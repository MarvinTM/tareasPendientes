# Data Flow Diagrams

## Application Data Flow Overview

```mermaid
flowchart TB
    subgraph UserLayer["User Interface Layer"]
        Browser["Web Browser"]
        UI["React Components"]
    end

    subgraph StateLayer["State Management Layer"]
        AuthCtx["Auth Context\n(user state)"]
        SocketCtx["Socket Context\n(connection)"]
        LocalState["Component State\n(tasks, forms)"]
    end

    subgraph APILayer["API Communication Layer"]
        Axios["Axios HTTP Client"]
        SocketIO["Socket.IO Client"]
    end

    subgraph ServerLayer["Server Layer"]
        Express["Express Routes"]
        Middleware["Auth Middleware"]
        Services["Business Services"]
    end

    subgraph DataLayer["Data Layer"]
        Prisma["Prisma Client"]
        PG["PostgreSQL"]
    end

    Browser --> UI
    UI --> StateLayer
    StateLayer --> APILayer
    APILayer --> ServerLayer
    ServerLayer --> DataLayer

    SocketIO -.->|"Real-time"| UI
```

## Request/Response Flow

### Read Operation (GET Tasks)

```mermaid
sequenceDiagram
    participant UI as React UI
    participant API as Axios
    participant Server as Express
    participant MW as Middleware
    participant SVC as Services
    participant DB as PostgreSQL

    UI->>API: fetchTasks()
    API->>Server: GET /api/tasks
    Server->>MW: authenticateToken
    MW->>MW: Verify JWT
    MW->>Server: User authenticated
    Server->>SVC: generatePeriodicTasks()
    SVC->>DB: Check & create periodic tasks
    DB->>SVC: Done
    Server->>DB: SELECT tasks with relations
    DB->>Server: Task records
    Server->>Server: Group by status
    Server->>API: JSON response
    API->>UI: Update state
    UI->>UI: Re-render board
```

### Write Operation (Create Task)

```mermaid
sequenceDiagram
    participant UI as React UI
    participant API as Axios
    participant Server as Express
    participant DB as PostgreSQL
    participant History as TaskHistory
    participant Socket as Socket.IO
    participant Email as Nodemailer
    participant Others as Other Clients

    UI->>API: createTask(data)
    API->>Server: POST /api/tasks
    Server->>Server: Validate input
    Server->>DB: INSERT task
    DB->>Server: New task ID
    Server->>History: Log CREATED action

    alt Has Assignee
        Server->>Email: Send notification
    end

    Server->>Socket: Emit task:created
    Socket->>UI: Event received
    Socket->>Others: Event broadcast

    Server->>API: 201 Created
    API->>UI: Success callback
    UI->>UI: Close dialog
```

## State Management Flow

```mermaid
flowchart LR
    subgraph Contexts["React Contexts"]
        Auth["AuthContext"]
        Socket["SocketContext"]
    end

    subgraph AuthFlow["Auth State Flow"]
        A1["Initial: null"]
        A2["Check /auth/status"]
        A3["Set user object"]
        A4["Logout: null"]
    end

    subgraph SocketFlow["Socket State Flow"]
        S1["Initial: null"]
        S2["User logged in"]
        S3["Connect to server"]
        S4["User logged out"]
        S5["Disconnect"]
    end

    Auth --> AuthFlow
    Socket --> SocketFlow

    A1 --> A2
    A2 -->|"authenticated"| A3
    A2 -->|"not authenticated"| A1
    A3 --> A4
    A4 --> A1

    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S1
```

## Event Flow (Real-time Updates)

```mermaid
flowchart TB
    subgraph Backend["Backend Events"]
        TaskCreate["Task Created"]
        TaskUpdate["Task Updated"]
        TaskDelete["Task Deleted"]
    end

    subgraph Emit["Socket Emission"]
        E1["emitTaskUpdate('task:created', task)"]
        E2["emitTaskUpdate('task:updated', task)"]
        E3["emitTaskUpdate('task:deleted', {id})"]
    end

    subgraph Clients["Connected Clients"]
        C1["Client 1"]
        C2["Client 2"]
        C3["Client N"]
    end

    subgraph Handlers["Event Handlers"]
        H1["Add to Nueva array"]
        H2["Update in correct array"]
        H3["Remove from all arrays"]
    end

    TaskCreate --> E1
    TaskUpdate --> E2
    TaskDelete --> E3

    E1 --> Clients
    E2 --> Clients
    E3 --> Clients

    Clients --> Handlers
```

## Authentication Data Flow

```mermaid
flowchart TB
    subgraph Login["Login Flow"]
        L1["Click Login"]
        L2["Redirect to Google"]
        L3["User consents"]
        L4["Callback with code"]
        L5["Exchange for tokens"]
        L6["Get user profile"]
        L7["Create/update DB user"]
        L8["Generate JWT"]
        L9["Set HTTP-only cookie"]
        L10["Redirect to app"]
    end

    subgraph Session["Session Flow"]
        S1["Every API request"]
        S2["Cookie sent automatically"]
        S3["Middleware extracts JWT"]
        S4["Verify signature"]
        S5["Attach user to request"]
        S6["Continue to route"]
    end

    subgraph Logout["Logout Flow"]
        O1["Click Logout"]
        O2["POST /auth/logout"]
        O3["Clear cookie"]
        O4["Clear client state"]
        O5["Redirect to login"]
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6 --> L7 --> L8 --> L9 --> L10

    S1 --> S2 --> S3 --> S4 --> S5 --> S6

    O1 --> O2 --> O3 --> O4 --> O5
```

## Form Data Flow

```mermaid
flowchart LR
    subgraph Form["Task Form"]
        Title["Title Input"]
        Desc["Description Input"]
        Category["Category Select"]
        Size["Size Select"]
        Assignee["Assignee Select"]
    end

    subgraph Validation["Client Validation"]
        Required["Required fields"]
        Format["Format checks"]
    end

    subgraph Submit["Submission"]
        Prepare["Prepare payload"]
        Send["POST/PATCH request"]
    end

    subgraph Server["Server Processing"]
        Validate["Server validation"]
        Save["Save to database"]
        Notify["Notifications"]
        Broadcast["Socket broadcast"]
    end

    Form --> Validation
    Validation -->|"Valid"| Submit
    Validation -->|"Invalid"| Form
    Submit --> Server
    Server -->|"Success"| Close["Close dialog"]
    Server -->|"Error"| Form
```

## Scoring Data Flow

```mermaid
flowchart TB
    subgraph Request["Score Request"]
        Period["Time period filter"]
        API["GET /users/scores"]
    end

    subgraph Query["Database Queries"]
        History["Query TaskHistory\nSTATUS_CHANGED → Completada"]
        Tasks["Query Tasks\nstatus = Completada"]
        Users["Query Users\nisApproved = true"]
    end

    subgraph Process["Processing"]
        Filter["Filter by period"]
        Match["Match tasks to users"]
        Calculate["Calculate points\nS=1, M=2, L=3"]
        Sort["Sort by points DESC"]
    end

    subgraph Response["Response"]
        JSON["JSON array of scores"]
        Display["Render leaderboard"]
    end

    Request --> Query
    Query --> Process
    Process --> Response

    Period --> Filter
    History --> Filter
    Filter --> Match
    Tasks --> Match
    Users --> Match
    Match --> Calculate
    Calculate --> Sort
    Sort --> JSON
    JSON --> Display
```
