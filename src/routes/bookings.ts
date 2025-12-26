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
router.put("/:id", updateBooking);
router.delete("/:id", deleteBooking);

export default router;
