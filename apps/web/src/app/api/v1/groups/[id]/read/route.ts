import { prisma } from "@dsk/db";
import { requireGroupRole } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/**
 * POST /api/v1/groups/:id/read - mark the group thread as read for the
 * current member. Drives unread counts in the groups list.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const user = await requireGroupRole(groupId, "MEMBER");

    const readAt = new Date();
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: user.id } },
      data: { lastReadAt: readAt },
    });

    return jsonOk({ readAt });
  } catch (error) {
    return handleApiError(error);
  }
}
