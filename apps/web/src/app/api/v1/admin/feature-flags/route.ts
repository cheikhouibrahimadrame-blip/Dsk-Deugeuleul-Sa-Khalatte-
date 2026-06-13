import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@dsk/db";
import { requireHiddenAdmin } from "@/lib/auth/guards";
import { jsonOk, handleApiError } from "@/lib/api";

/** GET /api/v1/admin/feature-flags - all flags (ADMIN+). */
export async function GET() {
  try {
    await requireHiddenAdmin();
    const items = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
    return jsonOk({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

const upsertSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_.-]+$/, "lowercase letters, digits, _ . - only"),
  enabled: z.boolean(),
  description: z.string().max(300).optional(),
});

/** POST /api/v1/admin/feature-flags - create or toggle a flag (ADMIN+). */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireHiddenAdmin();
    const input = upsertSchema.parse(await request.json());

    const flag = await prisma.featureFlag.upsert({
      where: { key: input.key },
      create: input,
      update: { enabled: input.enabled, description: input.description },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "admin.feature_flag.set",
        targetType: "FEATURE_FLAG",
        targetId: flag.id,
        metadata: { key: flag.key, enabled: flag.enabled },
      },
    });

    return jsonOk(flag);
  } catch (error) {
    return handleApiError(error);
  }
}
