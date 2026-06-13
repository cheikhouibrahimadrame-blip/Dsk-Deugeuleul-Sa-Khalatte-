import { prisma } from "@dsk/db";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/**
 * DELETE /api/v1/integrations/:id - disconnect an account.
 * Marks revoked and deletes stored tokens. Audit-logged.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const account = await prisma.integrationAccount.findFirst({
      where: { id, ownerUserId: user.id },
    });
    if (!account) return jsonFail(404, "NOT_FOUND", "Integration not found.");

    await prisma.$transaction([
      prisma.providerToken.deleteMany({ where: { integrationAccountId: id } }),
      prisma.integrationAccount.update({
        where: { id },
        data: { status: "REVOKED", revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "integration.disconnect",
          targetType: "INTEGRATION_ACCOUNT",
          targetId: id,
          metadata: { provider: account.provider },
        },
      }),
    ]);

    return jsonOk({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
}
