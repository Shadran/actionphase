-- Revert: remove 'interlude' phase type

BEGIN;

-- Remove any interlude phases before dropping the constraint
DELETE FROM game_phases WHERE phase_type = 'interlude';

ALTER TABLE game_phases DROP CONSTRAINT IF EXISTS game_phases_phase_type_check;

ALTER TABLE game_phases ADD CONSTRAINT game_phases_phase_type_check
    CHECK (phase_type IN ('common_room', 'action'));

COMMENT ON COLUMN game_phases.is_published IS 'For action phases: indicates whether GM has published results. For common_room phases: always false.';

COMMIT;
