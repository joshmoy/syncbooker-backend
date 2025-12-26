import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { EventType } from "../entities/EventType";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const createEventType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, durationMinutes, color } = req.body;

    if (!title || !durationMinutes) {
      throw new AppError("Title and duration are required", 400);
    }

    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const eventType = eventTypeRepository.create({
      userId: req.userId!,
      title,
      description,
      durationMinutes,
      color,
    });

    await eventTypeRepository.save(eventType);

    res.status(201).json({
      message: "Event type created successfully",
      eventType,
    });
  } catch (error) {
    next(error);
  }
};

export const getEventTypes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const eventTypes = await eventTypeRepository.find({
      where: { userId: req.userId! },
      order: { createdAt: "DESC" },
    });

    res.json({ eventTypes });
  } catch (error) {
    next(error);
  }
};

export const getEventTypeById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const eventType = await eventTypeRepository.findOne({
      where: { id, userId: req.userId! },
    });

    if (!eventType) {
      throw new AppError("Event type not found", 404);
    }

    res.json({ eventType });
  } catch (error) {
    next(error);
  }
};

export const updateEventType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, durationMinutes, color } = req.body;

    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const eventType = await eventTypeRepository.findOne({
      where: { id, userId: req.userId! },
    });

    if (!eventType) {
      throw new AppError("Event type not found", 404);
    }

    if (title) eventType.title = title;
    if (description !== undefined) eventType.description = description;
    if (durationMinutes) eventType.durationMinutes = durationMinutes;
    if (color) eventType.color = color;

    await eventTypeRepository.save(eventType);

    res.json({
      message: "Event type updated successfully",
      eventType,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEventType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const eventType = await eventTypeRepository.findOne({
      where: { id, userId: req.userId! },
    });

    if (!eventType) {
      throw new AppError("Event type not found", 404);
    }

    await eventTypeRepository.remove(eventType);

    res.json({ message: "Event type deleted successfully" });
  } catch (error) {
    next(error);
  }
};


