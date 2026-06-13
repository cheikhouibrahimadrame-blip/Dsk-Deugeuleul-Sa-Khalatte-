import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireHiddenAdmin, AuthError } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

const verifySchema = z.object({
  verification: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().min(2).max(500).default("Verification review"),
});

/** PATCH /api/v1/admin/organizations/:id - decide verification (ADMIN+). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireHiddenAdmin();
    const { id } = await params;
    const input = verifySchema.parse(await request.json());

    const org = await prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new AuthError(404, "NOT_FOUND");

    await prisma.$transaction([
      prisma.organization.update({
        where: { id },
        data: { verification: input.verification },
      }),
      prisma.moderationAction.create({
        data: {
          moderatorId: actor.id,
          targetType: "ORGANIZATION",
          targetId: id,
          action:
            input.verification === "VERIFIED"
              ? "VERIFY_ORGANIZATION"
              : "REJECT_ORGANIZATION",
          reason: input.reason,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: "admin.organization.verify",
          targetType: "ORGANIZATION",
          targetId: id,
          metadata: { verification: input.verification },
        },
      }),
    ]);

    return jsonOk({ id, verification: input.verification });
  } catch (error) {
    return handleApiError(error);
  }
}
