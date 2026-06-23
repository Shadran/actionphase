-- Backfill activated_at for phases that were inserted without it.
-- Any phase with a start_time was meant to be activated; activated_at = start_time is correct.
UPDATE game_phases
SET activated_at = start_time
WHERE activated_at IS NULL
  AND start_time IS NOT NULL;
