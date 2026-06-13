import { prisma } from "@dsk/db";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";
import { signRealtimeToken } from "@/lib/realtime";

/**
 * POST /api/v1/realtime/token - short-lived (60s) connection token for the
 * Socket.IO gateway. Session auth happens here; the gateway only verifies
 * the JWT, so session cookies never leave the web app.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });
    return jsonOk({
      token: signRealtimeToken({ id: user.id, name: dbUser?.name ?? null }),
      url: process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
