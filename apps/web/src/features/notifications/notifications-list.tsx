"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type NotificationItem = {
  id: string;
  type: string;
  payload: { ideaId?: string; ideaTitle?: string; groupId?: string; requestId?: string };
  readAt: string | null;
  createdAt: string;
};

type Labels = { empty: string; markAllRead: string; loading: string; error: string };

export function NotificationsList({
  locale,
  labels,
  typeLabels,
}: {
  locale: string;
  labels: Labels;
  typeLabels: Record<string, string>;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ items: NotificationItem[]; unreadCount: number }>("/api/v1/notifications"),
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/notifications", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (isLoading) return <p className="text-sm text-zinc-500">{labels.loading}</p>;
  if (isError) return <p className="text-sm text-red-600">{labels.error}</p>;

  if (!data || data.items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        {labels.empty}
      </p>
    );
  }

  function renderLabel(item: NotificationItem) {
    const template = typeLabels[item.type] ?? item.type;
    return template.replace("{ideaTitle}", item.payload.ideaTitle ?? "");
  }

  function hrefFor(item: NotificationItem): string | null {
    if (item.payload.groupId) return `/${locale}/app/groups/${item.payload.groupId}`;
    if (item.type === "COLLAB_REQUEST_RECEIVED") return `/${locale}/app/collaboration`;
    if (item.payload.ideaId) return `/${locale}/app/ideas/${item.payload.ideaId}`;
    return null;
  }

  return (
    <div>
      {data.unreadCount > 0 && (
        <button
          onClick={() => markAllRead.mutate()}
          className="mb-3 text-sm text-brand-600 hover:underline"
        >
          {labels.markAllRead} ({data.unreadCount})
        </button>
      )}
      <div className="flex flex-col gap-2">
        {data.items.map((item) => {
          const href = hrefFor(item);
          const content = (
            <div
              className={`rounded-lg border p-3 text-sm ${
                item.readAt
                  ? "border-zinc-200 text-zinc-500 dark:border-zinc-800"
                  : "border-brand-500 font-medium"
              }`}
            >
              {renderLabel(item)}
            </div>
          );
          return href ? (
            <Link key={item.id} href={href}>
              {content}
            </Link>
          ) : (
            <div key={item.id}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
