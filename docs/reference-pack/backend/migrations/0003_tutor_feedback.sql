CREATE TABLE IF NOT EXISTS tutor_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  clip_index INTEGER NOT NULL,
  attempt_text TEXT NOT NULL,
  line_text TEXT NOT NULL,
  model_name TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutor_feedback_session ON tutor_feedback(session_id);
