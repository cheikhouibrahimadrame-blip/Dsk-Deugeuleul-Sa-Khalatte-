import { prisma } from "@dsk/db";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/**
 * GET /api/v1/groups - groups where the current user is an active member,
 * including the unread message count per group (messages from others created
 * after the member's lastReadAt marker).
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.id, status: "ACTIVE", group: { deletedAt: null } },
      orderBy: { joinedAt: "desc" },
      select: {
        role: true,
        lastReadAt: true,
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            maxMembers: true,
            idea: { select: { id: true, title: true } },
            _count: { select: { members: { where: { status: "ACTIVE" } } } },
          },
        },
      },
    });

    // Members belong to at most a handful of 10-person groups, so per-group
    // counts are cheap; revisit with a denormalized counter only if needed.
    const items = await Promise.all(
      memberships.map(async (m) => {
        const unreadCount = await prisma.groupMessage.count({
          where: {
            groupId: m.group.id,
            deletedAt: null,
            senderId: { not: user.id },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        });
        return { role: m.role, unreadCount, ...m.group };
      })
    );

    return jsonOk({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
