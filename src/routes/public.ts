import { Router } from "express";
import { getPublicEventType } from "../controllers/eventTypeController";
import {
  createBooking,
  getPublicBookings,
  getAvailableSlots,
} from "../controllers/bookingController";

const router = Router();

// Public Event Type Routes
router.get("/event-type/:id", getPublicEventType);

// Public Booking Routes
router.get("/event-type/:eventTypeId/slots", getAvailableSlots);
router.get("/event-type/:eventTypeId/bookings", getPublicBookings);
router.post("/book", createBooking);

export default router;

