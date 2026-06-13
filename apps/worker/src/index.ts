import { startNotificationsWorker } from "./workers/notifications";
import { startEmailsWorker } from "./workers/emails";
import { startModerationScanWorker } from "./workers/moderation-scan";
import { startSocialPublishWorker } from "./workers/social-publish";
import { startTokenRefreshWorker } from "./workers/token-refresh";
import { startWebhookEventsWorker } from "./workers/webhook-events";
import { startAnalyticsSyncWorker } from "./workers/analytics-sync";
import { startTikTokStatusWorker } from "./workers/tiktok-status";

/** DSK worker entrypoint: all queue consumers register here. */
function main() {
  const workers = [
    startNotificationsWorker(),
    startEmailsWorker(),
    startModerationScanWorker(),
    startSocialPublishWorker(),
    startTokenRefreshWorker(),
    startWebhookEventsWorker(),
    startAnalyticsSyncWorker(),
    startTikTokStatusWorker(),
  ];
  console.log(`[worker] started ${workers.length} worker(s)`);

  const shutdown = async () => {
    console.log("[worker] shutting down...");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
