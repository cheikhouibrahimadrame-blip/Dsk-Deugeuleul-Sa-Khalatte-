import { beforeAll, describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "../src/crypto";

beforeAll(() => {
  // 32-byte hex key (64 chars) as required by AES-256-GCM.
  process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
});

describe("token crypto", () => {
  it("round-trips a token", () => {
    const token = "EAAB-very-secret-provider-token";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("produces a different ciphertext per call (random IV)", () => {
    const token = "same-token";
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });

  it("rejects tampered ciphertext (auth tag)", () => {
    const stored = encryptToken("secret");
    const [iv, tag, data] = stored.split(".");
    const tampered = [iv, tag, Buffer.from("hacked-data").toString("base64")].join(".");
    expect(() => decryptToken(tampered)).toThrow();
    expect(() => decryptToken(`${iv}.${data}`)).toThrow("Malformed");
  });
});
