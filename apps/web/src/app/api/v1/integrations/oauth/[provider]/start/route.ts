import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdapter } from "@dsk/integrations";
import { requireAuth } from "@/lib/auth/guards";
import { signOAuthState } from "@/lib/integrations/state";
import { handleApiError } from "@/lib/api";

const providerSchema = z.enum([
  "META_FACEBOOK_PAGE",
  "META_INSTAGRAM_PROFESSIONAL",
  "META_WHATSAPP_BUSINESS",
  "TIKTOK",
]);

/**
 * GET /api/v1/integrations/oauth/:provider/start
 * Starts the account connection flow: requires an authenticated session,
 * signs a CSRF state, and redirects to the provider's consent screen.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const user = await requireAuth();
    const { provider: rawProvider } = await params;
    const provider = providerSchema.parse(rawProvider);
    const locale = request.nextUrl.searchParams.get("locale") ?? "en";

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const redirectUri = `${base}/api/v1/integrations/oauth/${provider}/callback`;
    const state = signOAuthState({ userId: user.id, provider, locale });

    return NextResponse.redirect(getAdapter(provider).getAuthorizationUrl(state, redirectUri));
  } catch (error) {
    return handleApiError(error);
  }
}
