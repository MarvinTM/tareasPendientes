# Tareas Pendientes

A family task management application with Google authentication, drag-and-drop task boards, and scoring system.

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Google OAuth credentials (from Google Cloud Console)

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd tareasPendientes
```

### 2. Install dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Configure environment variables

#### Backend (`backend/.env`)

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your values:

```
DATABASE_URL=postgresql://user:password@localhost:5432/family_tasks
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret-change-in-production
ADMIN_EMAILS=admin@example.com
FRONTEND_URL=http://localhost:5173
PORT=3001
```

#### Frontend (`frontend/.env`)

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env` with your values:

```
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### 4. Set up the database

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push
```

### 5. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - `http://localhost:3001/api/auth/google/callback` (development)
   - Your production URL callback
6. Copy the Client ID and Client Secret to your `.env` files

## Updating an Existing Installation

If the application is already running and you need to update to a new version:

```bash
# 1. Pull the latest code
git pull

# 2. Install any new dependencies
cd backend
npm install
cd ../frontend
npm install

# 3. Apply database changes (if schema was modified)
cd backend
npm run db:push

# 4. Restart the servers
# (Stop the running servers and start them again)
```

**Note:** If there are new environment variables required, check the `.env.example` files and add them to your existing `.env` files.

## Running the Application

### Development

Open two terminal windows:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Production

```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd backend
npm start
```

## Local Network Access

To access the application from other devices on your local network:

1. Find your local IP address (e.g., `192.168.1.100`)
2. Use [nip.io](https://nip.io) for Google OAuth compatibility
3. Update Google OAuth redirect URIs to include: `http://192.168.1.100.nip.io:3001/api/auth/google/callback`
4. Access the app at: `http://192.168.1.100.nip.io:5173`

## Project Structure

```
tareasPendientes/
├── backend/
│   ├── src/
│   │   ├── config/       # Passport configuration
│   │   ├── middleware/   # Auth middleware
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── index.js      # Entry point
│   └── prisma/
│       └── schema.prisma # Database schema
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # Auth & Socket contexts
│   │   ├── pages/        # Page components
│   │   └── services/     # API service
│   └── index.html
└── README.md
```

## Features

- Google OAuth authentication
- Three-column Kanban board (Nueva, En Progreso, Completada)
- Drag-and-drop task management
- Task size/difficulty tracking (S, M, L)
- User assignment
- Task history logging
- Scoring system based on completed tasks
- Real-time updates via WebSocket
- Admin panel for user approval
