"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type CollabRequest = {
  id: string;
  message: string;
  skillsOffer: string[];
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SAVED" | "WITHDRAWN";
  createdAt: string;
  idea: { id: string; title: string };
  requester: {
    id: string;
    name: string | null;
    profile: { headline: string | null; skills: string[] } | null;
  };
};

type Labels = {
  received: string;
  sent: string;
  empty: string;
  accept: string;
  reject: string;
  save: string;
  groupFull: string;
  loading: string;
  error: string;
  statusPending: string;
  statusAccepted: string;
  statusRejected: string;
  statusSaved: string;
};

export function CollabInbox({ locale, labels }: { locale: string; labels: Labels }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [box, setBox] = useState<"received" | "sent">("received");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["collab", box],
    queryFn: () => apiFetch<{ items: CollabRequest[] }>(`/api/v1/collaboration-requests?box=${box}`),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "ACCEPTED" | "REJECTED" | "SAVED" }) =>
      apiFetch<{ groupId: string | null }>(`/api/v1/collaboration-requests/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: (result) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["collab"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      if (result.groupId) router.push(`/${locale}/app/groups/${result.groupId}`);
    },
    onError: (e) => {
      setActionError(
        e instanceof Error && e.message.startsWith("GROUP_FULL") ? labels.groupFull : labels.error
      );
    },
  });

  const statusLabel: Record<string, string> = {
    PENDING: labels.statusPending,
    ACCEPTED: labels.statusAccepted,
    REJECTED: labels.statusRejected,
    SAVED: labels.statusSaved,
  };

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["received", "sent"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBox(b)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              box === b
                ? "bg-brand-600 text-white"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {b === "received" ? labels.received : labels.sent}
          </button>
        ))}
      </div>

      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
      {isLoading && <p className="text-sm text-zinc-500">{labels.loading}</p>}
      {isError && <p className="text-sm text-red-600">{labels.error}</p>}

      {data && data.items.length === 0 && (
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {labels.empty}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {data?.items.map((req) => (
          <div key={req.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{req.idea.title}</p>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                {statusLabel[req.status] ?? req.status}
              </span>
            </div>
            {box === "received" && (
              <p className="mt-1 text-xs text-zinc-500">
                {req.requester.name}
                {req.requester.profile?.headline ? ` - ${req.requester.profile.headline}` : ""}
              </p>
            )}
            <p className="mt-2 text-sm">{req.message}</p>
            {req.skillsOffer.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {req.skillsOffer.map((skill) => (
                  <span key={skill} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-zinc-800 dark:text-brand-500">
                    {skill}
                  </span>
                ))}
              </div>
            )}
            {box === "received" && (req.status === "PENDING" || req.status === "SAVED") && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => decide.mutate({ id: req.id, decision: "ACCEPTED" })}
                  disabled={decide.isPending}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {labels.accept}
                </button>
                <button
                  onClick={() => decide.mutate({ id: req.id, decision: "REJECTED" })}
                  disabled={decide.isPending}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 disabled:opacity-50"
                >
                  {labels.reject}
                </button>
                {req.status === "PENDING" && (
                  <button
                    onClick={() => decide.mutate({ id: req.id, decision: "SAVED" })}
                    disabled={decide.isPending}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 disabled:opacity-50"
                  >
                    {labels.save}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
