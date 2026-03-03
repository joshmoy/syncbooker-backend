import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";

/**
 * Runs after validator chains — collects errors and returns 422 if any.
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      error: "Validation failed",
      details: errors.array().map((e) => ({ field: (e as any).path, message: e.msg })),
    });
    return;
  }
  next();
};

// ─── Auth validators ──────────────────────────────────────────────────────────

export const registerValidators = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ max: 100 }).withMessage("Name must be 100 characters or fewer"),
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email address")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage("Username may only contain letters, numbers, underscores, and hyphens"),
];

export const loginValidators = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email address")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required"),
];

export const forgotPasswordValidators = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email address")
    .normalizeEmail(),
];

export const resetPasswordValidators = [
  body("token")
    .notEmpty().withMessage("Reset token is required"),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
];

// ─── Booking validators ───────────────────────────────────────────────────────

export const createBookingValidators = [
  body("eventTypeId")
    .notEmpty().withMessage("Event type ID is required")
    .isUUID().withMessage("Event type ID must be a valid UUID"),
  body("inviteeName")
    .trim()
    .notEmpty().withMessage("Your name is required")
    .isLength({ max: 100 }).withMessage("Name must be 100 characters or fewer"),
  body("inviteeEmail")
    .trim()
    .notEmpty().withMessage("Your email is required")
    .isEmail().withMessage("Must be a valid email address")
    .normalizeEmail(),
  body("startTime")
    .notEmpty().withMessage("Start time is required")
    .isISO8601().withMessage("Start time must be a valid ISO 8601 date"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Notes must be 1000 characters or fewer"),
];
