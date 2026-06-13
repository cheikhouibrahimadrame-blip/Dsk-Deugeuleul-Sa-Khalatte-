import { prisma } from "@dsk/db";
import { requireGroupRole } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/** GET /api/v1/groups/:id - group detail with members. Members only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireGroupRole(id, "MEMBER");

    const group = await prisma.group.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        maxMembers: true,
        idea: { select: { id: true, title: true } },
        members: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "asc" },
          select: {
            role: true,
            joinedAt: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    return jsonOk(group);
  } catch (error) {
    return handleApiError(error);
  }
}
