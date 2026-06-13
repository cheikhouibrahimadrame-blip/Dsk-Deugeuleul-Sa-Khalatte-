import { NextRequest } from "next/server";
import { prisma } from "@dsk/db";
import { createOpportunitySchema } from "@dsk/shared";
import { requireOrgRole } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/**
 * POST /api/v1/organizations/:id/opportunities
 * Org ADMIN+ posts an opportunity (draft or open).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;
    await requireOrgRole(organizationId, "ADMIN");
    const input = createOpportunitySchema.parse(await request.json());

    const opportunity = await prisma.opportunity.create({
      data: {
        organizationId,
        title: input.title,
        description: input.description,
        language: input.language === "fr" ? "FR" : "EN",
        skills: input.skills,
        status: input.publish ? "OPEN" : "DRAFT",
      },
    });

    return jsonOk(opportunity, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
