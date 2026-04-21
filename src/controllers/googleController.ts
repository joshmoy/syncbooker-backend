import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { AuthRequest } from "../middleware/auth";
import { googleAuthService } from "../utils/google-calendar";
import { getJwtSecret } from "../utils/jwt";

export const getGoogleAuthUrl = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const redirectTo =
      typeof req.query.redirectTo === "string" ? req.query.redirectTo : undefined;
    const url = googleAuthService.getAuthUrl(req.userId!, redirectTo);
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
    let redirectTo: string | undefined;
    try {
      const decoded = jwt.verify(state as string, getJwtSecret()) as {
        userId: string;
        redirectTo?: string;
      };
      userId = decoded.userId;
      redirectTo = decoded.redirectTo;
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

    const safeRedirectPath =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : "/dashboard/settings";
    const redirectUrl = new URL(safeRedirectPath, process.env.FRONTEND_URL);
    redirectUrl.searchParams.set("google_connected", "true");

    res.redirect(redirectUrl.toString());
  } catch (error) {
    next(error);
  }
};
