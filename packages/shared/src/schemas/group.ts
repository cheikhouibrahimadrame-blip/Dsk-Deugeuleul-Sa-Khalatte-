import { z } from "zod";

export const updateGroupSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(1000).optional(),
});

export const sendGroupMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type SendGroupMessageInput = z.infer<typeof sendGroupMessageSchema>;
