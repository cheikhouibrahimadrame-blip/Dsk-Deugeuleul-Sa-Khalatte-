"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { useGroupSocket } from "./use-group-socket";

type Member = {
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: { id: string; name: string | null; image: string | null };
};

type GroupData = {
  id: string;
  name: string;
  maxMembers: number;
  idea: { id: string; title: string };
  members: Member[];
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  pinnedAt: string | null;
  sender: { id: string; name: string | null };
};

type Labels = {
  members: string;
  full: string;
  placeholder: string;
  send: string;
  loading: string;
  error: string;
  typing: string;
  pinned: string;
  live: string;
};

const TYPING_THROTTLE_MS = 1500;

/**
 * Group chat: Socket.IO realtime when connected, 5s REST polling otherwise.
 * Both transports share the same TanStack Query cache and payload shape.
 */
export function GroupChat({ groupId, labels }: { groupId: string; labels: Labels }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);

  const { connected, typingNames, sendTyping } = useGroupSocket(groupId);

  const { data: group, isLoading, isError } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => apiFetch<GroupData>(`/api/v1/groups/${groupId}`),
  });

  const { data: messagesData } = useQuery({
    queryKey: ["group", groupId, "messages"],
    queryFn: () =>
      apiFetch<{ items: Message[]; nextCursor: string | null }>(
        `/api/v1/groups/${groupId}/messages`
      ),
    // Polling is only the fallback transport when the socket is down.
    refetchInterval: connected ? false : 5000,
  });

  const send = useMutation({
    mutationFn: (text: string) =>
      apiFetch(`/api/v1/groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      }),
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: ["group", groupId, "messages"] });
      const previous = queryClient.getQueryData<{ items: Message[]; nextCursor: string | null }>(
        ["group", groupId, "messages"]
      );
      queryClient.setQueryData<{ items: Message[]; nextCursor: string | null }>(
        ["group", groupId, "messages"],
        (old) => {
          if (!old) return old;
          const optimistic: Message = {
            id: `optimistic-${Date.now()}`,
            body: text,
            createdAt: new Date().toISOString(),
            pinnedAt: null,
            sender: { id: "me", name: "You" },
          };
          return { ...old, items: [...old.items, optimistic] };
        }
      );
      setBody("");
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["group", groupId, "messages"], context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["group", groupId, "messages"] }),
  });

  const messageCount = messagesData?.items.length ?? 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageCount]);

  // Viewing the thread marks it read (keeps groups-list unread badges honest).
  useEffect(() => {
    if (messageCount === 0) return;
    apiFetch(`/api/v1/groups/${groupId}/read`, { method: "POST" })
      .then(() => queryClient.invalidateQueries({ queryKey: ["groups"] }))
      .catch(() => {
        /* non-critical */
      });
  }, [groupId, messageCount, queryClient]);

  if (isLoading) {
    return (
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col animate-pulse">
        <div className="border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-3 w-64 rounded bg-zinc-100 dark:bg-zinc-800/60" />
        </div>
        <div className="flex-1 py-3">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="mt-2 h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div className="h-10 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }
  if (isError || !group) return <p className="text-sm text-red-600">{labels.error}</p>;

  const isFull = group.members.length >= group.maxMembers;
  const pinnedMessage = useMemo(
    () => messagesData?.items.filter((m) => m.pinnedAt).at(-1),
    [messagesData]
  );

  const handleBodyChange = (value: string) => {
    setBody(value);
    const now = Date.now();
    if (connected && now - lastTypingSent.current > TYPING_THROTTLE_MS) {
      lastTypingSent.current = now;
      sendTyping();
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <div className="border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{group.name}</h1>
          {connected && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              {labels.live}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {labels.members}: {group.members.map((m) => m.user.name).join(", ")} (
          {group.members.length}/{group.maxMembers})
        </p>
        {isFull && <p className="mt-1 text-xs text-amber-600">{labels.full}</p>}
        {pinnedMessage && (
          <p className="mt-2 truncate rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            📌 {labels.pinned}: {pinnedMessage.body}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <div className="flex flex-col gap-2">
          {messagesData?.items.map((message) => (
            <div key={message.id} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
              <p className="text-xs font-semibold text-zinc-500">{message.sender.name}</p>
              <p className="mt-0.5 text-sm">{message.body}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {typingNames.length > 0 && (
        <p className="pb-1 text-xs italic text-zinc-500">
          {labels.typing.replace("{names}", typingNames.join(", "))}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate(body.trim());
        }}
        className="flex gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
      >
        <input
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder={labels.placeholder}
          className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={send.isPending || !body.trim()}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {labels.send}
        </button>
      </form>
    </div>
  );
}
