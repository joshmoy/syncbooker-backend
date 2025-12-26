import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { Booking, BookingStatus } from "../entities/Booking";
import { EventType } from "../entities/EventType";
import { Availability } from "../entities/Availability";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { addMinutes, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

export const createBooking = async (
  req: Request | AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventTypeId, inviteeName, inviteeEmail, startTime, notes } = req.body;

    if (!eventTypeId || !inviteeName || !inviteeEmail || !startTime) {
      throw new AppError("Event type, invitee details, and start time are required", 400);
    }

    const eventTypeRepository = AppDataSource.getRepository(EventType);
    const bookingRepository = AppDataSource.getRepository(Booking);

    // Get event type
    const eventType = await eventTypeRepository.findOne({
      where: { id: eventTypeId },
      relations: ["user"],
    });

    if (!eventType) {
      throw new AppError("Event type not found", 404);
    }

    const start = new Date(startTime);
    const end = addMinutes(start, eventType.durationMinutes);

    // Check for conflicts
    const conflictingBooking = await bookingRepository.findOne({
      where: {
        eventTypeId,
        startTime: start,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (conflictingBooking) {
      throw new AppError("This time slot is already booked", 409);
    }

    // Create booking
    const booking = bookingRepository.create({
      eventTypeId,
      inviteeName,
      inviteeEmail,
      startTime: start,
      endTime: end,
      status: BookingStatus.CONFIRMED,
      notes,
    });

    await bookingRepository.save(booking);

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingRepository = AppDataSource.getRepository(Booking);
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    // Get user's event types
    const eventTypes = await eventTypeRepository.find({
      where: { userId: req.userId! },
    });

    const eventTypeIds = eventTypes.map((et) => et.id);

    const bookings = await bookingRepository.find({
      where: eventTypeIds.map((id) => ({ eventTypeId: id })),
      relations: ["eventType"],
      order: { startTime: "DESC" },
    });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingRepository = AppDataSource.getRepository(Booking);
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const booking = await bookingRepository.findOne({
      where: { id },
      relations: ["eventType"],
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Verify user owns the event type
    const eventType = await eventTypeRepository.findOne({
      where: { id: booking.eventTypeId, userId: req.userId! },
    });

    if (!eventType) {
      throw new AppError("Unauthorized", 403);
    }

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};

export const updateBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const bookingRepository = AppDataSource.getRepository(Booking);
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const booking = await bookingRepository.findOne({
      where: { id },
      relations: ["eventType"],
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Verify user owns the event type
    const eventType = await eventTypeRepository.findOne({
      where: { id: booking.eventTypeId, userId: req.userId! },
    });

    if (!eventType) {
      throw new AppError("Unauthorized", 403);
    }

    if (status) {
      if (!Object.values(BookingStatus).includes(status)) {
        throw new AppError("Invalid booking status", 400);
      }
      booking.status = status;
    }
    if (notes !== undefined) booking.notes = notes;

    await bookingRepository.save(booking);

    res.json({
      message: "Booking updated successfully",
      booking,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingRepository = AppDataSource.getRepository(Booking);
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const booking = await bookingRepository.findOne({
      where: { id },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Verify user owns the event type
    const eventType = await eventTypeRepository.findOne({
      where: { id: booking.eventTypeId, userId: req.userId! },
    });

    if (!eventType) {
      throw new AppError("Unauthorized", 403);
    }

    await bookingRepository.remove(booking);

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getPublicBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventTypeId } = req.params;
    const bookingRepository = AppDataSource.getRepository(Booking);

    const bookings = await bookingRepository.find({
      where: {
        eventTypeId,
        status: BookingStatus.CONFIRMED,
      },
      select: ["startTime", "endTime"],
      order: { startTime: "ASC" },
    });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
};

export const getAvailableSlots = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventTypeId } = req.params;
    const { startDate, endDate } = req.query;

    const eventTypeRepository = AppDataSource.getRepository(EventType);
    const availabilityRepository = AppDataSource.getRepository(Availability);
    const bookingRepository = AppDataSource.getRepository(Booking);

    // Get event type
    const eventType = await eventTypeRepository.findOne({
      where: { id: eventTypeId },
      relations: ["user"],
    });

    if (!eventType) {
      throw new AppError("Event type not found", 404);
    }

    // Get user's availability
    const availabilities = await availabilityRepository.find({
      where: { userId: eventType.userId },
    });

    if (availabilities.length === 0) {
      res.json({ slots: [] });
      return;
    }

    // Get existing bookings
    const bookings = await bookingRepository.find({
      where: {
        eventTypeId,
        status: BookingStatus.CONFIRMED,
      },
    });

    // Calculate available slots
    const slots: { startTime: Date; endTime: Date }[] = [];
    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : addMinutes(start, 30 * 24 * 60); // 30 days

    // Simple slot generation logic (can be enhanced)
    // This is a basic implementation - you'd want to make this more sophisticated
    for (let date = start; date <= end; date = addMinutes(date, 24 * 60)) {
      const dayOfWeek = date.getDay();
      const dayAvailability = availabilities.find((a) => a.dayOfWeek === dayOfWeek);

      if (dayAvailability) {
        // Generate slots for this day
        // This is simplified - you'd want proper time parsing and slot generation
        const slotStart = new Date(date);
        slotStart.setHours(9, 0, 0, 0); // Example: 9 AM

        const slotEnd = addMinutes(slotStart, eventType.durationMinutes);

        // Check if slot conflicts with existing bookings
        const hasConflict = bookings.some((booking) => {
          return (
            (isAfter(slotStart, booking.startTime) && isBefore(slotStart, booking.endTime)) ||
            (isAfter(booking.startTime, slotStart) && isBefore(booking.startTime, slotEnd))
          );
        });

        if (!hasConflict && isAfter(slotStart, new Date())) {
          slots.push({ startTime: slotStart, endTime: slotEnd });
        }
      }
    }

    res.json({ slots });
  } catch (error) {
    next(error);
  }
};


