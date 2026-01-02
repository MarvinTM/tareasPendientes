# Functional Specification: Features

## 1. Authentication & Authorization

### 1.1 Google OAuth Authentication

**Description**: Users authenticate using their Google accounts via OAuth 2.0.

**User Flow**:
1. User clicks "Sign in with Google"
2. User is redirected to Google's authentication page
3. User authorizes the application
4. User is redirected back with authentication token
5. Session is established via HTTP-only cookie (JWT)

**Business Rules**:
- Only Google accounts are supported
- Email must be unique per user
- Session expires after 7 days

### 1.2 User Approval Workflow

**Description**: New users require administrator approval before accessing the system.

**States**:
| State | Access Level |
|-------|--------------|
| `isApproved: false` | Can log in, sees "Pending Approval" message |
| `isApproved: true` | Full access to task board and features |

**Business Rules**:
- Administrators are auto-approved based on email configuration
- Approved users can be revoked (except other admins)
- Unapproved users can be deleted

### 1.3 Role-Based Access Control

**Roles**:
- **Regular User**: Create, edit, view tasks; view scoreboard; view history
- **Administrator**: All user permissions + manage users, categories, periodic tasks

**Admin Identification**: Email addresses in `ADMIN_EMAILS` environment variable

---

## 2. Task Management

### 2.1 Task CRUD Operations

**Create Task**:
- Required: Title, Category, Size
- Optional: Description, Assigned User
- Auto-populated: Creator, Creation timestamp, "Nueva" status

**Read Tasks**:
- Tasks grouped by status (Nueva, EnProgreso, Completada)
- Ordered by creation date (newest first)
- Includes related data: creator, assignee, category

**Update Task**:
- Editable fields: Title, Description, Status, Size, Category, Assignee
- All changes logged to history
- Status change to "Completada" records completion timestamp

**Delete Task**:
- Soft deletes history first (cascade)
- Removes task from database
- Real-time update sent to all clients

### 2.2 Task Status Workflow

```
Nueva → EnProgreso → Completada
  ↑         ↓           ↓
  └─────────┴───────────┘
```

**Allowed Transitions**: Any status can transition to any other status (flexible workflow).

**Status Semantics**:
- **Nueva**: Task identified but not started
- **EnProgreso**: Actively being worked on
- **Completada**: Finished and verified

### 2.3 Task Sizing

**Size Options**:
| Size | Label | Points | Typical Duration |
|------|-------|--------|------------------|
| Pequeña | S | 1 | Quick task (<15 min) |
| Mediana | M | 2 | Medium effort (15-60 min) |
| Grande | L | 3 | Significant effort (>1 hour) |

**Usage**: Points contribute to user scores on the scoreboard.

### 2.4 Task Assignment

**Features**:
- Tasks can be assigned to any approved user
- Assignment triggers email notification (if configured)
- Assignment changes are logged in history

**Validation**:
- Assignee must exist and be approved
- NULL assignment allowed (unassigned task)

---

## 3. Kanban Board

### 3.1 Drag-and-Drop Interface

**Behavior**:
- Tasks can be dragged between columns
- Status updates automatically on drop
- Real-time sync across all connected clients

**Visual Feedback**:
- Dragging card shows visual indicator
- Drop zones highlight on hover

### 3.2 Task Cards

**Information Displayed**:
- Category emoji + name
- Task title
- Size badge (S/M/L)
- Assignee avatar and name
- Visual indication of creator

**Responsive Behavior**:
- Cards collapse on smaller screens
- Tap to expand on mobile
- Columns reduce based on viewport width

### 3.3 Real-Time Updates

**Events**:
| Event | Trigger | Action |
|-------|---------|--------|
| `task:created` | New task added | Card appears in Nueva column |
| `task:updated` | Task modified | Card updates in place or moves columns |
| `task:deleted` | Task removed | Card disappears |

---

## 4. Categories

### 4.1 Category Management (Admin Only)

**Operations**:
- Create: Name + Emoji required
- Update: Modify name or emoji
- Delete: Only if no associated tasks

**Constraints**:
- Category names must be unique
- Both name and emoji are required

### 4.2 Category Usage

- Every task must have a category
- Categories displayed with emoji on task cards
- Categories used for filtering/organization

---

## 5. Periodic Tasks

### 5.1 Periodic Task Templates

**Configuration Options**:
- Title, Description, Size (same as regular tasks)
- Category (required)
- Default Assignee (optional)
- Frequency: WEEKLY or MONTHLY
- Day of Week (for WEEKLY): 0-6 (Sunday-Saturday)
- Month of Year (for MONTHLY): 0-11 (January-December)

### 5.2 Task Generation Logic

**Weekly Tasks**:
- Generated on the specified day of the week
- Only generated once per day (tracked by `lastGeneratedAt`)

**Monthly Tasks**:
- Generated during the specified month
- Only generated once per month

**Generation Trigger**: Lazy generation when any user loads the task board.

### 5.3 Generated Task Properties

- Status: "Nueva"
- Links to parent periodic task template
- Creator: The user who triggered generation (or assignee as fallback)
- Source recorded in history ("Recurrente (Semanal)" or "Recurrente (Mensual)")

---

## 6. Task History & Audit Log

### 6.1 Tracked Actions

| Action | What's Logged |
|--------|---------------|
| CREATED | Task creation with source info |
| TITLE_UPDATED | Old title → New title |
| DESCRIPTION_UPDATED | Old description → New description |
| STATUS_CHANGED | Old status → New status |
| SIZE_CHANGED | Old size → New size |
| ASSIGNED | Previous assignee → New assignee |
| UNASSIGNED | Previous assignee → NULL |
| CATEGORY_CHANGED | Old category → New category |
| DELETED | Task title → NULL |

### 6.2 History Access

- **Per Task**: View history for individual task
- **Global**: Paginated view of all task changes
- **Information Shown**: User who made change, timestamp, action details

---

## 7. Scoreboard

### 7.1 Scoring System

**Point Calculation**:
- Based on completed tasks assigned to user
- Task must be in "Completada" status
- Points = Sum of task size values (S=1, M=2, L=3)

### 7.2 Time Periods

| Period | Scope |
|--------|-------|
| Week | Current week (Monday-Sunday) |
| Month | Current calendar month |
| Year | Current calendar year |
| All Time | No date filter |

### 7.3 Leaderboard Display

- Sorted by total points (descending)
- Shows: User avatar, name, task count, total points
- All approved users appear (even with 0 points)

---

## 8. Email Notifications

### 8.1 Notification Triggers

Currently supported:
- **Task Assignment**: When a task is assigned or reassigned to a user

### 8.2 Email Content

**Subject**: `Nueva tarea asignada: "{task title}"`

**Body includes**:
- Greeting with assignee's first name
- Task title and description
- Task difficulty/size
- Who assigned the task

### 8.3 Configuration

- Uses Gmail SMTP with App Passwords
- Optional feature: works without email configuration
- Failures logged but don't block task operations

---

## 9. Responsive Design

### 9.1 Breakpoints

**Column Visibility**:
- Large screens: All 3 columns visible
- Medium screens: 2-3 columns based on content
- Small screens: 1-2 columns, cards compressed

### 9.2 Adaptive Components

- Task cards reduce information density on mobile
- Navigation adapts to screen size
- Touch-friendly interactions on mobile devices
