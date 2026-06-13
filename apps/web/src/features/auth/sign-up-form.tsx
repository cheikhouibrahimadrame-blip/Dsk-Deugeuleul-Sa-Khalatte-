"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@dsk/shared";
import { apiFetch } from "@/lib/fetcher";

type Labels = {
  displayName: string;
  email: string;
  password: string;
  submit: string;
  emailTaken: string;
  verifySent: string;
};

export function SignUpForm({ locale, labels }: { locale: string; labels: Labels }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { locale: locale === "fr" ? "fr" : "en" },
  });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    try {
      await apiFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setDone(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setServerError(message.startsWith("EMAIL_TAKEN") ? labels.emailTaken : message);
    }
  }

  if (done) {
    return <p className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">{labels.verifySent}</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {labels.displayName}
        <input
          {...register("displayName")}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors.displayName && <span className="text-xs text-red-600">{errors.displayName.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.email}
        <input
          type="email"
          {...register("email")}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.password}
        <input
          type="password"
          {...register("password")}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors.password && <span className="text-xs text-red-600">{errors.password.message}</span>}
      </label>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {labels.submit}
      </button>
    </form>
  );
}
