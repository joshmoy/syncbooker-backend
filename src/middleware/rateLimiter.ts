import rateLimit from "express-rate-limit";

/**
 * Strict limiter for auth endpoints — brute-force protection.
 * 10 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});

/**
 * Moderate limiter for public booking creation.
 * 20 requests per hour per IP — prevents slot exhaustion / spam.
 */
export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many booking requests. Please try again later." },
});

/**
 * Light limiter for visitor tracking — prevents analytics pollution.
 * 60 requests per minute per IP.
 */
export const visitorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests." },
});

/**
 * General API limiter applied to all authenticated routes.
 * 200 requests per minute per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
