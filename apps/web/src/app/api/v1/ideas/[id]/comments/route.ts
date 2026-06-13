import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { createCommentSchema } from "@dsk/shared";
import { requireAuth } from "@/lib/auth/guards";
import { getOrCreateAnonymousIdentity } from "@/lib/services/anonymous";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/**
 * POST /api/v1/ideas/:id/comments
 * Posts an anonymous comment. Response exposes only the pseudonym.
 * Backend accountability: the AnonymousIdentity row links to the real user.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: ideaId } = await params;
    const input = createCommentSchema.parse(await request.json());

    const idea = await prisma.idea.findFirst({
      where: { id: ideaId, status: "PUBLISHED", deletedAt: null },
      select: { id: true, ownerId: true },
    });
    if (!idea) return jsonFail(404, "NOT_FOUND", "Idea not found.");

    const identity = await getOrCreateAnonymousIdentity(user.id, ideaId);

    const comment = await prisma.ideaComment.create({
      data: { ideaId, anonymousIdentityId: identity.id, body: input.body },
      select: {
        id: true,
        body: true,
        helpfulCount: true,
        unhelpfulCount: true,
        createdAt: true,
        anonymousIdentity: { select: { displayCode: true } },
      },
    });

    // Notify the idea owner (skip self-comments).
    if (idea.ownerId !== user.id) {
      await prisma.notification.create({
        data: {
          userId: idea.ownerId,
          type: "COMMENT_ON_IDEA",
          payload: { ideaId, commentId: comment.id },
        },
      });
    }

    return jsonOk(comment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
