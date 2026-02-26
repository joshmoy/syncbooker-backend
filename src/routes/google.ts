import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { getGoogleAuthUrl, googleCallback } from "../controllers/googleController";

const router = Router();

// Get auth URL (protected)
router.get("/auth-url", authenticateToken, getGoogleAuthUrl);

// Google callback (public, but handles token storage)
router.get("/callback", googleCallback);

export default router;
