-- Migration: Update tutor_feedback table to support structured JSON responses
-- Replaces response_text TEXT column with response_data JSON column

-- Since SQLite doesn't support ALTER COLUMN, we need to:
-- 1. Create a new table with the updated schema
-- 2. Copy data (though no data preservation needed per requirements)
-- 3. Drop old table
-- 4. Rename new table

CREATE TABLE tutor_feedback_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    clip_index INTEGER NOT NULL,
    attempt_text TEXT NOT NULL,
    line_text TEXT NOT NULL,
    model_name TEXT,
    response_data TEXT NOT NULL,  -- JSON column for structured tutor feedback
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Copy existing data (response_text will be lost, per requirements no data preservation needed)
-- Insert placeholder JSON for existing records
INSERT INTO tutor_feedback_new (id, session_id, clip_index, attempt_text, line_text, model_name, response_data, created_at)
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
