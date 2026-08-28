import { QueryClient } from "@tanstack/react-query";

/**
 * Create a QueryClient tuned for server-side prefetching.
 * One instance per request – never shared across requests.
 */
export function getQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
