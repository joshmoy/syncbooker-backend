import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { AppError } from "../middleware/errorHandler";
import { generateToken } from "../utils/jwt";

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

    if (existingUser) {
      throw new AppError("User with this email or username already exists", 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = userRepository.create({
      name,
      email,
      passwordHash,
      username: username || email.split("@")[0],
    });

    await userRepository.save(user);

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
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
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};


