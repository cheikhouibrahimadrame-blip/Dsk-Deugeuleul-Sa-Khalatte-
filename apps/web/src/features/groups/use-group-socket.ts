"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  SOCKET_EVENTS,
  type ChatEvent,
  type ChatMessagePayload,
  type TypingEvent,
} from "@dsk/shared";
import { apiFetch } from "@/lib/fetcher";

type MessagesPage = { items: ChatMessagePayload[]; nextCursor: string | null };
type TokenResponse = { token: string; url: string };

/**
 * Realtime chat transport. REST stays the source of truth:
 * - on connect we join the group room (membership re-checked server-side)
 * - on events we patch the TanStack Query cache in place
 * - on disconnect the chat falls back to REST polling; on (re)connect we
 *   refetch history once to fill any gap missed while offline
 */
export function useGroupSocket(groupId: string) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const socketRef = useRef<Socket | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function connect() {
      try {
        const { token, url } = await apiFetch<TokenResponse>("/api/v1/realtime/token", {
          method: "POST",
        });
        if (cancelled) return;

        socket = io(url, { auth: { token }, transports: ["websocket"] });
        socketRef.current = socket;

        socket.on("connect", () => {
          socket?.emit(SOCKET_EVENTS.joinGroup, groupId, (ok: boolean) => {
            if (!cancelled) setConnected(ok);
          });
          // Fill any gap missed while disconnected.
          void queryClient.invalidateQueries({
            queryKey: ["group", groupId, "messages"],
          });
        });

        socket.on("disconnect", () => setConnected(false));

        // Connection tokens live 60s: refresh before each reconnect attempt.
        socket.io.on("reconnect_attempt", () => {
          void apiFetch<TokenResponse>("/api/v1/realtime/token", { method: "POST" })
            .then((fresh) => {
              if (socket) socket.auth = { token: fresh.token };
            })
            .catch(() => {
              /* token refresh failed: polling remains the fallback */
            });
        });

        socket.on(SOCKET_EVENTS.chatEvent, (event: ChatEvent) => {
          if (event.groupId !== groupId) return;
          queryClient.setQueryData<MessagesPage>(
            ["group", groupId, "messages"],
            (page) => {
              if (!page) return page;
              if (event.type === "chat.message.created") {
                if (page.items.some((m) => m.id === event.message.id)) return page;
                return { ...page, items: [...page.items, event.message] };
              }
              if (event.type === "chat.message.deleted") {
                return {
                  ...page,
                  items: page.items.filter((m) => m.id !== event.messageId),
                };
              }
              return {
                ...page,
                items: page.items.map((m) =>
                  m.id === event.messageId ? { ...m, pinnedAt: event.pinnedAt } : m
                ),
              };
            }
          );
        });

        socket.on(SOCKET_EVENTS.userTyping, (event: TypingEvent) => {
          if (event.groupId !== groupId) return;
          setTypingUsers((prev) => ({ ...prev, [event.userId]: event.name ?? "…" }));
          clearTimeout(typingTimers.current[event.userId]);
          typingTimers.current[event.userId] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[event.userId];
              return next;
            });
          }, 3000);
        });
      } catch {
        // Token fetch failed: chat keeps working over REST polling.
      }
    }

    void connect();

    return () => {
      cancelled = true;
      for (const timer of Object.values(typingTimers.current)) clearTimeout(timer);
      typingTimers.current = {};
      socket?.emit(SOCKET_EVENTS.leaveGroup, groupId);
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [groupId, queryClient]);

  const sendTyping = () => {
    socketRef.current?.emit(SOCKET_EVENTS.typing, groupId);
  };

  return { connected, typingNames: Object.values(typingUsers), sendTyping };
}
