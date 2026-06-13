import { describe, expect, it } from "vitest";
import { getTranslator, isLocale } from "../src";

describe("getTranslator", () => {
  it("translates with variable interpolation", () => {
    const t = getTranslator("fr", "groups");
    expect(t("detail.full", { max: 10 })).toContain("10");
  });

  it("serves French keys in French", () => {
    const t = getTranslator("fr", "common");
    expect(t("nav.discover")).toBe("Découvrir");
  });

  it("falls back to the key itself when unknown", () => {
    const t = getTranslator("en", "common");
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});

describe("isLocale", () => {
  it("accepts supported locales and rejects others", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("wo")).toBe(false); // future-ready, not shipped yet
    expect(isLocale("de")).toBe(false);
  });
});
