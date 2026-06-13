import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@dsk/db";
import { registerSchema } from "@dsk/shared";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/**
 * POST /api/v1/auth/register
 * Creates a user + profile and an email verification token.
 * Email sending is stubbed behind the Mailer (logged in dev).
 */
export async function POST(request: NextRequest) {
  try {
    const body = registerSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonFail(409, "EMAIL_TAKEN", "An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const verifyToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: body.displayName,
        profile: {
          create: {
            displayName: body.displayName,
            locale: body.locale === "fr" ? "FR" : "EN",
          },
        },
      },
      select: { id: true, email: true },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verifyToken,
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    // Mailer stub: replace with real email provider in production.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mailer] verify-email token for ${email}: ${verifyToken}`);
    }

    return jsonOk({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
