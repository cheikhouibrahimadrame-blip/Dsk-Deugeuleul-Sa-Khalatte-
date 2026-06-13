import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

const querySchema = z.object({
  box: z.enum(["received", "sent"]).default("received"),
});

/**
 * GET /api/v1/collaboration-requests?box=received|sent
 * received: requests on MY ideas (owner inbox).
 * sent: requests I made on others' ideas.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { box } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where =
      box === "received"
        ? { idea: { ownerId: user.id } }
        : { requesterId: user.id };

    const requests = await prisma.collaborationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        message: true,
        skillsOffer: true,
        status: true,
        createdAt: true,
        idea: { select: { id: true, title: true } },
        // Requester identity is visible to the idea owner: collaboration is
        // NOT anonymous (only feedback comments are).
        requester: {
          select: { id: true, name: true, image: true, profile: { select: { headline: true, skills: true } } },
        },
      },
    });

    return jsonOk({ items: requests });
  } catch (error) {
    return handleApiError(error);
  }
}
