import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireGroupRole, AuthError } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";
import { publishChatEvent } from "@/lib/realtime";

const pinSchema = z.object({ pinned: z.boolean() });

/** PATCH /api/v1/groups/:id/messages/:messageId - pin/unpin (group ADMIN+). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id: groupId, messageId } = await params;
    await requireGroupRole(groupId, "ADMIN");
    const { pinned } = pinSchema.parse(await request.json());

    const message = await prisma.groupMessage.findFirst({
      where: { id: messageId, groupId, deletedAt: null },
      select: { id: true },
    });
    if (!message) throw new AuthError(404, "NOT_FOUND");

    const pinnedAt = pinned ? new Date() : null;
    await prisma.groupMessage.update({
      where: { id: messageId },
      data: { pinnedAt },
    });

    await publishChatEvent({
      type: "chat.message.pinned",
      groupId,
      messageId,
      pinnedAt: pinnedAt?.toISOString() ?? null,
    });

    return jsonOk({ id: messageId, pinnedAt });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/groups/:id/messages/:messageId - soft delete.
 * Senders remove their own messages; group ADMIN/OWNER can moderate any.
 * Soft delete keeps the row for moderation/audit accountability.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id: groupId, messageId } = await params;
    const user = await requireGroupRole(groupId, "MEMBER");

    const message = await prisma.groupMessage.findFirst({
      where: { id: messageId, groupId, deletedAt: null },
      select: { senderId: true },
    });
    if (!message) throw new AuthError(404, "NOT_FOUND");

    if (message.senderId !== user.id) {
      await requireGroupRole(groupId, "ADMIN"); // throws 403 if not allowed
    }

    await prisma.groupMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), pinnedAt: null },
    });

    await publishChatEvent({ type: "chat.message.deleted", groupId, messageId });

    return jsonOk({ id: messageId, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
