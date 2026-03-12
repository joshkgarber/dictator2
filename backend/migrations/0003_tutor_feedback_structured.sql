-- Migration: Rename response_text column to respose_json for structured JSON responses

-- Since SQLite doesn't support ALTER COLUMN, we need to:
-- 1. Create a new table with the updated schema
-- 2. Copy data (converting response_text to JSON format)
-- 3. Drop old table
-- 4. Rename new table

CREATE TABLE tutor_feedback_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    clip_index INTEGER NOT NULL,
    attempt_text TEXT NOT NULL,
    line_text TEXT NOT NULL,
    model_name TEXT,
    respose_json TEXT NOT NULL,  -- Renamed from response_text for structured JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Copy existing data (convert response_text to JSON format)
INSERT INTO tutor_feedback_new (id, session_id, clip_index, attempt_text, line_text, model_name, respose_json, created_at)
SELECT 
    id,
    session_id,
    clip_index,
    attempt_text,
    line_text,
    model_name,
    json_object('corrections', json_array()),
    created_at
FROM tutor_feedback;

-- Drop the old table
DROP TABLE tutor_feedback;

-- Rename the new table to the original name
ALTER TABLE tutor_feedback_new RENAME TO tutor_feedback;

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_tutor_feedback_session_id ON tutor_feedback(session_id);
