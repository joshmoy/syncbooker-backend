import { Router } from "express";
import { getPublicEventType } from "../controllers/eventTypeController";
import {
  createBooking,
  getPublicBookings,
  getAvailableSlots,
} from "../controllers/bookingController";
import { trackVisitor } from "../controllers/visitorController";

const router = Router();

// Public Event Type Routes
router.get("/event-type/:id", getPublicEventType);

// Public Booking Routes
router.get("/event-type/:eventTypeId/slots", getAvailableSlots);
router.get("/event-type/:eventTypeId/bookings", getPublicBookings);
router.post("/book", createBooking);

// Visitor Tracking Route
router.post("/track-visitor", trackVisitor);

export default router;

