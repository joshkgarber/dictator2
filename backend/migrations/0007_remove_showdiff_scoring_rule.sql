-- Migration: Remove orphaned 'showdiff' scoring rule
-- The 'showdiff' command was renamed to 'diff' during development.
-- This orphaned row should be cleaned up to maintain database cleanliness.

DELETE FROM scoring_rules WHERE key = 'showdiff';
