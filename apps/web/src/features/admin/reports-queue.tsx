"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string | null };
};

type Labels = {
  loading: string;
  error: string;
  empty: string;
  hide: string;
  remove: string;
  restore: string;
  dismiss: string;
};

export function ReportsQueue({ labels }: { labels: Labels }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: () => apiFetch<{ items: Report[] }>("/api/v1/admin/reports?status=OPEN"),
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/api/v1/admin/reports/${id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reports"] }),
  });

  if (isLoading) return <p className="text-sm text-zinc-500">{labels.loading}</p>;
  if (isError || !data) return <p className="text-sm text-red-600">{labels.error}</p>;
  if (data.items.length === 0)
    return <p className="text-sm text-zinc-500">{labels.empty}</p>;

  const actions = [
    { key: "HIDE_CONTENT", label: labels.hide },
    { key: "REMOVE_CONTENT", label: labels.remove },
    { key: "RESTORE_CONTENT", label: labels.restore },
    { key: "DISMISS", label: labels.dismiss },
  ];

  return (
    <div className="flex flex-col gap-3">
      {data.items.map((report) => (
        <div
          key={report.id}
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              {report.targetType} · {report.targetId}
            </span>
            <span>{new Date(report.createdAt).toLocaleString()}</span>
          </div>
          <p className="mt-1 text-sm font-medium">{report.reason}</p>
          {report.details && (
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              {report.details}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: report.id, action: action.key })}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
