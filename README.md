# Dictator 2.0

Phase 0 bootstrap for a Vite + React frontend and Flask + SQLite backend.

## Prerequisites

- Node.js 20+
- Python 3.11+

## Quick start

1. Copy environment examples:

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Install backend dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```

3. Install frontend dependencies:

   ```bash
   npm --prefix frontend install
   ```

4. Run both services:

   ```bash
   bash scripts/dev.sh
   ```

Frontend runs at `http://localhost:5173` and backend runs at `http://localhost:5000` by default.

## Backend commands

- Run API: `python -m flask --app backend.run run --debug --port 5000`
- Re-apply migrations: `python -m flask --app backend.run init-db`

## Frontend commands

- Dev server: `npm --prefix frontend run dev`
- Build: `npm --prefix frontend run build`
- Preview build: `npm --prefix frontend run preview`

## Stream leader agent

The repository includes an automation script for stream issue workflow management:

- Script: `stream-leader/stream_leader.py`
- Docs and setup: `stream-leader/README.md`
- Systemd examples:
  - `stream-leader/stream-leader.service.example`
  - `stream-leader/stream-leader.timer.example`
