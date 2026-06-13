import { Queue } from "bullmq";
import { connection } from "./connection";

/**
 * Canonical queue registry.
 * Names are stable identifiers; never rename without a migration plan.
 */
export const QUEUE_NAMES = {
  notifications: "notifications",
  emails: "emails",
  moderationScan: "moderation-scan",
  socialPublish: "social-publish",
  analyticsSync: "analytics-sync",
  tokenRefresh: "token-refresh",
  webhookProcessing: "webhook-processing",
  tiktokStatus: "tiktok-status",
} as const;

// --- Job payload shapes ---

export type NotificationFanoutJob = {
  /** Recipient user ids. */
  userIds: string[];
  type: string; // NotificationType enum value
  payload: Record<string, unknown>;
};

export type EmailJob = {
  to: string;
  template: string;
  locale: "en" | "fr";
  vars: Record<string, string>;
};

export type SocialPublishJob = {
  socialPostId: string;
};

export type ModerationScanJob = {
  targetType: "COMMENT" | "IDEA" | "GROUP_MESSAGE";
  targetId: string;
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { age: 60 * 60 * 24 },
  removeOnFail: false, // keep failed jobs for inspection (acts as dead-letter)
};

export const notificationsQueue = new Queue<NotificationFanoutJob>(
  QUEUE_NAMES.notifications,
  { connection, defaultJobOptions }
);

export const emailsQueue = new Queue<EmailJob>(QUEUE_NAMES.emails, {
  connection,
  defaultJobOptions,
});

export const socialPublishQueue = new Queue<SocialPublishJob>(
  QUEUE_NAMES.socialPublish,
  { connection, defaultJobOptions }
);

export const moderationScanQueue = new Queue<ModerationScanJob>(
  QUEUE_NAMES.moderationScan,
  { connection, defaultJobOptions }
);

export const tokenRefreshQueue = new Queue(QUEUE_NAMES.tokenRefresh, {
  connection,
  defaultJobOptions,
});

export const webhookProcessingQueue = new Queue(QUEUE_NAMES.webhookProcessing, {
  connection,
  defaultJobOptions,
});

export const analyticsSyncQueue = new Queue(QUEUE_NAMES.analyticsSync, {
  connection,
  defaultJobOptions,
});

export const tiktokStatusQueue = new Queue(QUEUE_NAMES.tiktokStatus, {
  connection,
  defaultJobOptions,
});
