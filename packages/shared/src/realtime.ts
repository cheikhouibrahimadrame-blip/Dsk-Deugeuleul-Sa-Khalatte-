/**
 * Realtime contract shared by the web app (publisher), the realtime gateway
 * (subscriber/broadcaster), and the browser client.
 *
 * Transport model (lightweight, product-focused):
 * - Writes always go through the REST API (validation + auth live there).
 * - API routes publish events on Redis pub/sub; the gateway fans them out to
 *   Socket.IO rooms; REST polling remains the fallback when sockets are down.
 */

/** Redis pub/sub channel carrying all chat events. */
export const REDIS_CHAT_CHANNEL = "dsk:chat";

/** Socket.IO room name for a group. */
export const groupRoom = (groupId: string) => `group:${groupId}`;

/** Audience claim for socket connection tokens. */
export const REALTIME_TOKEN_AUDIENCE = "dsk-realtime";

// --- Server -> client chat events (persisted, bridged over Redis) ---

export type ChatMessagePayload = {
  id: string;
  body: string;
  createdAt: string;
  pinnedAt: string | null;
  sender: { id: string; name: string | null; image: string | null };
};

export type ChatEvent =
  | { type: "chat.message.created"; groupId: string; message: ChatMessagePayload }
  | { type: "chat.message.deleted"; groupId: string; messageId: string }
  | {
      type: "chat.message.pinned";
      groupId: string;
      messageId: string;
      pinnedAt: string | null;
    };

/** Ephemeral, socket-only typing signal (never persisted, never on Redis). */
export type TypingEvent = { groupId: string; userId: string; name: string | null };

export const SOCKET_EVENTS = {
  // client -> server
  joinGroup: "group:join",
  leaveGroup: "group:leave",
  typing: "chat:typing",
  // server -> client
  chatEvent: "chat:event",
  userTyping: "chat:user-typing",
} as const;
