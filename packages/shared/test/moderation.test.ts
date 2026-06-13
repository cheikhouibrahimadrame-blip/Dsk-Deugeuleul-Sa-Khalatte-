import { describe, expect, it } from "vitest";
import { scoreText } from "../src/moderation";

describe("scoreText", () => {
  it("passes normal feedback", () => {
    const result = scoreText("I think the onboarding flow could be simpler.");
    expect(result.flagged).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("flags spam keywords", () => {
    const result = scoreText("Win free money at our casino now");
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("spam-keywords");
  });

  it("flags link stuffing", () => {
    const result = scoreText(
      "check https://a.example then https://b.example and https://c.example"
    );
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("link-stuffing");
  });

  it("flags character flooding", () => {
    const result = scoreText("this is greaaaaaaaaaaaat");
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("char-flooding");
  });

  it("flags long all-caps shouting", () => {
    const text = "THIS IS AN EXTREMELY LOUD MESSAGE THAT KEEPS GOING ON AND ON WITHOUT ANY END IN SIGHT";
    const result = scoreText(text);
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("all-caps-shouting");
  });
});
