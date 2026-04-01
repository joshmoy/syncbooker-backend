import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { EventType } from "../entities/EventType";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import {
  generateBookingCopy,
  type BookingCopyTone,
} from "../services/bookingCopyAssistantService";
import { generateBookingFaqs } from "../services/bookingFaqAssistantService";
import type { EventTypeFaq } from "../entities/EventType";

function isBookingCopyTone(value: string): value is BookingCopyTone {
  return [
    "professional",
    "friendly",
    "consultative",
    "sales",
    "supportive",
  ].includes(value);
}

function normalizeFaqs(value: unknown): EventTypeFaq[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const faqs = value
    .map((faq) => {
      if (!faq || typeof faq !== "object") {
        return null;
      }

      const question = "question" in faq && typeof faq.question === "string"
        ? faq.question.trim()
        : "";
      const answer = "answer" in faq && typeof faq.answer === "string"
        ? faq.answer.trim()
        : "";

      if (!question || !answer) {
        return null;
      }

      return { question, answer };
    })
    .filter((faq): faq is EventTypeFaq => Boolean(faq))
    .slice(0, 4);

  return faqs;
}

export const createEventType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, durationMinutes, color, faqs } = req.body;

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
      faqs: normalizeFaqs(faqs) || null,
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
    const { title, description, durationMinutes, color, faqs } = req.body;

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
    if (faqs !== undefined) eventType.faqs = normalizeFaqs(faqs) || null;

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

export const generateBookingCopySuggestions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      title,
      durationMinutes,
      audience,
      goal,
      tone,
      additionalContext,
      existingDescription,
    } = req.body;

    if (!title || !String(title).trim()) {
      throw new AppError("Event title is required to generate booking copy", 400);
    }

    const result = await generateBookingCopy({
      title: String(title).trim(),
      durationMinutes:
        typeof durationMinutes === "number" && Number.isFinite(durationMinutes)
          ? durationMinutes
          : undefined,
      audience: typeof audience === "string" ? audience : undefined,
      goal: typeof goal === "string" ? goal : undefined,
      tone: typeof tone === "string" && isBookingCopyTone(tone) ? tone : undefined,
      additionalContext:
        typeof additionalContext === "string" ? additionalContext : undefined,
      existingDescription:
        typeof existingDescription === "string" ? existingDescription : undefined,
    });

    res.json({
      message: "Booking copy generated successfully",
      provider: result.provider,
      suggestions: result.suggestions,
    });
  } catch (error) {
    next(error);
  }
};

export const generateBookingFaqSuggestions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, businessType, audience } = req.body;

    if (!title || !String(title).trim()) {
      throw new AppError("Event title is required to generate FAQs", 400);
    }

    const result = await generateBookingFaqs({
      title: String(title).trim(),
      description: typeof description === "string" ? description : undefined,
      businessType: typeof businessType === "string" ? businessType : undefined,
      audience: typeof audience === "string" ? audience : undefined,
    });

    res.json({
      message: "Booking FAQs generated successfully",
      provider: result.provider,
      faqs: result.faqs,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicEventType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    const eventType = await eventTypeRepository.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!eventType) {
      throw new AppError("Event type not found", 404);
    }

    // Return public-safe event type information
    res.json({
      eventType: {
        id: eventType.id,
        title: eventType.title,
        description: eventType.description,
        durationMinutes: eventType.durationMinutes,
        color: eventType.color,
        faqs: eventType.faqs,
        createdAt: eventType.createdAt,
        updatedAt: eventType.updatedAt,
        // Include minimal user info
        user: {
          name: eventType.user.name,
          username: eventType.user.username,
          displayPicture: eventType.user.displayPicture,
          banner: eventType.user.banner,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
