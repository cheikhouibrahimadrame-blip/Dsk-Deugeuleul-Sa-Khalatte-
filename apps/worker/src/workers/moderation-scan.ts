import { Worker } from "bullmq";
import { prisma } from "@dsk/db";
import { scoreText } from "@dsk/shared";
import { connection } from "../connection";
import { QUEUE_NAMES, moderationScanQueue, type ModerationScanJob } from "../queues";

const SWEEP_EVERY_MS = 5 * 60 * 1000;
const SWEEP_LOOKBACK_MS = 15 * 60 * 1000;
const SWEEP_JOB = "scan-sweep";

// scoreText lives in @dsk/shared (pure, unit-tested); a future
// toxicity-scoring service replaces it behind the same shape.

/**
 * Moderation scan worker.
 * Direct jobs scan a single target; a 5-minute sweep covers recent comments
 * as the safety net. Scans are idempotent (one audit record per target).
 * Flagged content becomes a system report for the moderation queue -
 * humans decide, the scanner never auto-removes content.
 */
export function startModerationScanWorker() {
  const worker = new Worker(
    QUEUE_NAMES.moderationScan,
    async (job) => {
      if (job.name === SWEEP_JOB) {
        await sweepRecentComments();
        return;
      }
      const { targetType, targetId } = job.data as ModerationScanJob;
      await scanTarget(targetType, targetId);
    },
    { connection, concurrency: 2 }
  );

  void moderationScanQueue.add(
    SWEEP_JOB,
    { targetType: "COMMENT", targetId: "*" },
    { repeat: { every: SWEEP_EVERY_MS }, jobId: "moderation-scan-sweep" }
  );

  worker.on("failed", (job, err) => {
    console.error(`[moderation-scan] job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function sweepRecentComments() {
  const since = new Date(Date.now() - SWEEP_LOOKBACK_MS);
  const comments = await prisma.ideaComment.findMany({
    where: { createdAt: { gte: since }, status: "VISIBLE", deletedAt: null },
    select: { id: true },
    take: 100,
  });
  for (const comment of comments) {
    await scanTarget("COMMENT", comment.id);
  }
}

async function scanTarget(
  targetType: ModerationScanJob["targetType"],
  targetId: string
) {
  // Idempotency: one scan record per target.
  const already = await prisma.auditLog.findFirst({
    where: { action: "moderation.scan", targetType, targetId },
    select: { id: true },
  });
  if (already) return;

  let text: string | null = null;
  if (targetType === "COMMENT") {
    const comment = await prisma.ideaComment.findUnique({
      where: { id: targetId },
      select: { body: true },
    });
    text = comment?.body ?? null;
  } else if (targetType === "GROUP_MESSAGE") {
    const message = await prisma.groupMessage.findUnique({
      where: { id: targetId },
      select: { body: true },
    });
    text = message?.body ?? null;
  } else if (targetType === "IDEA") {
    const idea = await prisma.idea.findUnique({
      where: { id: targetId },
      select: { title: true, description: true },
    });
    text = idea ? `${idea.title}\n${idea.description}` : null;
  }
  if (text === null) return;

  const result = scoreText(text);
  await prisma.auditLog.create({
    data: {
      action: "moderation.scan",
      targetType,
      targetId,
      metadata: { flagged: result.flagged, reasons: result.reasons },
    },
  });

  if (!result.flagged) return;

  // Surface in the moderation queue as a system-filed report. Reports need a
  // reporter: use an admin account (seeded); if none exists yet, the audit
  // record above still preserves the flag.
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
    select: { id: true },
  });
  if (!admin) return;

  await prisma.report.create({
    data: {
      reporterId: admin.id,
      targetType,
      targetId,
      reason: "AUTO_FLAGGED",
      details: result.reasons.join(", "),
    },
  });
}
