# API Integration Guide - Authentication Endpoints

This document provides detailed integration instructions for the Registration and Login endpoints of the SyncBooker API.

## Base URL

```
http://localhost:3000/api
```

For production, replace `localhost:3000` with your production server URL.

---

## Authentication Flow

1. **Register** a new user account → Receive JWT token
2. **Login** with existing credentials → Receive JWT token
3. Use the JWT token in the `Authorization` header for protected endpoints

---

## 1. User Registration

Register a new user account. Returns a JWT token upon successful registration.

### Endpoint

```
POST /api/auth/register
```

### Headers

```
Content-Type: application/json
```

### Request Body

| Field    | Type   | Required | Description                                    |
| -------- | ------ | -------- | ---------------------------------------------- |
| name     | string | Yes      | User's full name                                |
| email    | string | Yes      | User's email address (must be unique)          |
| password | string | Yes      | User's password (will be hashed)                |
| username | string | No       | Unique username (auto-generated from email if not provided) |

### Request Example

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "username": "johndoe"
}
```

**Minimal Request (username optional):**

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

### Success Response

**Status Code:** `201 Created`

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "username": "johndoe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Error Responses

#### 400 Bad Request - Missing Required Fields

```json
{
  "error": "Name, email, and password are required"
}
```

#### 409 Conflict - User Already Exists

```json
{
  "error": "User with this email or username already exists"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal Server Error"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "SecurePassword123!",
    "username": "johndoe"
  }'
```

### JavaScript/TypeScript Example

```typescript
async function registerUser(name: string, email: string, password: string, username?: string) {
  const response = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
      username,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Registration failed");
  }

  const data = await response.json();
  return {
    user: data.user,
    token: data.token,
  };
}

// Usage
const { user, token } = await registerUser(
  "John Doe",
  "john.doe@example.com",
  "SecurePassword123!",
  "johndoe"
);

// Store token for subsequent requests
localStorage.setItem("authToken", token);
```

### Python Example

```python
import requests

def register_user(name, email, password, username=None):
    url = "http://localhost:3000/api/auth/register"
    payload = {
        "name": name,
        "email": email,
        "password": password,
    }
    if username:
        payload["username"] = username
    
    response = requests.post(url, json=payload)
    
    if response.status_code == 201:
        data = response.json()
        return {
            "user": data["user"],
            "token": data["token"]
        }
    else:
        error = response.json()
        raise Exception(error.get("error", "Registration failed"))

# Usage
result = register_user(
    "John Doe",
    "john.doe@example.com",
    "SecurePassword123!",
    "johndoe"
)
token = result["token"]
```

---

## 2. User Login

Authenticate an existing user and receive a JWT token.

### Endpoint

```
POST /api/auth/login
```

### Headers

```
Content-Type: application/json
```

### Request Body

| Field    | Type   | Required | Description           |
| -------- | ------ | -------- | --------------------- |
| email    | string | Yes      | User's email address  |
| password | string | Yes      | User's password       |

### Request Example

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

### Success Response

**Status Code:** `200 OK`

```json
{
  "message": "Login successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "username": "johndoe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Error Responses

#### 400 Bad Request - Missing Required Fields

```json
{
  "error": "Email and password are required"
}
```

#### 401 Unauthorized - Invalid Credentials

```json
{
  "error": "Invalid email or password"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal Server Error"
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePassword123!"
  }'
```

### JavaScript/TypeScript Example

```typescript
async function loginUser(email: string, password: string) {
  const response = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }

  const data = await response.json();
  return {
    user: data.user,
    token: data.token,
  };
}

// Usage
const { user, token } = await loginUser(
  "john.doe@example.com",
  "SecurePassword123!"
);

// Store token for subsequent requests
localStorage.setItem("authToken", token);
```

### Python Example

```python
import requests

def login_user(email, password):
    url = "http://localhost:3000/api/auth/login"
    payload = {
        "email": email,
        "password": password,
    }
    
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        return {
            "user": data["user"],
            "token": data["token"]
        }
    else:
        error = response.json()
        raise Exception(error.get("error", "Login failed"))

# Usage
result = login_user("john.doe@example.com", "SecurePassword123!")
token = result["token"]
```

---

## 3. Using the JWT Token

After successful registration or login, you'll receive a JWT token. Use this token to authenticate requests to protected endpoints.

### Authorization Header Format

```
Authorization: Bearer <token>
```

### Example: Authenticated Request

```typescript
const token = localStorage.getItem("authToken");

const response = await fetch("http://localhost:3000/api/event-types", {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

### cURL Example

```bash
curl -X GET http://localhost:3000/api/event-types \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### Token Expiration

- Default expiration: **7 days** (configurable via `JWT_EXPIRES_IN` environment variable)
- If token expires, you'll receive a `403 Forbidden` response
- User must login again to get a new token

### Error Response - Invalid/Expired Token

**Status Code:** `403 Forbidden`

```json
{
  "error": "Invalid or expired token"
}
```

### Error Response - Missing Token

**Status Code:** `401 Unauthorized`

```json
{
  "error": "Access token required"
}
```

---

## 4. Complete Integration Example

### React/Next.js Example

```typescript
// authService.ts
const API_BASE_URL = "http://localhost:3000/api";

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export async function register(
  name: string,
  email: string,
  password: string,
  username?: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, username }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

export function getAuthToken(): string | null {
  return localStorage.getItem("authToken");
}

export function setAuthToken(token: string): void {
  localStorage.setItem("authToken", token);
}

export function removeAuthToken(): void {
  localStorage.removeItem("authToken");
}

// Usage in component
import { register, login, setAuthToken } from "./authService";

// Register
const handleRegister = async () => {
  try {
    const { user, token } = await register(
      "John Doe",
      "john@example.com",
      "password123"
    );
    setAuthToken(token);
    console.log("Registered:", user);
  } catch (error) {
    console.error("Registration failed:", error);
  }
};

// Login
const handleLogin = async () => {
  try {
    const { user, token } = await login("john@example.com", "password123");
    setAuthToken(token);
    console.log("Logged in:", user);
  } catch (error) {
    console.error("Login failed:", error);
  }
};
```

---

## 5. Error Handling Best Practices

1. **Always check response status** before parsing JSON
2. **Handle network errors** (connection failures, timeouts)
3. **Display user-friendly error messages** from the API
4. **Implement token refresh logic** if needed
5. **Clear stored tokens** on 401/403 errors

### Error Handling Example

```typescript
async function handleApiRequest<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        removeAuthToken();
        // Redirect to login page
        window.location.href = "/login";
      }

      throw new Error(error.error || "Request failed");
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      // Network error
      throw new Error("Network error. Please check your connection.");
    }
    throw error;
  }
}
```

---

## 6. Testing the Endpoints

### Using Postman

1. **Register Endpoint:**
   - Method: `POST`
   - URL: `http://localhost:3000/api/auth/register`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
     ```json
     {
       "name": "Test User",
       "email": "test@example.com",
       "password": "test123"
     }
     ```

2. **Login Endpoint:**
   - Method: `POST`
   - URL: `http://localhost:3000/api/auth/login`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
     ```json
     {
       "email": "test@example.com",
       "password": "test123"
     }
     ```

### Using HTTPie

```bash
# Register
http POST localhost:3000/api/auth/register \
  name="Test User" \
  email="test@example.com" \
  password="test123"

# Login
http POST localhost:3000/api/auth/login \
  email="test@example.com" \
  password="test123"
```

---

## 7. Security Considerations

1. **Always use HTTPS** in production
2. **Store tokens securely** (httpOnly cookies preferred over localStorage)
3. **Never log or expose tokens** in client-side code
4. **Implement token refresh** for long-lived sessions
5. **Validate email format** on the client side before sending
6. **Enforce password strength** requirements
7. **Implement rate limiting** to prevent brute force attacks

---

## 8. Response Time & Performance

- Expected response time: < 500ms
- Token generation: < 50ms
- Database queries: < 100ms

---

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify database connection is active
- Ensure environment variables are properly configured
- Review the main README.md for setup instructions

