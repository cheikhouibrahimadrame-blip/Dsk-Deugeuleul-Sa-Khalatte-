"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createIdeaSchema, type CreateIdeaInput } from "@dsk/shared";
import { apiFetch } from "@/lib/fetcher";

type Labels = { title: string; description: string; publish: string; saveDraft: string };

export function CreateIdeaForm({ locale, labels }: { locale: string; labels: Labels }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateIdeaInput>({
    resolver: zodResolver(createIdeaSchema),
    defaultValues: { language: locale === "fr" ? "fr" : "en", tags: [], publish: false },
  });

  async function onSubmit(values: CreateIdeaInput) {
    setServerError(null);
    try {
      const idea = await apiFetch<{ id: string; status: string }>("/api/v1/ideas", {
        method: "POST",
        body: JSON.stringify(values),
      });
      await queryClient.invalidateQueries({ queryKey: ["ideas", "feed"] });
      router.push(
        idea.status === "PUBLISHED"
          ? `/${locale}/app/ideas/${idea.id}`
          : `/${locale}/app/discover`
      );
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {labels.title}
        <input
          {...register("title")}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors.title && <span className="text-xs text-red-600">{errors.title.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.description}
        <textarea
          rows={8}
          {...register("description")}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors.description && (
          <span className="text-xs text-red-600">{errors.description.message}</span>
        )}
      </label>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          onClick={() => setValue("publish", true)}
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {labels.publish}
        </button>
        <button
          type="submit"
          onClick={() => setValue("publish", false)}
          disabled={isSubmitting}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700 disabled:opacity-50"
        >
          {labels.saveDraft}
        </button>
      </div>
    </form>
  );
}
