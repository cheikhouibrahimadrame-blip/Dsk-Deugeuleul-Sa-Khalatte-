/**
 * Standard JSON envelope for every DSK API response.
 * Success: { data, error: null }
 * Failure: { data: null, error: { code, message, details? } }
 */
export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export function ok<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

export function fail(code: string, message: string, details?: unknown): ApiResponse<never> {
  return { data: null, error: { code, message, details } };
}

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};
