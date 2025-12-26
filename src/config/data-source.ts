import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { User } from "../entities/User";
import { EventType } from "../entities/EventType";
import { Availability } from "../entities/Availability";
import { Booking } from "../entities/Booking";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: process.env.NODE_ENV === "development",
  logging: process.env.NODE_ENV === "development",
  entities: [User, EventType, Availability, Booking],
  migrations: ["src/migrations/**/*.ts"],
  subscribers: ["src/subscribers/**/*.ts"],
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});


