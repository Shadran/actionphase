-- Add 'interlude' phase type: private messaging only, no public post or action submissions

BEGIN;

ALTER TABLE game_phases DROP CONSTRAINT IF EXISTS game_phases_phase_type_check;

ALTER TABLE game_phases ADD CONSTRAINT game_phases_phase_type_check
    CHECK (phase_type IN ('common_room', 'action', 'interlude'));

COMMENT ON COLUMN game_phases.is_published IS 'For action phases: indicates whether GM has published results. For common_room and interlude phases: always false.';

COMMIT;
