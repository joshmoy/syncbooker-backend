import { Router } from "express";
import { register, login, forgotPassword, resetPassword, verifyEmail, resendVerification } from "../controllers/authController";
import { authLimiter } from "../middleware/rateLimiter";
import {
  validate,
  registerValidators,
  loginValidators,
  forgotPasswordValidators,
  resetPasswordValidators,
} from "../middleware/validate";

const router = Router();

router.post("/register", authLimiter, registerValidators, validate, register);
router.post("/login", authLimiter, loginValidators, validate, login);
router.post("/forgot-password", authLimiter, forgotPasswordValidators, validate, forgotPassword);
router.post("/reset-password", authLimiter, resetPasswordValidators, validate, resetPassword);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", authLimiter, resendVerification);

export default router;


