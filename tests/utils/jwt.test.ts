import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { generateToken, verifyToken, getJwtSecret } from "../../src/utils/jwt";

describe("jwt utils", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-xyz";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("round-trips a user id", () => {
    const token = generateToken("user-123");
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe("user-123");
  });

  it("rejects tokens signed with a different secret", () => {
    const bogus = jwt.sign({ userId: "user-123" }, "different-secret");
    expect(() => verifyToken(bogus)).toThrow();
  });

  it("throws when JWT_SECRET is missing at sign time", () => {
    delete process.env.JWT_SECRET;
    expect(() => generateToken("user-123")).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_SECRET is missing at verify time", () => {
    const token = generateToken("user-123");
    delete process.env.JWT_SECRET;
    expect(() => verifyToken(token)).toThrow(/JWT_SECRET/);
  });

  it("getJwtSecret returns the configured secret", () => {
    expect(getJwtSecret()).toBe("test-secret-xyz");
  });
});
