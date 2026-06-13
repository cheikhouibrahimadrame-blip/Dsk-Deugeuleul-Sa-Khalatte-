"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type Account = {
  id: string;
  provider: string;
  displayName: string;
  status: "CONNECTED" | "EXPIRED" | "REVOKED" | "ERROR";
  scopes: string[];
  connectedAt: string;
};

type ProviderInfo = {
  provider: string;
  capabilities: {
    publish: boolean;
    analytics: boolean;
    webhooks: boolean;
    messaging: boolean;
    requiresMedia: boolean;
  };
};

type Labels = {
  connect: string;
  disconnect: string;
  loading: string;
  error: string;
};

/**
 * Capability-driven connection cards: fully API-driven (providers and
 * capabilities come from the backend matrix, never hardcoded here).
 */
export function IntegrationCards({
  locale,
  providerNames,
  labels,
}: {
  locale: string;
  providerNames: Record<string, string>;
  labels: Labels;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      apiFetch<{ accounts: Account[]; providers: ProviderInfo[] }>("/api/v1/integrations"),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/integrations/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });

  if (isLoading) return <p className="text-sm text-zinc-500">{labels.loading}</p>;
  if (isError || !data) return <p className="text-sm text-red-600">{labels.error}</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.providers.map(({ provider, capabilities }) => {
        const accounts = data.accounts.filter((a) => a.provider === provider);
        return (
          <div
            key={provider}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{providerNames[provider] ?? provider}</h2>
              <a
                href={`/api/v1/integrations/oauth/${provider}/start?locale=${locale}`}
                className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-medium text-white"
              >
                {labels.connect}
              </a>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(capabilities)
                .filter(([, enabled]) => enabled)
                .map(([capability]) => (
                  <span
                    key={capability}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                  >
                    {capability}
                  </span>
                ))}
            </div>

            {accounts.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
                  >
                    <span>
                      {account.displayName}
                      <span className="ml-2 text-[10px] uppercase text-zinc-500">
                        {account.status}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => disconnect.mutate(account.id)}
                      disabled={disconnect.isPending}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      {labels.disconnect}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
