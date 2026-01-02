# Tareas Pendientes - Documentation

Welcome to the comprehensive documentation for Tareas Pendientes, a family task management application.

## Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── user-guide/                  # End-user documentation
│   ├── getting-started.md       # Quick start guide for users
│   └── admin-guide.md           # Administrator guide
├── functional/                  # Functional specifications
│   ├── features.md              # Feature specifications
│   └── user-stories.md          # User stories
├── technical/                   # Technical documentation
│   ├── architecture.md          # System architecture
│   ├── api-reference.md         # REST API documentation
│   └── dependencies.md          # Dependencies and libraries
└── diagrams/                    # Visual diagrams
    ├── architecture.md          # Architecture diagrams
    ├── database.md              # Database schema diagrams
    └── data-flow.md             # Data flow diagrams
```

---

## Quick Links

### For Users

| Document | Description |
|----------|-------------|
| [Getting Started](user-guide/getting-started.md) | How to use the application |
| [Admin Guide](user-guide/admin-guide.md) | Administrator features and setup |

### For Product Owners

| Document | Description |
|----------|-------------|
| [Features](functional/features.md) | Complete feature specification |
| [User Stories](functional/user-stories.md) | User stories and acceptance criteria |

### For Developers

| Document | Description |
|----------|-------------|
| [Architecture](technical/architecture.md) | System design and patterns |
| [API Reference](technical/api-reference.md) | REST API endpoints |
| [Dependencies](technical/dependencies.md) | Libraries and packages |
| [Testing](technical/testing.md) | Test suite documentation |

### Diagrams

| Document | Description |
|----------|-------------|
| [Architecture Diagrams](diagrams/architecture.md) | System and component diagrams |
| [Database Diagrams](diagrams/database.md) | ER diagrams and schema |
| [Data Flow Diagrams](diagrams/data-flow.md) | Request/response flows |

---

## Application Overview

**Tareas Pendientes** is a full-stack web application for family task management featuring:

- **Kanban Board**: Visual task organization with drag-and-drop
- **Real-time Updates**: Instant synchronization across devices
- **Google Authentication**: Secure sign-in with Google accounts
- **User Management**: Admin-controlled access and approval
- **Scoring System**: Track family contributions
- **Recurring Tasks**: Automatic task generation
- **Email Notifications**: Stay informed when assigned tasks

### Technology Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, Vite, Material-UI, Socket.IO Client |
| Backend | Node.js, Express, Prisma, Socket.IO |
| Database | PostgreSQL |
| Auth | Google OAuth 2.0, JWT |
| Deployment | PM2, Nginx, Let's Encrypt |

---

## Getting Started (Development)

### Prerequisites
- Node.js 18+
- PostgreSQL
- Google OAuth credentials

### Quick Start

```bash
# Clone repository
git clone <repository-url>
cd tareasPendientes

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your configuration

# Setup database
cd backend
npm run db:generate
npm run db:push

# Run development servers
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev
```

Visit `http://localhost:5173` to access the application.

---

## Documentation Conventions

### Mermaid Diagrams
All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render automatically on GitHub and compatible markdown viewers.

### API Examples
API documentation includes request/response examples in JSON format.

### Version Information
This documentation reflects the current state of the main branch. Check git history for version-specific documentation.

---

## Contributing to Documentation

When updating documentation:

1. Keep language simple and clear
2. Update the relevant section only
3. Maintain consistent formatting
4. Update diagrams if architecture changes
5. Test all code examples

---

## Support

For application support:
- Review the [Getting Started](user-guide/getting-started.md) guide
- Check the [Admin Guide](user-guide/admin-guide.md) for administrative issues
- Contact your family administrator for account issues

For development questions:
- Review the [Architecture](technical/architecture.md) documentation
- Check the [API Reference](technical/api-reference.md) for endpoint details
