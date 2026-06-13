/**
 * Heuristic moderation scoring - deliberately dependency-free for MVP.
 * Pure function: unit-testable without DB/Redis. A future toxicity-scoring
 * service replaces scoreText behind the same shape.
 */
const FLAG_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "spam-keywords", pattern: /\b(viagra|casino|crypto pump|free money)\b/i },
  { name: "link-stuffing", pattern: /(https?:\/\/\S+[\s\S]*?){3,}/i },
  { name: "char-flooding", pattern: /(.)\1{9,}/ },
];

export function scoreText(text: string): { flagged: boolean; reasons: string[] } {
  const reasons = FLAG_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ name }) => name
  );
  if (text.length > 80 && text === text.toUpperCase()) {
    reasons.push("all-caps-shouting");
  }
  return { flagged: reasons.length > 0, reasons };
}
