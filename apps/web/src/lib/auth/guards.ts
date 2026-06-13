import { getServerSession } from "next-auth";
import { prisma, GlobalRole, GroupRole, OrganizationRole } from "@dsk/db";
import { authOptions } from "./options";

export class AuthError extends Error {
  constructor(public status: 401 | 403 | 404, message: string) {
    super(message);
  }
}

export type SessionUser = { id: string; role: GlobalRole };

/** Require an authenticated, non-banned user. */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) throw new AuthError(401, "UNAUTHENTICATED");

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, bannedAt: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.bannedAt) throw new AuthError(401, "UNAUTHENTICATED");
  return { id: user.id, role: user.role };
}

const ROLE_ORDER: GlobalRole[] = ["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

/** Require a minimum global role (RBAC). */
export async function requireRole(min: GlobalRole): Promise<SessionUser> {
  const user = await requireAuth();
  if (ROLE_ORDER.indexOf(user.role) < ROLE_ORDER.indexOf(min)) {
    throw new AuthError(403, "FORBIDDEN");
  }
  return user;
}

/**
 * Hidden admin guard: unauthorized users get 404 (not 403) so the
 * panel's existence is never confirmed to non-admins.
 */
export async function requireHiddenAdmin(): Promise<SessionUser> {
  try {
    return await requireRole("ADMIN");
  } catch {
    throw new AuthError(404, "NOT_FOUND");
  }
}

/**
 * Hidden guard with a custom minimum role (e.g. MODERATOR for the reports
 * queue). Unauthorized users get 404 so the surface is never confirmed.
 */
export async function requireHiddenRole(min: GlobalRole): Promise<SessionUser> {
  try {
    return await requireRole(min);
  } catch {
    throw new AuthError(404, "NOT_FOUND");
  }
}

/** Require active membership in a group, optionally with a minimum group role. */
export async function requireGroupRole(
  groupId: string,
  min: GroupRole = "MEMBER"
): Promise<SessionUser> {
  const user = await requireAuth();
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!member || member.status !== "ACTIVE") throw new AuthError(403, "NOT_A_MEMBER");

  const order: GroupRole[] = ["MEMBER", "ADMIN", "OWNER"];
  if (order.indexOf(member.role) < order.indexOf(min)) throw new AuthError(403, "FORBIDDEN");
  return user;
}

/** Require membership in an organization, optionally with a minimum org role. */
export async function requireOrgRole(
  organizationId: string,
  min: OrganizationRole = "MEMBER"
): Promise<SessionUser> {
  const user = await requireAuth();
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  if (!member) throw new AuthError(403, "NOT_A_MEMBER");

  const order: OrganizationRole[] = ["MEMBER", "ADMIN", "OWNER"];
  if (order.indexOf(member.role) < order.indexOf(min)) throw new AuthError(403, "FORBIDDEN");
  return user;
}
