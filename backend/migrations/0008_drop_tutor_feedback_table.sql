-- Migration: Drop the unused tutor_feedback table
-- This table is no longer in use since PR #188 restructured the tutor feedback system

DROP INDEX IF EXISTS idx_tutor_feedback_session_id;
DROP TABLE IF EXISTS tutor_feedback;
