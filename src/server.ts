import express, { Express } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { AppDataSource } from "./config/data-source";
import { errorHandler, AppError } from "./middleware/errorHandler";

// Routes
import authRoutes from "./routes/auth";
import eventTypeRoutes from "./routes/eventTypes";
import availabilityRoutes from "./routes/availability";
import bookingRoutes from "./routes/bookings";
import settingsRoutes from "./routes/settings";
import publicRoutes from "./routes/public";
import dashboardRoutes from "./routes/dashboard";
import googleRoutes from "./routes/google";
import { startScheduler } from "./utils/scheduler";
import { generalLimiter } from "./middleware/rateLimiter";

dotenv.config();

// ─── Environment validation ────────────────────────────────────────────────
//
// 1) Hard-require the variables the server cannot function without. Missing
//    any of these stops the boot with a clear message rather than producing
//    a cryptic runtime crash later.
// 2) For feature-gated integrations (email, storage, Google, AI), log a
//    readable summary of what's enabled so ops can spot silent misconfig.

const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "DB_HOST",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_DATABASE",
] as const;

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

type OptionalFeature = {
  name: string;
  vars: string[];
  whenDisabled: string;
};

const OPTIONAL_FEATURES: OptionalFeature[] = [
  {
    name: "Email notifications (Maileroo)",
    vars: ["MAILEROO_API_KEY"],
    whenDisabled: "outbound emails will be skipped",
  },
  {
    name: "Avatar/banner uploads (Supabase Storage)",
    vars: [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_DISPLAY_PICTURE_BUCKET",
      "SUPABASE_BANNER_BUCKET",
    ],
    whenDisabled: "upload endpoints will return 503",
  },
  {
    name: "Google Calendar integration",
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    whenDisabled: "users cannot connect Google Calendar",
  },
  {
    name: "AI assistant (Gemini)",
    vars: ["GEMINI_API_KEY"],
    whenDisabled: "AI copy/FAQ endpoints will return no suggestions",
  },
];

for (const feature of OPTIONAL_FEATURES) {
  const missing = feature.vars.filter((key) => !process.env[key]);
  if (missing.length === 0) {
    console.log(`✅ ${feature.name}: enabled`);
  } else if (missing.length === feature.vars.length) {
    console.warn(
      `⚠️  ${feature.name}: disabled — ${feature.whenDisabled} (missing ${missing.join(", ")})`
    );
  } else {
    console.warn(
      `⚠️  ${feature.name}: partially configured — set ${missing.join(", ")} to fully enable`
    );
  }
}

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Apply general rate limiter to all API routes
app.use("/api", generalLimiter);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/event-types", eventTypeRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/google", googleRoutes);

// Public routes (no auth required)
app.use("/api/public", publicRoutes);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log("✅ Database connected successfully");

    startScheduler();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("❌ Error starting server:", error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing database connection...");
  await AppDataSource.destroy();
  process.exit(0);
});


