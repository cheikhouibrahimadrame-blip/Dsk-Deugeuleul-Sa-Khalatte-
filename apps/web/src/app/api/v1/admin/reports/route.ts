import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireHiddenRole } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

const querySchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]).default("OPEN"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /api/v1/admin/reports - moderation reports queue (MODERATOR+). */
export async function GET(request: NextRequest) {
  try {
    await requireHiddenRole("MODERATOR");
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const items = await prisma.report.findMany({
      where: { status: query.status },
      orderBy: { createdAt: "asc" }, // oldest first: FIFO queue
      take: query.limit,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        details: true,
        status: true,
        createdAt: true,
        reporter: { select: { id: true, name: true } },
      },
    });

    return jsonOk({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
