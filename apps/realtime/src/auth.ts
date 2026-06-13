import jwt from "jsonwebtoken";
import { REALTIME_TOKEN_AUDIENCE } from "@dsk/shared";

const secret = process.env.REALTIME_JWT_SECRET || process.env.NEXTAUTH_SECRET;

export type SocketUser = { id: string; name: string | null };

/**
 * Verifies the short-lived connection token issued by the web app at
 * POST /api/v1/realtime/token. The gateway never touches session cookies:
 * session auth stays in the web app, the gateway only verifies JWTs.
 */
export function verifyConnectionToken(token: string): SocketUser {
  if (!secret) {
    throw new Error("REALTIME_JWT_SECRET (or NEXTAUTH_SECRET) is not set");
  }
  const payload = jwt.verify(token, secret, {
    audience: REALTIME_TOKEN_AUDIENCE,
  }) as jwt.JwtPayload;
  if (!payload.sub) throw new Error("Token missing subject");
  return { id: payload.sub, name: (payload.name as string | undefined) ?? null };
}
