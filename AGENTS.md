# Agent Guidelines for Dictator 2.0

This document provides guidelines for AI agents working on the Dictator 2.0 codebase, including build/lint/test commands, code style conventions, and project-specific rules.

## Project Overview

- **Backend**: Flask + SQLite (Python 3.11+)
- **Frontend**: Vite + React + TypeScript
- **Architecture**: REST API with separate frontend/backend services
- **Testing**: pytest (backend), vitest (frontend)

## Build/Lint/Test Commands

### Backend (Python/Flask)

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run backend server
python -m flask --app backend.run run --debug --port 5000

# Initialize database
python -m flask --app backend.run init-db

# Run all backend tests
python -m pytest backend/tests/

# Run specific test file
python -m pytest backend/tests/test_auth_flow.py

# Run specific test function
python -m pytest backend/tests/test_auth_flow.py::test_register_login_me_logout_flow

# Run tests with verbose output
python -m pytest -v backend/tests/

# Run tests and stop on first failure
python -m pytest -x backend/tests/
```

### Frontend (TypeScript/React)

```bash
# Install dependencies
npm --prefix frontend install

# Run development server
npm --prefix frontend run dev

# Build for production
npm --prefix frontend run build

# Preview production build
npm --prefix frontend run preview

# Run all frontend tests
npm --prefix frontend run test

# Run tests once (no watch mode)
npm --prefix frontend run test:run

# Run specific test file
npm --prefix frontend run test src/features/auth/auth-context.test.tsx

# Run tests with coverage
npx vitest run --coverage
```

### Full Stack Development

```bash
# Run both frontend and backend (from project root)
bash scripts/dev.sh

# Clean build (remove cache and reinstall)
rm -rf .venv node_modules frontend/node_modules
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
npm --prefix frontend install
```

## Code Style Guidelines

### Python Backend

#### Imports
- Use absolute imports within the package
- Group imports: standard library, third-party, local
- Use `from __future__ import annotations` for type hints
- Import specific names rather than modules when possible

```python
# Good
from __future__ import annotations
from pathlib import Path
from flask import Flask, jsonify
from .db import get_db

# Avoid
import flask
import pathlib
```

#### Formatting
- Follow PEP 8 guidelines
- Use 4-space indentation
- Limit lines to 88 characters
- Use snake_case for variables/functions
- Use PascalCase for classes
- Use UPPER_CASE for constants
- Add two blank lines between top-level functions/classes
- Add one blank line between methods

#### Type Hints
- Use Python type hints extensively
- Use `|` for union types (Python 3.10+)
- Use `dict`, `list`, `tuple` for simple types
- Use `typing` module for complex types

```python
# Good
def create_auth_session(user_id: int) -> tuple[str, str, datetime]:
    pass

# Avoid
def create_auth_session(user_id):
    pass
```

#### Naming Conventions
- Functions: `snake_case` with verbs (e.g., `get_user()`, `create_session()`)
- Variables: `snake_case` with nouns (e.g., `user_id`, `session_token`)
- Classes: `PascalCase` (e.g., `AuthError`, `DatabaseConnection`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- Private methods: `_prefix` (e.g., `_validate_input()`)

#### Error Handling
- Use custom exception classes for domain-specific errors
- Provide meaningful error messages
- Use HTTP status codes appropriately in API responses
- Validate input data early and fail fast

```python
# Good
class ApiError(Exception):
    def __init__(self, message: str, status: int, payload: unknown):
        super().__init__(message)
        self.status = status
        self.payload = payload

# In API endpoints
def error_response(code: str, message: str, status: int):
    return jsonify({"error": {"code": code, "message": message}}), status
```

#### Database Operations
- Use parameterized queries to prevent SQL injection
- Use context managers for database connections
- Handle database errors gracefully
- Use transactions for multi-step operations

### TypeScript Frontend

#### Imports
- Use ES modules (`import/export`)
- Group imports: React, external libraries, local files
- Use absolute imports with `@/` alias for project files
- Use named imports for specific functions/components

```typescript
# Good
import { useState, useEffect, useCallback } from 'react';
import { requestJson, ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';

# Avoid
import React from 'react';
import * as api from '@/lib/api/client';
```

#### Formatting
- Use 2-space indentation
- Use single quotes for strings
- Use semicolons
- Limit lines to 100 characters
- Use PascalCase for components
- Use camelCase for variables/functions
- Add spaces around operators and after commas

#### TypeScript Types
- Use TypeScript interfaces for complex types
- Use type aliases for union types and simple objects
- Avoid `any` type - use `unknown` instead
- Use generics for reusable components/functions

```typescript
# Good
export interface AuthUser {
  id: number;
  email: string;
  username: string;
}

export type HealthResponse = {
  status: string;
  service: string;
};

# Avoid
export type User = any;
```

#### Component Structure
- Use functional components with hooks
- Separate logic from presentation
- Use custom hooks for reusable logic
- Follow React best practices (keys, effect cleanup, etc.)

```typescript
# Good - Functional component with hooks
interface UserProfileProps {
  user: AuthUser;
  onLogout: () => void;
}

export function UserProfile({ user, onLogout }: UserProfileProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      await onLogout();
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  return (
    <div className="user-profile">
      <h2>{user.username}</h2>
      <Button onClick={handleLogout} disabled={isLoading}>
        {isLoading ? 'Logging out...' : 'Logout'}
      </Button>
    </div>
  );
}
```

#### API Client Patterns
- Centralize API calls in dedicated service files
- Use consistent error handling
- Type all API responses
- Handle authentication tokens properly

```typescript
# Good - Typed API client
export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json();
    throw new ApiError(
      getErrorMessage(payload, response.status),
      response.status,
      payload
    );
  }

  return response.json() as T;
}
```

#### Testing Patterns
- Use `@testing-library/react` for component testing
- Use `vitest` for unit tests
- Mock external dependencies
- Test both happy paths and error cases
- Use descriptive test names

```typescript
# Good test structure
describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with null user when no stored user exists', () => {
    // Test implementation
  });

  it('should handle login errors gracefully', async () => {
    // Mock failed login
    vi.mocked(loginUser).mockRejectedValue(
      new ApiError('Invalid credentials', 401, {})
    );
    
    // Test error handling
  });
});
```

## Project-Specific Rules

### Backend API Conventions
- Use `/api` prefix for all API endpoints
- Use RESTful naming: `/api/resource` for collections, `/api/resource/{id}` for items
- Use HTTP methods appropriately:
  - `GET` for reading data
  - `POST` for creating data
  - `PUT`/`PATCH` for updating data
  - `DELETE` for removing data
- Return consistent JSON response formats
- Use proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)

### Authentication Flow
- Use session-based authentication with cookies
- Include CSRF tokens in state-modifying requests
- Store CSRF token in cookie named `csrf_token`
- Include CSRF token in `X-CSRF-Token` header
- Handle 401 responses by clearing authentication state

### Database Schema
- Use SQLite for development
- Store database in `backend/instance/dictator2.sqlite3`
- Store audio clips in `backend/instance/clips/`
- Use migrations in `backend/migrations/` directory

### Environment Variables
- Use `.env` files for configuration
- Prefix backend env vars appropriately
- Never commit secrets to version control
- Use `.env.example` files for documentation

### Frontend Routing
- Use React Router for navigation
- Protect authenticated routes with route guards
- Handle authentication state changes gracefully
- Redirect unauthenticated users to login page

### Error Handling
- Backend: Return JSON error objects with `error.code` and `error.message`
- Frontend: Display user-friendly error messages
- Log errors for debugging but don't expose sensitive information
- Provide actionable error messages to users

### Testing Best Practices
- Backend tests: Use pytest with temporary SQLite databases
- Frontend tests: Use vitest with jsdom
- Test both success and failure scenarios
- Mock external APIs and services
- Keep tests isolated and deterministic
- Use descriptive test names that explain the behavior

## Development Workflow

1. **Feature Development**:
   - Create feature branches from `main`
   - Use descriptive branch names (e.g., `feat/auth-improvements`)
   - Write tests before implementation when possible
   - Keep commits small and focused

2. **Testing**:
   - Run relevant tests before committing
   - Ensure all tests pass
   - Add tests for new functionality
   - Update existing tests when behavior changes

3. **Code Reviews**:
   - Follow established code style
   - Ensure proper error handling
   - Verify test coverage
   - Check for security issues

4. **Deployment**:
   - Build frontend assets
   - Run database migrations
   - Restart backend services
   - Verify health checks pass

## Security Guidelines

- Never hardcode secrets or API keys
- Use environment variables for sensitive data
- Validate all user input
- Sanitize HTML content (use DOMPurify)
- Use HTTPS in production
- Implement proper CORS headers
- Use secure cookie settings in production
- Hash passwords with strong algorithms (PBKDF2)
- Implement rate limiting for public endpoints

## Performance Guidelines

- Backend: Use database indexes for frequent queries
- Frontend: Use React.memo for expensive components
- Bundle and minify frontend assets for production
- Implement proper caching headers
- Optimize database queries (avoid N+1 queries)
- Use lazy loading for non-critical resources