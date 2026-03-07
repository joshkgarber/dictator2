# Context Decisions and Constraints

## Original Request Summary

- Convert the existing CLI prototype into a shareable web app.
- Frontend: Vite with vanilla JavaScript.
- Backend: Flask + SQLite.
- Authentication required: unauthenticated users must register/login before using the app.
- Support all use cases in `web_app_use_cases.md`.
- Preserve session functionality currently supported by project code in working directory.

## Use Cases Confirmed

From `web_app_use_cases.md`:

1. Story creation (name + level)
2. Chapter creation (name + transcript + audio clips)
3. Session history viewing
4. Register account
5. User login
6. Schedule chapter session after completion
7. View schedule
8. Update schedule date
9. Start a chapter session

## Prototype Behavior Mapped from `main.py`

- Session loop is line/clip based and ordered by clip filename index.
- Commands supported during session:
  - `replay`
  - `keep`
  - `exit`
  - `showdiff`
  - `tutor`
  - `answer`
  - `help`
- Scoring is penalty-style and currently includes command penalties.
- Attempt text is persisted per line (`attempt.txt` in prototype).
- Session logging includes duration, chapter path, reps, and score.
- `--reps` behavior exists and must be preserved in web session mode.
- Diff and tutor features are already part of session workflow.

## Legacy Content Structure Observed

- Filesystem hierarchy: `level/text/chapter` (e.g. `01/01/08`).
- Label files at multiple hierarchy levels (`label`).
- Chapter data includes:
  - `lines.txt`
  - `audio/` with `c-XX.mp3` naming
  - `text/` with `c-XX.txt` naming (present in sample)
  - `next` file for next scheduled session date

## Architectural Direction Agreed

- Browser-based SPA frontend with route guards.
- Flask JSON API backend.
- SQLite relational model + disk-based file storage for clips.
- User-scoped ownership for all resources.
- Session engine endpoint-driven with incremental persistence.

## Security Expectations Captured

- Auth required for all non-auth endpoints.
- Password hashing only.
- Ownership checks everywhere.
- Upload validation and safe path handling.
- OpenAI key remains server-side only.

## Planning Artifacts Produced

- Full development specification.
- Detailed API contract.
- Initial SQL schema.
- Implementation phases + 10-day sprint plan.
- GitHub issue backlog and tracking issue.
