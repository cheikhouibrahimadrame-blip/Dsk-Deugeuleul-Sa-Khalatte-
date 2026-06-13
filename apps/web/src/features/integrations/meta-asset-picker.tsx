"use client";

import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type Asset = { externalAccountId: string; displayName: string };

type Labels = {
  title: string;
  select: string;
  loading: string;
  error: string;
  empty: string;
};

/**
 * Step 2 of the Meta connection flow: pick the page / IG account / WABA.
 * Only asset ids cross the wire - tokens stay server-side.
 */
export function MetaAssetPicker({
  pendingId,
  labels,
}: {
  pendingId: string;
  labels: Labels;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["integrations", "pending", pendingId],
    queryFn: () =>
      apiFetch<{ provider: string; assets: Asset[] }>(
        `/api/v1/integrations/pending/${pendingId}/assets`
      ),
  });

  const select = useMutation({
    mutationFn: (externalAccountId: string) =>
      apiFetch(`/api/v1/integrations/pending/${pendingId}/select`, {
        method: "POST",
        body: JSON.stringify({ externalAccountId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      router.replace(pathname); // drop ?pending from the URL
    },
  });

  return (
    <div className="mb-6 rounded-lg border border-brand-500 p-4">
      <h2 className="font-semibold">{labels.title}</h2>

      {isLoading && <p className="mt-2 text-sm text-zinc-500">{labels.loading}</p>}
      {isError && <p className="mt-2 text-sm text-red-600">{labels.error}</p>}

      {data && data.assets.length === 0 && (
        <p className="mt-2 text-sm text-zinc-500">{labels.empty}</p>
      )}

      {data && data.assets.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {data.assets.map((asset) => (
            <li
              key={asset.externalAccountId}
              className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
            >
              <span>{asset.displayName}</span>
              <button
                type="button"
                onClick={() => select.mutate(asset.externalAccountId)}
                disabled={select.isPending}
                className="rounded-full bg-brand-600 px-4 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {labels.select}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
