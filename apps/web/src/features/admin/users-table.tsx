"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  bannedAt: string | null;
  cooldownUntil: string | null;
  createdAt: string;
};

type Labels = { loading: string; error: string; ban: string; unban: string };

export function UsersTable({ labels }: { labels: Labels }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () =>
      apiFetch<{ items: AdminUser[] }>(
        `/api/v1/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`
      ),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "BAN" | "UNBAN" }) =>
      apiFetch(`/api/v1/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="email / name"
        className="mb-3 w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      {isLoading && <p className="text-sm text-zinc-500">{labels.loading}</p>}
      {isError && <p className="text-sm text-red-600">{labels.error}</p>}

      <div className="flex flex-col gap-2">
        {data?.items.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <p className="font-medium">
                {user.name ?? user.email}
                <span className="ml-2 text-[10px] uppercase text-zinc-500">
                  {user.role}
                </span>
                {user.bannedAt && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                    BANNED
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
            <button
              type="button"
              disabled={act.isPending}
              onClick={() =>
                act.mutate({ id: user.id, action: user.bannedAt ? "UNBAN" : "BAN" })
              }
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {user.bannedAt ? labels.unban : labels.ban}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
