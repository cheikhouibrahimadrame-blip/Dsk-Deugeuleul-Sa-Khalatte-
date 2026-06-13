import { prisma } from "@dsk/db";
import { requireAuth } from "@/lib/auth/guards";
import { CAPABILITY_MATRIX } from "@dsk/integrations";
import { jsonOk, handleApiError } from "@/lib/api";

/**
 * GET /api/v1/integrations
 * Lists the user's connected accounts + every provider with its capability
 * matrix so the settings UI is fully API-driven. Tokens are NEVER returned.
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const accounts = await prisma.integrationAccount.findMany({
      where: { ownerUserId: user.id, revokedAt: null },
      select: {
        id: true,
        provider: true,
        displayName: true,
        status: true,
        scopes: true,
        connectedAt: true,
      },
    });

    return jsonOk({
      accounts,
      providers: Object.entries(CAPABILITY_MATRIX).map(([provider, capabilities]) => ({
        provider,
        capabilities,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
