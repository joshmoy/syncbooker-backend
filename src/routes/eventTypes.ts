import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  createEventType,
  getEventTypes,
  getEventTypeById,
  updateEventType,
  deleteEventType,
} from "../controllers/eventTypeController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post("/", createEventType);
router.get("/", getEventTypes);
router.get("/:id", getEventTypeById);
router.put("/:id", updateEventType);
router.delete("/:id", deleteEventType);

export default router;
