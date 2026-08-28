"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type GroupItem = {
  id: string;
  name: string;
  description: string | null;
  maxMembers: number;
  role: "OWNER" | "ADMIN" | "MEMBER";
  unreadCount: number;
  idea: { id: string; title: string };
  _count: { members: number };
};

type Labels = { empty: string; loading: string; error: string; maxMembers: string };

export function GroupsList({ locale, labels }: { locale: string; labels: Labels }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiFetch<{ items: GroupItem[] }>("/api/v1/groups"),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-12 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            </div>
            <div className="mt-2 h-3 w-16 rounded bg-zinc-100 dark:bg-zinc-800/60" />
          </div>
        ))}
      </div>
    );
  }
  if (isError) return <p className="text-sm text-red-600">{labels.error}</p>;

  if (!data || data.items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        {labels.empty}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">{labels.maxMembers}</p>
      {data.items.map((group) => (
        <Link
          key={group.id}
          href={`/${locale}/app/groups/${group.id}`}
          className="rounded-lg border border-zinc-200 p-4 hover:border-brand-500 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{group.name}</h2>
              {group.unreadCount > 0 && (
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {group.unreadCount > 99 ? "99+" : group.unreadCount}
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-500">
              {group._count.members}/{group.maxMembers}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{group.role}</p>
        </Link>
      ))}
    </div>
  );
}
