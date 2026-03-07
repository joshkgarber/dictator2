# Development Specification (Vite + Vanilla JS, Flask, SQLite)

## Product Scope

- Build a shareable web app version of Dictator.
- Require account registration/login before app use.
- Support all use cases in `web_app_use_cases.md`.
- Preserve key prototype session functionality from `main.py`.

## User Roles

- Guest: register/login only.
- Authenticated user: full feature access to own data.

## Domain Model

- User
- Story
- Chapter
- ChapterLine
- ChapterClip
- Session
- SessionAttempt
- SessionEvent
- ChapterSchedule
- TutorFeedback

## Functional Requirements

### Auth

- Register account.
- Log in and log out.
- Protected routes for all app features.

### Story and Chapter Management

- Create/list/edit/delete stories.
- Create/list/edit/delete chapters under a story.
- Chapter creation includes transcript and clip uploads.
- Validate line count against clip count before allowing session start.

### Session Engine (Parity with Prototype)

- Start session for selected chapter with reps.
- Process clips in numeric order (`c-1`..`c-249` supported).
- Accept typed attempts line by line.
- Support command actions:
  - `replay`
  - `keep`
  - `showdiff`
  - `tutor`
  - `answer`
  - `help`
  - `exit`
- Persist attempts/events incrementally.
- Track score and session duration.
- Mark completed vs incomplete sessions.

### History

- List user sessions with filters.
- Show session details (attempts, events, score, duration).

### Scheduling

- Set next chapter date after session.
- View schedule (due/upcoming).
- Update schedule date.

## Frontend Specification

- Stack: Vite + vanilla JS SPA.
- Suggested modules:
  - `auth/`
  - `stories/`
  - `chapters/`
  - `session/`
  - `history/`
  - `schedule/`
- Route guards for authenticated pages.
- Session player optimized for keyboard-first flow.
- Responsive behavior for desktop/mobile.

## Backend Specification

- Stack: Flask + SQLite.
- JSON API under `/api`.
- Auth middleware for protected endpoints.
- Ownership checks for all resources.
- Multipart upload handling for mp3 clips.
- OpenAI tutor proxy endpoint from backend only.

## Non-Functional Requirements

- Reliability: session progress survives refresh/interruption.
- Security: no plaintext passwords, validated uploads, user isolation.
- Maintainability: clear module boundaries and test coverage.
- Deployability: simple small-footprint deployment for family/friends usage.
