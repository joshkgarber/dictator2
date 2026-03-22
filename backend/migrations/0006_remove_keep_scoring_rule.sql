-- Migration: Remove 'keep' command scoring rule
-- The 'keep' command has been removed as redundant functionality.
-- Users can use up arrow to recall previous attempts instead.

DELETE FROM scoring_rules WHERE key = 'keep';
