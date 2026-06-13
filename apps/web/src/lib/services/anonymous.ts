import crypto from "node:crypto";
import { prisma } from "@dsk/db";

function randomCode() {
  return `Anon-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Returns the user's stable pseudonym for one idea thread, creating it on
 * first use. Public API exposes ONLY displayCode; userId stays server-side.
 */
export async function getOrCreateAnonymousIdentity(userId: string, ideaId: string) {
  const existing = await prisma.anonymousIdentity.findUnique({
    where: { userId_ideaId: { userId, ideaId } },
  });
  if (existing) return existing;

  // Retry on the rare displayCode collision within the same idea.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.anonymousIdentity.create({
        data: { userId, ideaId, displayCode: randomCode() },
      });
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
      // P2002 on (userId, ideaId) means a concurrent create won: fetch it.
      const winner = await prisma.anonymousIdentity.findUnique({
        where: { userId_ideaId: { userId, ideaId } },
      });
      if (winner) return winner;
      // Otherwise the collision was on (ideaId, displayCode): retry with a new code.
    }
  }
  throw new Error("ANON_IDENTITY_FAILED");
}
