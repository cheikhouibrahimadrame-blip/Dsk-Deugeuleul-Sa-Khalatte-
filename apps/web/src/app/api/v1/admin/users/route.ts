import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireHiddenAdmin } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

const querySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /api/v1/admin/users - search/manage users (ADMIN+). */
export async function GET(request: NextRequest) {
  try {
    await requireHiddenAdmin();
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const items = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(query.q
          ? {
              OR: [
                { email: { contains: query.q, mode: "insensitive" } },
                { name: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        bannedAt: true,
        cooldownUntil: true,
        createdAt: true,
      },
    });

    return jsonOk({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
