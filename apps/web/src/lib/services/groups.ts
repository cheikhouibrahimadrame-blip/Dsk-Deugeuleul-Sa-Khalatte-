import { prisma, type Prisma, type GroupRole } from "@dsk/db";
import { MAX_GROUP_MEMBERS } from "@dsk/shared";

export class GroupFullError extends Error {
  constructor() {
    super("GROUP_FULL");
  }
}

export class InvalidDecisionError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

/**
 * Adds (or reactivates) a member inside a transaction.
 * HARD INVARIANT: active members can never exceed group.maxMembers (10).
 * Must be called inside a Serializable transaction to prevent races.
 */
export async function addMemberTx(
  tx: Tx,
  groupId: string,
  userId: string,
  role: GroupRole
) {
  const group = await tx.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { maxMembers: true },
  });

  const existing = await tx.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (existing?.status === "ACTIVE") return existing;

  const activeCount = await tx.groupMember.count({
    where: { groupId, status: "ACTIVE" },
  });
  if (activeCount >= Math.min(group.maxMembers, MAX_GROUP_MEMBERS)) {
    throw new GroupFullError();
  }

  return tx.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: { status: "ACTIVE", role, leftAt: null, joinedAt: new Date() },
    create: { groupId, userId, role },
  });
}

/**
 * Idea owner decides on a collaboration request.
 * ACCEPTED: creates the idea's private group on first acceptance (owner = OWNER),
 * then adds the requester (max-10 enforced), and notifies them.
 */
export async function decideCollaborationRequest(
  requestId: string,
  ownerId: string,
  decision: "ACCEPTED" | "REJECTED" | "SAVED"
) {
  return prisma.$transaction(
    async (tx) => {
      const request = await tx.collaborationRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { idea: { select: { id: true, title: true, ownerId: true } } },
      });

      if (request.idea.ownerId !== ownerId) {
        throw new InvalidDecisionError("NOT_IDEA_OWNER");
      }
      if (request.status !== "PENDING" && request.status !== "SAVED") {
        throw new InvalidDecisionError("ALREADY_DECIDED");
      }

      let groupId: string | null = null;

      if (decision === "ACCEPTED") {
        let group = await tx.group.findUnique({ where: { ideaId: request.idea.id } });
        if (!group) {
          group = await tx.group.create({
            data: { ideaId: request.idea.id, name: request.idea.title },
          });
          await addMemberTx(tx, group.id, ownerId, "OWNER");
        }
        await addMemberTx(tx, group.id, request.requesterId, "MEMBER");
        groupId = group.id;
      }

      const updated = await tx.collaborationRequest.update({
        where: { id: requestId },
        data: {
          status: decision,
          decidedAt: decision === "SAVED" ? null : new Date(),
        },
      });

      if (decision !== "SAVED") {
        await tx.notification.create({
          data: {
            userId: request.requesterId,
            type: decision === "ACCEPTED" ? "COLLAB_REQUEST_ACCEPTED" : "COLLAB_REQUEST_REJECTED",
            payload: { ideaId: request.idea.id, ideaTitle: request.idea.title, groupId },
          },
        });
      }

      return { request: updated, groupId };
    },
    { isolationLevel: "Serializable" }
  );
}
