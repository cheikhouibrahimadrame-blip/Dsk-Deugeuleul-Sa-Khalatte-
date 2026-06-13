import { NextRequest } from "next/server";
import { decideCollaborationRequestSchema } from "@dsk/shared";
import { requireAuth } from "@/lib/auth/guards";
import { decideCollaborationRequest, GroupFullError, InvalidDecisionError } from "@/lib/services/groups";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/**
 * POST /api/v1/collaboration-requests/:id/decision
 * Idea owner accepts / rejects / saves a request.
 * ACCEPTED creates the private group (max 10 members) and adds the requester.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { decision } = decideCollaborationRequestSchema.parse(await request.json());

    try {
      const result = await decideCollaborationRequest(id, user.id, decision);
      return jsonOk(result);
    } catch (error) {
      if (error instanceof GroupFullError) {
        return jsonFail(409, "GROUP_FULL", "This group already has the maximum of 10 members.");
      }
      if (error instanceof InvalidDecisionError) {
        const status = error.message === "NOT_IDEA_OWNER" ? 403 : 409;
        return jsonFail(status, error.message, "Invalid decision.");
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
