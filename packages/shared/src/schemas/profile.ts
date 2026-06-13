import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  bio: z.string().max(500).optional(),
  headline: z.string().max(120).optional(),
  skills: z.array(z.string().min(1).max(40)).max(20).optional(),
  interests: z.array(z.string().min(1).max(40)).max(20).optional(),
  industries: z.array(z.string().min(1).max(40)).max(10).optional(),
  locale: z.enum(["en", "fr"]).optional(),
  country: z.string().max(60).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
