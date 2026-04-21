import { Request, Response, NextFunction } from "express";
import { In } from "typeorm";
import { v4 as uuidv4 } from "uuid";
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
import {
  findAvailabilityForDateTimeRange,
  getAvailabilityWindowsInRange,
} from "../utils/timezone";

// Postgres SQLSTATE for exclusion_violation — raised when the
// `bookings_no_overlap` EXCLUDE constraint rejects an overlapping booking.
const PG_EXCLUSION_VIOLATION = "23P01";

const isOverlapConstraintViolation = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; constraint?: string };
  return (
    err.code === PG_EXCLUSION_VIOLATION ||
    err.constraint === "bookings_no_overlap"
  );
};

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
    const availabilityRepository = AppDataSource.getRepository(Availability);

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
    const availabilities = await availabilityRepository.find({
      where: { userId: eventType.userId },
    });
    const matchingAvailability = findAvailabilityForDateTimeRange(
      availabilities,
      start,
      end,
    );

    if (!matchingAvailability) {
      throw new AppError("This time slot is no longer available", 409);
    }

    // Create the booking inside a transaction. The DB-level exclusion
    // constraint (`bookings_no_overlap`) is the source of truth for
    // preventing overlaps: two concurrent requests that both pass the
    // application-level overlap check cannot both succeed here.
    let booking: Booking;
    try {
      booking = await AppDataSource.transaction(async (manager) => {
        const txBookings = manager.getRepository(Booking);

        // Overlap check: existing non-cancelled booking whose interval
        // intersects [start, end) for this event type.
        const conflictingBooking = await txBookings
          .createQueryBuilder("booking")
          .where("booking.eventTypeId = :eventTypeId", { eventTypeId })
          .andWhere("booking.status IN (:...statuses)", {
            statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          })
          .andWhere("booking.startTime < :end", { end })
          .andWhere("booking.endTime > :start", { start })
          .getOne();

        if (conflictingBooking) {
          throw new AppError(
            "This time slot is already booked or pending approval",
            409,
          );
        }

        const newBooking = txBookings.create({
          eventTypeId,
          inviteeName,
          inviteeEmail,
          startTime: start,
          endTime: end,
          timezone: matchingAvailability.timezone,
          status: BookingStatus.PENDING,
          notes,
          cancelToken: uuidv4(),
        });

        return txBookings.save(newBooking);
      });
    } catch (err) {
      if (isOverlapConstraintViolation(err)) {
        throw new AppError(
          "This time slot is already booked or pending approval",
          409,
        );
      }
      throw err;
    }

    // Send email notification to user
    await emailService.sendBookingRequestEmail(
      eventType.user.email,
      eventType.user.name,
      inviteeName,
      eventType.title,
      start,
      matchingAvailability.timezone,
    );

    // Send email notification to invitee (visitor)
    await emailService.sendBookingRequestReceivedEmail(
      inviteeEmail,
      inviteeName,
      eventType.user.name,
      eventType.title,
      start,
      matchingAvailability.timezone,
      booking.cancelToken!,
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
                timeZone: booking.timezone,
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
          booking.timezone,
          booking.meetingLink || undefined,
          booking.cancelToken || undefined,
        );
      } else if (status === BookingStatus.CANCELLED) {
        await emailService.sendBookingRejectedEmail(
          booking.inviteeEmail,
          booking.inviteeName,
          booking.eventType.user.name,
          booking.eventType.title,
          booking.startTime,
          booking.timezone,
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
      booking.timezone,
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

    const slots: { startTime: Date; endTime: Date; timezone: string }[] = [];

    for (const availability of availabilities) {
      const windows = getAvailabilityWindowsInRange(
        availability,
        rangeStart,
        rangeEnd,
      );

      for (const window of windows) {
        let slotStart = new Date(window.start);

        while (slotStart < window.end) {
          const slotEnd = addMinutes(slotStart, eventType.durationMinutes);

          if (slotEnd > window.end) {
            break;
          }

          if (
            isAfter(slotStart, now) &&
            !isBefore(slotStart, rangeStart) &&
            !isAfter(slotStart, rangeEnd)
          ) {
            const hasConflict = bookings.some(
              (b) =>
                isBefore(slotStart, new Date(b.endTime)) &&
                isAfter(slotEnd, new Date(b.startTime))
            );

            if (!hasConflict) {
              slots.push({
                startTime: new Date(slotStart),
                endTime: new Date(slotEnd),
                timezone: window.timeZone,
              });
            }
          }

          slotStart = addMinutes(slotStart, eventType.durationMinutes);
        }
      }
    }

    slots.sort((left, right) => left.startTime.getTime() - right.startTime.getTime());

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
    const availabilityRepository = AppDataSource.getRepository(Availability);

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
    const availabilities = await availabilityRepository.find({
      where: { userId: booking.eventType.userId },
    });
    const matchingAvailability = findAvailabilityForDateTimeRange(
      availabilities,
      newStart,
      newEnd,
    );

    if (!matchingAvailability) {
      throw new AppError("This time slot is no longer available", 409);
    }

    // Run the overlap check and the update inside one transaction. The
    // DB-level exclusion constraint (`bookings_no_overlap`) guarantees
    // correctness even if two rescheduling requests race.
    try {
      await AppDataSource.transaction(async (manager) => {
        const txBookings = manager.getRepository(Booking);

        const conflict = await txBookings
          .createQueryBuilder("booking")
          .where("booking.id != :id", { id })
          .andWhere("booking.eventTypeId = :eventTypeId", {
            eventTypeId: booking.eventTypeId,
          })
          .andWhere("booking.status IN (:...statuses)", {
            statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          })
          .andWhere("booking.startTime < :newEnd", { newEnd })
          .andWhere("booking.endTime > :newStart", { newStart })
          .getOne();

        if (conflict) {
          throw new AppError("This time slot is already booked", 409);
        }

        booking.startTime = newStart;
        booking.endTime = newEnd;
        booking.timezone = matchingAvailability.timezone;
        booking.rescheduledAt = new Date();
        booking.meetingReminderSentAt = null; // reset so reminder fires for the new time
        await txBookings.save(booking);
      });
    } catch (err) {
      if (isOverlapConstraintViolation(err)) {
        throw new AppError("This time slot is already booked", 409);
      }
      throw err;
    }

    // Notify invitee of the new time
    await emailService.sendBookingRescheduledEmail(
      booking.inviteeEmail,
      booking.inviteeName,
      booking.eventType.user.name,
      booking.eventType.title,
      newStart,
      booking.timezone,
      booking.meetingLink ?? undefined
    );

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};

export const cancelBookingByToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { cancelToken } = req.params;
    const bookingRepository = AppDataSource.getRepository(Booking);

    const booking = await bookingRepository.findOne({
      where: { cancelToken },
      relations: ["eventType", "eventType.user"],
    });

    if (!booking) {
      throw new AppError("Invalid or expired cancellation link", 404);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      res.json({ message: "This booking has already been cancelled.", booking });
      return;
    }

    if (isPast(new Date(booking.startTime))) {
      throw new AppError("Cannot cancel a booking that has already passed", 400);
    }

    booking.status = BookingStatus.CANCELLED;
    await bookingRepository.save(booking);

    // Delete Google Calendar event if it exists
    if (booking.eventType.user.googleRefreshToken && booking.googleEventId) {
      try {
        await googleCalendarService.deleteEvent(
          booking.eventType.user.googleRefreshToken,
          booking.googleEventId,
        );
      } catch (err) {
        console.error("Failed to delete Google Calendar event:", err);
      }
    }

    // Notify host of the cancellation
    await emailService.sendBookingRejectedEmail(
      booking.eventType.user.email,
      booking.eventType.user.name,
      booking.inviteeName,
      booking.eventType.title,
      booking.startTime,
      booking.timezone,
    );

    res.json({ message: "Booking cancelled successfully.", booking });
  } catch (error) {
    next(error);
  }
};
