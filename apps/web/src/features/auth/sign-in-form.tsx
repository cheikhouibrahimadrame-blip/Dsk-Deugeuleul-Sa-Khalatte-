"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { loginSchema, type LoginInput } from "@dsk/shared";

type Labels = {
  email: string;
  password: string;
  submit: string;
  invalidCredentials: string;
};

export function SignInForm({ locale, labels }: { locale: string; labels: Labels }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result = await signIn("credentials", { ...values, redirect: false });
    if (result?.error) {
      setServerError(labels.invalidCredentials);
      return;
    }
    router.push(`/${locale}/app/discover`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
