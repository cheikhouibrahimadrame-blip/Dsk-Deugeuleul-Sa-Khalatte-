import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { jsonOk, handleApiError } from "@/lib/api";

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  skill: z.string().optional(),
});

/** GET /api/v1/opportunities - public list of OPEN opportunities. */
export async function GET(request: NextRequest) {
  try {
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const opportunities = await prisma.opportunity.findMany({
      where: {
        status: "OPEN",
        deletedAt: null,
        ...(query.skill ? { skills: { has: query.skill } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        description: true,
        skills: true,
        language: true,
        createdAt: true,
        organization: {
          select: { id: true, name: true, slug: true, type: true, verification: true },
        },
      },
    });

    const hasMore = opportunities.length > query.limit;
    const items = hasMore ? opportunities.slice(0, -1) : opportunities;
    return jsonOk({
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
