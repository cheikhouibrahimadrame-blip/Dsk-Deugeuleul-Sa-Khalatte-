import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/** GET /api/v1/notifications - latest notifications + unread count. */
export async function GET() {
  try {
    const user = await requireAuth();

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return jsonOk({ items, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

const markReadSchema = z.object({
  ids: z.array(z.string()).max(100).optional(), // omit = mark all read
});

/** POST /api/v1/notifications - mark notifications as read. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { ids } = markReadSchema.parse(await request.json());

    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        ...(ids ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });

    return jsonOk({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
