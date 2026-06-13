import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { getAdapter, decryptToken, encryptToken } from "@dsk/integrations";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

const selectSchema = z.object({ externalAccountId: z.string().min(1) });

/**
 * POST /api/v1/integrations/pending/:id/select
 * Finalizes a Meta connection: re-lists assets server-side (the client only
 * ever sends an id, never a token), stores the asset-scoped token when the
 * platform issues one (Facebook Page token), and deletes the pending row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const input = selectSchema.parse(await request.json());

    const pending = await prisma.pendingProviderConnection.findFirst({
      where: { id, userId: user.id, expiresAt: { gt: new Date() } },
    });
    if (!pending) {
      return jsonFail(404, "NOT_FOUND", "Pending connection not found or expired.");
    }

    const adapter = getAdapter(pending.provider);
    if (!adapter.listAssets) {
      return jsonFail(400, "NOT_SUPPORTED", "This provider has no asset selection step.");
    }

    const userToken = decryptToken(pending.userTokenEnc);
    const assets = await adapter.listAssets(userToken);
    const asset = assets.find((a) => a.externalAccountId === input.externalAccountId);
    if (!asset) {
      return jsonFail(404, "ASSET_NOT_FOUND", "Selected account is not available.");
    }

    // Facebook issues page-scoped tokens; IG and WhatsApp use the user token.
    const tokenToStore = asset.assetToken ?? userToken;

    const account = await prisma.$transaction(async (tx) => {
      const upserted = await tx.integrationAccount.upsert({
        where: {
          provider_externalAccountId: {
            provider: pending.provider,
            externalAccountId: asset.externalAccountId,
          },
        },
        create: {
          provider: pending.provider,
          externalAccountId: asset.externalAccountId,
          displayName: asset.displayName,
          ownerUserId: user.id,
          status: "CONNECTED",
        },
        update: {
          status: "CONNECTED",
          revokedAt: null,
          displayName: asset.displayName,
          ownerUserId: user.id,
        },
      });

      await tx.providerToken.deleteMany({
        where: { integrationAccountId: upserted.id },
      });
      await tx.providerToken.create({
        data: {
          integrationAccountId: upserted.id,
          accessTokenEnc: encryptToken(tokenToStore),
          // Long-lived Meta tokens have no refresh grant; expiry handled by
          // EXPIRED status + reconnect.
          expiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "integration.connect",
          targetType: "INTEGRATION_ACCOUNT",
          targetId: upserted.id,
          metadata: { provider: pending.provider, asset: asset.externalAccountId },
        },
      });

      await tx.pendingProviderConnection.delete({ where: { id: pending.id } });
      return upserted;
    });

    return jsonOk(
      { id: account.id, provider: account.provider, displayName: account.displayName },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
