import { prisma } from "@dsk/db";

/**
 * Channel authorization: a user may join a group room only with an ACTIVE
 * membership. Checked once per join; removed/left members stop receiving
 * events as soon as their sockets leave the room (next reconnect at latest).
 */
export async function isActiveGroupMember(
  groupId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { status: true },
  });
  return member?.status === "ACTIVE";
}
