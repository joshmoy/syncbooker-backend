import { describe, it, expect } from "vitest";
import {
  generateResetToken,
  hashResetToken,
  verifyResetToken,
} from "../../src/utils/resetToken";

describe("resetToken utils", () => {
  it("generates a 64-char hex string (32 random bytes)", () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a deterministic hash for the same token", () => {
    expect(hashResetToken("my-token")).toBe(hashResetToken("my-token"));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashResetToken("a")).not.toBe(hashResetToken("b"));
  });

  it("verifyResetToken only returns true for a matching pair", () => {
    const token = generateResetToken();
    const hash = hashResetToken(token);
    expect(verifyResetToken(token, hash)).toBe(true);
    expect(verifyResetToken("wrong-token", hash)).toBe(false);
  });

  it("generateResetToken produces unique values", () => {
    expect(generateResetToken()).not.toBe(generateResetToken());
  });
});
