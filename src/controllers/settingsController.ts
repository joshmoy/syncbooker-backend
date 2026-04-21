import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import {
  getSupabaseStorage,
  isSupabaseStorageConfigured,
} from "../config/supabase";

/**
 * Resolve the Supabase storage client for an upload handler, or throw a
 * 503 AppError if storage is not configured. Keeps the server healthy when
 * the uploads feature hasn't been set up.
 */
const requireStorage = () => {
  if (!isSupabaseStorageConfigured()) {
    throw new AppError(
      "File uploads are not configured on this server.",
      503
    );
  }
  return getSupabaseStorage();
};

export const getUserSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: req.userId! },
      select: [
        "id",
        "name",
        "email",
        "username",
        "displayPicture",
        "banner",
        "googleRefreshToken",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const { googleRefreshToken, ...rest } = user;
    res.json({ user: { ...rest, googleConnected: !!googleRefreshToken } });
  } catch (error) {
    next(error);
  }
};

export const updateUserSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, username, password, currentPassword } = req.body;

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: req.userId! },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Update name
    if (name !== undefined) {
      if (!name.trim()) {
        throw new AppError("Name cannot be empty", 400);
      }
      user.name = name.trim();
    }

    // Update username
    if (username !== undefined) {
      if (username && username.trim()) {
        // Check if username is already taken by another user
        const existingUser = await userRepository.findOne({
          where: { username: username.trim() },
        });

        if (existingUser && existingUser.id !== user.id) {
          throw new AppError("Username is already taken", 409);
        }

        user.username = username.trim();
      } else {
        user.username = null as any; // TypeORM allows null for nullable fields
      }
    }

    // Update password
    if (password !== undefined) {
      if (!password || password.length < 6) {
        throw new AppError("Password must be at least 6 characters", 400);
      }
      if (!currentPassword) {
        throw new AppError("Current password is required to set a new password", 400);
      }
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new AppError("Current password is incorrect", 401);
      }
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await userRepository.save(user);

    // Return updated user (excluding password)
    const updatedUser = await userRepository.findOne({
      where: { id: user.id },
      select: [
        "id",
        "name",
        "email",
        "username",
        "displayPicture",
        "banner",
        "createdAt",
        "updatedAt",
      ],
    });

    res.json({
      message: "Settings updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadDisplayPicture = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new AppError("No file uploaded", 400);
    }

    const { client, displayPictureBucket } = requireStorage();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.userId! },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Generate unique filename
    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `${req.userId}-${Date.now()}.${fileExt}`;

    // Upload to Supabase storage
    const { error } = await client.storage
      .from(displayPictureBucket)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      // Provide more helpful error messages
      if (error.message.includes("Bucket not found") || error.message.includes("not found")) {
        throw new AppError(
          `Storage bucket "${displayPictureBucket}" not found. Please verify the bucket name in your .env file matches the bucket name in Supabase Storage.`,
          500
        );
      }
      throw new AppError(
        `Failed to upload file to bucket "${displayPictureBucket}": ${error.message}`,
        500
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = client.storage.from(displayPictureBucket).getPublicUrl(fileName);

    // Delete old display picture if it exists
    if (user.displayPicture) {
      const oldFileName = user.displayPicture.split("/").pop();
      if (oldFileName) {
        await client.storage.from(displayPictureBucket).remove([oldFileName]);
      }
    }

    // Update user's display picture URL
    user.displayPicture = publicUrl;
    await userRepository.save(user);

    res.json({
      message: "Display picture uploaded successfully",
      displayPicture: publicUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadBanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new AppError("No file uploaded", 400);
    }

    const { client, bannerBucket } = requireStorage();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.userId! },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Generate unique filename
    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `${req.userId}-${Date.now()}.${fileExt}`;

    // Upload to Supabase storage
    const { error } = await client.storage
      .from(bannerBucket)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      // Provide more helpful error messages
      if (error.message.includes("Bucket not found") || error.message.includes("not found")) {
        throw new AppError(
          `Storage bucket "${bannerBucket}" not found. Please verify the bucket name in your .env file matches the bucket name in Supabase Storage.`,
          500
        );
      }
      throw new AppError(
        `Failed to upload file to bucket "${bannerBucket}": ${error.message}`,
        500
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = client.storage.from(bannerBucket).getPublicUrl(fileName);

    // Delete old banner if it exists
    if (user.banner) {
      const oldFileName = user.banner.split("/").pop();
      if (oldFileName) {
        await client.storage.from(bannerBucket).remove([oldFileName]);
      }
    }

    // Update user's banner URL
    user.banner = publicUrl;
    await userRepository.save(user);

    res.json({
      message: "Banner uploaded successfully",
      banner: publicUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const removeDisplayPicture = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.userId! },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (!user.displayPicture) {
      throw new AppError("Display picture not found", 404);
    }

    // Extract filename from URL
    const urlParts = user.displayPicture.split("/");
    const fileName = urlParts[urlParts.length - 1];

    // Delete file from Supabase storage if configured. If not, we still
    // clear the DB field below so the user can remove a stale URL.
    if (isSupabaseStorageConfigured()) {
      const { client, displayPictureBucket } = getSupabaseStorage();
      const { error } = await client.storage.from(displayPictureBucket).remove([fileName]);
      if (error) {
        // Log error but continue to remove from database
        console.error(`Failed to delete file from storage: ${error.message}`);
      }
    }

    // Remove from database
    user.displayPicture = null as any;
    await userRepository.save(user);

    res.json({
      message: "Display picture removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const removeBanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.userId! },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (!user.banner) {
      throw new AppError("Banner not found", 404);
    }

    // Extract filename from URL
    const urlParts = user.banner.split("/");
    const fileName = urlParts[urlParts.length - 1];

    // Delete file from Supabase storage if configured. If not, we still
    // clear the DB field below so the user can remove a stale URL.
    if (isSupabaseStorageConfigured()) {
      const { client, bannerBucket } = getSupabaseStorage();
      const { error } = await client.storage.from(bannerBucket).remove([fileName]);
      if (error) {
        // Log error but continue to remove from database
        console.error(`Failed to delete file from storage: ${error.message}`);
      }
    }

    // Remove from database
    user.banner = null as any;
    await userRepository.save(user);

    res.json({
      message: "Banner removed successfully",
    });
  } catch (error) {
    next(error);
  }
};
