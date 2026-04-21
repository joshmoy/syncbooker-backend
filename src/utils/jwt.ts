import jwt from "jsonwebtoken";

/**
 * Returns the configured JWT secret or throws if it isn't set.
 * Use this instead of reading process.env.JWT_SECRET directly so that
 * missing configuration fails loudly rather than falling back to a
 * predictable value.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  return secret;
};

export const generateToken = (userId: string): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: expiresIn as any,
  });
};

export const verifyToken = (token: string): { userId: string } => {
  return jwt.verify(token, getJwtSecret()) as { userId: string };
};
