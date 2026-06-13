import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { createOrganizationSchema } from "@dsk/shared";
import { requireAuth } from "@/lib/auth/guards";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

/** GET /api/v1/organizations - organizations the current user belongs to. */
export async function GET() {
  try {
    const user = await requireAuth();

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id, organization: { deletedAt: null } },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            verification: true,
            _count: { select: { members: true, opportunities: true } },
          },
        },
      },
    });

    return jsonOk({ items: memberships.map((m) => ({ role: m.role, ...m.organization })) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/organizations - create an organization (startup or enterprise).
 * Creator becomes OWNER. Verification starts UNVERIFIED; admins verify via
 * the hidden admin panel.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const input = createOrganizationSchema.parse(await request.json());

    try {
      const organization = await prisma.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          type: input.type,
          description: input.description,
          website: input.website,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
        select: { id: true, name: true, slug: true, type: true, verification: true },
      });
      return jsonOk(organization, { status: 201 });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "P2002") {
        return jsonFail(409, "SLUG_TAKEN", "This organization slug is already in use.");
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
