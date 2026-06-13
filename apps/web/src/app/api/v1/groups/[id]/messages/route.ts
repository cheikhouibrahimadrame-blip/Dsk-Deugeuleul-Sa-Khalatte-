import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { sendGroupMessageSchema } from "@dsk/shared";
import { requireGroupRole } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";
import { publishChatEvent } from "@/lib/realtime";

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const messageSelect = {
  id: true,
  body: true,
  createdAt: true,
  pinnedAt: true,
  sender: { select: { id: true, name: true, image: true } },
} as const;

/**
 * GET /api/v1/groups/:id/messages - chat history (newest-first cursor pagination).
 * This REST surface is the source of truth and the polling fallback; the
 * Socket.IO gateway only accelerates delivery of the same payload shape.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    await requireGroupRole(groupId, "MEMBER");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const messages = await prisma.groupMessage.findMany({
      where: { groupId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: messageSelect,
    });

    const hasMore = messages.length > query.limit;
    const items = hasMore ? messages.slice(0, -1) : messages;
    return jsonOk({
      items: items.reverse(), // chronological for rendering
      nextCursor: hasMore ? items[0]?.id ?? null : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/v1/groups/:id/messages - send a message. Members only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const user = await requireGroupRole(groupId, "MEMBER");
    const input = sendGroupMessageSchema.parse(await request.json());

    const message = await prisma.groupMessage.create({
      data: { groupId, senderId: user.id, body: input.body },
      select: messageSelect,
    });

    // Sending implies having read the thread up to now.
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });

    await publishChatEvent({
      type: "chat.message.created",
      groupId,
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        pinnedAt: null,
        sender: message.sender,
      },
    });

    return jsonOk(message, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
