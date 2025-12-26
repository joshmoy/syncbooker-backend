import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { Availability } from "../entities/Availability";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

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


