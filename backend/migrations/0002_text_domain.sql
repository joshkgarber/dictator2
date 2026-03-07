PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS texts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    transcript_raw TEXT NOT NULL,
    clip_count INTEGER NOT NULL DEFAULT 0,
    line_count INTEGER NOT NULL DEFAULT 0,
    is_ready INTEGER NOT NULL DEFAULT 0 CHECK (is_ready IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_texts_user_id ON texts(user_id);

CREATE TABLE IF NOT EXISTS text_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_id INTEGER NOT NULL,
    line_index INTEGER NOT NULL,
    line_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(text_id, line_index),
    FOREIGN KEY (text_id) REFERENCES texts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_text_lines_text_id ON text_lines(text_id);

CREATE TABLE IF NOT EXISTS text_clips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_id INTEGER NOT NULL,
    clip_index INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    duration_ms INTEGER,
    trimmed INTEGER NOT NULL DEFAULT 0 CHECK (trimmed IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(text_id, clip_index),
    UNIQUE(text_id, storage_path),
    FOREIGN KEY (text_id) REFERENCES texts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_text_clips_text_id ON text_clips(text_id);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text_id INTEGER NOT NULL,
    reps INTEGER NOT NULL DEFAULT 1 CHECK (reps > 0),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'incomplete', 'abandoned')),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_seconds INTEGER,
    raw_score REAL NOT NULL DEFAULT 0,
    weighted_score REAL,
    total_clips INTEGER NOT NULL DEFAULT 0,
    current_clip_index INTEGER,
    metadata_json TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (text_id) REFERENCES texts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id_started_at ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_text_id ON sessions(text_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE TABLE IF NOT EXISTS session_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    text_line_id INTEGER NOT NULL,
    clip_index INTEGER NOT NULL,
    rep_index INTEGER NOT NULL DEFAULT 1,
    attempt_text TEXT NOT NULL,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (text_line_id) REFERENCES text_lines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_attempts_session_id ON session_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attempts_line ON session_attempts(session_id, clip_index);

CREATE TABLE IF NOT EXISTS session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    clip_index INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('replay', 'showdiff', 'tutor', 'answer', 'help', 'keep', 'exit')),
    points_delta REAL NOT NULL DEFAULT 0,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);

CREATE TABLE IF NOT EXISTS text_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text_id INTEGER NOT NULL,
    next_session_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, text_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (text_id) REFERENCES texts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_text_schedules_user_date ON text_schedules(user_id, next_session_date);

CREATE TABLE IF NOT EXISTS tutor_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    clip_index INTEGER NOT NULL,
    attempt_text TEXT NOT NULL,
    line_text TEXT NOT NULL,
    model_name TEXT,
    response_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutor_feedback_session_id ON tutor_feedback(session_id);

CREATE TABLE IF NOT EXISTS scoring_rules (
    key TEXT PRIMARY KEY,
    points REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO scoring_rules(key, points) VALUES
    ('wrong_attempt', 1),
    ('replay', 1),
    ('showdiff', 1),
    ('tutor', 5),
    ('answer', 5),
    ('keep', 0),
    ('exit', 0);
