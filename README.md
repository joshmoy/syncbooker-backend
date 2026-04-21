# SyncBooker Backend

A lite version of Calendly - A booking and scheduling system backend built with Express.js, TypeScript, TypeORM, and Supabase PostgreSQL.

## 🚀 Features

- User authentication (JWT-based)
- Event type management
- Availability management
- Booking system
- Public booking pages
- Available slots calculation

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database (Supabase recommended)
- npm or yarn

## 🛠️ Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd syncbooker-backend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

The server validates its configuration at boot and prints a feature summary.
The following are **required** — the server will refuse to start without them:

- `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` — PostgreSQL connection
- `JWT_SECRET` — any long random string; used to sign auth tokens

Everything else is **optional** and degrades gracefully when unset:

- **Supabase Storage** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DISPLAY_PICTURE_BUCKET`, `SUPABASE_BANNER_BUCKET`) — required only if you want avatar/banner uploads. If unset, upload endpoints return `503` and the rest of the app works.
- **Email** (`MAILEROO_API_KEY`) — required to actually send password-reset and booking emails. Without it, emails are skipped and logged.
- **Google Calendar** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`) — required for Google Calendar sync and auto-generated Meet links on confirm.
- **AI assistant** (`GEMINI_API_KEY`) — required for the AI copy, FAQ, and event-type generator endpoints. Without it, those endpoints return empty suggestions.

See `.env.example` for the full list and inline documentation.

4. Initialize the database:

In `development`, TypeORM auto-syncs the schema from the entity classes,
so simple schema changes don't need migrations. However, some features
(e.g. the booking no-overlap exclusion constraint) ship as raw SQL in
migration files and must be applied explicitly — even in dev:

```bash
npm run migration:run
```

For production (where `synchronize` is off) this is the only way schema
changes are applied, so include it in your deploy pipeline before starting
the server.

5. Start the development server:

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## 📁 Project Structure

```
src/
├── config/          # Configuration files (database, etc.)
├── controllers/     # Request handlers
├── entities/        # TypeORM entities (database models)
├── middleware/      # Express middleware (auth, error handling)
├── routes/          # API routes
├── utils/           # Utility functions
└── server.ts        # Main server file
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Event Types (Protected)

- `POST /api/event-types` - Create event type
- `GET /api/event-types` - Get user's event types
- `GET /api/event-types/:id` - Get event type by ID
- `PUT /api/event-types/:id` - Update event type
- `DELETE /api/event-types/:id` - Delete event type

### Availability (Protected)

- `POST /api/availability` - Create availability
- `GET /api/availability` - Get user's availabilities
- `PUT /api/availability/:id` - Update availability
- `DELETE /api/availability/:id` - Delete availability

### Bookings

- `POST /api/public/book` - Create booking (public)
- `GET /api/public/event-type/:eventTypeId/slots` - Get available slots (public)
- `GET /api/public/event-type/:eventTypeId/bookings` - Get bookings for event type (public)
- `GET /api/bookings` - Get user's bookings (protected)
- `GET /api/bookings/:id` - Get booking by ID (protected)
- `PUT /api/bookings/:id` - Update booking (protected)
- `DELETE /api/bookings/:id` - Delete booking (protected)

### Settings (Protected)

- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings (name, username, password)
- `POST /api/settings/upload/display-picture` - Upload display picture
- `POST /api/settings/upload/banner` - Upload banner
- `DELETE /api/settings/display-picture` - Remove display picture
- `DELETE /api/settings/banner` - Remove banner

## 🔐 Authentication

Protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## 🗄️ Database Schema

- **Users**: User accounts
- **EventTypes**: Meeting/event types
- **Availabilities**: User availability windows
- **Bookings**: Scheduled bookings

## 🧪 Development

- Development mode with hot reload: `npm run dev`
- Build for production: `npm run build`
- Start production server: `npm start`

## 📝 Environment Variables

See `.env.example` for the full list of environment variables, grouped by
feature and annotated with which are required vs. optional.

## 📄 License

ISC


