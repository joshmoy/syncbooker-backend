import { Router } from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/auth";
import {
  createEventType,
  getEventTypes,
  getEventTypeById,
  updateEventType,
  deleteEventType,
  generateBookingCopySuggestions,
  generateBookingFaqSuggestions,
  generateEventTypeSuggestions,
  generateEventTypeSuggestionsFromAudio,
} from "../controllers/eventTypeController";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

// All routes require authentication
router.use(authenticateToken);

router.post("/generate-copy", generateBookingCopySuggestions);
router.post("/generate-faqs", generateBookingFaqSuggestions);
router.post("/generate-ideas", generateEventTypeSuggestions);
router.post("/generate-ideas-audio", upload.single("audio"), generateEventTypeSuggestionsFromAudio);
router.post("/", createEventType);
router.get("/", getEventTypes);
router.get("/:id", getEventTypeById);
router.put("/:id", updateEventType);
router.delete("/:id", deleteEventType);

export default router;
