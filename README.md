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

## Email Notifications (Optional)

The app can send email notifications when a task is assigned to a user. To enable this:

### 1. Create a Gmail App Password

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** > **2-Step Verification** (must be enabled)
3. At the bottom, click on **App passwords**
4. Select "Mail" and your device, then click **Generate**
5. Copy the 16-character password

### 2. Configure environment variables

Add to your `backend/.env`:

```
EMAIL_USER=your-gmail-account@gmail.com
EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

**Note:** Email notifications are optional. If these variables are not set, the app will work normally without sending emails.

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

### Production Deployment (with Nginx + HTTPS)

This guide covers deploying the application on a Linux server with Nginx, HTTPS (Let's Encrypt), and PM2.

#### Prerequisites

- A Linux server (Ubuntu/Debian recommended)
- A domain name pointing to your server
- Node.js v18+ installed
- PostgreSQL installed and configured
- Nginx installed

#### 1. Clone and set up the application

```bash
# Clone to /var/www
cd /var/www
git clone <repository-url> tareas-pendientes
cd tareas-pendientes

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

#### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
nano backend/.env
```

Update `backend/.env` for production:
```
DATABASE_URL=postgresql://user:password@localhost:5432/family_tasks
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=generate-a-strong-random-secret
ADMIN_EMAILS=admin@example.com
FRONTEND_URL=https://yourdomain.com
PORT=3001

# Optional: Email notifications
EMAIL_USER=your-gmail@gmail.com
EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

```bash
# Frontend
cp frontend/.env.example frontend/.env
nano frontend/.env
```

Update `frontend/.env` for production:
```
VITE_API_URL=https://yourdomain.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

#### 3. Set up the database

```bash
cd backend
npm run db:generate
npm run db:push
```

#### 4. Build the frontend

```bash
cd frontend
npm run build
```

This creates a `dist/` folder with static files.

#### 5. Install and configure PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the backend
cd /var/www/tareas-pendientes
pm2 start ecosystem.config.cjs

# Save PM2 configuration and set up auto-start on reboot
pm2 save
pm2 startup
```

#### 6. Configure Nginx

```bash
# Copy the example config
sudo cp nginx.example.conf /etc/nginx/sites-available/tareas-pendientes

# Edit with your domain
sudo nano /etc/nginx/sites-available/tareas-pendientes
# Replace "yourdomain.com" with your actual domain
# Replace "/var/www/tareas-pendientes" if using a different path

# Enable the site
sudo ln -s /etc/nginx/sites-available/tareas-pendientes /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 7. Set up HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate (follow the prompts)
sudo certbot --nginx -d yourdomain.com

# Certbot will automatically configure Nginx for HTTPS
# and set up auto-renewal
```

#### 8. Update Google OAuth

In Google Cloud Console, add the production redirect URI:
```
https://yourdomain.com/api/auth/google/callback
```

#### 9. Verify the deployment

- Visit `https://yourdomain.com`
- Test Google login
- Create a task and verify real-time updates

#### Useful PM2 commands

```bash
pm2 status              # Check status
pm2 logs tareas-backend # View logs
pm2 restart all         # Restart
pm2 stop all            # Stop
```

#### Updating in production

```bash
cd /var/www/tareas-pendientes

# Pull latest code
git pull

# Install dependencies (if changed)
cd backend && npm install
cd ../frontend && npm install

# Apply database changes (if schema changed)
cd backend && npm run db:push

# Rebuild frontend
cd ../frontend && npm run build

# Restart backend
pm2 restart all
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
- User assignment with email notifications
- Task history logging
- Scoring system based on completed tasks
- Real-time updates via WebSocket
- Admin panel for user approval
