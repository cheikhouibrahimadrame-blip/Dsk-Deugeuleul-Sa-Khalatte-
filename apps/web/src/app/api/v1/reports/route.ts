import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { createReportSchema } from "@dsk/shared";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/** POST /api/v1/reports - file a report against any content type. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const input = createReportSchema.parse(await request.json());

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details,
      },
      select: { id: true, status: true, createdAt: true },
    });

    return jsonOk(report, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
