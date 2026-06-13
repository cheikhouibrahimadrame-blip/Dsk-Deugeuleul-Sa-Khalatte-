import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { createIdeaSchema, listIdeasQuerySchema } from "@dsk/shared";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/** GET /api/v1/ideas - public feed of published ideas (cursor pagination). */
export async function GET(request: NextRequest) {
  try {
    const query = listIdeasQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const ideas = await prisma.idea.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        ...(query.tag ? { tags: { has: query.tag } } : {}),
        ...(query.language ? { language: query.language === "fr" ? "FR" : "EN" } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        language: true,
        publishedAt: true,
        owner: { select: { id: true, name: true, image: true } },
        _count: { select: { comments: true, reactions: true, collaborationRequests: true } },
      },
    });

    const hasMore = ideas.length > query.limit;
    const items = hasMore ? ideas.slice(0, -1) : ideas;
    return jsonOk({
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/v1/ideas - create an idea (draft or published). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const input = createIdeaSchema.parse(await request.json());

    const idea = await prisma.idea.create({
      data: {
        ownerId: user.id,
        title: input.title,
        description: input.description,
        language: input.language === "fr" ? "FR" : "EN",
        tags: input.tags,
        status: input.publish ? "PUBLISHED" : "DRAFT",
        publishedAt: input.publish ? new Date() : null,
      },
    });

    return jsonOk(idea, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
