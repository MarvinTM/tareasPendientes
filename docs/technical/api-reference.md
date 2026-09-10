# API Reference

## Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: `https://yourdomain.com/api`

## Authentication

All endpoints (except auth routes) require authentication via JWT token stored in an HTTP-only cookie named `token`.

### Headers
```
Cookie: token=<jwt_token>
```

---

## Authentication Endpoints

### GET /auth/google
Initiates Google OAuth authentication flow.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| redirect_origin | string | URL to redirect after authentication |

**Response**: Redirects to Google OAuth consent screen

---

### GET /auth/google/callback
OAuth callback handler (called by Google).

**Response**:
- Sets `token` cookie
- Redirects to frontend URL

---

### GET /auth/status
Check current authentication status (does not require approval).

**Response**:
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "shortName": "John",
    "color": "#1976d2",
    "picture": "https://...",
    "isApproved": true,
    "isAdmin": false
  }
}
```

---

### GET /auth/me
Get current authenticated user (requires authentication).

**Response**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "shortName": "John",
  "color": "#1976d2",
  "picture": "https://...",
  "isApproved": true,
  "isAdmin": false
}
```

---

### POST /auth/logout
Log out the current user.

**Response**:
```json
{
  "message": "Logged out successfully"
}
```

---

## Task Endpoints

### GET /tasks
Get all tasks grouped by status.

**Response**:
```json
{
  "Nueva": [
    {
      "id": "uuid",
      "title": "Buy groceries",
      "description": "Milk, bread, eggs",
      "status": "Nueva",
      "size": "Pequena",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "completedAt": null,
      "createdBy": {
        "id": "uuid",
        "name": "John Doe",
        "shortName": "John",
        "color": "#1976d2",
        "picture": "https://..."
      },
      "assignedTo": {
        "id": "uuid",
        "name": "Jane Doe",
        "shortName": "Jane",
        "color": "#e91e63",
        "picture": "https://..."
      },
      "category": {
        "id": "uuid",
        "name": "Shopping",
        "emoji": "🛒"
      }
    }
  ],
  "EnProgreso": [],
  "Completada": []
}
```

---

### POST /tasks
Create a new task.

**Request Body**:
```json
{
  "title": "Buy groceries",
  "description": "Milk, bread, eggs",
  "size": "Pequena",
  "categoryId": "uuid",
  "assignedToId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Task title |
| description | string | No | Task description |
| size | enum | Yes | "Pequena", "Mediana", or "Grande" |
| categoryId | string | Yes | Category UUID |
| assignedToId | string | No | Assignee user UUID |

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "title": "Buy groceries",
  ...
}
```

---

### PATCH /tasks/:id
Update a task.

**URL Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Task UUID |

**Request Body** (all fields optional):
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "status": "EnProgreso",
  "size": "Mediana",
  "categoryId": "uuid",
  "assignedToId": "uuid"
}
```

**Response**: `200 OK` - Updated task object

---

### DELETE /tasks/:id
Delete a task.

**URL Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Task UUID |

**Response**: `200 OK`
```json
{
  "message": "Task deleted"
}
```

---

### GET /tasks/:id/history
Get history for a specific task.

**URL Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Task UUID |

**Response**:
```json
{
  "task": {
    "title": "Buy groceries"
  },
  "history": [
    {
      "id": "uuid",
      "action": "STATUS_CHANGED",
      "previousValue": "Nueva",
      "newValue": "EnProgreso",
      "timestamp": "2024-01-15T11:00:00Z",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "shortName": "John",
        "color": "#1976d2",
        "picture": "https://..."
      }
    }
  ]
}
```

---

## Periodic Task Endpoints

### GET /periodic-tasks
Get all periodic task templates.

**Response**:
```json
[
  {
    "id": "uuid",
    "title": "Weekly cleaning",
    "description": "Clean the house",
    "size": "Grande",
    "frequency": "WEEKLY",
    "dayOfWeek": 6,
    "monthOfYear": null,
    "lastGeneratedAt": "2024-01-13T08:00:00Z",
    "category": {
      "id": "uuid",
      "name": "Cleaning",
      "emoji": "🧹"
    },
    "assignedTo": {
      "id": "uuid",
      "name": "Jane Doe",
      ...
    }
  }
]
```

---

### POST /periodic-tasks
Create a periodic task template.

**Request Body**:
```json
{
  "title": "Weekly cleaning",
  "description": "Clean the house",
  "size": "Grande",
  "frequency": "WEEKLY",
  "dayOfWeek": 6,
  "categoryId": "uuid",
  "assignedToId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Task title |
| description | string | No | Task description |
| size | enum | No | "Pequena" (default), "Mediana", "Grande" |
| frequency | enum | Yes | "WEEKLY" or "MONTHLY" |
| dayOfWeek | int | For WEEKLY | 0-6 (Sunday-Saturday) |
| monthOfYear | int | For MONTHLY | 0-11 (January-December) |
| categoryId | string | Yes | Category UUID |
| assignedToId | string | No | Default assignee UUID |

**Response**: `201 Created`

---

### PATCH /periodic-tasks/:id
Update a periodic task template.

**Request Body**: Same as POST (all fields optional)

**Response**: `200 OK` - Updated periodic task object

---

### DELETE /periodic-tasks/:id
Delete a periodic task template.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| deletePending | boolean | If true, also delete pending generated tasks |

**Response**: `200 OK`
```json
{
  "message": "Periodic task deleted"
}
```

---

## Category Endpoints

### GET /categories
Get all categories.

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "Shopping",
    "emoji": "🛒",
    "createdAt": "2024-01-01T00:00:00Z",
    "_count": {
      "tasks": 5
    }
  }
]
```

---

### POST /categories
Create a new category (admin only).

**Request Body**:
```json
{
  "name": "Shopping",
  "emoji": "🛒"
}
```

**Response**: `201 Created`

---

### PATCH /categories/:id
Update a category (admin only).

**Request Body**:
```json
{
  "name": "Updated name",
  "emoji": "🛍️"
}
```

**Response**: `200 OK` - Updated category object

---

### DELETE /categories/:id
Delete a category (admin only). Fails if tasks are assigned.

**Response**: `200 OK`
```json
{
  "message": "Category deleted successfully"
}
```

**Error** (if tasks exist): `400 Bad Request`
```json
{
  "error": "Cannot delete category. It has 5 task(s) assigned to it."
}
```

---

## User Endpoints

### GET /users
Get all approved users (for task assignment).

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "shortName": "John",
    "color": "#1976d2",
    "email": "john@example.com",
    "picture": "https://..."
  }
]
```

---

### GET /users/scores
Get user scores based on completed tasks.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | "week", "month", "year", or omit for all time |

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "Jane Doe",
    "shortName": "Jane",
    "color": "#e91e63",
    "picture": "https://...",
    "taskCount": 15,
    "totalPoints": 28
  }
]
```

---

## Admin Endpoints

All admin endpoints require admin authorization.

### GET /admin/users
Get all users (including unapproved).

**Response**:
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "shortName": "John",
    "color": "#1976d2",
    "picture": "https://...",
    "isApproved": true,
    "isAdmin": false,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

---

### PATCH /admin/users/:id
Update user details (shortName, color).

**Request Body**:
```json
{
  "shortName": "Johnny",
  "color": "#2196f3"
}
```

**Response**: `200 OK` - Updated user object

---

### PATCH /admin/users/:id/approve
Approve a pending user.

**Response**: `200 OK` - Updated user object with `isApproved: true`

---

### PATCH /admin/users/:id/revoke
Revoke user access (cannot revoke admins).

**Response**: `200 OK` - Updated user object with `isApproved: false`

---

### DELETE /admin/users/:id
Delete an unapproved user.

**Response**: `200 OK`
```json
{
  "message": "User deleted successfully"
}
```

---

## History Endpoints

### GET /history
Get all task history (paginated).

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | int | 1 | Page number |
| limit | int | 50 | Items per page |

**Response**:
```json
{
  "history": [
    {
      "id": "uuid",
      "action": "STATUS_CHANGED",
      "previousValue": "Nueva",
      "newValue": "Completada",
      "timestamp": "2024-01-15T12:00:00Z",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        ...
      },
      "task": {
        "id": "uuid",
        "title": "Buy groceries"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

---

## Water Flow Endpoints (Agua)

Readings come from a pulse water meter wired to the counter input of a Shelly
Plus Uni. The Raspberry Pi polls the device over the LAN and pushes readings to
the ingestion endpoint; the frontend reads the derived series.

Litres are never stored — they are derived as `pulsesDelta / pulsesPerLitre`
from `backend/config/shelly.json`, so recalibrating the sensor recomputes the
whole history. Intervals with no readings are returned as `null`, never `0`.

### POST /ingestion/flow
Receives pulse-counter readings from the local component.

**Auth**: API key (`x-api-key` header), not JWT.

**Body**:
```json
{
  "timestamp": "2026-09-10T10:00:00.000Z",
  "sensors": [
    {
      "shellyId": "<Shelly Plus Uni id>",
      "input": 2,
      "online": true,
      "counts": { "total": 123456, "by_minute": [12, 15, 14], "minute_ts": 1757498400 },
      "freq": 3.2
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| sensors | array | Required, non-empty. Entries whose `shellyId` + `input` pair is not declared as a sensor are ignored with a warning. |
| online | boolean | `false` for an unreachable device: a row is still stored (with `pulsesDelta: 0`) so "sin conexión" is recorded rather than becoming an unexplained gap. |
| counts.total | int | Monotonic pulse counter as reported by the device. A lower value than the previous reading is treated as a device reset: `counterReset` is set and the whole total is attributed to the interval. |
| freq | float | Instantaneous frequency in Hz, used for the current rate (`freq × 60 / pulsesPerLitre`). |

**Response**: `201 { "stored": 1 }`

Also emits the `flow:data` WebSocket event with one summary per stored reading.

---

### GET /flow/sensors
Declared flow sensors with their current status.

**Response**:
```json
[
  {
    "id": "caudal-deposito",
    "name": "Entrada de agua al depósito",
    "room": "Depósito",
    "group": "water",
    "showOnHome": true,
    "pulsesPerLitre": 450,
    "online": true,
    "rateLpm": 12.5,
    "todayLitres": 340.2,
    "lastReadingAt": "2026-09-10T10:00:00.000Z"
  }
]
```

`online` is `false` when the last reading is older than the freshness window
(`FLOW_FRESHNESS_MS`, 90 s by default), so a sensor that stopped reporting never
shows a frozen rate. `todayLitres` is the current natural day in `Europe/Madrid`.

---

### GET /flow/:sensorId/history
Litres per interval for a chart.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| range | string | `24h` (5-minute intervals, default), `7d` (hourly) or `30d` (daily). Anything else → `400`. |

**Response**:
```json
[
  { "time": "2026-09-10T09:55:00.000Z", "litres": 3.2, "avgRateLpm": 10.4 },
  { "time": "2026-09-10T10:00:00.000Z", "litres": null, "avgRateLpm": null }
]
```

**Errors**: `400` unsupported range, `404` unknown sensor.

---

### GET /flow/:sensorId/daily
Litres per natural day in `Europe/Madrid`.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| days | int | Number of days ending today. Default 30, clamped to 1–365. |

**Response**:
```json
[
  { "date": "2026-09-09", "time": "2026-09-08T22:00:00.000Z", "litres": 412.5 },
  { "date": "2026-09-10", "time": "2026-09-09T22:00:00.000Z", "litres": null }
]
```

**Errors**: `404` unknown sensor.

---

## WebSocket Events

### Connection
```javascript
const socket = io(API_URL, { withCredentials: true });
```

### Events (Server → Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `task:created` | Task object | New task created |
| `task:updated` | Task object | Task modified |
| `task:deleted` | `{ id: "uuid" }` | Task deleted |
| `device:updated` | `{ id, on, online, source }` | Shelly relay state changed |
| `device:pulsed` | `{ id, triggeredAt }` | Pulse device triggered |
| `riego:updated` | Riego queue state | Irrigation queue changed |
| `inverter:data` | Array of inverter readings | New solar reading ingested |
| `flow:data` | Array of `{ sensorId, name, room, online, rateLpm, todayLitres, lastReadingAt, pulsesDelta, counterReset }` | New flow-sensor reading ingested |

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (not approved or not admin) |
| 404 | Not Found |
| 500 | Internal Server Error |
