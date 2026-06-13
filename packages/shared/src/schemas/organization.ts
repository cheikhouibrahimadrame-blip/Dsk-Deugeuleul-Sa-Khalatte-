import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  type: z.enum(["STARTUP", "ENTERPRISE"]),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const createOpportunitySchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(20).max(5000),
  language: z.enum(["en", "fr"]).default("en"),
  skills: z.array(z.string().min(1).max(40)).max(15).default([]),
  publish: z.boolean().default(false),
});
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
