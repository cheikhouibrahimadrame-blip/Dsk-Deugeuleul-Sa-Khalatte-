import { prisma } from "@dsk/db";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/**
 * GET /api/v1/ideas/:id - public idea detail.
 * Comments are returned with the anonymous displayCode ONLY.
 * The underlying userId is never exposed here (backend accountability only).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await prisma.idea.findFirst({
      where: { id, status: "PUBLISHED", deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        language: true,
        publishedAt: true,
        owner: { select: { id: true, name: true, image: true } },
        comments: {
          where: { status: "VISIBLE", deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            helpfulCount: true,
            unhelpfulCount: true,
            createdAt: true,
            anonymousIdentity: { select: { displayCode: true } },
          },
        },
        _count: { select: { reactions: true, collaborationRequests: true } },
      },
    });

    if (!idea) return jsonFail(404, "NOT_FOUND", "Idea not found.");
    return jsonOk(idea);
  } catch (error) {
    return handleApiError(error);
  }
}
