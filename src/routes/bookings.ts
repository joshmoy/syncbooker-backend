import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  getPublicBookings,
  getAvailableSlots,
} from "../controllers/bookingController";

const router = Router();

// Public routes (no auth required)
router.get("/public/event-type/:eventTypeId/slots", getAvailableSlots);
router.get("/public/event-type/:eventTypeId/bookings", getPublicBookings);
router.post("/public/book", createBooking);

// Protected routes (require authentication)
router.use(authenticateToken);

router.get("/", getBookings);
router.get("/:id", getBookingById);
router.put("/:id", updateBooking);
router.delete("/:id", deleteBooking);

export default router;


