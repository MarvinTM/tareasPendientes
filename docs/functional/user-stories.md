# User Stories

## Authentication & Onboarding

### US-001: Google Sign-In
**As a** family member
**I want to** sign in using my Google account
**So that** I don't need to create and remember a separate password

**Acceptance Criteria**:
- "Sign in with Google" button visible on login page
- Redirects to Google authentication
- Returns to application after successful login
- User profile (name, email, picture) is retrieved from Google

### US-002: New User Approval
**As a** new user
**I want to** know my account is pending approval
**So that** I understand why I can't access the task board yet

**Acceptance Criteria**:
- Clear message shown when logged in but not approved
- User cannot access task board until approved
- User can log out if needed

### US-003: Admin User Approval
**As an** administrator
**I want to** approve new family members
**So that** only authorized people can access our family tasks

**Acceptance Criteria**:
- List of pending users visible in admin panel
- Can approve users with one click
- Approved users immediately gain access
- Can reject/delete pending users

---

## Task Management

### US-010: Create Task
**As a** family member
**I want to** create a new task
**So that** I can track something that needs to be done

**Acceptance Criteria**:
- Can enter title (required)
- Can enter description (optional)
- Must select a category
- Must select a size (S/M/L)
- Can optionally assign to a family member
- Task appears in "Nueva" column after creation

### US-011: Edit Task
**As a** family member
**I want to** edit an existing task
**So that** I can update details or correct mistakes

**Acceptance Criteria**:
- Can click on any task to open edit dialog
- All fields are editable
- Changes are saved when submitted
- Task card updates in real-time

### US-012: Delete Task
**As a** family member
**I want to** delete a task
**So that** I can remove tasks that are no longer needed

**Acceptance Criteria**:
- Delete option available in task dialog
- Confirmation required before deletion
- Task is removed from board
- All clients update in real-time

### US-013: Move Task Status
**As a** family member
**I want to** drag a task between columns
**So that** I can update its progress status

**Acceptance Criteria**:
- Can drag task card from any column
- Can drop in any other column
- Status updates automatically
- All family members see update instantly

### US-014: Assign Task
**As a** family member
**I want to** assign a task to someone
**So that** they know they're responsible for it

**Acceptance Criteria**:
- Can select assignee from list of approved family members
- Assignee's avatar appears on task card
- Email notification sent to assignee (if configured)
- Assignment logged in task history

---

## Kanban Board

### US-020: View Task Board
**As a** family member
**I want to** see all tasks organized by status
**So that** I can understand what needs to be done

**Acceptance Criteria**:
- Three columns: Nueva, En Progreso, Completada
- Tasks sorted by creation date (newest first)
- Task cards show key information (title, category, assignee, size)

### US-021: Real-Time Updates
**As a** family member
**I want to** see task changes made by others immediately
**So that** I'm always looking at current information

**Acceptance Criteria**:
- New tasks appear without page refresh
- Status changes update instantly
- Deleted tasks disappear automatically
- Works across multiple devices/browsers

### US-022: Responsive Board
**As a** family member
**I want to** use the task board on my phone
**So that** I can manage tasks on the go

**Acceptance Criteria**:
- Board adapts to screen size
- Touch interactions work properly
- Cards are readable on small screens
- Critical functionality accessible on mobile

---

## Categories

### US-030: View Categories
**As a** family member
**I want to** see tasks organized by category
**So that** I can quickly identify task types

**Acceptance Criteria**:
- Category emoji visible on each task card
- Category name shown in task details

### US-031: Manage Categories (Admin)
**As an** administrator
**I want to** create and manage task categories
**So that** tasks can be properly organized

**Acceptance Criteria**:
- Can create new categories with name and emoji
- Can edit existing category name or emoji
- Can delete categories (only if empty)
- All family members see the same categories

---

## Periodic Tasks

### US-040: Create Periodic Task (Admin)
**As an** administrator
**I want to** set up recurring tasks
**So that** routine tasks are automatically created

**Acceptance Criteria**:
- Can create weekly recurring tasks (specify day of week)
- Can create monthly recurring tasks (specify month)
- Can set default assignee
- Task template saved for future generation

### US-041: Automatic Task Generation
**As a** family member
**I want** routine tasks to appear automatically
**So that** I don't have to remember to create them

**Acceptance Criteria**:
- Weekly tasks appear on their specified day
- Monthly tasks appear during their specified month
- Generated tasks are identical to manual tasks
- Tasks only generate once per period

### US-042: Manage Periodic Tasks (Admin)
**As an** administrator
**I want to** edit or remove periodic task templates
**So that** I can adjust our routine tasks

**Acceptance Criteria**:
- Can edit all periodic task properties
- Can delete periodic task template
- Option to delete pending generated tasks when deleting template
- Completed generated tasks are preserved

---

## History & Tracking

### US-050: View Task History
**As a** family member
**I want to** see the history of a task
**So that** I can understand what changes were made

**Acceptance Criteria**:
- Can view history for any task
- Shows all changes chronologically
- Indicates who made each change
- Shows before/after values for changes

### US-051: View All History
**As a** family member
**I want to** see all task activity
**So that** I can track what's been happening

**Acceptance Criteria**:
- Paginated list of all changes
- Most recent changes first
- Includes task title for context
- Shows user who made change

---

## Scoreboard

### US-060: View Scoreboard
**As a** family member
**I want to** see everyone's task completion scores
**So that** I can track contributions

**Acceptance Criteria**:
- All family members listed with scores
- Points based on completed task sizes
- Sorted by highest score first

### US-061: Filter Scoreboard by Period
**As a** family member
**I want to** filter scores by time period
**So that** I can see recent performance

**Acceptance Criteria**:
- Can filter by: Week, Month, Year, All Time
- Scores recalculate based on period
- Clear indication of selected period

---

## Notifications

### US-070: Task Assignment Email
**As a** family member
**I want to** receive an email when assigned a task
**So that** I'm aware even when not using the app

**Acceptance Criteria**:
- Email sent when task is assigned to me
- Email includes task title and description
- Email shows who assigned the task
- Email is properly formatted and readable

---

## Administration

### US-080: User Management
**As an** administrator
**I want to** manage family member accounts
**So that** I can control who has access

**Acceptance Criteria**:
- Can view all users (pending and approved)
- Can approve pending users
- Can revoke access from approved users (except admins)
- Can delete unapproved users

### US-081: Customize User Display
**As an** administrator
**I want to** set nicknames and colors for users
**So that** the board is personalized

**Acceptance Criteria**:
- Can set short display name for each user
- Can set color for each user
- Changes reflected on task cards
