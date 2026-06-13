"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

type Comment = {
  id: string;
  body: string;
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: string;
  anonymousIdentity: { displayCode: string };
};

type IdeaData = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  owner: { id: string; name: string | null };
  comments: Comment[];
};

type Labels = {
  comments: string;
  workTogether: string;
  commentPlaceholder: string;
  commentSubmit: string;
  helpful: string;
  unhelpful: string;
  report: string;
  loading: string;
  error: string;
  modalTitle: string;
  modalMessage: string;
  modalSkills: string;
  modalSubmit: string;
  modalSuccess: string;
  alreadyRequested: string;
  cancel: string;
};

export function IdeaDetail({ ideaId, labels }: { ideaId: string; labels: Labels }) {
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: idea, isLoading, isError } = useQuery({
    queryKey: ["idea", ideaId],
    queryFn: () => apiFetch<IdeaData>(`/api/v1/ideas/${ideaId}`),
  });

  const postComment = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/v1/ideas/${ideaId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["idea", ideaId] });
    },
  });

  const feedback = useMutation({
    mutationFn: ({ commentId, action }: { commentId: string; action: "HELPFUL" | "UNHELPFUL" }) =>
      apiFetch(`/api/v1/comments/${commentId}/feedback`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["idea", ideaId] }),
  });

  const reportComment = useMutation({
    mutationFn: (commentId: string) =>
      apiFetch("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify({ targetType: "COMMENT", targetId: commentId, reason: "inappropriate" }),
      }),
  });

  if (isLoading) return <p className="text-sm text-zinc-500">{labels.loading}</p>;
  if (isError || !idea) return <p className="text-sm text-red-600">{labels.error}</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{idea.title}</h1>
      <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{idea.description}</p>

      <button
        onClick={() => setModalOpen(true)}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
      >
        {labels.workTogether}
      </button>

      <h2 className="mt-8 text-lg font-semibold">{labels.comments}</h2>
      <div className="mt-3 flex flex-col gap-3">
        {idea.comments.map((comment) => (
          <div key={comment.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500">{comment.anonymousIdentity.displayCode}</p>
            <p className="mt-1 text-sm">{comment.body}</p>
            <div className="mt-2 flex gap-3 text-xs text-zinc-500">
              <button onClick={() => feedback.mutate({ commentId: comment.id, action: "HELPFUL" })}>
                {labels.helpful} ({comment.helpfulCount})
              </button>
              <button onClick={() => feedback.mutate({ commentId: comment.id, action: "UNHELPFUL" })}>
                {labels.unhelpful} ({comment.unhelpfulCount})
              </button>
              <button onClick={() => reportComment.mutate(comment.id)} className="text-red-500">
                {labels.report}
              </button>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (commentBody.trim().length >= 2) postComment.mutate(commentBody);
        }}
        className="mt-4 flex flex-col gap-2"
      >
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder={labels.commentPlaceholder}
          rows={3}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={postComment.isPending}
          className="self-end rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {labels.commentSubmit}
        </button>
      </form>

      {modalOpen && (
        <WorkTogetherModal ideaId={ideaId} labels={labels} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function WorkTogetherModal({
  ideaId,
  labels,
  onClose,
}: {
  ideaId: string;
  labels: Labels;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [skills, setSkills] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/ideas/${ideaId}/collaboration-requests`, {
        method: "POST",
        body: JSON.stringify({
          message,
          skillsOffer: skills.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      }),
    onSuccess: () => setDone(true),
    onError: (e) => {
      setError(
        e instanceof Error && e.message.startsWith("ALREADY_REQUESTED")
          ? labels.alreadyRequested
          : labels.error
      );
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-xl bg-white p-5 dark:bg-zinc-900 sm:rounded-xl">
        <h3 className="text-lg font-semibold">{labels.modalTitle}</h3>
        {done ? (
          <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
            {labels.modalSuccess}
          </p>
        ) : (
          <>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              {labels.modalMessage}
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              {labels.modalSkills}
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </>
        )}
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
            {labels.cancel}
          </button>
          {!done && (
            <button
              onClick={() => message.trim().length >= 10 && send.mutate()}
              disabled={send.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {labels.modalSubmit}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
