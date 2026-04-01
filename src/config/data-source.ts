import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { User } from "../entities/User";
import { EventType } from "../entities/EventType";
import { Availability } from "../entities/Availability";
import { Booking } from "../entities/Booking";
import { ResetToken } from "../entities/ResetToken";
import { Visitor } from "../entities/Visitor";

dotenv.config();
const runtimeEnv = process.env.NODE_ENV || "development";
const isDevelopment = runtimeEnv === "development";
const isProduction = runtimeEnv === "production";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: isDevelopment,
  logging: isDevelopment,
  entities: [User, EventType, Availability, Booking, ResetToken, Visitor],
  migrations: ["src/migrations/**/*.ts"],
  subscribers: ["src/subscribers/**/*.ts"],
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  extra: {
    // Prefer IPv4 to avoid routing issues between Railway and Supabase IPv6 endpoints
    // This helps when there are network routing problems even if IPv6 is supported
    family: 4,
  },
});
