import { Request, Response, NextFunction } from "express";
import { In, Not } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Booking, BookingStatus } from "../entities/Booking";
import { EventType } from "../entities/EventType";
import { Availability } from "../entities/Availability";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { addMinutes, isAfter, isBefore, isPast } from "date-fns";
import { emailService } from "../utils/email";
import { googleCalendarService } from "../utils/google-calendar";
import { generateMeetingLink } from "../services/meetingLinkService";

export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
      start,
    );

    // Send email notification to invitee (visitor)
    await emailService.sendBookingRequestReceivedEmail(
      inviteeEmail,
      inviteeName,
      eventType.user.name,
      eventType.title,
      start,
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
  next: NextFunction,
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
  next: NextFunction,
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
  next: NextFunction,
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

    if (isPast(new Date(booking.startTime))) {
      throw new AppError("Cannot modify a past booking", 400);
    }

    if (status) {
      if (!Object.values(BookingStatus).includes(status)) {
        throw new AppError("Invalid booking status", 400);
      }

      const oldStatus = booking.status;

      booking.status = status;

      // Send email notifications based on status change
      if (oldStatus === BookingStatus.PENDING && status === BookingStatus.CONFIRMED) {
        booking.confirmedAt = new Date();
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
              },
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
          booking.meetingLink || undefined, // Pass meeting link to email
        );
      } else if (status === BookingStatus.CANCELLED) {
        await emailService.sendBookingRejectedEmail(
          booking.inviteeEmail,
          booking.inviteeName,
          booking.eventType.user.name,
          booking.eventType.title,
          booking.startTime,
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

export const generateMeetingLinkForBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
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

    const eventType = await eventTypeRepository.findOne({
      where: { id: booking.eventTypeId, userId: req.userId! },
    });

    if (!eventType) {
      throw new AppError("Unauthorized", 403);
    }

    if (isPast(new Date(booking.startTime))) {
      throw new AppError("Cannot generate a meeting link for a past booking", 400);
    }

    const result = await generateMeetingLink(booking);
    booking.googleEventId = result.googleEventId;
    booking.meetingLink = result.meetingLink;
    await bookingRepository.save(booking);

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
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

    if (isPast(new Date(booking.startTime))) {
      throw new AppError("Cannot cancel a past booking", 400);
    }

    // Instead of removing, update status to CANCELLED
    booking.status = BookingStatus.CANCELLED;
    await bookingRepository.save(booking);

    // Delete Google Calendar event if it exists
    if (booking.eventType.user.googleRefreshToken && booking.googleEventId) {
      try {
        await googleCalendarService.deleteEvent(
          booking.eventType.user.googleRefreshToken,
          booking.googleEventId,
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
      booking.startTime,
    );

    res.json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    next(error);
  }
};

export const getPublicBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
  next: NextFunction,
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

    const now = new Date();
    const rangeStart = startDate ? new Date(startDate as string) : now;
    const rangeEnd = endDate
      ? new Date(endDate as string)
      : addMinutes(rangeStart, 30 * 24 * 60); // 30 days

    // Group availabilities by day of week (a day can have multiple windows)
    const availabilityByDay = new Map<number, Availability[]>();
    for (const avail of availabilities) {
      if (!availabilityByDay.has(avail.dayOfWeek)) {
        availabilityByDay.set(avail.dayOfWeek, []);
      }
      availabilityByDay.get(avail.dayOfWeek)!.push(avail);
    }

    const slots: { startTime: Date; endTime: Date }[] = [];

    // Start from the beginning of rangeStart day in UTC
    const cursor = new Date(
      Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate())
    );

    while (cursor <= rangeEnd) {
      const dayOfWeek = cursor.getUTCDay();
      const dayAvailabilities = availabilityByDay.get(dayOfWeek) ?? [];

      for (const avail of dayAvailabilities) {
        // Parse "HH:mm:ss" availability windows (stored in UTC)
        const [startHour, startMin] = avail.startTime.split(":").map(Number);
        const [endHour, endMin] = avail.endTime.split(":").map(Number);

        const windowStart = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), startHour, startMin, 0)
        );
        const windowEnd = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), endHour, endMin, 0)
        );

        // Generate slots that fit entirely within this availability window
        let slotStart = new Date(windowStart);
        while (slotStart < windowEnd) {
          const slotEnd = addMinutes(slotStart, eventType.durationMinutes);

          if (slotEnd > windowEnd) break; // slot doesn't fit

          if (isAfter(slotStart, now)) {
            // Proper overlap check: slot conflicts if slotStart < bookingEnd AND slotEnd > bookingStart
            const hasConflict = bookings.some(
              (b) =>
                isBefore(slotStart, new Date(b.endTime)) &&
                isAfter(slotEnd, new Date(b.startTime))
            );

            if (!hasConflict) {
              slots.push({ startTime: new Date(slotStart), endTime: new Date(slotEnd) });
            }
          }

          slotStart = addMinutes(slotStart, eventType.durationMinutes);
        }
      }

      // Advance to next day
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    res.json({ slots });
  } catch (error) {
    next(error);
  }
};

export const rescheduleBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { startTime } = req.body;

    if (!startTime) {
      throw new AppError("New start time is required", 400);
    }

    const bookingRepository = AppDataSource.getRepository(Booking);

    const booking = await bookingRepository.findOne({
      where: { id },
      relations: ["eventType", "eventType.user"],
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.eventType.userId !== req.userId!) {
      throw new AppError("Not authorized to reschedule this booking", 403);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError("Cannot reschedule a cancelled booking", 400);
    }

    const newStart = new Date(startTime);

    if (isPast(newStart)) {
      throw new AppError("Cannot reschedule to a past time", 400);
    }

    const newEnd = addMinutes(newStart, booking.eventType.durationMinutes);

    // Check for conflicts with other bookings (excluding this one)
    const conflict = await bookingRepository.findOne({
      where: {
        id: Not(id),
        eventTypeId: booking.eventTypeId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
        startTime: newStart,
      },
    });

    if (conflict) {
      throw new AppError("This time slot is already booked", 409);
    }

    booking.startTime = newStart;
    booking.endTime = newEnd;
    booking.rescheduledAt = new Date();
    booking.meetingReminderSentAt = null; // reset so reminder fires for the new time
    await bookingRepository.save(booking);

    // Notify invitee of the new time
    await emailService.sendBookingRescheduledEmail(
      booking.inviteeEmail,
      booking.inviteeName,
      booking.eventType.user.name,
      booking.eventType.title,
      newStart,
      booking.meetingLink ?? undefined
    );

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};
