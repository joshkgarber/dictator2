PRAGMA foreign_keys = ON;

-- Add reps column to texts table with default value of 1
ALTER TABLE texts ADD COLUMN reps INTEGER NOT NULL DEFAULT 1 CHECK (reps > 0);

-- Create index for reps column
CREATE INDEX IF NOT EXISTS idx_texts_reps ON texts(reps);
