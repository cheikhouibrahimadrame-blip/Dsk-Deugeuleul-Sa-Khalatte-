import { z } from "zod";

export const createIdeaSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(20).max(5000),
  language: z.enum(["en", "fr"]).default("en"),
  tags: z.array(z.string().min(1).max(30)).max(8).default([]),
  publish: z.boolean().default(false),
});
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

export const updateIdeaSchema = createIdeaSchema.partial().omit({ publish: true }).extend({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;

export const listIdeasQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  tag: z.string().optional(),
  language: z.enum(["en", "fr"]).optional(),
});
