import { describe, expect, it } from "vitest";
import { sendGroupMessageSchema, updateGroupSchema } from "../src/schemas/group";

describe("sendGroupMessageSchema", () => {
  it("accepts a normal message", () => {
    expect(sendGroupMessageSchema.safeParse({ body: "Hello team" }).success).toBe(true);
  });

  it("rejects an empty message", () => {
    expect(sendGroupMessageSchema.safeParse({ body: "" }).success).toBe(false);
  });

  it("rejects oversized messages", () => {
    expect(
      sendGroupMessageSchema.safeParse({ body: "x".repeat(4001) }).success
    ).toBe(false);
  });
});

describe("updateGroupSchema", () => {
  it("accepts partial updates", () => {
    expect(updateGroupSchema.safeParse({ name: "New name" }).success).toBe(true);
    expect(updateGroupSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a too-short name", () => {
    expect(updateGroupSchema.safeParse({ name: "x" }).success).toBe(false);
  });
});
