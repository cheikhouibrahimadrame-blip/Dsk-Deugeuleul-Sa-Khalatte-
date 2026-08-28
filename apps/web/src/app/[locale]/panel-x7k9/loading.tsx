/**
 * Instant loading skeleton for the admin panel.
 * Mirrors the stat-card grid layout of the dashboard.
 */
export default function PanelLoading() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="mt-2 h-7 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      ))}
    </div>
  );
}
