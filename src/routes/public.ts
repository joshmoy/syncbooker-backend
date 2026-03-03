import { Router } from "express";
import { getPublicEventType } from "../controllers/eventTypeController";
import {
  createBooking,
  getPublicBookings,
  getAvailableSlots,
} from "../controllers/bookingController";
import { trackVisitor } from "../controllers/visitorController";
import { bookingLimiter, visitorLimiter } from "../middleware/rateLimiter";

const router = Router();

// Public Event Type Routes
router.get("/event-type/:id", getPublicEventType);

// Public Booking Routes
router.get("/event-type/:eventTypeId/slots", getAvailableSlots);
router.get("/event-type/:eventTypeId/bookings", getPublicBookings);
router.post("/book", bookingLimiter, createBooking);

// Visitor Tracking Route
router.post("/track-visitor", visitorLimiter, trackVisitor);

export default router;

