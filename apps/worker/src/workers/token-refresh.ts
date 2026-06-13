import { Worker } from "bullmq";
import { prisma } from "@dsk/db";
import { getAdapter, decryptToken, encryptToken } from "@dsk/integrations";
import { connection } from "../connection";
import { QUEUE_NAMES, tokenRefreshQueue } from "../queues";

const REFRESH_EVERY_MS = 60 * 60 * 1000; // hourly
const EXPIRY_WINDOW_MS = 24 * 60 * 60 * 1000; // refresh tokens expiring within 24h

/**
 * Proactive token refresh: keeps refreshable provider tokens (TikTok) alive
 * before they expire. Meta long-lived tokens have no refresh grant; when they
 * expire the account is marked EXPIRED and the user must reconnect (the
 * settings UI surfaces this state).
 */
export function startTokenRefreshWorker() {
  const worker = new Worker(
    QUEUE_NAMES.tokenRefresh,
    async () => {
      const expiring = await prisma.providerToken.findMany({
        where: {
          expiresAt: { lte: new Date(Date.now() + EXPIRY_WINDOW_MS) },
          refreshTokenEnc: { not: null },
          integrationAccount: { status: "CONNECTED", revokedAt: null },
        },
        include: { integrationAccount: true },
        take: 50,
      });

      for (const token of expiring) {
        const adapter = getAdapter(token.integrationAccount.provider);
        try {
          const refreshed = await adapter.refreshToken(decryptToken(token.refreshTokenEnc!));
          await prisma.$transaction([
            prisma.providerToken.update({
              where: { id: token.id },
              data: {
                accessTokenEnc: encryptToken(refreshed.accessToken),
                refreshTokenEnc: refreshed.refreshToken
                  ? encryptToken(refreshed.refreshToken)
                  : token.refreshTokenEnc,
                expiresAt: refreshed.expiresAt,
              },
            }),
            prisma.auditLog.create({
              data: {
                action: "integration.token.refresh",
                targetType: "INTEGRATION_ACCOUNT",
                targetId: token.integrationAccountId,
                metadata: { provider: token.integrationAccount.provider },
              },
            }),
          ]);
        } catch (error) {
          console.error(
            `[token-refresh] failed for account ${token.integrationAccountId}:`,
            error
          );
          await prisma.integrationAccount.update({
            where: { id: token.integrationAccountId },
            data: { status: "EXPIRED" },
          });
        }
      }
    },
    { connection, concurrency: 1 }
  );

  void tokenRefreshQueue.add("refresh-sweep", {} as never, {
    repeat: { every: REFRESH_EVERY_MS },
    jobId: "token-refresh-sweep",
  });

  worker.on("failed", (job, err) => {
    console.error(`[token-refresh] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
