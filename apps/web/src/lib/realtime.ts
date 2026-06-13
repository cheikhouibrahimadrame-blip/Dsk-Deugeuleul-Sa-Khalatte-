import IORedis from "ioredis";
import jwt from "jsonwebtoken";
import {
  REDIS_CHAT_CHANNEL,
  REALTIME_TOKEN_AUDIENCE,
  type ChatEvent,
} from "@dsk/shared";

/**
 * Server-side realtime helpers for the web app.
 * The web API is the only writer: routes persist via Prisma first, then
 * publish events here. The gateway (apps/realtime) broadcasts to rooms.
 */

declare global {
  // eslint-disable-next-line no-var
  var __dskRedisPublisher: IORedis | undefined;
}

function getPublisher(): IORedis {
  if (!globalThis.__dskRedisPublisher) {
    globalThis.__dskRedisPublisher = new IORedis(
      process.env.REDIS_URL ?? "redis://localhost:6379",
      { maxRetriesPerRequest: null }
    );
  }
  return globalThis.__dskRedisPublisher;
}

/** Fire-and-forget: chat keeps working over REST polling if Redis is down. */
export async function publishChatEvent(event: ChatEvent): Promise<void> {
  try {
    await getPublisher().publish(REDIS_CHAT_CHANNEL, JSON.stringify(event));
  } catch (error) {
    console.error("[realtime] publish failed (clients fall back to polling)", error);
  }
}

/** Short-lived token the browser presents to the Socket.IO gateway. */
export function signRealtimeToken(user: { id: string; name: string | null }): string {
  const secret = process.env.REALTIME_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("REALTIME_JWT_SECRET (or NEXTAUTH_SECRET) is not set");
  return jwt.sign({ name: user.name }, secret, {
    subject: user.id,
    audience: REALTIME_TOKEN_AUDIENCE,
    expiresIn: "60s",
  });
}
