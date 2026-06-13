import { Worker } from "bullmq";
import { prisma } from "@dsk/db";
import { TikTokAdapter, decryptToken } from "@dsk/integrations";
import { connection } from "../connection";
import { QUEUE_NAMES, tiktokStatusQueue } from "../queues";

const SWEEP_EVERY_MS = 60_000;
const TIMEOUT_MS = 24 * 60 * 60 * 1000; // give up after 24h in PUBLISHING

const tiktok = new TikTokAdapter();

/**
 * TikTok publish status poller.
 * TikTok publishing is async: posts park at PUBLISHING with the publish_id in
 * externalPostId. Webhooks complete most of them; this poller is the reliable
 * fallback for missed webhooks and the source of the final video id.
 */
export function startTikTokStatusWorker() {
  const worker = new Worker(
    QUEUE_NAMES.tiktokStatus,
    async () => {
      const posts = await prisma.socialPost.findMany({
        where: {
          status: "PUBLISHING",
          externalPostId: { not: null },
          integrationAccount: {
            provider: "TIKTOK",
            status: "CONNECTED",
            revokedAt: null,
          },
        },
        include: {
          integrationAccount: {
            include: { tokens: { orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
        take: 20,
      });

      for (const post of posts) {
        const token = post.integrationAccount.tokens[0];
        if (!token) continue;

        try {
          const result = await tiktok.fetchPublishStatus(
            decryptToken(token.accessTokenEnc),
            post.externalPostId!
          );

          if (result.state === "PUBLISHED") {
            await prisma.socialPost.update({
              where: { id: post.id },
              data: {
                status: "PUBLISHED",
                externalPostId: result.externalPostId,
                publishedAt: new Date(),
                lastError: null,
              },
            });
          } else if (result.state === "FAILED") {
            await prisma.socialPost.update({
              where: { id: post.id },
              data: { status: "FAILED", lastError: result.reason },
            });
          } else if (Date.now() - post.updatedAt.getTime() > TIMEOUT_MS) {
            await prisma.socialPost.update({
              where: { id: post.id },
              data: { status: "FAILED", lastError: "TIKTOK_STATUS_TIMEOUT" },
            });
          }
        } catch (error) {
          console.error(`[tiktok-status] post ${post.id} failed:`, error);
        }
      }
    },
    { connection, concurrency: 1 }
  );

  void tiktokStatusQueue.add("status-sweep", {} as never, {
    repeat: { every: SWEEP_EVERY_MS },
    jobId: "tiktok-status-sweep",
  });

  worker.on("failed", (job, err) => {
    console.error(`[tiktok-status] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
