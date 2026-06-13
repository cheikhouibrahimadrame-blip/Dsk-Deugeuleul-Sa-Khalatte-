"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type Flag = {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
};

type Labels = { loading: string; error: string; save: string };

export function FeatureFlags({ labels }: { labels: Labels }) {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "flags"],
    queryFn: () => apiFetch<{ items: Flag[] }>("/api/v1/admin/feature-flags"),
  });

  const upsert = useMutation({
    mutationFn: (flag: { key: string; enabled: boolean }) =>
      apiFetch("/api/v1/admin/feature-flags", {
        method: "POST",
        body: JSON.stringify(flag),
      }),
    onSuccess: () => {
      setNewKey("");
      queryClient.invalidateQueries({ queryKey: ["admin", "flags"] });
    },
  });

  if (isLoading) return <p className="text-sm text-zinc-500">{labels.loading}</p>;
  if (isError) return <p className="text-sm text-red-600">{labels.error}</p>;

  return (
    <div className="max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newKey.trim()) upsert.mutate({ key: newKey.trim(), enabled: false });
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="new.flag.key"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={upsert.isPending || !newKey.trim()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {labels.save}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {data?.items.map((flag) => (
          <label
            key={flag.id}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span>
              <span className="font-mono">{flag.key}</span>
              {flag.description && (
                <span className="ml-2 text-xs text-zinc-500">{flag.description}</span>
              )}
            </span>
            <input
              type="checkbox"
              checked={flag.enabled}
              disabled={upsert.isPending}
              onChange={() => upsert.mutate({ key: flag.key, enabled: !flag.enabled })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
