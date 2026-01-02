# Administrator Guide

## Overview

Administrators have additional privileges to manage users, categories, and periodic tasks. This guide covers all administrative functions available in Tareas Pendientes.

## Identifying Administrators

Administrators are defined by their email addresses in the server configuration (`ADMIN_EMAILS` environment variable). Admin users see additional menu options and have access to restricted features.

## User Management

### Accessing User Management

1. Click on the **menu icon** (hamburger menu)
2. Select **"Admin"** or **"Administración"**

### Approving New Users

When a new family member registers:

1. Go to the Admin panel
2. Find the user in the "Pending Approval" section
3. Review the user's email and name
4. Click **"Approve"** or **"Aprobar"** to grant access

### User Actions

| Action | Description |
|--------|-------------|
| **Approve** | Grant access to a pending user |
| **Revoke** | Remove access from an approved user (cannot revoke other admins) |
| **Delete** | Permanently remove an unapproved user |
| **Edit** | Modify user's display name (shortName) and color |

### Customizing User Display

For each approved user, you can set:

- **Short Name**: A nickname displayed on task cards (e.g., "Mom" instead of "María García")
- **Color**: A color code for visual identification on the task board

## Category Management

### Accessing Category Management

1. Click on the menu icon
2. Select **"Categories"** or **"Categorías"**

### Creating Categories

1. Click **"Add Category"** or **"Nueva Categoría"**
2. Enter:
   - **Name**: Category name (e.g., "Cleaning", "Shopping", "Repairs")
   - **Emoji**: An emoji to visually identify the category
3. Click **"Create"**

### Editing Categories

1. Click on an existing category
2. Modify the name or emoji
3. Save changes

### Deleting Categories

- Categories can only be deleted if **no tasks are assigned** to them
- First, reassign or delete all tasks in the category
- Then delete the category

## Periodic Tasks (Recurring Tasks)

### What Are Periodic Tasks?

Periodic tasks are templates that automatically generate new tasks on a schedule:
- **Weekly**: Generated on a specific day of the week
- **Monthly**: Generated during a specific month

### Accessing Periodic Tasks

1. Click on the menu icon
2. Select **"Periodic Tasks"** or **"Tareas Periódicas"**

### Creating a Periodic Task

1. Click **"Add Periodic Task"** or **"Nueva Tarea Periódica"**
2. Configure:
   - **Title**: Task name
   - **Description** (optional): Task details
   - **Category**: Required category assignment
   - **Size**: S, M, or L
   - **Frequency**: Weekly or Monthly
   - **Day of Week** (for weekly): Sunday (0) through Saturday (6)
   - **Month** (for monthly): January (0) through December (11)
   - **Assigned To** (optional): Default assignee
3. Click **"Create"**

### How Periodic Tasks Work

- Tasks are generated **lazily** when any user loads the task board
- Weekly tasks generate once per day on the specified day
- Monthly tasks generate once per month during the specified month
- Generated tasks appear in the "Nueva" (New) column
- Each generated task links back to its template

### Managing Periodic Tasks

- **Edit**: Modify the template; future generated tasks will use new settings
- **Delete**:
  - Option to delete pending tasks generated from this template
  - Completed tasks are preserved
  - The template is removed

## System Monitoring

### Task History

View all task changes across the system:

1. Navigate to **"History"** or **"Historial"** from the menu
2. See a paginated list of all actions:
   - Task creations
   - Status changes
   - Assignments
   - Edits
   - Deletions

### Using History for Oversight

- Track who completed which tasks
- See when tasks were reassigned
- Monitor task lifecycle from creation to completion
- Useful for resolving disputes or understanding patterns

## Best Practices for Administrators

### User Management

1. **Approve promptly**: Don't leave family members waiting
2. **Set meaningful short names**: Makes the board easier to read
3. **Use distinct colors**: Helps identify task ownership at a glance

### Category Organization

1. **Keep categories focused**: Too many categories reduce usefulness
2. **Use clear emojis**: Should represent the category intuitively
3. **Plan before creating**: Think about your family's task types

### Periodic Tasks

1. **Start simple**: Begin with a few essential recurring tasks
2. **Assign thoughtfully**: Consider rotating assignments
3. **Review regularly**: Update or remove outdated periodic tasks

## Server Configuration Reference

### Environment Variables

```
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com
```

Multiple admins can be specified as a comma-separated list.

### Adding New Administrators

To add a new administrator:

1. Add their email to the `ADMIN_EMAILS` environment variable
2. Restart the backend server
3. They must log in (or be logged in) to see admin features

## Troubleshooting

### User Can't Log In

1. Check if they're using the correct Google account
2. Verify their account is approved in the Admin panel
3. Confirm Google OAuth is properly configured

### Categories Won't Delete

- Ensure all tasks are removed from the category first
- Check for periodic tasks using the category

### Periodic Tasks Not Generating

- Tasks generate lazily when the board is loaded
- Check the day/month configuration matches current date
- Verify the periodic task is properly saved
