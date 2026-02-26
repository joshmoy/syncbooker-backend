import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { getDashboardStats } from "../controllers/dashboardController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get("/stats", getDashboardStats);

export default router;
