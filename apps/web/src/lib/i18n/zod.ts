import type { ZodIssue } from "zod";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Maps Zod issues to translated, user-facing messages.
 *
 * Strategy: shared schemas (@dsk/shared) stay locale-agnostic - they encode
 * rules, not copy. Translation happens at the edge (forms / API error
 * rendering) with a translator bound to the "validation" namespace:
 *
 *   const t = getTranslator(locale, "validation");
 *   const message = translateZodIssue(issue, t);
 */
export function translateZodIssue(issue: ZodIssue, t: Translator): string {
  switch (issue.code) {
    case "too_small":
      return issue.type === "string" && Number(issue.minimum) <= 1
        ? t("required")
        : t("tooShort", { min: String(issue.minimum) });
    case "too_big":
      return t("tooLong", { max: String(issue.maximum) });
    case "invalid_string":
      return issue.validation === "email" ? t("email") : t("invalid");
    default:
      return t("invalid");
  }
}
