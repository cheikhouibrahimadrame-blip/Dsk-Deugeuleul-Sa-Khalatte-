import { prisma } from "@dsk/db";
import { getAdapter, decryptToken } from "@dsk/integrations";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/**
 * GET /api/v1/integrations/pending/:id/assets
 * Lists the Meta assets (pages / IG accounts / WABAs) the user can connect.
 * Asset-scoped tokens are stripped - they never reach the browser.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

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

    const assets = await adapter.listAssets(decryptToken(pending.userTokenEnc));
    return jsonOk({
      provider: pending.provider,
      assets: assets.map(({ externalAccountId, displayName }) => ({
        externalAccountId,
        displayName,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
