import { Worker } from "bullmq";
import { prisma } from "@dsk/db";
import { connection } from "../connection";
import { QUEUE_NAMES, webhookProcessingQueue } from "../queues";

const SWEEP_EVERY_MS = 10_000;

/**
 * Webhook event processor.
 * Ingestion (signature verification + persistence) happens at the edge in the
 * web app; this worker handles business logic asynchronously so webhook
 * endpoints always answer fast.
 *
 * Currently implemented: TikTok publish completion. Meta event routing
 * (messages, comments) lands with the Meta deep-dive batch.
 */
export function startWebhookEventsWorker() {
  const worker = new Worker(
    QUEUE_NAMES.webhookProcessing,
    async () => {
      const events = await prisma.webhookEvent.findMany({
        where: { status: "RECEIVED" },
        orderBy: { receivedAt: "asc" },
        take: 20,
      });

      for (const event of events) {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: { status: "PROCESSING" },
        });
        try {
          const handled = await handleEvent(event.provider, event.eventType, event.payload);
          await prisma.webhookEvent.update({
            where: { id: event.id },
            data: { status: handled ? "PROCESSED" : "IGNORED", processedAt: new Date() },
          });
        } catch (error) {
          await prisma.webhookEvent.update({
            where: { id: event.id },
            data: { status: "FAILED", error: error instanceof Error ? error.message : "unknown" },
          });
        }
      }
    },
    { connection, concurrency: 1 }
  );

  void webhookProcessingQueue.add("webhook-sweep", {} as never, {
    repeat: { every: SWEEP_EVERY_MS },
    jobId: "webhook-events-sweep",
  });

  worker.on("failed", (job, err) => {
    console.error(`[webhook-events] job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function handleEvent(
  provider: string,
  eventType: string,
  payload: unknown
): Promise<boolean> {
  if (provider === "TIKTOK" && eventType === "post.publish.complete") {
    const data = payload as { publish_id?: string };
    if (!data.publish_id) return false;
    await prisma.socialPost.updateMany({
      where: { externalPostId: data.publish_id, status: "PUBLISHING" },
      data: { status: "PUBLISHED", publishedAt: new Date(), lastError: null },
    });
    return true;
  }
  if (provider === "TIKTOK" && eventType === "post.publish.failed") {
    const data = payload as { publish_id?: string; reason?: string };
    if (!data.publish_id) return false;
    await prisma.socialPost.updateMany({
      where: { externalPostId: data.publish_id, status: "PUBLISHING" },
      data: { status: "FAILED", lastError: data.reason ?? "TIKTOK_PUBLISH_FAILED" },
    });
    return true;
  }
  if (provider.startsWith("META_")) {
    return handleMetaEvent(provider, payload);
  }
  return false;
}

/**
 * Meta webhook routing (entry/changes envelope shared by FB, IG, WhatsApp).
 * WhatsApp message statuses, IG comments, and FB feed changes all land here.
 * MVP: each change is recorded on the audit trail; product-level handlers
 * (e.g. surfacing IG comments in-app) attach per field as features ship.
 */
async function handleMetaEvent(provider: string, payload: unknown): Promise<boolean> {
  const body = payload as {
    entry?: Array<{
      id?: string;
      changes?: Array<{ field?: string; value?: unknown }>;
    }>;
  };
  if (!body.entry?.length) return false;

  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      await prisma.auditLog.create({
        data: {
          action: `webhook.${provider.toLowerCase()}.${change.field ?? "unknown"}`,
          targetType: "INTEGRATION_ACCOUNT",
          targetId: entry.id ?? null,
          metadata: (change.value as object | undefined) ?? undefined,
        },
      });
    }
  }
  return true;
}
