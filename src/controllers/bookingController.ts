import { Request, Response, NextFunction } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Booking, BookingStatus } from "../entities/Booking";
import { EventType } from "../entities/EventType";
import { Availability } from "../entities/Availability";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { addMinutes, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { emailService } from "../utils/email";
import { googleCalendarService } from "../utils/google-calendar";

export const createBooking = async (
  req: Request,
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

    // Check for conflicts (both CONFIRMED and PENDING bookings reserve the slot)
    const conflictingBooking = await bookingRepository.findOne({
      where: {
        eventTypeId,
        startTime: start,
        status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
      },
    });

    if (conflictingBooking) {
      throw new AppError("This time slot is already booked or pending approval", 409);
    }

    // Create booking
    const booking = bookingRepository.create({
      eventTypeId,
      inviteeName,
      inviteeEmail,
      startTime: start,
      endTime: end,
      status: BookingStatus.PENDING,
      notes,
    });

    await bookingRepository.save(booking);

    // Send email notification to user
    await emailService.sendBookingRequestEmail(
      eventType.user.email,
      eventType.user.name,
      inviteeName,
      eventType.title,
      start
    );

    // Send email notification to invitee (visitor)
    await emailService.sendBookingRequestReceivedEmail(
      inviteeEmail,
      inviteeName,
      eventType.user.name,
      eventType.title,
      start
    );

    res.status(201).json({
      message: "Booking requested successfully. Please wait for approval.",
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

    if (eventTypeIds.length === 0) {
      res.json({ bookings: [] });
      return;
    }

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
      relations: ["eventType", "eventType.user"],
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
      
      const oldStatus = booking.status;
      booking.status = status;

      // Send email notifications based on status change
      if (oldStatus === BookingStatus.PENDING && status === BookingStatus.CONFIRMED) {
        // Create Google Calendar event if user has connected their account
        if (booking.eventType.user.googleRefreshToken) {
          try {
            const googleEvent = await googleCalendarService.createEvent(
              booking.eventType.user.googleRefreshToken,
              {
                title: `${booking.eventType.title}: ${booking.inviteeName}`,
                description: booking.notes || undefined,
                startTime: new Date(booking.startTime),
                endTime: new Date(booking.endTime),
                inviteeEmail: booking.inviteeEmail,
                inviteeName: booking.inviteeName,
              }
            );
            booking.googleEventId = googleEvent.googleEventId || null;
            booking.meetingLink = googleEvent.meetingLink || null;
          } catch (error) {
            console.error("Failed to create Google Calendar event:", error);
          }
        }

        await emailService.sendBookingConfirmedEmail(
          booking.inviteeEmail,
          booking.inviteeName,
          booking.eventType.user.name,
          booking.eventType.title,
          booking.startTime,
          booking.meetingLink || undefined // Pass meeting link to email
        );
      } else if (status === BookingStatus.CANCELLED) {
        await emailService.sendBookingRejectedEmail(
          booking.inviteeEmail,
          booking.inviteeName,
          booking.eventType.user.name,
          booking.eventType.title,
          booking.startTime
        );
      }
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
      relations: ["eventType", "eventType.user"],
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

    // Instead of removing, update status to CANCELLED
    booking.status = BookingStatus.CANCELLED;
    await bookingRepository.save(booking);

    // Delete Google Calendar event if it exists
    if (booking.eventType.user.googleRefreshToken && booking.googleEventId) {
      try {
        await googleCalendarService.deleteEvent(
          booking.eventType.user.googleRefreshToken,
          booking.googleEventId
        );
      } catch (error) {
        console.error("Failed to delete Google Calendar event:", error);
      }
    }

    // Send cancellation email to invitee
    await emailService.sendBookingRejectedEmail(
      booking.inviteeEmail,
      booking.inviteeName,
      eventType.user.name,
      eventType.title,
      booking.startTime
    );

    res.json({ message: "Booking cancelled successfully", booking });
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
        status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
      },
      select: ["id", "startTime", "endTime", "status"],
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

    // Get existing bookings (both CONFIRMED and PENDING reserve the slot)
    const bookings = await bookingRepository.find({
      where: {
        eventTypeId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
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
