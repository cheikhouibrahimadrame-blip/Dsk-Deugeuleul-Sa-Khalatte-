"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type FeedIdea = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  owner: { id: string; name: string | null };
  _count: { comments: number; reactions: number; collaborationRequests: number };
};

type FeedPage = { items: FeedIdea[]; nextCursor: string | null };

type Labels = { empty: string; loading: string; error: string };

export function IdeaFeed({ labels, locale }: { labels: Labels; locale: string }) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["ideas", "feed"],
    queryFn: ({ pageParam }) =>
      apiFetch<FeedPage>(`/api/v1/ideas${pageParam ? `?cursor=${pageParam}` : ""}`),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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
    );
  }
  if (isError) return <p className="text-sm text-red-600">{labels.error}</p>;

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  if (items.length === 0) {
    return <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">{labels.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((idea) => (
        <Link
          key={idea.id}
          href={`/${locale}/app/ideas/${idea.id}`}
          className="rounded-lg border border-zinc-200 p-4 hover:border-brand-500 dark:border-zinc-800"
        >
          <h2 className="font-semibold">{idea.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {idea.description}
          </p>
          <div className="mt-2 flex gap-3 text-xs text-zinc-500">
            <span>{idea._count.comments} comments</span>
            <span>{idea._count.reactions} reactions</span>
          </div>
        </Link>
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          className="rounded-md border border-zinc-300 py-2 text-sm dark:border-zinc-700"
        >
          More
        </button>
      )}
    </div>
  );
}
