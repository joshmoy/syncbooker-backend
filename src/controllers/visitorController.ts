import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { Visitor } from "../entities/Visitor";
import { User } from "../entities/User";

export const trackVisitor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, pagePath } = req.body;

    if (!username) {
      res.status(400).json({ message: "Username is required" });
      return;
    }

    const userRepository = AppDataSource.getRepository(User);
    const visitorRepository = AppDataSource.getRepository(Visitor);

    const user = await userRepository.findOne({ where: { username } });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const visitor = visitorRepository.create({
      userId: user.id,
      ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
      userAgent: req.headers["user-agent"] || null,
      pagePath: pagePath || null,
    });

    await visitorRepository.save(visitor);

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
};
