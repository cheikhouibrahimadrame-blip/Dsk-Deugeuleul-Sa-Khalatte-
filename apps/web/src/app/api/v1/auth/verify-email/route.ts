import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { verifyEmailSchema } from "@dsk/shared";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/** POST /api/v1/auth/verify-email - consumes a verification token. */
export async function POST(request: NextRequest) {
  try {
    const { token } = verifyEmailSchema.parse(await request.json());

    const record = await prisma.verificationToken.findUnique({ where: { token } });
    if (!record || record.expires < new Date()) {
      return jsonFail(400, "INVALID_TOKEN", "This verification link is invalid or expired.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { email: record.identifier },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);

    return jsonOk({ verified: true });
  } catch (error) {
    return handleApiError(error);
  }
}
