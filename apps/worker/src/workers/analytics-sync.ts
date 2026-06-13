import { Worker } from "bullmq";
import { prisma } from "@dsk/db";
import { getAdapter, decryptToken } from "@dsk/integrations";
import { connection } from "../connection";
import { QUEUE_NAMES, analyticsSyncQueue } from "../queues";

const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000; // every 6 hours
const LOOKBACK_DAYS = 30;

/**
 * Analytics sync worker.
 * Captures point-in-time AnalyticsSnapshot rows for recently published posts
 * on providers that expose post metrics (Facebook Pages, Instagram).
 * Per-post failures are logged and skipped - one bad token never blocks the
 * whole sweep.
 */
export function startAnalyticsSyncWorker() {
  const worker = new Worker(
    QUEUE_NAMES.analyticsSync,
    async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      const posts = await prisma.socialPost.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { gte: since },
          externalPostId: { not: null },
          integrationAccount: { status: "CONNECTED", revokedAt: null },
        },
        include: {
          integrationAccount: {
            include: { tokens: { orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
        take: 100,
      });

      for (const post of posts) {
        const adapter = getAdapter(post.integrationAccount.provider);
        const token = post.integrationAccount.tokens[0];
        if (!adapter.fetchPostMetrics || !token) continue;

        try {
          const metrics = await adapter.fetchPostMetrics(
            decryptToken(token.accessTokenEnc),
            post.integrationAccount.externalAccountId,
            post.externalPostId!
          );
          await prisma.analyticsSnapshot.create({
            data: {
              integrationAccountId: post.integrationAccountId,
              socialPostId: post.id,
              metrics,
            },
          });
        } catch (error) {
          console.error(`[analytics-sync] post ${post.id} failed:`, error);
        }
      }
    },
    { connection, concurrency: 1 }
  );

  void analyticsSyncQueue.add("analytics-sweep", {} as never, {
    repeat: { every: SWEEP_EVERY_MS },
    jobId: "analytics-sync-sweep",
  });

  worker.on("failed", (job, err) => {
    console.error(`[analytics-sync] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
