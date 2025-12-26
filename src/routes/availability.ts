import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  createAvailability,
  getAvailabilities,
  updateAvailability,
  deleteAvailability,
} from "../controllers/availabilityController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post("/", createAvailability);
router.get("/", getAvailabilities);
router.put("/:id", updateAvailability);
router.delete("/:id", deleteAvailability);

export default router;


