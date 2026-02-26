import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import {
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
} from "../controllers/bookingController";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get("/", getBookings);
router.get("/:id", getBookingById);
router.patch("/:id/approve", updateBooking); // We'll use updateBooking for now or add specific ones
router.patch("/:id/reject", updateBooking);
router.put("/:id", updateBooking);
router.delete("/:id", deleteBooking);

export default router;
