# Dependencies Documentation

## Frontend Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **react** | ^18.3.1 | Core React library for building user interfaces |
| **react-dom** | ^18.3.1 | React DOM rendering package |
| **react-router-dom** | ^6.28.0 | Declarative routing for React applications |
| **@mui/material** | ^6.1.6 | Material Design UI component library |
| **@mui/icons-material** | ^6.1.6 | Material Design icons for MUI |
| **@emotion/react** | ^11.13.3 | CSS-in-JS library (MUI styling engine) |
| **@emotion/styled** | ^11.13.0 | Styled components API for Emotion |
| **axios** | ^1.7.7 | Promise-based HTTP client |
| **socket.io-client** | ^4.8.3 | Socket.IO client for real-time communication |
| **@hello-pangea/dnd** | ^17.0.0 | Drag and drop library (fork of react-beautiful-dnd) |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **vite** | ^5.4.10 | Next-generation frontend build tool |
| **@vitejs/plugin-react** | ^4.3.3 | Vite plugin for React support |

### Dependency Details

#### React Ecosystem
- **React 18.3**: Latest stable React with concurrent features
- **React Router 6**: Modern routing with data APIs and nested routes

#### UI Framework (Material-UI)
```
@mui/material
├── @emotion/react (peer dependency)
├── @emotion/styled (peer dependency)
└── @mui/icons-material (icon library)
```

**Key MUI Components Used**:
- `Box`, `Container`, `Paper` - Layout
- `Button`, `IconButton`, `Fab` - Actions
- `Dialog`, `DialogTitle`, `DialogContent` - Modals
- `TextField`, `Select`, `FormControl` - Forms
- `Avatar`, `Chip`, `Badge` - Display
- `AppBar`, `Toolbar`, `Drawer` - Navigation
- `Typography` - Text styling

#### Drag and Drop
**@hello-pangea/dnd** is a maintained fork of `react-beautiful-dnd` after the original was deprecated. It provides:
- Accessible drag and drop
- Smooth animations
- Keyboard support
- Vertical and horizontal lists

#### HTTP & Real-time
- **Axios**: Used for all REST API calls with automatic cookie handling
- **Socket.IO Client**: Maintains WebSocket connection for real-time updates

---

## Backend Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **express** | ^4.21.1 | Minimal web framework for Node.js |
| **@prisma/client** | ^5.22.0 | Auto-generated database client |
| **passport** | ^0.7.0 | Authentication middleware |
| **passport-google-oauth20** | ^2.0.0 | Google OAuth 2.0 strategy for Passport |
| **jsonwebtoken** | ^9.0.2 | JWT creation and verification |
| **socket.io** | ^4.8.3 | Real-time bidirectional communication |
| **nodemailer** | ^7.0.12 | Email sending library |
| **cors** | ^2.8.5 | Cross-Origin Resource Sharing middleware |
| **cookie-parser** | ^1.4.6 | Cookie parsing middleware |
| **dotenv** | ^16.4.5 | Environment variable loading |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **prisma** | ^5.22.0 | Prisma CLI for migrations and client generation |
| **nodemon** | ^3.1.7 | Auto-restart server on file changes |

### Dependency Details

#### Express Ecosystem
```
express (core framework)
├── cors (CORS headers)
├── cookie-parser (parse cookies)
└── [routes/middleware] (custom)
```

#### Database (Prisma)
```
prisma (CLI tool - dev)
└── @prisma/client (runtime client)
    └── PostgreSQL (database)
```

**Prisma Features Used**:
- Schema-first design with `schema.prisma`
- Auto-generated TypeScript-safe client
- Migrations and database introspection
- Relations and nested queries
- Transactions

#### Authentication Stack
```
passport (middleware)
└── passport-google-oauth20 (strategy)
    └── jsonwebtoken (session tokens)
```

**Auth Flow**:
1. Passport handles OAuth handshake
2. JWT token generated on success
3. Token stored in HTTP-only cookie
4. Subsequent requests verified with `jsonwebtoken`

#### Real-time Communication
```
socket.io (server)
├── WebSocket (primary transport)
└── HTTP long-polling (fallback)
```

#### Email
```
nodemailer
└── Gmail SMTP (configured transport)
```

---

## Dependency Graph

### Frontend
```
                    ┌─────────────┐
                    │   React     │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
    │  Router │      │    MUI    │     │   D&D     │
    │  DOM    │      │ + Emotion │     │  Library  │
    └─────────┘      └───────────┘     └───────────┘
         │
    ┌────▼────────────────────────┐
    │        axios + socket.io    │
    │        (API Layer)          │
    └─────────────────────────────┘
```

### Backend
```
                    ┌─────────────┐
                    │   Express   │
                    └──────┬──────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼───┐           ┌──────▼──────┐        ┌──────▼──────┐
│Passport│          │  Socket.IO  │        │  Nodemailer │
│ + JWT  │          │             │        │             │
└───┬────┘          └──────┬──────┘        └─────────────┘
    │                      │
    └──────────┬───────────┘
               │
        ┌──────▼──────┐
        │   Prisma    │
        │   Client    │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │ PostgreSQL  │
        └─────────────┘
```

---

## Version Compatibility

### Node.js Requirements
- **Minimum**: Node.js 18.x
- **Recommended**: Node.js 20.x LTS

### Database Requirements
- **PostgreSQL**: 12.x or higher
- **Prisma Support**: Full support for PostgreSQL 10-16

### Browser Support
Based on Vite's default target:
- Chrome 87+
- Firefox 78+
- Safari 14+
- Edge 88+

---

## Security Considerations

### Known Vulnerabilities
Regular dependency audits recommended:
```bash
# Frontend
cd frontend && npm audit

# Backend
cd backend && npm audit
```

### Security-Sensitive Dependencies

| Package | Security Notes |
|---------|----------------|
| jsonwebtoken | Keep updated; verify algorithm configuration |
| passport | Ensure proper session handling |
| cookie-parser | HTTP-only and secure flags important |
| express | Keep updated for security patches |

---

## Update Strategy

### Recommended Update Frequency
- **Security patches**: Immediately
- **Minor versions**: Monthly
- **Major versions**: Evaluate compatibility, test thoroughly

### Update Commands
```bash
# Check for updates
npm outdated

# Update all (minor versions)
npm update

# Update specific package
npm install package@latest

# Update Prisma (requires regeneration)
npm install prisma@latest @prisma/client@latest
npx prisma generate
```

---

## License Summary

All dependencies use permissive open-source licenses:

| License | Packages |
|---------|----------|
| MIT | Most packages (React, Express, Axios, Socket.IO, etc.) |
| Apache 2.0 | Some MUI components |
| ISC | Some Node.js utilities |

No copyleft (GPL) dependencies are included, making this suitable for commercial use.
