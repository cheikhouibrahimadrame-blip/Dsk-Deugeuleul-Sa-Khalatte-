"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type AuditEntry = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  actor: { id: string; name: string | null } | null;
};

type Labels = { loading: string; error: string; empty: string };

export function AuditTable({ labels }: { labels: Labels }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => apiFetch<{ items: AuditEntry[] }>("/api/v1/admin/audit-logs"),
  });

  if (isLoading) return <p className="text-sm text-zinc-500">{labels.loading}</p>;
  if (isError || !data) return <p className="text-sm text-red-600">{labels.error}</p>;
  if (data.items.length === 0)
    return <p className="text-sm text-zinc-500">{labels.empty}</p>;

  return (
    <div className="flex flex-col gap-1">
      {data.items.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-wrap items-baseline gap-2 rounded-md bg-white px-3 py-2 text-xs dark:bg-zinc-900"
        >
          <span className="text-zinc-500">
            {new Date(entry.createdAt).toLocaleString()}
          </span>
          <span className="font-mono font-medium">{entry.action}</span>
          {entry.actor && <span className="text-zinc-500">by {entry.actor.name}</span>}
          {entry.targetType && (
            <span className="text-zinc-400">
              {entry.targetType} · {entry.targetId}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
