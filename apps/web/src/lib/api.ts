import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ok, fail } from "@dsk/shared";
import { AuthError } from "./auth/guards";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(ok(data), init);
}

export function jsonFail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(fail(code, message, details), { status });
}

/** Wrap a route handler with consistent error mapping. */
export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return jsonFail(error.status, error.message, error.message);
  }
  if (error instanceof ZodError) {
    return jsonFail(422, "VALIDATION_ERROR", "Invalid input.", error.flatten());
  }
  console.error("[api]", error);
  return jsonFail(500, "INTERNAL_ERROR", "Internal server error.");
}
