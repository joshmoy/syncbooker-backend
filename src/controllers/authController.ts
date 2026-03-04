import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { ResetToken } from "../entities/ResetToken";
import { AppError } from "../middleware/errorHandler";
import { generateToken } from "../utils/jwt";
import { generateResetToken, hashResetToken } from "../utils/resetToken";
import { emailService } from "../utils/email";

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, username } = req.body;

    if (!name || !email || !password) {
      throw new AppError("Name, email, and password are required", 400);
    }

    const userRepository = AppDataSource.getRepository(User);

    // Check if user already exists
    const existingUser = await userRepository.findOne({
      where: [{ email }, ...(username ? [{ username }] : [])],
    });

    console.log("existingUser check:", {
      email,
      username,
      found: !!existingUser,
      foundEmail: existingUser?.email,
    });

    if (existingUser) {
      throw new AppError("User with this email or username already exists", 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const verificationToken = uuidv4();
    const user = userRepository.create({
      name,
      email,
      passwordHash,
      username: username || email.split("@")[0],
      emailVerified: false,
      emailVerificationToken: verificationToken,
    });

    await userRepository.save(user);

    // Generate token
    const token = generateToken(user.id);

    // Send verification email (replaces welcome email)
    await emailService.sendEmailVerificationEmail(user.email, user.name, verificationToken);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        displayPicture: user.displayPicture,
        banner: user.banner,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const userRepository = AppDataSource.getRepository(User);

    // Find user
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      throw new AppError("Invalid email or password", 401);
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        displayPicture: user.displayPicture,
        banner: user.banner,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError("Email is required", 400);
    }

    const userRepository = AppDataSource.getRepository(User);
    const resetTokenRepository = AppDataSource.getRepository(ResetToken);

    // Find user by email
    const user = await userRepository.findOne({ where: { email } });

    // Always return success to prevent email enumeration
    // Don't reveal if email exists or not
    res.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });

    // If user doesn't exist, don't proceed
    if (!user) {
      return;
    }

    // Invalidate any existing reset tokens for this user
    await resetTokenRepository.update({ userId: user.id, used: false }, { used: true });

    // Generate reset token
    const resetToken = generateResetToken();
    const hashedToken = hashResetToken(resetToken);

    // Set token expiry (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Create reset token record
    const tokenRecord = resetTokenRepository.create({
      userId: user.id,
      tokenHash: hashedToken,
      expiresAt,
      used: false,
    });

    await resetTokenRepository.save(tokenRecord);

    // Send email with reset link
    await emailService.sendPasswordResetEmail(user.email, resetToken);

    // For debugging, log the token (REMOVE IN PRODUCTION!)
    console.log("Password reset token for", email, ":", resetToken);
    console.log(
      "Reset link:",
      `${process.env.FRONTEND_URL || "http://localhost:3001"}/reset-password?token=${resetToken}`
    );

    // In production, send email using your email service (Maileroo, etc.)
    // await sendPasswordResetEmail(user.email, resetToken);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new AppError("Token and new password are required", 400);
    }

    if (newPassword.length < 6) {
      throw new AppError("Password must be at least 6 characters", 400);
    }

    const userRepository = AppDataSource.getRepository(User);
    const resetTokenRepository = AppDataSource.getRepository(ResetToken);

    // Hash the provided token to compare with stored hash
    const hashedToken = hashResetToken(token);

    // Find reset token that hasn't been used and hasn't expired
    const tokenRecord = await resetTokenRepository.findOne({
      where: {
        tokenHash: hashedToken,
        used: false,
      },
      relations: ["user"],
    });

    if (!tokenRecord) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    // Check if token has expired
    if (tokenRecord.expiresAt < new Date()) {
      // Mark as used (expired)
      tokenRecord.used = true;
      await resetTokenRepository.save(tokenRecord);

      throw new AppError("Reset token has expired. Please request a new one.", 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password
    const user = tokenRecord.user;
    user.passwordHash = passwordHash;
    await userRepository.save(user);

    // Mark token as used
    tokenRecord.used = true;
    await resetTokenRepository.save(tokenRecord);

    res.json({
      message: "Password has been reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    next(error);
  }
};
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.query as { token: string };
    if (!token) throw new AppError("Verification token is required", 400);

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { emailVerificationToken: token } });

    if (!user) throw new AppError("Invalid or expired verification token", 400);
    if (user.emailVerified) {
      res.json({ message: "Email already verified." });
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    await userRepository.save(user);

    res.json({ message: "Email verified successfully! You can now use all features." });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError("Email is required", 400);

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { email } });

    // Always respond the same way to prevent enumeration
    res.json({ message: "If that account exists and is unverified, a new link has been sent." });

    if (!user || user.emailVerified) return;

    const verificationToken = uuidv4();
    user.emailVerificationToken = verificationToken;
    await userRepository.save(user);
    await emailService.sendEmailVerificationEmail(user.email, user.name, verificationToken);
  } catch (error) {
    next(error);
  }
};
