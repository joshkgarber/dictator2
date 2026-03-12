-- Migration: Rename response_text column to response_data for structured JSON responses

ALTER TABLE tutor_feedback RENAME COLUMN response_text TO response_data;
