import type { ApiResponse } from "@dsk/shared";

/** Typed fetch wrapper for the DSK API envelope. Throws on error responses. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const body = (await res.json()) as ApiResponse<T>;
  if (body.error) {
    throw new Error(`${body.error.code}: ${body.error.message}`);
  }
  return body.data;
}
