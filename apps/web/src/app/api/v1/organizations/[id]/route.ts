import { prisma } from "@dsk/db";
import { requireOrgRole } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/** GET /api/v1/organizations/:id - org detail. Members only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireOrgRole(id, "MEMBER");

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        description: true,
        website: true,
        verification: true,
        members: {
          select: {
            role: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
        opportunities: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true, createdAt: true },
        },
      },
    });

    return jsonOk(organization);
  } catch (error) {
    return handleApiError(error);
  }
}
