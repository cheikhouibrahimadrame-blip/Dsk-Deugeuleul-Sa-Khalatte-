import { prisma } from "@dsk/db";
import { requireHiddenAdmin } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/**
 * GET /api/v1/admin/integrations-health - platform-wide integration status:
 * account counts by status, recent webhook failures, recent publish failures.
 */
export async function GET() {
  try {
    await requireHiddenAdmin();

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [accountsByStatus, webhookFailures, publishFailures] = await Promise.all([
      prisma.integrationAccount.groupBy({
        by: ["provider", "status"],
        _count: { _all: true },
      }),
      prisma.webhookEvent.count({
        where: { status: "FAILED", receivedAt: { gte: since } },
      }),
      prisma.socialPost.count({
        where: { status: "FAILED", updatedAt: { gte: since } },
      }),
    ]);

    return jsonOk({
      accounts: accountsByStatus.map((row) => ({
        provider: row.provider,
        status: row.status,
        count: row._count._all,
      })),
      last7Days: { webhookFailures, publishFailures },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
