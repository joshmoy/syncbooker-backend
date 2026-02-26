import crypto from "crypto";

/**
 * Generate a secure random token for password reset
 * @returns A random hex string token
 */
export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Hash a reset token for storage in database
 * @param token The plain reset token
 * @returns Hashed token
 */
export const hashResetToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Verify if a provided token matches the stored hash
 * @param token The plain token to verify
 * @param hash The stored hash
 * @returns True if tokens match
 */
export const verifyResetToken = (token: string, hash: string): boolean => {
  const tokenHash = hashResetToken(token);
  return tokenHash === hash;
};
