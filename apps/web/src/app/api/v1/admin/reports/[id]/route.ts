import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireHiddenRole, AuthError } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

const decisionSchema = z.object({
  action: z.enum(["HIDE_CONTENT", "REMOVE_CONTENT", "RESTORE_CONTENT", "DISMISS"]),
  reason: z.string().min(2).max(500).default("Moderation decision"),
});

/**
 * POST /api/v1/admin/reports/:id - decide a report (MODERATOR+).
 * Applies the content change, records a ModerationAction, resolves the
 * report, and audit-logs - all in one transaction.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const moderator = await requireHiddenRole("MODERATOR");
    const { id } = await params;
    const input = decisionSchema.parse(await request.json());

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.status === "RESOLVED" || report.status === "DISMISSED") {
      throw new AuthError(404, "NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      // Apply the content change for supported target types.
      if (input.action !== "DISMISS") {
        if (report.targetType === "COMMENT") {
          await tx.ideaComment.update({
            where: { id: report.targetId },
            data: {
              status:
                input.action === "HIDE_CONTENT"
                  ? "HIDDEN_BY_MODERATION"
                  : input.action === "REMOVE_CONTENT"
                    ? "REMOVED"
                    : "VISIBLE",
            },
          });
        } else if (report.targetType === "GROUP_MESSAGE") {
          await tx.groupMessage.update({
            where: { id: report.targetId },
            data: {
              deletedAt: input.action === "RESTORE_CONTENT" ? null : new Date(),
              pinnedAt: null,
            },
          });
        } else if (report.targetType === "IDEA") {
          await tx.idea.update({
            where: { id: report.targetId },
            data: {
              deletedAt:
                input.action === "REMOVE_CONTENT" ? new Date() : null,
              status: input.action === "HIDE_CONTENT" ? "ARCHIVED" : undefined,
            },
          });
        }

        await tx.moderationAction.create({
          data: {
            moderatorId: moderator.id,
            reportId: report.id,
            targetType: report.targetType,
            targetId: report.targetId,
            action: input.action,
            reason: input.reason,
          },
        });
      }

      await tx.report.update({
        where: { id: report.id },
        data: {
          status: input.action === "DISMISS" ? "DISMISSED" : "RESOLVED",
          resolvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: moderator.id,
          action: "admin.report.decide",
          targetType: report.targetType,
          targetId: report.targetId,
          metadata: { reportId: report.id, decision: input.action },
        },
      });
    });

    return jsonOk({ id: report.id, decided: true });
  } catch (error) {
    return handleApiError(error);
  }
}
