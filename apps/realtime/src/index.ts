import { createServer } from "node:http";
import { Server } from "socket.io";
import IORedis from "ioredis";
import {
  REDIS_CHAT_CHANNEL,
  SOCKET_EVENTS,
  groupRoom,
  type ChatEvent,
  type TypingEvent,
} from "@dsk/shared";
import { verifyConnectionToken, type SocketUser } from "./auth";
import { isActiveGroupMember } from "./membership";

const PORT = Number(process.env.REALTIME_PORT ?? 3001);
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const WEB_ORIGIN = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

const httpServer = createServer((_req, res) => {
  // Simple health endpoint for local checks and deploy probes.
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "dsk-realtime" }));
});

const io = new Server(httpServer, {
  cors: { origin: WEB_ORIGIN, credentials: true },
});

// --- Socket auth middleware: deny by default ---
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") return next(new Error("UNAUTHENTICATED"));
    (socket.data as { user: SocketUser }).user = verifyConnectionToken(token);
    next();
  } catch {
    next(new Error("UNAUTHENTICATED"));
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user as SocketUser;

  socket.on(
    SOCKET_EVENTS.joinGroup,
    async (groupId: unknown, ack?: (ok: boolean) => void) => {
      if (typeof groupId !== "string") return ack?.(false);
      const allowed = await isActiveGroupMember(groupId, user.id);
      if (!allowed) return ack?.(false);
      await socket.join(groupRoom(groupId));
      ack?.(true);
    }
  );

  socket.on(SOCKET_EVENTS.leaveGroup, (groupId: unknown) => {
    if (typeof groupId === "string") void socket.leave(groupRoom(groupId));
  });

  // Typing is ephemeral: relayed to the room only, never persisted.
  socket.on(SOCKET_EVENTS.typing, (groupId: unknown) => {
    if (typeof groupId !== "string") return;
    const room = groupRoom(groupId);
    if (!socket.rooms.has(room)) return; // must have joined (membership-checked)
    const payload: TypingEvent = { groupId, userId: user.id, name: user.name };
    socket.to(room).emit(SOCKET_EVENTS.userTyping, payload);
  });
});

// --- Redis bridge: API routes publish, the gateway fans out to rooms ---
const subscriber = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

void subscriber.subscribe(REDIS_CHAT_CHANNEL).then(() => {
  console.log(`[realtime] subscribed to ${REDIS_CHAT_CHANNEL}`);
});

subscriber.on("message", (_channel, raw) => {
  try {
    const event = JSON.parse(raw) as ChatEvent;
    io.to(groupRoom(event.groupId)).emit(SOCKET_EVENTS.chatEvent, event);
  } catch (error) {
    console.error("[realtime] failed to process chat event", error);
  }
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] gateway listening on :${PORT}`);
});
