import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { createCollaborationRequestSchema } from "@dsk/shared";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/**
 * POST /api/v1/ideas/:id/collaboration-requests - "Work Together" CTA.
 * Duplicate-proof via unique(ideaId, requesterId). Owners cannot request
 * collaboration on their own idea.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: ideaId } = await params;
    const input = createCollaborationRequestSchema.parse(await request.json());

    const idea = await prisma.idea.findFirst({
      where: { id: ideaId, status: "PUBLISHED", deletedAt: null },
      select: { id: true, ownerId: true, title: true },
    });
    if (!idea) return jsonFail(404, "NOT_FOUND", "Idea not found.");
    if (idea.ownerId === user.id) {
      return jsonFail(400, "OWN_IDEA", "You cannot request collaboration on your own idea.");
    }

    try {
      const collabRequest = await prisma.collaborationRequest.create({
        data: {
          ideaId,
          requesterId: user.id,
          message: input.message,
          skillsOffer: input.skillsOffer,
        },
        select: { id: true, status: true, createdAt: true },
      });

      await prisma.notification.create({
        data: {
          userId: idea.ownerId,
          type: "COLLAB_REQUEST_RECEIVED",
          payload: { ideaId, ideaTitle: idea.title, requestId: collabRequest.id },
        },
      });

      return jsonOk(collabRequest, { status: 201 });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "P2002") {
        return jsonFail(409, "ALREADY_REQUESTED", "You already sent a request for this idea.");
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
