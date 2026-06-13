import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, GlobalRole } from "@dsk/db";
import { requireHiddenAdmin, AuthError } from "@/lib/auth/guards";
import { jsonOk, jsonFail, handleApiError } from "@/lib/api";

const actionSchema = z.object({
  action: z.enum(["BAN", "UNBAN", "COOLDOWN"]),
  reason: z.string().min(2).max(500).default("Admin action"),
  cooldownHours: z.coerce.number().int().min(1).max(720).default(24),
});

const ROLE_ORDER: GlobalRole[] = ["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

/**
 * PATCH /api/v1/admin/users/:id - ban / unban / cooldown (ADMIN+).
 * Role hierarchy protection: actors can only act on strictly lower roles,
 * and never on themselves.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireHiddenAdmin();
    const { id } = await params;
    const input = actionSchema.parse(await request.json());

    if (id === actor.id) {
      return jsonFail(400, "SELF_ACTION", "You cannot moderate your own account.");
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, deletedAt: true },
    });
    if (!target || target.deletedAt) throw new AuthError(404, "NOT_FOUND");

    if (ROLE_ORDER.indexOf(target.role) >= ROLE_ORDER.indexOf(actor.role)) {
      return jsonFail(403, "ROLE_HIERARCHY", "Cannot act on an equal or higher role.");
    }

    const data =
      input.action === "BAN"
        ? { bannedAt: new Date() }
        : input.action === "UNBAN"
          ? { bannedAt: null, cooldownUntil: null }
          : { cooldownUntil: new Date(Date.now() + input.cooldownHours * 3600_000) };

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data }),
      prisma.moderationAction.create({
        data: {
          moderatorId: actor.id,
          targetType: "USER",
          targetId: id,
          action:
            input.action === "BAN"
              ? "BAN_USER"
              : input.action === "UNBAN"
                ? "UNBAN_USER"
                : "COOLDOWN_USER",
          reason: input.reason,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: `admin.user.${input.action.toLowerCase()}`,
          targetType: "USER",
          targetId: id,
          metadata: { reason: input.reason },
        },
      }),
    ]);

    return jsonOk({ id, action: input.action });
  } catch (error) {
    return handleApiError(error);
  }
}
