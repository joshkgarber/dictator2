# Dictator Web App

Dictator is a web app for transcript + audio memorization practice.

- `frontend/`: Vite + vanilla JavaScript SPA.
- `backend/`: Flask API + SQLite + file-based clip storage.

## Prerequisites

- Node.js 20+
- Python 3.11+

## Local development

1. Copy environment variables:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
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
scripts/dev.sh
```

You can also run each service independently:

```bash
npm --prefix frontend run dev -- --port ${FRONTEND_PORT:-5173}
python -m flask --app backend.run run --debug --port ${BACKEND_PORT:-5000}
```

The backend exposes `GET /api/health`.

## Database setup

`init-db` is called automatically at app startup, and can also be run manually:

```bash
python -m flask --app backend.run init-db
```

## Import legacy filesystem content

The backend includes a CLI importer for legacy `level/text/chapter` folders (for example `../01`, `../02`) and parses:

- labels (`label`, `level.label`, `text.label`, `chapter.label`)
- `lines.txt`
- `audio/c-<index>.mp3`
- `next` session date files (`YYYY-MM-DD` or `YYYY.MM.DD`)

Usage:

```bash
python -m flask --app backend.run import-filesystem --user-email you@example.com --source ../01 --source ../02
```

The command prints a JSON report that includes imported counts and mismatch details:

- `missingClipIndexes`: transcript lines without corresponding clips
- `missingLineIndexes`: clips whose indexes exceed available transcript lines

## Run backend tests

```bash
pytest backend/tests
```

## Docker deployment

The repository includes:

- `backend/Dockerfile`
- `docker-compose.yml`

Bring up backend with persistent SQLite + uploads storage:

```bash
docker compose up -d --build
```

Data is stored in the named volume `dictator-data` (`/data/dictator.db` and `/data/uploads` inside the container).

## Backup and restore

Create a backup directory:

```bash
mkdir -p backups
```

Export the persistent Docker volume:

```bash
docker run --rm -v dictator-data:/volume -v "$(pwd)/backups:/backup" alpine tar czf /backup/dictator-data.tar.gz -C /volume .
```

Restore into the volume:

```bash
docker run --rm -v dictator-data:/volume -v "$(pwd)/backups:/backup" alpine sh -c "cd /volume && tar xzf /backup/dictator-data.tar.gz"
```

For non-Docker local installs, back up `DATABASE` and `CLIP_STORAGE_ROOT` paths together.
