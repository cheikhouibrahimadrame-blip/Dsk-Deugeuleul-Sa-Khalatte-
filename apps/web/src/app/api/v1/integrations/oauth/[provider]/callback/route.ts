import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { getAdapter, encryptToken } from "@dsk/integrations";
import { verifyOAuthState } from "@/lib/integrations/state";

const providerSchema = z.enum([
  "META_FACEBOOK_PAGE",
  "META_INSTAGRAM_PROFESSIONAL",
  "META_WHATSAPP_BUSINESS",
  "TIKTOK",
]);

const META_PROVIDERS = new Set([
  "META_FACEBOOK_PAGE",
  "META_INSTAGRAM_PROFESSIONAL",
  "META_WHATSAPP_BUSINESS",
]);

const PENDING_TTL_MS = 15 * 60 * 1000;

/**
 * GET /api/v1/integrations/oauth/:provider/callback
 * Verifies state and exchanges the code.
 * - Meta providers: two-step - store the encrypted long-lived user token as a
 *   PendingProviderConnection and send the user to the asset picker.
 * - TikTok: single-step - finalize account + tokens immediately.
 * Errors redirect with a query flag - never expose provider errors raw.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const search = request.nextUrl.searchParams;
  const state = search.get("state");
  const verified = state ? verifyOAuthState(state) : null;
  const settingsPath = (locale: string) => `${base}/${locale}/app/settings/integrations`;

  const { provider: rawProvider } = await params;
  const parsed = providerSchema.safeParse(rawProvider);

  if (!verified || !parsed.success || verified.provider !== parsed.data) {
    return NextResponse.redirect(`${settingsPath(verified?.locale ?? "en")}?error=state`);
  }
  const provider = parsed.data;

  const code = search.get("code");
  if (!code) {
    // User denied consent at the provider.
    return NextResponse.redirect(`${settingsPath(verified.locale)}?error=denied`);
  }

  try {
    const adapter = getAdapter(provider);
    const redirectUri = `${base}/api/v1/integrations/oauth/${provider}/callback`;
    const result = await adapter.exchangeCode(code, redirectUri);

    if (META_PROVIDERS.has(provider)) {
      const pending = await prisma.pendingProviderConnection.create({
        data: {
          userId: verified.userId,
          provider,
          userTokenEnc: encryptToken(result.accessToken),
          expiresAt: new Date(Date.now() + PENDING_TTL_MS),
        },
      });
      return NextResponse.redirect(
        `${settingsPath(verified.locale)}?pending=${pending.id}`
      );
    }

    // Single-step providers (TikTok): finalize immediately.
    await prisma.$transaction(async (tx) => {
      const account = await tx.integrationAccount.upsert({
        where: {
          provider_externalAccountId: {
            provider,
            externalAccountId: result.externalAccountId,
          },
        },
        create: {
          provider,
          externalAccountId: result.externalAccountId,
          displayName: result.displayName,
          ownerUserId: verified.userId,
          scopes: result.scopes,
          status: "CONNECTED",
        },
        update: {
          status: "CONNECTED",
          revokedAt: null,
          scopes: result.scopes,
          ownerUserId: verified.userId,
        },
      });

      await tx.providerToken.deleteMany({ where: { integrationAccountId: account.id } });
      await tx.providerToken.create({
        data: {
          integrationAccountId: account.id,
          accessTokenEnc: encryptToken(result.accessToken),
          refreshTokenEnc: result.refreshToken ? encryptToken(result.refreshToken) : null,
          expiresAt: result.expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: verified.userId,
          action: "integration.connect",
          targetType: "INTEGRATION_ACCOUNT",
          targetId: account.id,
          metadata: { provider },
        },
      });
    });

    return NextResponse.redirect(`${settingsPath(verified.locale)}?connected=${provider}`);
  } catch (error) {
    console.error("[oauth:callback]", error);
    return NextResponse.redirect(`${settingsPath(verified.locale)}?error=exchange`);
  }
}
