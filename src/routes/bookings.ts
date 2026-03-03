import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import {
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  generateMeetingLinkForBooking,
  rescheduleBooking,
} from "../controllers/bookingController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get("/", getBookings);
router.get("/:id", getBookingById);
router.patch("/:id/approve", updateBooking);
router.patch("/:id/reject", updateBooking);
router.post("/:id/generate-meeting-link", generateMeetingLinkForBooking);
router.patch("/:id/reschedule", rescheduleBooking);
router.put("/:id", updateBooking);
router.delete("/:id", deleteBooking);

export default router;
