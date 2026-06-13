import { Worker } from "bullmq";
import { prisma, NotificationType } from "@dsk/db";
import { connection } from "../connection";
import {
  QUEUE_NAMES,
  emailsQueue,
  type EmailJob,
  type NotificationFanoutJob,
} from "../queues";

/**
 * Notification types that also fan out to the email channel.
 * Template keys map to the i18n "emails" namespace.
 */
const EMAIL_TEMPLATES: Partial<Record<NotificationType, string>> = {
  COLLAB_REQUEST_ACCEPTED: "collabAccepted",
};

/**
 * Notification fanout worker.
 * Always persists one in-app Notification row per recipient, then fans out
 * to additional channels:
 * - Email: high-signal types only, verified addresses only, recipient locale.
 * - WhatsApp: attaches here once Profile stores an opted-in phone number
 *   (template messaging policy); see WhatsAppBusinessAdapter.sendTemplateMessage.
 */
export function startNotificationsWorker() {
  const worker = new Worker<NotificationFanoutJob>(
    QUEUE_NAMES.notifications,
    async (job) => {
      const { userIds, type, payload } = job.data;
      if (userIds.length === 0) return;

      await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type: type as NotificationType,
          payload,
        })),
      });

      const template = EMAIL_TEMPLATES[type as NotificationType];
      if (!template) return;

      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          emailVerified: { not: null },
          deletedAt: null,
          bannedAt: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          profile: { select: { locale: true } },
        },
      });

      const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      const data = payload as Record<string, unknown>;

      for (const user of users) {
        const locale = user.profile?.locale === "FR" ? "fr" : "en";
        await emailsQueue.add("send", {
          to: user.email,
          template,
          locale,
          vars: {
            name: user.name ?? "",
            ideaTitle: String(data.ideaTitle ?? ""),
            url: data.groupId
              ? `${base}/${locale}/app/groups/${String(data.groupId)}`
              : `${base}/${locale}/app/notifications`,
          },
        } satisfies EmailJob);
      }
    },
    { connection, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[notifications] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
