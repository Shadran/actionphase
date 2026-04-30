-- E2E Test Fixture: Notification Flow (phase activation test)
-- Purpose: Isolated game for the phase-activation notification test in
--          notification-flow.spec.ts. Player 5 is the sole participant.
--          The test creates a new action phase and activates it, then asserts
--          Player 5 receives a notification. This game must be kept separate
--          from game 704 because creating/activating a phase is a state mutation.
-- Game ID: 705 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id = 705;

DO $$
DECLARE
  gm_id    INTEGER;
  p5_id    INTEGER;
  phase_id INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p5_id FROM users WHERE email = 'test_player5@example.com';

  INSERT INTO games (
    id, title, description, genre, gm_user_id, max_players,
    state, is_public, created_at, updated_at
  ) VALUES (
    705,
    'E2E Test: Notification Phase',
    'Stable fixture for phase-activation notification E2E test.',
    'Test',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '7 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (705, p5_id, 'player', 'active', NOW() - INTERVAL '7 days');

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (705, gm_id, 'GM Character',           'npc',              'approved', NOW() - INTERVAL '7 days', NOW()),
    (705, p5_id, 'Test Notify Phase Char', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW());

  -- Active common_room phase — required for the game to be in_progress and accept a new action phase
  INSERT INTO game_phases (
    game_id, phase_type, phase_number, title, description,
    start_time, deadline, is_active, is_published, created_at
  ) VALUES (
    705, 'common_room', 1, 'Discussion', 'Common room for phase-notification test.',
    NOW() - INTERVAL '6 days', NOW() + INTERVAL '30 days',
    true, true, NOW() - INTERVAL '6 days'
  ) RETURNING id INTO phase_id;

  RAISE NOTICE 'Notification Phase fixture created: Game #705';
END $$;

SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;
