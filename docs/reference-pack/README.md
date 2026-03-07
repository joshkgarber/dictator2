# Compact Reference Pack

This directory is a curated reference pack copied from the previous `dictator` project.

It exists so developers working on `dictator2` can still inspect the most important prior implementation details without needing direct access to the old repository.

## Included

### Backend behavior references

- `backend/app/api/sessions.py`
  - Main reference for session lifecycle, scoring, command behavior, diff handling, tutor handling, completion, and exit.
- `backend/app/api/chapters.py`
  - Reference for transcript parsing, clip upload validation, readiness checks, and clip serving.
- `backend/app/api/schedule.py`
  - Reference for schedule logic and due/upcoming categorization.
- `backend/app/api/auth.py`
  - Reference for auth flow and response shape.
- `backend/app/api/__init__.py`
  - Compact map of the old backend API surface.

### Schema and scoring references

- `backend/migrations/0001_initial_schema.sql`
- `backend/migrations/0002_scoring_rules_commands.sql`
- `backend/migrations/0003_tutor_feedback.sql`

These files show the old relational model and command scoring defaults. They are reference material only, not the target schema for `dictator2`.

### Backend test references

- `backend/tests/test_session_schedule_flow.py`
- `backend/tests/test_auth_flow.py`

These are useful as behavior examples when rebuilding or adapting the core flows.

### Planning references

- `planning-context/api-contract.md`
- `planning-context/development-spec.md`
- `planning-context/context-decisions.md`
- `README.upstream.md`

These capture how the old web app was planned and scoped.

### Prototype references

- `prototype-reference/sources/web_app_use_cases.md`
- `prototype-reference/sources/main.py`
- `prototype-reference/sources/PLAN.md`
- `prototype-reference/sources/TODO.md`

These are especially important for understanding the original session behavior that the earlier web app implementation was trying to preserve.

## Intentionally Excluded

- Importer code and importer tests
- Most frontend code from the previous project
- General repository scaffolding and deployment files

The goal is to keep this pack small and focused on the behaviors most likely to matter while implementing `dictator2`.

## How To Use This Pack

- Use the files here as behavioral reference material.
- Do not assume the old story/chapter domain model should be copied directly.
- Prefer the current `dictator2` docs and wireframes when there is a conflict.
- Treat old code as source material, not as the final architecture for this project.
