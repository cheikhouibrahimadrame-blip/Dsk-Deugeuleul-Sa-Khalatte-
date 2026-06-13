import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireAuth } from "@/lib/auth/guards";
import { CAPABILITY_MATRIX } from "@dsk/integrations";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

const createSocialPostSchema = z.object({
  integrationAccountId: z.string().min(1),
  ideaId: z.string().optional(),
  content: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string().url()).max(4).default([]),
});

/** GET /api/v1/social-posts - the user's posts across providers. */
export async function GET() {
  try {
    const user = await requireAuth();
    const posts = await prisma.socialPost.findMany({
      where: { integrationAccount: { ownerUserId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        content: true,
        status: true,
        externalPostId: true,
        publishedAt: true,
        lastError: true,
        createdAt: true,
        integrationAccount: { select: { provider: true, displayName: true } },
        idea: { select: { id: true, title: true } },
      },
    });
    return jsonOk({ items: posts });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/social-posts - queue a post for publishing.
 * Validates against the provider capability matrix before queueing.
 * Actual publishing happens in the social-publish worker.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const input = createSocialPostSchema.parse(await request.json());

    const account = await prisma.integrationAccount.findFirst({
      where: {
        id: input.integrationAccountId,
        ownerUserId: user.id,
        status: "CONNECTED",
        revokedAt: null,
      },
    });
    if (!account) return jsonFail(404, "NOT_FOUND", "Connected account not found.");

    const capabilities = CAPABILITY_MATRIX[account.provider];
    if (!capabilities.publish) {
      return jsonFail(400, "PUBLISH_NOT_SUPPORTED", "This provider does not support publishing.");
    }
    if (capabilities.requiresMedia && input.mediaUrls.length === 0) {
      return jsonFail(400, "MEDIA_REQUIRED", "This provider requires at least one media file.");
    }

    const post = await prisma.socialPost.create({
      data: {
        integrationAccountId: account.id,
        ideaId: input.ideaId,
        content: input.content,
        mediaUrls: input.mediaUrls,
        status: "QUEUED",
      },
      select: { id: true, status: true, createdAt: true },
    });

    // The social-publish BullMQ worker picks QUEUED posts up
    // (enqueue call wired in the worker batch to avoid a Redis dependency here).
    return jsonOk(post, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
