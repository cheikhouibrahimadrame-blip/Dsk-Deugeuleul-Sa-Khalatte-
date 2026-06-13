import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { commentFeedbackSchema } from "@dsk/shared";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/**
 * POST /api/v1/comments/:id/feedback - mark a comment HELPFUL or UNHELPFUL.
 * One vote per user per type, enforced by the Reaction unique constraint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: commentId } = await params;
    const { action } = commentFeedbackSchema.parse(await request.json());

    const comment = await prisma.ideaComment.findFirst({
      where: { id: commentId, status: "VISIBLE", deletedAt: null },
      select: { id: true },
    });
    if (!comment) return jsonFail(404, "NOT_FOUND", "Comment not found.");

    const counterField = action === "HELPFUL" ? "helpfulCount" : "unhelpfulCount";

    try {
      const [, updated] = await prisma.$transaction([
        prisma.reaction.create({
          data: { userId: user.id, commentId, type: action },
        }),
        prisma.ideaComment.update({
          where: { id: commentId },
          data: { [counterField]: { increment: 1 } },
          select: { id: true, helpfulCount: true, unhelpfulCount: true },
        }),
      ]);
      return jsonOk(updated);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "P2002") {
        return jsonFail(409, "ALREADY_VOTED", "You already gave this feedback.");
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
