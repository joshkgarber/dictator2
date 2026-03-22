-- Migration: Update scoring rules for incentivized learning
-- replay: 1 -> 5 (more penalty for replaying audio)
-- diff: 1 -> 3 (more penalty for viewing word-level diffs)
-- tutor: 5 -> 10 (more penalty for AI tutor help)
-- answer: 5 -> 10 (more penalty for revealing correct answer)
-- wrong_attempt: unchanged at 1
-- exit: unchanged at 0

UPDATE scoring_rules SET points = 5, updated_at = datetime('now') WHERE key = 'replay';
UPDATE scoring_rules SET points = 3, updated_at = datetime('now') WHERE key = 'diff';
UPDATE scoring_rules SET points = 10, updated_at = datetime('now') WHERE key = 'tutor';
UPDATE scoring_rules SET points = 10, updated_at = datetime('now') WHERE key = 'answer';
