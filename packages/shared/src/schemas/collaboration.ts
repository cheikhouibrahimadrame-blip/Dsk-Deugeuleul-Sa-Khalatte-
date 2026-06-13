import { z } from "zod";

export const createCollaborationRequestSchema = z.object({
  message: z.string().min(10).max(1000),
  skillsOffer: z.array(z.string().min(1).max(40)).max(10).default([]),
});
export type CreateCollaborationRequestInput = z.infer<typeof createCollaborationRequestSchema>;

export const decideCollaborationRequestSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED", "SAVED"]),
});
export type DecideCollaborationRequestInput = z.infer<typeof decideCollaborationRequestSchema>;
