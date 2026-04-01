import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  createEventType,
  getEventTypes,
  getEventTypeById,
  updateEventType,
  deleteEventType,
  generateBookingCopySuggestions,
  generateBookingFaqSuggestions,
} from "../controllers/eventTypeController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post("/generate-copy", generateBookingCopySuggestions);
router.post("/generate-faqs", generateBookingFaqSuggestions);
router.post("/", createEventType);
router.get("/", getEventTypes);
router.get("/:id", getEventTypeById);
router.put("/:id", updateEventType);
router.delete("/:id", deleteEventType);

export default router;
