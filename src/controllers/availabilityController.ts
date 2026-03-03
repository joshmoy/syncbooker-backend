import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { Availability } from "../entities/Availability";
import { User } from "../entities/User";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { googleCalendarService } from "../utils/google-calendar";

/**
 * Returns the next `count` UTC date windows for a given day-of-week + time range.
 * dayOfWeek: 0 (Sun) – 6 (Sat), startTime/endTime: "HH:mm:ss"
 */
function getNextOccurrences(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  count: number
): Array<{ start: Date; end: Date }> {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const now = new Date();
  const daysUntilNext = (dayOfWeek - now.getUTCDay() + 7) % 7;

  const windows: Array<{ start: Date; end: Date }> = [];
  for (let i = 0; i < count; i++) {
    const offset = daysUntilNext + i * 7;
    const start = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset,
      startHour, startMin, 0
    ));
    const end = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset,
      endHour, endMin, 0
    ));
    windows.push({ start, end });
  }
  return windows;
}

export const createAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dayOfWeek, startTime, endTime, timezone } = req.body;

    if (dayOfWeek === undefined || !startTime || !endTime) {
      throw new AppError("Day of week, start time, and end time are required", 400);
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new AppError("Day of week must be between 0 (Sunday) and 6 (Saturday)", 400);
    }

    // Check Google Calendar for conflicts if the user has connected their account
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.userId! },
      select: ["id", "googleRefreshToken"],
    });

    if (user?.googleRefreshToken) {
      try {
        const windows = getNextOccurrences(dayOfWeek, startTime, endTime, 4);
        const busyPeriods = await googleCalendarService.checkFreeBusy(user.googleRefreshToken, windows);

        if (busyPeriods.length > 0) {
          const conflicts = busyPeriods
            .map((b) => {
              const start = new Date(b.start);
              const end = new Date(b.end);
              return `${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}–${end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
            })
            .join(", ");
          throw new AppError(
            `This time slot conflicts with events on your Google Calendar: ${conflicts}`,
            409
          );
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        console.error("Failed to check Google Calendar freebusy:", error);
        // Non-fatal: if the check itself fails (e.g. token expired), proceed with save
      }
    }

    const availabilityRepository = AppDataSource.getRepository(Availability);

    const availability = availabilityRepository.create({
      userId: req.userId!,
      dayOfWeek,
      startTime,
      endTime,
      timezone: timezone || "UTC",
    });

    await availabilityRepository.save(availability);

    res.status(201).json({
      message: "Availability created successfully",
      availability,
    });
  } catch (error) {
    next(error);
  }
};

export const getAvailabilities = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const availabilityRepository = AppDataSource.getRepository(Availability);

    const availabilities = await availabilityRepository.find({
      where: { userId: req.userId! },
      order: { dayOfWeek: "ASC", startTime: "ASC" },
    });

    res.json({ availabilities });
  } catch (error) {
    next(error);
  }
};

export const updateAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, timezone } = req.body;

    const availabilityRepository = AppDataSource.getRepository(Availability);

    const availability = await availabilityRepository.findOne({
      where: { id, userId: req.userId! },
    });

    if (!availability) {
      throw new AppError("Availability not found", 404);
    }

    if (dayOfWeek !== undefined) {
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        throw new AppError("Day of week must be between 0 (Sunday) and 6 (Saturday)", 400);
      }
      availability.dayOfWeek = dayOfWeek;
    }
    if (startTime) availability.startTime = startTime;
    if (endTime) availability.endTime = endTime;
    if (timezone) availability.timezone = timezone;

    await availabilityRepository.save(availability);

    res.json({
      message: "Availability updated successfully",
      availability,
    });
  } catch (error) {
    next(error);
  }
};

export const replaceAvailabilities = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slots } = req.body as {
      slots: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        timezone?: string;
      }>;
    };

    if (!Array.isArray(slots)) {
      throw new AppError("slots must be an array", 400);
    }

    for (const slot of slots) {
      if (slot.dayOfWeek === undefined || !slot.startTime || !slot.endTime) {
        throw new AppError(
          "Each slot must have dayOfWeek, startTime, and endTime",
          400
        );
      }
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new AppError(
          "dayOfWeek must be between 0 (Sunday) and 6 (Saturday)",
          400
        );
      }
    }

    // Check Google Calendar conflicts for ALL slots upfront
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.userId! },
      select: ["id", "googleRefreshToken"],
    });

    if (user?.googleRefreshToken && slots.length > 0) {
      try {
        const allWindows = slots.flatMap((slot) =>
          getNextOccurrences(slot.dayOfWeek, slot.startTime, slot.endTime, 4)
        );
        const busyPeriods = await googleCalendarService.checkFreeBusy(
          user.googleRefreshToken,
          allWindows
        );

        if (busyPeriods.length > 0) {
          const conflicts = busyPeriods
            .map((b) => {
              const start = new Date(b.start);
              const end = new Date(b.end);
              return `${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}–${end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
            })
            .join(", ");
          throw new AppError(
            `These time slots conflict with events on your Google Calendar: ${conflicts}`,
            409
          );
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        console.error("Failed to check Google Calendar freebusy:", error);
      }
    }

    // Atomically replace all availability in a single transaction
    await AppDataSource.transaction(async (manager) => {
      await manager.delete(Availability, { userId: req.userId! });

      if (slots.length > 0) {
        const entities = slots.map((slot) => {
          const entity = new Availability();
          entity.userId = req.userId!;
          entity.dayOfWeek = slot.dayOfWeek;
          entity.startTime = slot.startTime;
          entity.endTime = slot.endTime;
          entity.timezone = slot.timezone || "UTC";
          return entity;
        });
        await manager.save(entities);
      }
    });

    const availabilityRepository = AppDataSource.getRepository(Availability);
    const availabilities = await availabilityRepository.find({
      where: { userId: req.userId! },
      order: { dayOfWeek: "ASC", startTime: "ASC" },
    });

    res.json({ message: "Availability updated successfully", availabilities });
  } catch (error) {
    next(error);
  }
};

export const deleteAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const availabilityRepository = AppDataSource.getRepository(Availability);

    const availability = await availabilityRepository.findOne({
      where: { id, userId: req.userId! },
    });

    if (!availability) {
      throw new AppError("Availability not found", 404);
    }

    await availabilityRepository.remove(availability);

    res.json({ message: "Availability deleted successfully" });
  } catch (error) {
    next(error);
  }
};
