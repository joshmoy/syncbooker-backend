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

Edit `.env` and fill in your configuration:

- Database connection details (Supabase)
- JWT secret
- Email configuration (optional)
- Google Calendar API credentials (optional)

4. Initialize the database: The database will be automatically synchronized in development mode. For production, use migrations:

```bash
npm run migration:generate -- -n InitialMigration
npm run migration:run
```

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

See `.env.example` for all required environment variables.

## 🚧 Next Steps

- [ ] Email notifications (Maileroo integration)
- [ ] Google Calendar sync
- [ ] Enhanced slot calculation logic
- [ ] Timezone handling improvements
- [ ] Public booking page routes
- [ ] ICS file generation for calendar invites

## 📄 License

ISC


