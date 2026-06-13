import { z } from "zod";

export const createReportSchema = z.object({
  targetType: z.enum([
    "IDEA",
    "COMMENT",
    "USER",
    "GROUP",
    "GROUP_MESSAGE",
    "ORGANIZATION",
    "OPPORTUNITY",
  ]),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(120),
  details: z.string().max(2000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;
