import { z } from "zod";

export const createCommentSchema = z.object({
  body: z.string().min(2).max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const commentFeedbackSchema = z.object({
  action: z.enum(["HELPFUL", "UNHELPFUL"]),
});
