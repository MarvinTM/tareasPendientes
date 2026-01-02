# Testing Documentation

## Overview

Tareas Pendientes uses a comprehensive testing strategy with unit tests for both frontend and backend.

## Test Stack

| Layer | Framework | Environment |
|-------|-----------|-------------|
| Backend | Jest | Node.js |
| Frontend | Vitest | happy-dom |

## Running Tests

### All Tests
```bash
npm test
```

### Backend Tests Only
```bash
npm run test:backend
# or
cd backend && npm test
```

### Frontend Tests Only
```bash
npm run test:frontend
# or
cd frontend && npm test
```

### Watch Mode
```bash
# Backend
cd backend && npm run test:watch

# Frontend
cd frontend && npm run test:watch
```

### Coverage Reports
```bash
npm run test:coverage
```

Coverage reports are generated in:
- `backend/coverage/`
- `frontend/coverage/`

---

## Backend Tests

### Test Structure
```
backend/src/__tests__/
├── setup.js                    # Test environment setup
├── middleware/
│   ├── auth.test.js           # Authentication middleware tests
│   └── admin.test.js          # Admin authorization tests
├── services/
│   ├── taskHistory.test.js    # History logging tests
│   ├── email.test.js          # Email service tests
│   └── taskGenerator.test.js  # Periodic task generation tests
└── routes/
    ├── tasks.test.js          # Task route logic tests
    └── users.test.js          # User/scores route tests
```

### Test Categories

#### Middleware Tests
- **auth.test.js**: JWT token generation, validation, and extraction
- **admin.test.js**: Admin email parsing, authorization logic

#### Service Tests
- **taskHistory.test.js**: Action types, history entry structure
- **email.test.js**: Configuration detection, email structure
- **taskGenerator.test.js**: Frequency types, date calculations, generation logic

#### Route Tests
- **tasks.test.js**: Status/size validation, grouping, update logic
- **users.test.js**: Score calculation, period filtering, sorting

### Configuration

**jest.config.js**:
```javascript
export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  verbose: true
};
```

---

## Frontend Tests

### Test Structure
```
frontend/src/__tests__/
├── setup.js                    # Test environment setup
├── components/
│   ├── TaskCard.test.jsx      # Task card display logic
│   └── TaskBoard.test.jsx     # Kanban board logic
├── contexts/
│   ├── AuthContext.test.jsx   # Authentication state tests
│   └── SocketContext.test.jsx # Socket connection tests
└── services/
    └── api.test.jsx           # API endpoint tests
```

### Test Categories

#### Component Tests
- **TaskCard.test.jsx**: Size labels, status colors, category/assignee display
- **TaskBoard.test.jsx**: Column definitions, task grouping, drag-and-drop, socket events

#### Context Tests
- **AuthContext.test.jsx**: User state, loading state, admin detection, login URL
- **SocketContext.test.jsx**: Connection logic, URL construction, event handling

#### Service Tests
- **api.test.jsx**: Endpoint structure, query parameters, error handling

### Configuration

**vitest.config.js**:
```javascript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}']
  }
});
```

---

## Test Patterns

### Unit Test Structure
```javascript
describe('Feature/Component Name', () => {
  describe('Sub-feature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = ...;

      // Act
      const result = someFunction(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Testing Business Logic
Tests focus on pure business logic to avoid complex mocking:

```javascript
// Example: Testing validation logic
describe('Task Status Validation', () => {
  const validStatuses = ['Nueva', 'EnProgreso', 'Completada'];

  it('should accept valid statuses', () => {
    validStatuses.forEach(status => {
      expect(validStatuses.includes(status)).toBe(true);
    });
  });
});
```

### Testing Data Transformations
```javascript
// Example: Testing score calculation
describe('Score Calculation', () => {
  const sizePoints = { Pequena: 1, Mediana: 2, Grande: 3 };

  it('should calculate total points correctly', () => {
    const tasks = [
      { size: 'Pequena' },
      { size: 'Grande' }
    ];

    const total = tasks.reduce((sum, task) =>
      sum + (sizePoints[task.size] || 1), 0
    );

    expect(total).toBe(4); // 1 + 3
  });
});
```

---

## Coverage Goals

| Metric | Target |
|--------|--------|
| Statements | 70% |
| Branches | 60% |
| Functions | 70% |
| Lines | 70% |

---

## Adding New Tests

### Backend
1. Create test file in appropriate `__tests__/` subdirectory
2. Import from `@jest/globals`:
   ```javascript
   import { describe, it, expect } from '@jest/globals';
   ```
3. Test pure logic without database dependencies

### Frontend
1. Create test file in appropriate `__tests__/` subdirectory
2. Import from `vitest`:
   ```javascript
   import { describe, it, expect } from 'vitest';
   ```
3. Test component logic and state management

---

## Continuous Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm test
```

---

## Troubleshooting

### Backend Tests Not Running
- Ensure you're in the backend directory or using workspace flag
- Check that Jest is installed: `npm install`

### Frontend Tests Failing with ESM Errors
- Ensure `happy-dom` is used instead of `jsdom`
- Check Node.js version compatibility

### Import Errors
- Backend: Use `import { } from '@jest/globals'`
- Frontend: Use `import { } from 'vitest'`
