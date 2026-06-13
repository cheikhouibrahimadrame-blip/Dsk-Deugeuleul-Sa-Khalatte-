import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { updateProfileSchema } from "@dsk/shared";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/** GET /api/v1/me - current user + profile. */
export async function GET() {
  try {
    const sessionUser = await requireAuth();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        emailVerified: true,
        profile: true,
      },
    });
    return jsonOk(user);
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/v1/me - update own profile. */
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await requireAuth();
    const input = updateProfileSchema.parse(await request.json());

    const profile = await prisma.profile.update({
      where: { userId: sessionUser.id },
      data: {
        ...input,
        locale: input.locale ? (input.locale === "fr" ? "FR" : "EN") : undefined,
      },
    });
    return jsonOk(profile);
  } catch (error) {
    return handleApiError(error);
  }
}
