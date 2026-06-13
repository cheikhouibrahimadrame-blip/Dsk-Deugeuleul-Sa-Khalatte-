import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@dsk/db";
import { requestPasswordResetSchema, resetPasswordSchema } from "@dsk/shared";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * POST /api/v1/auth/reset-password
 * Two modes:
 *  - { email } -> issues a reset token (always 200 to avoid account enumeration)
 *  - { token, password } -> consumes the token and sets the new password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if ("email" in body) {
      const { email } = requestPasswordResetSchema.parse(body);
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

      if (user && !user.deletedAt && !user.bannedAt) {
        const token = crypto.randomBytes(32).toString("hex");
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            expires: new Date(Date.now() + 1000 * 60 * 30),
          },
        });
        if (process.env.NODE_ENV !== "production") {
          console.log(`[mailer] password-reset token for ${email}: ${token}`);
        }
      }
      // Same response whether or not the account exists.
      return jsonOk({ sent: true });
    }

    const { token, password } = resetPasswordSchema.parse(body);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.usedAt || record.expires < new Date()) {
      return jsonFail(400, "INVALID_TOKEN", "This reset link is invalid or expired.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all existing DB sessions for this user.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return jsonOk({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}
