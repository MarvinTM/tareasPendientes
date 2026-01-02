# Technical Architecture

## System Overview

Tareas Pendientes is a full-stack web application following a client-server architecture with real-time communication capabilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              React SPA (Vite)                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │    │
│  │  │  Pages   │  │Components│  │      Contexts        │   │    │
│  │  └──────────┘  └──────────┘  │  (Auth + Socket)     │   │    │
│  │                              └──────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │ HTTP/WebSocket                        │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                     Server Layer                                 │
│  ┌───────────────────────┼─────────────────────────────────┐    │
│  │              Express.js Server                           │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │    │
│  │  │  Routes  │  │Middleware│  │      Services        │   │    │
│  │  │  (API)   │  │ (Auth)   │  │ (Email, Generator)   │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────────┘   │    │
│  │                      │                                   │    │
│  │              ┌───────┴───────┐                          │    │
│  │              │   Socket.io   │                          │    │
│  │              └───────────────┘                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │ Prisma ORM                            │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                     Data Layer                                   │
│              ┌───────────┴───────────┐                          │
│              │     PostgreSQL        │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI component library |
| Vite | 5.4.10 | Build tool and dev server |
| Material-UI (MUI) | 6.1.6 | UI component framework |
| Emotion | 11.13.x | CSS-in-JS styling |
| React Router | 6.28.0 | Client-side routing |
| Axios | 1.7.7 | HTTP client |
| Socket.io Client | 4.8.3 | Real-time communication |
| @hello-pangea/dnd | 17.0.0 | Drag-and-drop functionality |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| Express | 4.21.1 | Web framework |
| Prisma | 5.22.0 | ORM and database toolkit |
| PostgreSQL | - | Relational database |
| Passport | 0.7.0 | Authentication middleware |
| passport-google-oauth20 | 2.0.0 | Google OAuth strategy |
| JWT (jsonwebtoken) | 9.0.2 | Token-based authentication |
| Socket.io | 4.8.3 | Real-time server |
| Nodemailer | 7.0.12 | Email sending |

### DevOps
| Technology | Purpose |
|------------|---------|
| PM2 | Process management (production) |
| Nginx | Reverse proxy (production) |
| Let's Encrypt | SSL certificates |
| Nodemon | Development auto-reload |

## Project Structure

```
tareasPendientes/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── passport.js       # OAuth configuration + Prisma client
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT authentication middleware
│   │   │   └── admin.js          # Admin authorization middleware
│   │   ├── routes/
│   │   │   ├── auth.js           # Authentication endpoints
│   │   │   ├── tasks.js          # Task CRUD operations
│   │   │   ├── periodicTasks.js  # Recurring task management
│   │   │   ├── categories.js     # Category management
│   │   │   ├── users.js          # User listing and scores
│   │   │   ├── admin.js          # Admin-only operations
│   │   │   └── history.js        # Task history queries
│   │   ├── services/
│   │   │   ├── email.js          # Email notification service
│   │   │   ├── taskGenerator.js  # Periodic task generation
│   │   │   └── taskHistory.js    # History logging service
│   │   ├── socket.js             # Socket.io management
│   │   └── index.js              # Server entry point
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TaskBoard.jsx     # Main Kanban board
│   │   │   ├── TaskColumn.jsx    # Status column container
│   │   │   ├── TaskCard.jsx      # Individual task card
│   │   │   ├── TaskDialog.jsx    # Task create/edit modal
│   │   │   ├── CategoryDialog.jsx# Category management modal
│   │   │   ├── Layout.jsx        # App shell with navigation
│   │   │   ├── AppLogo.jsx       # Logo component
│   │   │   └── UserAvatar.jsx    # User avatar display
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx   # Authentication state
│   │   │   └── SocketContext.jsx # WebSocket connection
│   │   ├── pages/
│   │   │   ├── MainPage.jsx      # Kanban board page
│   │   │   ├── LoginPage.jsx     # Login page
│   │   │   ├── AdminPage.jsx     # User management
│   │   │   ├── CategoriesAdminPage.jsx
│   │   │   ├── PeriodicTasksPage.jsx
│   │   │   ├── ScoreboardPage.jsx
│   │   │   ├── TaskHistoryPage.jsx
│   │   │   └── AllHistoryPage.jsx
│   │   ├── services/
│   │   │   └── api.js            # Axios HTTP client
│   │   ├── App.jsx               # Root component + routing
│   │   └── main.jsx              # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── ecosystem.config.cjs          # PM2 configuration
├── nginx.example.conf            # Nginx template
├── deploy.sh                     # Deployment script
└── README.md
```

## Design Patterns

### Frontend Patterns

#### 1. Context Pattern (State Management)
The application uses React Context for global state:

```javascript
// AuthContext - Manages authentication state
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // ... authentication logic
}

// SocketContext - Manages WebSocket connection
const SocketContext = createContext(null);
export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  // ... socket management
}
```

**Usage**: Components access global state via custom hooks (`useAuth`, `useSocket`).

#### 2. Container/Presentational Pattern
- **Container Components** (Pages): Handle data fetching, state, business logic
- **Presentational Components**: Render UI based on props

#### 3. Compound Component Pattern
Used in the Kanban board structure:
- `TaskBoard` → `TaskColumn` → `TaskCard`

### Backend Patterns

#### 1. Route-Controller-Service Pattern
```
Request → Route → Middleware → Service → Database
                                ↓
Response ← Route ← Middleware ← Service ← Database
```

- **Routes**: Define endpoints and HTTP methods
- **Middleware**: Authentication, authorization, validation
- **Services**: Business logic (email, task generation, history)

#### 2. Repository Pattern (via Prisma)
Prisma provides a repository-like interface for database operations:
```javascript
// Direct database access through Prisma client
const tasks = await prisma.task.findMany({
  include: { createdBy: true, assignedTo: true }
});
```

#### 3. Middleware Chain Pattern
```javascript
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  // Only authenticated admins reach here
});
```

#### 4. Observer Pattern (Real-time Updates)
Socket.io implements publish-subscribe for real-time updates:
```javascript
// Publisher (backend)
emitTaskUpdate('task:created', task);

// Subscriber (frontend)
socket.on('task:created', (task) => {
  setTasks(prev => ({ ...prev, Nueva: [task, ...prev.Nueva] }));
});
```

#### 5. Lazy Initialization Pattern
Periodic tasks are generated lazily when the task board is loaded:
```javascript
router.get('/', authenticateToken, async (req, res) => {
  await generatePeriodicTasks(req.user);  // Lazy generation
  const tasks = await prisma.task.findMany({...});
});
```

## Security Architecture

### Authentication Flow
```
┌────────┐     ┌─────────┐     ┌────────┐     ┌─────────┐
│ Client │────►│ Backend │────►│ Google │────►│ Backend │
│        │     │ /google │     │ OAuth  │     │/callback│
└────────┘     └─────────┘     └────────┘     └────┬────┘
                                                   │
     ┌─────────────────────────────────────────────┘
     │ JWT in HTTP-only cookie
     ▼
┌────────┐
│ Client │ (Authenticated)
└────────┘
```

### Security Measures

1. **HTTP-Only Cookies**: JWT stored in HTTP-only cookies (not accessible via JavaScript)
2. **SameSite Cookies**: Protection against CSRF
3. **Secure Cookies**: HTTPS-only in production
4. **Admin Authorization**: Middleware checks admin status for restricted routes
5. **User Approval**: Two-step registration (register → admin approval)
6. **Input Validation**: Server-side validation for all inputs

## Data Flow

### Task Creation Flow
```
User Action: Create Task
        │
        ▼
┌───────────────┐
│  TaskDialog   │
│  (Frontend)   │
└───────┬───────┘
        │ POST /api/tasks
        ▼
┌───────────────┐     ┌───────────────┐
│  tasks.js     │────►│ taskHistory   │
│  (Route)      │     │ (Service)     │
└───────┬───────┘     └───────────────┘
        │
        ├───────────────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│   Prisma      │   │   email.js    │
│   (DB Save)   │   │ (Notification)│
└───────┬───────┘   └───────────────┘
        │
        ▼
┌───────────────┐
│   socket.js   │
│  (Broadcast)  │
└───────┬───────┘
        │ task:created
        ▼
┌───────────────┐
│ All Connected │
│    Clients    │
└───────────────┘
```

## Deployment Architecture

### Production Setup
```
Internet
    │
    ▼
┌─────────────────┐
│     Nginx       │
│ (Reverse Proxy) │
│  + SSL (Let's   │
│    Encrypt)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────────┐
│Static │ │  Node.js  │
│Files  │ │  (PM2)    │
│(dist/)│ │Port 3001  │
└───────┘ └─────┬─────┘
                │
                ▼
         ┌────────────┐
         │ PostgreSQL │
         └────────────┘
```

### Environment Configuration

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
ADMIN_EMAILS=admin@example.com
FRONTEND_URL=https://yourdomain.com
PORT=3001
EMAIL_USER=...           # Optional
EMAIL_APP_PASSWORD=...   # Optional
```

**Frontend** (`frontend/.env`):
```
VITE_API_URL=https://yourdomain.com
VITE_GOOGLE_CLIENT_ID=...
```
