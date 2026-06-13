import crypto from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

export type OAuthState = {
  userId: string;
  provider: string;
  locale: string;
  exp: number;
};

/**
 * HMAC-signed OAuth state: CSRF protection for the connect flow without
 * server-side session storage. Format: base64url(payload).base64url(hmac).
 */
export function signOAuthState(input: {
  userId: string;
  provider: string;
  locale: string;
}): string {
  const payload: OAuthState = { ...input, exp: Date.now() + STATE_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string): OAuthState | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as OAuthState;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
