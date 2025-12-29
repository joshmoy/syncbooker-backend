# Settings API Integration Guide

Quick reference for integrating the Settings endpoints with your frontend.

## Base URL

```
/api/settings
```

All endpoints require authentication: `Authorization: Bearer <token>`

---

## 1. Get User Settings

**Endpoint:** `GET /api/settings`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "displayPicture": "https://...",
    "banner": "https://...",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-10T12:00:00.000Z"
  }
}
```

**Example:**
```typescript
const response = await fetch('/api/settings', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { user } = await response.json();
```

---

## 2. Update User Settings

**Endpoint:** `PUT /api/settings`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (all fields optional):
```json
{
  "name": "John Doe",
  "username": "johndoe",
  "password": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Settings updated successfully",
  "user": { ... }
}
```

**Example:**
```typescript
const response = await fetch('/api/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'John Doe',
    username: 'johndoe'
  })
});
```

---

## 3. Upload Display Picture

**Endpoint:** `POST /api/settings/upload/display-picture`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
- Form field: `file` (image file)

**Response:**
```json
{
  "message": "Display picture uploaded successfully",
  "displayPicture": "https://supabase-url/..."
}
```

**Example:**
```typescript
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('/api/settings/upload/display-picture', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
const { displayPicture } = await response.json();
```

**React Example:**
```typescript
const handleDisplayPictureUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/settings/upload/display-picture', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (response.ok) {
    const { displayPicture } = await response.json();
    // Update UI with new display picture URL
    return displayPicture;
  }
};
```

---

## 4. Upload Banner

**Endpoint:** `POST /api/settings/upload/banner`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
- Form field: `file` (image file)

**Response:**
```json
{
  "message": "Banner uploaded successfully",
  "banner": "https://supabase-url/..."
}
```

**Example:**
```typescript
const formData = new FormData();
formData.append('file', bannerFile);

const response = await fetch('/api/settings/upload/banner', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
const { banner } = await response.json();
```

---

## Complete React Hook Example

```typescript
import { useState } from 'react';

export function useSettings(token: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      const { user } = await response.json();
      return user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (data: { name?: string; username?: string; password?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update settings');
      }
      const { user } = await response.json();
      return user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const uploadDisplayPicture = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/settings/upload/display-picture', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to upload display picture');
      }

      const { displayPicture } = await response.json();
      return displayPicture;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const uploadBanner = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/settings/upload/banner', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to upload banner');
      }

      const { banner } = await response.json();
      return banner;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    getSettings,
    updateSettings,
    uploadDisplayPicture,
    uploadBanner,
    loading,
    error
  };
}
```

**Usage in Component:**
```typescript
function SettingsPage() {
  const token = localStorage.getItem('authToken');
  const { getSettings, updateSettings, uploadDisplayPicture, uploadBanner, loading } = useSettings(token!);

  const handleNameUpdate = async (name: string) => {
    await updateSettings({ name });
  };

  const handleFileUpload = async (file: File, type: 'displayPicture' | 'banner') => {
    if (type === 'displayPicture') {
      await uploadDisplayPicture(file);
    } else {
      await uploadBanner(file);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, 'displayPicture');
        }}
      />
    </div>
  );
}
```

---

## Axios Example

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get settings
const { data } = await api.get('/settings');

// Update settings
await api.put('/settings', { name: 'John Doe', username: 'johndoe' });

// Upload display picture
const formData = new FormData();
formData.append('file', imageFile);
await api.post('/settings/upload/display-picture', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Upload banner
const bannerFormData = new FormData();
bannerFormData.append('file', bannerFile);
await api.post('/settings/upload/banner', bannerFormData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here"
}
```

**Common Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `404` - User not found
- `409` - Conflict (username already taken)
- `500` - Server error

---

## File Upload Constraints

- **Allowed types:** JPEG, JPG, PNG, WebP, GIF
- **Max file size:** 5MB
- **Field name:** `file` (for both display picture and banner)

---

## Quick Reference

| Endpoint | Method | Auth | Body |
|----------|--------|------|------|
| `/api/settings` | GET | ✅ | - |
| `/api/settings` | PUT | ✅ | JSON |
| `/api/settings/upload/display-picture` | POST | ✅ | FormData |
| `/api/settings/upload/banner` | POST | ✅ | FormData |

