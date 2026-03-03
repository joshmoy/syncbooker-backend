import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  createAvailability,
  getAvailabilities,
  updateAvailability,
  deleteAvailability,
  replaceAvailabilities,
} from "../controllers/availabilityController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post("/", createAvailability);
router.get("/", getAvailabilities);
router.put("/", replaceAvailabilities);
router.put("/:id", updateAvailability);
router.delete("/:id", deleteAvailability);

export default router;


