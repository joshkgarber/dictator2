# Dictator 2.0 Implementation Plan

## Overview

Dictator 2.0 is a rebuild of the earlier `dictator` project with a narrower, cleaner product scope and a new desktop-first interface. The implementation should reuse proven backend behavior from the previous project where it still fits, while deliberately reshaping the data model and frontend interaction model to match the new wireframes and UX goals.

Core project goals:

- Replace the old monolithic frontend with a new Vite + React frontend.
- Use shadcn components as the UI foundation.
- Simplify the domain from stories + chapters into just texts with levels.
- Keep the proven Flask backend as a starting point, but adapt it to the new product model.
- Build the app around the three main views shown in the wireframes: Schedule, Texts, and History.
- Ship a desktop-only experience.

Reference material from the previous project has been copied into `docs/reference-pack/`. Developers should review `docs/reference-pack/README.md` when they need prior backend behavior, schema, test, or planning context without direct access to the old repository.

## Critical Product Differences From The Previous Project

These are not cosmetic changes. They must shape architecture, API design, and implementation order.

### 1. Texts replace stories + chapters

- The previous project models content as `stories` containing `chapters`.
- Dictator 2.0 simplifies this into a single `text` entity with a level.
- Transcript, audio clips, scheduling, and session history must now attach directly to a text.

### 2. Session commands are typed into the attempt input

This is one of the most important differences from the previous project and must be treated as a dedicated implementation concern.

- In the previous project, commands such as `replay`, `keep`, `showdiff`, `tutor`, `answer`, `help`, and `exit` are surfaced as clickable controls.
- In Dictator 2.0, those commands are entered directly into the same input box used for normal attempts.
- This means the session input must support two distinct behaviors through a single entry point:
  - normal attempt submission
  - command recognition and dispatch
- This affects:
  - session UI design
  - keyboard flow
  - frontend state management
  - validation and error handling
  - help and instruction copy
  - API request routing from the frontend

Implementation consequence:

- The session flow needs an explicit command parsing layer in the frontend.
- Typed command handling must be planned and implemented as a first-class part of the session engine, not added after the baseline session UI is complete.
- The new session UI should not depend on button-based command controls for the main workflow.

Acceptance expectations for typed commands:

- When the user enters an exact reserved command, the app triggers the correct session action.
- When the user enters normal text, the app treats it as an attempt.
- Any input that is not an exact command word, including misspellings or extra text, is treated as an attempt.
- The workflow remains efficient and keyboard-first.

### 3. Multiple views and dialogs replace the old workspace-heavy UI

- The old frontend is a broad, mostly inline workspace.
- Dictator 2.0 moves to a more structured app shell with dedicated views and modal dialogs.
- This should be reflected in component boundaries, route structure, and state organization.

### 4. History replaces the old event-logging emphasis

- The previous project stores detailed events and exposes those in the UI.
- Dictator 2.0 still needs the supporting session data, but the primary surface becomes a simpler session history view.
- The user-facing product should emphasize completed sessions and scores rather than raw operational logs.

## Architecture Direction

## Frontend

- Stack: Vite + React.
- UI primitives: shadcn.
- Scope: desktop-only layout.
- Main app areas:
  - `Schedule`
  - `Texts`
  - `History`
- Dialog-driven workflows:
  - New Text
  - Edit Text
  - Delete Confirmation
  - Session
  - Session Over

Recommended frontend structure:

- `app/` for shell, providers, layout, and navigation
- `features/texts/`
- `features/schedule/`
- `features/history/`
- `features/session/`
- `components/ui/` for shadcn components
- `lib/api/` for API client and request helpers
- `lib/utils/` for formatting and shared utilities

## Backend

- Stack: Flask + SQLite.
- Start from the previous project's backend code and tests.
- Replace or adapt story/chapter concepts into a text-centered model.
- Keep ownership checks, session persistence, schedule support, and upload validation where still useful.

Recommended backend modules:

- `auth`
- `texts`
- `sessions`
- `history`
- `schedule`

## Data Model Direction

The previous schema should be used as reference, not copied unchanged.

Target core entities:

- `users`
- `texts`
- `text_lines`
- `text_clips`
- `sessions`
- `session_attempts`
- `session_events` or equivalent command/action tracking if still needed internally
- `text_schedules`
- `tutor_feedback` if tutor support remains in scope

Recommended `texts` fields:

- id
- user_id
- name
- level
- transcript_raw
- line_count
- clip_count
- is_ready
- created_at
- updated_at

## Delivery Phases

## Phase 0 - Project Bootstrap

Goals:

- Create the real project structure inside `dictator2`.
- Set up frontend and backend as runnable applications.
- Copy or port the previous Flask backend into this repository as the starting point.
- Establish local development scripts, environment handling, and a health check.

Tasks:

- Initialize Vite + React frontend.
- Install and configure shadcn.
- Bring over the Flask application factory, database bootstrapping, and migrations pattern.
- Wire frontend-to-backend communication.
- Confirm the app runs locally with empty state.

Exit criteria:

- Frontend starts successfully.
- Backend starts successfully.
- Frontend can call backend health endpoint.

## Phase 1 - Flatten The Domain To Texts

Goals:

- Replace the old story/chapter model with a text model that matches Dictator 2.0.
- Keep only the backend concepts needed by the new product.

Tasks:

- Design new SQLite schema and migrations for texts, text lines, text clips, schedules, and sessions.
- Refactor CRUD endpoints from story/chapter resources to text resources.
- Remove or de-emphasize backend concepts that only existed to support the old UI model.

Exit criteria:

- Users can create, read, update, and delete texts.
- Each text owns its transcript, clips, schedule, and session history.

## Phase 2 - App Shell And UI Foundation

Goals:

- Implement the desktop-only shell shown in the wireframes.
- Establish shared patterns for navigation, dialogs, tables, forms, and API state.

Tasks:

- Build top-level shell with tabs for Schedule, Texts, and History.
- Set up shared dialog infrastructure.
- Establish typography, spacing, black-and-white visual direction, and table styles.
- Add API client, request state handling, and basic error surfaces.
- Create reusable form patterns for text and schedule workflows.

Exit criteria:

- The shell matches the high-level wireframe structure.
- View switching works.
- Dialogs can be opened and closed consistently.

## Phase 3 - Text Management Flow

Goals:

- Deliver the Texts view and the text creation/editing lifecycle.

Tasks:

- Build the Texts view table with sorting and level filter behavior.
- Build the New Text dialog.
- Build the Edit Text dialog.
- Build the Delete Confirmation dialog.
- Add transcript file selection/validation.
- Add audio clip directory selection/validation.
- Validate transcript line count against available audio clips.
- Surface readiness state so only valid texts can be used for sessions.

Exit criteria:

- Users can create, edit, filter, and delete texts.
- Invalid transcript/clip combinations are detected clearly.
- Text rows are ready for scheduling and session launch.

## Phase 4 - Schedule View

Goals:

- Deliver the schedule workspace defined by the wireframes.

Tasks:

- Build grouped schedule lists for overdue, due today, and upcoming.
- Implement the weekly calendar display.
- Add previous/next week navigation.
- Show scheduled-session indicators in both list and calendar areas.
- Implement the `Start Next Session` action using the priority behavior described in the wireframe notes.

Exit criteria:

- Users can understand what is due now versus later.
- The next session can be launched from schedule without navigating elsewhere.

## Phase 5 - Session Engine And Typed Command Workflow

Goals:

- Port the old session engine to the new text model.
- Implement the new keyboard-first session interaction model.

This phase must explicitly cover the typed-command difference from the previous project.

Tasks:

- Adapt session creation, session state, attempt submission, scoring, completion, and exit flows to the text model.
- Build the Session dialog UI from the wireframe.
- Implement audio playback and clip progression.
- Implement the session transcript/console area for attempt results and command output.
- Implement a command parser for the attempt input field.
- Route reserved commands entered into the attempt box to the correct session action.
- Treat all non-command input as a normal attempt.
- Treat unsupported, malformed, or misspelled command-like input as a normal attempt.
- Ensure the input box remains the main interaction surface for session control.
- Add instructions content that clearly teaches the available commands.

Command-handling requirements:

- Supported typed commands should include:
  - `replay`
  - `keep`
  - `showdiff`
  - `tutor`
  - `answer`
  - `help`
  - `exit`
- Command matching should be exact. Any value that is not exactly one of the reserved command words should be submitted as an attempt.
- The app should preserve parity with the old backend behavior where appropriate.
- The frontend should not force the user to click command buttons to access these actions.
- If any auxiliary command buttons exist during development, they should be treated as temporary helpers or secondary affordances, not the core UX.

Exit criteria:

- A user can complete a full session using the input box for both attempts and commands.
- Typed commands behave correctly and predictably.
- The session interaction feels keyboard-first and aligned with the wireframes.

## Phase 6 - Session Over Flow And Rescheduling

Goals:

- Deliver the post-session flow shown in the Session Over dialog wireframe.

Tasks:

- Build the Session Over dialog.
- Show session duration and weighted score.
- Require next scheduled date selection.
- Save the next scheduled date for the text.
- Return the user to the Schedule view after completion.

Exit criteria:

- Completing a session leads directly into the next-date workflow.
- The next schedule date is persisted successfully.

## Phase 7 - History View

Goals:

- Deliver the simplified session history experience.

Tasks:

- Build the History table with date completed, text, and score.
- Load completed session records from the backend.
- Make text names clickable into the Edit Text dialog, as shown in the wireframe.
- Keep detailed backend session data available for debugging or future extension without overcomplicating the primary UI.

Exit criteria:

- Users can review prior sessions quickly.
- The history surface reflects the simpler product direction.

## Phase 8 - Testing And Hardening

Goals:

- Make the app reliable for real usage.

Tasks:

- Port and update backend tests from the old project.
- Add tests for transcript/clip validation.
- Add tests for typed command parsing and dispatch from the attempt input.
- Add tests for schedule and post-session rescheduling flows.
- Add frontend integration coverage for the key user journeys.

Exit criteria:

- Core user journeys are covered by tests.
- The typed-command workflow is explicitly verified.

## Recommended Build Order

1. Bootstrap frontend and backend.
2. Refactor backend to the new text model.
3. Ship Texts CRUD and validation.
4. Ship Schedule view and session launch.
5. Ship Session dialog with typed command handling.
6. Ship Session Over rescheduling.
7. Ship History view.
8. Finish tests and polish.

## Key Risks And Mitigations

### Risk: typed command parsing becomes ambiguous

- Mitigation: use exact-match command detection only.
- Mitigation: treat every non-exact command input, including misspellings, as a normal attempt.
- Mitigation: add dedicated frontend tests for command detection.

### Risk: backend reuse drags old concepts into the new app

- Mitigation: treat the old backend as source material, not final architecture.
- Mitigation: flatten the model early before building much frontend on top.

### Risk: session UX regresses during the shift from buttons to typed commands

- Mitigation: build and validate the command-input workflow before polishing secondary session UI.
- Mitigation: make help/instructions available inside the session dialog from the start.

## Success Criteria

Dictator 2.0 is successful when:

- A user can create a text with transcript and clips.
- The app validates the text correctly.
- The text appears in the schedule and can be launched into a session.
- The user can complete the session using typed commands in the attempt input.
- The app records results and immediately schedules the next session.
- The completed session appears in history.
- The workflow feels simpler and more intentional than the previous project.
