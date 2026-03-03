import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { AuthRequest } from "../middleware/auth";
import { googleAuthService } from "../utils/google-calendar";

export const getGoogleAuthUrl = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const url = googleAuthService.getAuthUrl(req.userId!);
    res.json({ url });
  } catch (error) {
    next(error);
  }
};

export const googleCallback = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code, state } = req.query;

    if (!code) {
      res.status(400).send("No code provided");
      return;
    }

    if (!state) {
      res.status(400).send("Missing state parameter");
      return;
    }

    let userId: string;
    try {
      const decoded = jwt.verify(
        state as string,
        process.env.JWT_SECRET || "fallback-secret"
      ) as { userId: string };
      userId = decoded.userId;
    } catch {
      res.status(400).send("Invalid or expired state parameter");
      return;
    }

    const tokens = await googleAuthService.getTokens(code as string);

    if (tokens.refresh_token) {
      const userRepository = AppDataSource.getRepository(User);
      await userRepository.update(userId, {
        googleRefreshToken: tokens.refresh_token,
      });
    }

    // Redirect back to frontend settings
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?google_connected=true`);
  } catch (error) {
    next(error);
  }
};
