# Booking API Integration Guide

Complete integration guide for the Booking module endpoints, including data models, request/response formats, and code examples.

## Base URLs

**Public Endpoints:** `/api/public`  
**Protected Endpoints:** `/api/bookings` (requires JWT authentication)

---

## Data Models

### Booking Model

```typescript
interface Booking {
  id: string; // UUID
  eventTypeId: string; // UUID - Reference to EventType
  inviteeName: string; // Name of the person booking
  inviteeEmail: string; // Email of the person booking
  startTime: Date; // ISO 8601 timestamp
  endTime: Date; // ISO 8601 timestamp (auto-calculated)
  status: BookingStatus; // "pending" | "confirmed" | "cancelled"
  notes: string | null; // Optional notes
  createdAt: Date; // ISO 8601 timestamp
  updatedAt: Date; // ISO 8601 timestamp
  eventType?: EventType; // Populated when relations are loaded
}
```

### BookingStatus Enum

```typescript
enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
}
```

### Available Slot Model

```typescript
interface AvailableSlot {
  startTime: Date; // ISO 8601 timestamp
  endTime: Date; // ISO 8601 timestamp
}
```

---

## Public Endpoints (No Authentication Required)

### 1. Get Available Slots

Get available booking slots for a specific event type within a date range.

**Endpoint:** `GET /api/public/event-type/:eventTypeId/slots`

**URL Parameters:**

- `eventTypeId` (string, required) - UUID of the event type

**Query Parameters:**

- `startDate` (string, optional) - Start date in ISO 8601 format (default: today)
- `endDate` (string, optional) - End date in ISO 8601 format (default: 30 days from start)

**Request Example:**

```http
GET /api/public/event-type/550e8400-e29b-41d4-a716-446655440000/slots?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
```

**Success Response:** `200 OK`

```json
{
  "slots": [
    {
      "startTime": "2024-01-15T09:00:00.000Z",
      "endTime": "2024-01-15T09:30:00.000Z"
    },
    {
      "startTime": "2024-01-15T10:00:00.000Z",
      "endTime": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Error Responses:**

- `404` - Event type not found
- `500` - Server error

**cURL Example:**

```bash
curl -X GET "http://localhost:3000/api/public/event-type/550e8400-e29b-41d4-a716-446655440000/slots?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z"
```

**JavaScript/TypeScript Example:**

```typescript
async function getAvailableSlots(eventTypeId: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const response = await fetch(`/api/public/event-type/${eventTypeId}/slots?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch slots");
  }

  return response.json();
}

// Usage
const { slots } = await getAvailableSlots(
  "550e8400-e29b-41d4-a716-446655440000",
  "2024-01-01T00:00:00Z",
  "2024-01-31T23:59:59Z"
);
```

---

### 2. Get Public Bookings

Get all confirmed bookings for an event type (to display busy times).

**Endpoint:** `GET /api/public/event-type/:eventTypeId/bookings`

**URL Parameters:**

- `eventTypeId` (string, required) - UUID of the event type

**Request Example:**

```http
GET /api/public/event-type/550e8400-e29b-41d4-a716-446655440000/bookings
```

**Success Response:** `200 OK`

```json
{
  "bookings": [
    {
      "startTime": "2024-01-15T09:00:00.000Z",
      "endTime": "2024-01-15T09:30:00.000Z"
    },
    {
      "startTime": "2024-01-15T14:00:00.000Z",
      "endTime": "2024-01-15T14:30:00.000Z"
    }
  ]
}
```

**Note:** Only returns `startTime` and `endTime` for privacy reasons.

**cURL Example:**

```bash
curl -X GET "http://localhost:3000/api/public/event-type/550e8400-e29b-41d4-a716-446655440000/bookings"
```

**JavaScript/TypeScript Example:**

```typescript
async function getPublicBookings(eventTypeId: string) {
  const response = await fetch(`/api/public/event-type/${eventTypeId}/bookings`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch bookings");
  }

  return response.json();
}
```

---

### 3. Create Booking (Public)

Create a new booking. This endpoint is public and doesn't require authentication.

**Endpoint:** `POST /api/public/book`

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```typescript
{
  eventTypeId: string;      // Required - UUID of the event type
  inviteeName: string;      // Required - Name of the person booking
  inviteeEmail: string;    // Required - Email of the person booking
  startTime: string;        // Required - ISO 8601 timestamp
  notes?: string;           // Optional - Additional notes
}
```

**Request Example:**

```json
{
  "eventTypeId": "550e8400-e29b-41d4-a716-446655440000",
  "inviteeName": "John Doe",
  "inviteeEmail": "john.doe@example.com",
  "startTime": "2024-01-15T10:00:00.000Z",
  "notes": "Looking forward to our meeting!"
}
```

**Success Response:** `201 Created`

```json
{
  "message": "Booking created successfully",
  "booking": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "eventTypeId": "550e8400-e29b-41d4-a716-446655440000",
    "inviteeName": "John Doe",
    "inviteeEmail": "john.doe@example.com",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": "2024-01-15T10:30:00.000Z",
    "status": "confirmed",
    "notes": "Looking forward to our meeting!",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-10T12:00:00.000Z"
  }
}
```

**Error Responses:**

**400 Bad Request - Missing Required Fields:**

```json
{
  "error": "Event type, invitee details, and start time are required"
}
```

**404 Not Found - Event Type Not Found:**

```json
{
  "error": "Event type not found"
}
```

**409 Conflict - Time Slot Already Booked:**

```json
{
  "error": "This time slot is already booked"
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/public/book \
  -H "Content-Type: application/json" \
  -d '{
    "eventTypeId": "550e8400-e29b-41d4-a716-446655440000",
    "inviteeName": "John Doe",
    "inviteeEmail": "john.doe@example.com",
    "startTime": "2024-01-15T10:00:00.000Z",
    "notes": "Looking forward to our meeting!"
  }'
```

**JavaScript/TypeScript Example:**

```typescript
interface CreateBookingRequest {
  eventTypeId: string;
  inviteeName: string;
  inviteeEmail: string;
  startTime: string; // ISO 8601 format
  notes?: string;
}

async function createBooking(data: CreateBookingRequest) {
  const response = await fetch("/api/public/book", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create booking");
  }

  return response.json();
}

// Usage
const result = await createBooking({
  eventTypeId: "550e8400-e29b-41d4-a716-446655440000",
  inviteeName: "John Doe",
  inviteeEmail: "john.doe@example.com",
  startTime: "2024-01-15T10:00:00.000Z",
  notes: "Looking forward to our meeting!",
});

console.log("Booking created:", result.booking.id);
```

**Python Example:**

```python
import requests
from datetime import datetime

def create_booking(event_type_id, invitee_name, invitee_email, start_time, notes=None):
    url = "http://localhost:3000/api/public/book"
    payload = {
        "eventTypeId": event_type_id,
        "inviteeName": invitee_name,
        "inviteeEmail": invitee_email,
        "startTime": start_time.isoformat() if isinstance(start_time, datetime) else start_time,
    }
    if notes:
        payload["notes"] = notes

    response = requests.post(url, json=payload)

    if response.status_code == 201:
        return response.json()
    else:
        error = response.json()
        raise Exception(error.get("error", "Failed to create booking"))

# Usage
from datetime import datetime, timezone

result = create_booking(
    "550e8400-e29b-41d4-a716-446655440000",
    "John Doe",
    "john.doe@example.com",
    datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
    "Looking forward to our meeting!"
)
```

---

## Protected Endpoints (Authentication Required)

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### 4. Get User's Bookings

Get all bookings for event types owned by the authenticated user.

**Endpoint:** `GET /api/bookings`

**Headers:**

```
Authorization: Bearer <token>
```

**Success Response:** `200 OK`

```json
{
  "bookings": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "eventTypeId": "550e8400-e29b-41d4-a716-446655440000",
      "inviteeName": "John Doe",
      "inviteeEmail": "john.doe@example.com",
      "startTime": "2024-01-15T10:00:00.000Z",
      "endTime": "2024-01-15T10:30:00.000Z",
      "status": "confirmed",
      "notes": "Looking forward to our meeting!",
      "createdAt": "2024-01-10T12:00:00.000Z",
      "updatedAt": "2024-01-10T12:00:00.000Z",
      "eventType": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "30 Min Consultation",
        "durationMinutes": 30
      }
    }
  ]
}
```

**Note:** Bookings are sorted by `startTime` in descending order (newest first).

**cURL Example:**

```bash
curl -X GET http://localhost:3000/api/bookings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript/TypeScript Example:**

```typescript
async function getUserBookings(token: string) {
  const response = await fetch("/api/bookings", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch bookings");
  }

  return response.json();
}
```

---

### 5. Get Booking by ID

Get a specific booking by ID. User must own the event type associated with the booking.

**Endpoint:** `GET /api/bookings/:id`

**URL Parameters:**

- `id` (string, required) - UUID of the booking

**Headers:**

```
Authorization: Bearer <token>
```

**Success Response:** `200 OK`

```json
{
  "booking": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "eventTypeId": "550e8400-e29b-41d4-a716-446655440000",
    "inviteeName": "John Doe",
    "inviteeEmail": "john.doe@example.com",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": "2024-01-15T10:30:00.000Z",
    "status": "confirmed",
    "notes": "Looking forward to our meeting!",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-10T12:00:00.000Z",
    "eventType": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "30 Min Consultation",
      "durationMinutes": 30
    }
  }
}
```

**Error Responses:**

**404 Not Found:**

```json
{
  "error": "Booking not found"
}
```

**403 Forbidden - Unauthorized:**

```json
{
  "error": "Unauthorized"
}
```

**cURL Example:**

```bash
curl -X GET http://localhost:3000/api/bookings/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 6. Update Booking

Update a booking's status or notes. User must own the event type associated with the booking.

**Endpoint:** `PUT /api/bookings/:id`

**URL Parameters:**

- `id` (string, required) - UUID of the booking

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```typescript
{
  status?: BookingStatus;  // Optional - "pending" | "confirmed" | "cancelled"
  notes?: string;          // Optional - Update notes
}
```

**Request Example:**

```json
{
  "status": "cancelled",
  "notes": "Rescheduled for next week"
}
```

**Success Response:** `200 OK`

```json
{
  "message": "Booking updated successfully",
  "booking": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "eventTypeId": "550e8400-e29b-41d4-a716-446655440000",
    "inviteeName": "John Doe",
    "inviteeEmail": "john.doe@example.com",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": "2024-01-15T10:30:00.000Z",
    "status": "cancelled",
    "notes": "Rescheduled for next week",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-10T13:00:00.000Z"
  }
}
```

**Error Responses:**

**400 Bad Request - Invalid Status:**

```json
{
  "error": "Invalid booking status"
}
```

**404 Not Found:**

```json
{
  "error": "Booking not found"
}
```

**403 Forbidden:**

```json
{
  "error": "Unauthorized"
}
```

**cURL Example:**

```bash
curl -X PUT http://localhost:3000/api/bookings/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cancelled",
    "notes": "Rescheduled for next week"
  }'
```

**JavaScript/TypeScript Example:**

```typescript
interface UpdateBookingRequest {
  status?: "pending" | "confirmed" | "cancelled";
  notes?: string;
}

async function updateBooking(bookingId: string, data: UpdateBookingRequest, token: string) {
  const response = await fetch(`/api/bookings/${bookingId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update booking");
  }

  return response.json();
}
```

---

### 7. Delete Booking

Delete a booking. User must own the event type associated with the booking.

**Endpoint:** `DELETE /api/bookings/:id`

**URL Parameters:**

- `id` (string, required) - UUID of the booking

**Headers:**

```
Authorization: Bearer <token>
```

**Success Response:** `200 OK`

```json
{
  "message": "Booking deleted successfully"
}
```

**Error Responses:**

**404 Not Found:**

```json
{
  "error": "Booking not found"
}
```

**403 Forbidden:**

```json
{
  "error": "Unauthorized"
}
```

**cURL Example:**

```bash
curl -X DELETE http://localhost:3000/api/bookings/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript/TypeScript Example:**

```typescript
async function deleteBooking(bookingId: string, token: string) {
  const response = await fetch(`/api/bookings/${bookingId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete booking");
  }

  return response.json();
}
```

---

## Complete Integration Example

### React/Next.js Booking Flow

```typescript
// bookingService.ts
const API_BASE_URL = "http://localhost:3000/api";

export interface Booking {
  id: string;
  eventTypeId: string;
  inviteeName: string;
  inviteeEmail: string;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
}

// Get available slots
export async function getAvailableSlots(
  eventTypeId: string,
  startDate?: string,
  endDate?: string
): Promise<{ slots: AvailableSlot[] }> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const response = await fetch(
    `${API_BASE_URL}/public/event-type/${eventTypeId}/slots?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch slots");
  }

  return response.json();
}

// Create booking
export async function createBooking(data: {
  eventTypeId: string;
  inviteeName: string;
  inviteeEmail: string;
  startTime: string;
  notes?: string;
}): Promise<{ booking: Booking }> {
  const response = await fetch(`${API_BASE_URL}/public/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create booking");
  }

  return response.json();
}

// Get user's bookings
export async function getUserBookings(token: string): Promise<{ bookings: Booking[] }> {
  const response = await fetch(`${API_BASE_URL}/bookings`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch bookings");
  }

  return response.json();
}

// Update booking
export async function updateBooking(
  bookingId: string,
  data: { status?: "pending" | "confirmed" | "cancelled"; notes?: string },
  token: string
): Promise<{ booking: Booking }> {
  const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update booking");
  }

  return response.json();
}

// Delete booking
export async function deleteBooking(bookingId: string, token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete booking");
  }
}
```

### Usage in Component

```typescript
// BookingComponent.tsx
import { useState, useEffect } from "react";
import { getAvailableSlots, createBooking } from "./bookingService";

export function BookingComponent({ eventTypeId }: { eventTypeId: string }) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSlots();
  }, [eventTypeId]);

  const loadSlots = async () => {
    try {
      const { slots } = await getAvailableSlots(eventTypeId);
      setSlots(slots);
    } catch (error) {
      console.error("Failed to load slots:", error);
    }
  };

  const handleBookSlot = async (slot: AvailableSlot) => {
    setLoading(true);
    try {
      const result = await createBooking({
        eventTypeId,
        inviteeName: "John Doe",
        inviteeEmail: "john@example.com",
        startTime: slot.startTime,
      });
      alert(`Booking created: ${result.booking.id}`);
      loadSlots(); // Refresh slots
    } catch (error) {
      alert(`Booking failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Available Slots</h2>
      {slots.map((slot, index) => (
        <button key={index} onClick={() => handleBookSlot(slot)} disabled={loading}>
          {new Date(slot.startTime).toLocaleString()}
        </button>
      ))}
    </div>
  );
}
```

---

## Error Handling

All endpoints follow consistent error response format:

```typescript
{
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., time slot already booked)
- `500` - Internal Server Error

---

## Notes

1. **Time Format:** All timestamps use ISO 8601 format (e.g., `2024-01-15T10:00:00.000Z`)
2. **End Time Calculation:** The `endTime` is automatically calculated based on `startTime` + `eventType.durationMinutes`
3. **Conflict Detection:** The system prevents double-booking by checking for existing confirmed bookings at the same time
4. **Privacy:** Public booking endpoints only return time information, not personal details
5. **Authorization:** Users can only access bookings for event types they own
