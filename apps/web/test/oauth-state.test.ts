import { beforeAll, describe, expect, it } from "vitest";
import { signOAuthState, verifyOAuthState } from "../src/lib/integrations/state";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-for-ci";
});

describe("OAuth state", () => {
  it("round-trips a signed state", () => {
    const state = signOAuthState({
      userId: "user_1",
      provider: "TIKTOK",
      locale: "fr",
    });
    const verified = verifyOAuthState(state);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("user_1");
    expect(verified?.provider).toBe("TIKTOK");
    expect(verified?.locale).toBe("fr");
    expect(verified!.exp).toBeGreaterThan(Date.now());
  });

  it("rejects a tampered signature", () => {
    const state = signOAuthState({
      userId: "user_1",
      provider: "TIKTOK",
      locale: "en",
    });
    const [body] = state.split(".");
    expect(verifyOAuthState(`${body}.invalid-signature`)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const state = signOAuthState({
      userId: "user_1",
      provider: "TIKTOK",
      locale: "en",
    });
    const [, sig] = state.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ userId: "attacker", provider: "TIKTOK", locale: "en", exp: Date.now() + 60000 })
    ).toString("base64url");
    expect(verifyOAuthState(`${forgedBody}.${sig}`)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyOAuthState("not-a-state")).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
  });
});
