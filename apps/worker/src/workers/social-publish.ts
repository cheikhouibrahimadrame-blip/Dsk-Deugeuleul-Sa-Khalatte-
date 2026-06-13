import { Worker } from "bullmq";
import { prisma } from "@dsk/db";
import { getAdapter, decryptToken, encryptToken } from "@dsk/integrations";
import { connection } from "../connection";
import { QUEUE_NAMES, socialPublishQueue, type SocialPublishJob } from "../queues";

const SWEEP_JOB = "sweep-queued";
const SWEEP_EVERY_MS = 15_000;

/**
 * Social publish worker.
 * The DB is the source of truth: the API marks posts QUEUED; a repeatable
 * sweep enqueues them (so the web app needs no Redis producer). Each post is
 * processed exactly once thanks to deterministic jobIds + status checks.
 */
export function startSocialPublishWorker() {
  const worker = new Worker(
    QUEUE_NAMES.socialPublish,
    async (job) => {
      if (job.name === SWEEP_JOB) {
        const queued = await prisma.socialPost.findMany({
          where: { status: "QUEUED" },
          select: { id: true },
          take: 20,
        });
        for (const post of queued) {
          await socialPublishQueue.add(
            "publish",
            { socialPostId: post.id } satisfies SocialPublishJob,
            { jobId: `publish:${post.id}:${Date.now()}` }
          );
        }
        return;
      }
      await publishPost((job.data as SocialPublishJob).socialPostId);
    },
    { connection, concurrency: 3 }
  );

  void socialPublishQueue.add(SWEEP_JOB, {} as never, {
    repeat: { every: SWEEP_EVERY_MS },
    jobId: "social-publish-sweep",
  });

  worker.on("failed", (job, err) => {
    console.error(`[social-publish] job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function publishPost(socialPostId: string) {
  const post = await prisma.socialPost.findUnique({
    where: { id: socialPostId },
    include: {
      integrationAccount: {
        include: { tokens: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });
  // Status check makes sweep + direct enqueue idempotent.
  if (!post || post.status !== "QUEUED") return;

  const token = post.integrationAccount.tokens[0];
  if (!token) {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "FAILED", lastError: "NO_TOKEN" },
    });
    return;
  }

  await prisma.socialPost.update({
    where: { id: post.id },
    data: { status: "PUBLISHING", attemptCount: { increment: 1 } },
  });

  const adapter = getAdapter(post.integrationAccount.provider);
  let accessToken = decryptToken(token.accessTokenEnc);

  // Refresh on expiry when the provider supports it (TikTok).
  if (token.expiresAt && token.expiresAt < new Date() && token.refreshTokenEnc) {
    try {
      const refreshed = await adapter.refreshToken(decryptToken(token.refreshTokenEnc));
      accessToken = refreshed.accessToken;
      await prisma.providerToken.update({
        where: { id: token.id },
        data: {
          accessTokenEnc: encryptToken(refreshed.accessToken),
          refreshTokenEnc: refreshed.refreshToken
            ? encryptToken(refreshed.refreshToken)
            : token.refreshTokenEnc,
          expiresAt: refreshed.expiresAt,
        },
      });
    } catch {
      await prisma.$transaction([
        prisma.socialPost.update({
          where: { id: post.id },
          data: { status: "FAILED", lastError: "TOKEN_EXPIRED" },
        }),
        prisma.integrationAccount.update({
          where: { id: post.integrationAccountId },
          data: { status: "EXPIRED" },
        }),
      ]);
      return;
    }
  }

  const result = await adapter.publish(
    accessToken,
    post.integrationAccount.externalAccountId,
    { content: post.content, mediaUrls: post.mediaUrls }
  );

  if (result.status === "PUBLISHED") {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: "PUBLISHED",
        externalPostId: result.externalPostId,
        publishedAt: new Date(),
        lastError: null,
      },
    });
  } else if (result.status === "PENDING") {
    // Async providers (TikTok): keep PUBLISHING; the webhook-events worker
    // completes it when the publish status event arrives.
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { externalPostId: result.externalRef },
    });
  } else {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "FAILED", lastError: result.error },
    });
  }
}
