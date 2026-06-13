import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireHiddenAdmin } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

const querySchema = z.object({
  action: z.string().max(100).optional(), // prefix filter, e.g. "admin."
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/** GET /api/v1/admin/audit-logs - newest-first audit trail (ADMIN+). */
export async function GET(request: NextRequest) {
  try {
    await requireHiddenAdmin();
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const items = await prisma.auditLog.findMany({
      where: query.action ? { action: { startsWith: query.action } } : undefined,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
    });

    return jsonOk({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
