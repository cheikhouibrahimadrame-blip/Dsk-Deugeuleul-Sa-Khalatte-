/**
 * Instant loading skeleton for public pages (sign-in, sign-up, landing).
 * Shows a centered card placeholder matching the auth form layout.
 */
export default function PublicLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center animate-pulse">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Title */}
        <div className="mx-auto mb-6 h-7 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />

        {/* Form fields */}
        <div className="flex flex-col gap-4">
          <div className="h-10 w-full rounded-md bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 w-full rounded-md bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 w-full rounded-md bg-zinc-200 dark:bg-zinc-700" />
        </div>

        {/* Bottom link */}
        <div className="mx-auto mt-4 h-4 w-40 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
