-- Migration: Rename response_data column to response_json for structured JSON responses

ALTER TABLE tutor_feedback RENAME COLUMN response_data TO response_json;
