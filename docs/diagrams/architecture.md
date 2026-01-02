# Architecture Diagrams

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render automatically on GitHub.

## System Architecture

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        React["React SPA"]
        Socket_Client["Socket.IO Client"]
    end

    subgraph Server["Backend Server"]
        Express["Express.js"]
        Passport["Passport OAuth"]
        Socket_Server["Socket.IO Server"]
        Prisma["Prisma ORM"]
    end

    subgraph External["External Services"]
        Google["Google OAuth"]
        Gmail["Gmail SMTP"]
    end

    subgraph Database["Database"]
        PostgreSQL["PostgreSQL"]
    end

    React -->|"REST API (Axios)"| Express
    React <-->|"WebSocket"| Socket_Server
    Socket_Client <-->|"Real-time Events"| Socket_Server

    Express --> Passport
    Passport <-->|"OAuth 2.0"| Google
    Express --> Prisma
    Express -->|"Email Notifications"| Gmail

    Prisma <-->|"SQL"| PostgreSQL
```

## Component Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend Components"]
        App["App.jsx"]

        subgraph Contexts["Contexts"]
            AuthContext["AuthContext"]
            SocketContext["SocketContext"]
        end

        subgraph Pages["Pages"]
            MainPage["MainPage"]
            LoginPage["LoginPage"]
            AdminPage["AdminPage"]
            ScoreboardPage["ScoreboardPage"]
            PeriodicTasksPage["PeriodicTasksPage"]
            HistoryPages["History Pages"]
        end

        subgraph Components["Components"]
            Layout["Layout"]
            TaskBoard["TaskBoard"]
            TaskColumn["TaskColumn"]
            TaskCard["TaskCard"]
            TaskDialog["TaskDialog"]
            CategoryDialog["CategoryDialog"]
            UserAvatar["UserAvatar"]
        end

        App --> Contexts
        App --> Pages
        Pages --> Components

        MainPage --> TaskBoard
        TaskBoard --> TaskColumn
        TaskColumn --> TaskCard
    end
```

## Backend Architecture

```mermaid
flowchart LR
    subgraph Routes["API Routes"]
        auth["/auth"]
        tasks["/tasks"]
        periodic["/periodic-tasks"]
        categories["/categories"]
        users["/users"]
        admin["/admin"]
        history["/history"]
    end

    subgraph Middleware["Middleware"]
        authMW["authenticateToken"]
        adminMW["requireAdmin"]
    end

    subgraph Services["Services"]
        email["Email Service"]
        taskGen["Task Generator"]
        taskHist["Task History"]
    end

    subgraph Socket["Socket.IO"]
        socket["Real-time Events"]
    end

    Routes --> Middleware
    Middleware --> Services
    Services --> socket

    tasks --> taskHist
    tasks --> email
    tasks --> socket
    periodic --> taskGen
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Google
    participant Database

    User->>Frontend: Click "Sign in with Google"
    Frontend->>Backend: GET /api/auth/google
    Backend->>Google: Redirect to OAuth consent
    Google->>User: Show consent screen
    User->>Google: Approve access
    Google->>Backend: Callback with auth code
    Backend->>Google: Exchange code for tokens
    Google->>Backend: Return user profile
    Backend->>Database: Create/update user
    Database->>Backend: User record
    Backend->>Backend: Generate JWT
    Backend->>Frontend: Set cookie + redirect
    Frontend->>User: Show task board (or pending approval)
```

## Task Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database
    participant Socket
    participant Email

    User->>Frontend: Fill task form & submit
    Frontend->>Backend: POST /api/tasks
    Backend->>Database: Create task
    Database->>Backend: New task record
    Backend->>Database: Log to TaskHistory

    alt Task has assignee
        Backend->>Email: Send notification
        Email-->>User: Email delivered
    end

    Backend->>Socket: Emit task:created
    Socket->>Frontend: Broadcast to all clients
    Frontend->>User: Task appears on board
    Backend->>Frontend: HTTP Response (201)
```

## Real-time Update Flow

```mermaid
sequenceDiagram
    participant User1 as User A
    participant FE1 as Frontend A
    participant Backend
    participant Socket
    participant FE2 as Frontend B
    participant User2 as User B

    User1->>FE1: Drag task to new column
    FE1->>Backend: PATCH /api/tasks/:id
    Backend->>Backend: Update database
    Backend->>Socket: Emit task:updated
    Socket->>FE1: Receive update
    Socket->>FE2: Receive update
    FE1->>User1: Update UI
    FE2->>User2: Update UI (real-time)
```

## Periodic Task Generation

```mermaid
flowchart TB
    subgraph Trigger["Trigger"]
        UserLoad["User loads task board"]
    end

    subgraph Check["Check Conditions"]
        GetTemplates["Get periodic task templates"]
        CheckWeekly{"Weekly task?\nCorrect day?"}
        CheckMonthly{"Monthly task?\nCorrect month?"}
        CheckGenerated{"Already generated\nthis period?"}
    end

    subgraph Generate["Generate"]
        CreateTask["Create new task"]
        UpdateLastGen["Update lastGeneratedAt"]
        LogHistory["Log to history"]
        Notify["Send notifications"]
        Broadcast["Broadcast via Socket"]
    end

    UserLoad --> GetTemplates
    GetTemplates --> CheckWeekly
    GetTemplates --> CheckMonthly

    CheckWeekly -->|Yes| CheckGenerated
    CheckMonthly -->|Yes| CheckGenerated
    CheckWeekly -->|No| End1["Skip"]
    CheckMonthly -->|No| End2["Skip"]

    CheckGenerated -->|No| CreateTask
    CheckGenerated -->|Yes| End3["Skip"]

    CreateTask --> UpdateLastGen
    UpdateLastGen --> LogHistory
    LogHistory --> Notify
    Notify --> Broadcast
```

## Scoring System Flow

```mermaid
flowchart LR
    subgraph Input["Data Sources"]
        History["TaskHistory\n(STATUS_CHANGED to Completada)"]
        Tasks["Tasks\n(still in Completada status)"]
        Users["Approved Users"]
    end

    subgraph Filter["Filtering"]
        Period["Apply time period filter"]
        Status["Verify task still completed"]
        Assignee["Match to assigned user"]
    end

    subgraph Calculate["Score Calculation"]
        Points["Sum points by size\nS=1, M=2, L=3"]
        Count["Count completed tasks"]
    end

    subgraph Output["Result"]
        Leaderboard["Sorted leaderboard"]
    end

    History --> Period
    Period --> Status
    Tasks --> Status
    Status --> Assignee
    Users --> Assignee
    Assignee --> Points
    Assignee --> Count
    Points --> Leaderboard
    Count --> Leaderboard
```
