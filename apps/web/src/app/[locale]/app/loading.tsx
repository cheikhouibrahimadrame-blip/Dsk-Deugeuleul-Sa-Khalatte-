/**
 * Instant loading skeleton for authenticated app routes.
 * Next.js shows this immediately on navigation while the server
 * renders the actual page (session check + data fetching).
 */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse">
      {/* Page title placeholder */}
      <div className="mb-4 h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />

      {/* Content card placeholders */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
            <div className="mt-1 h-4 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            <div className="mt-3 flex gap-4">
              <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
