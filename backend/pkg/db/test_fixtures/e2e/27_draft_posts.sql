-- E2E Test Fixture: Draft Posts
-- Creates a game with two common room phases:
--   Phase 1: active (provides a running game state)
--   Phase 2: pending ("The Gathering Storm") — the phase used for draft post tests
--
-- Also creates a GM NPC character ("The Narrator") so the draft post character
-- selector is populated, and a player character for Player1.
--
-- Game ID: 380 (offset by worker: Worker 1 = 10380, Worker 2 = 20380, etc.)
--
-- IDEMPOTENT: Safe to run multiple times — deletes existing data before recreating.

BEGIN;

DO $$
DECLARE
  gm_id            INTEGER;
  player1_id       INTEGER;
  game_id          INTEGER;
  worker_game_id_offset INTEGER := 0;
BEGIN
  game_id := 380 + worker_game_id_offset;

  DELETE FROM games WHERE id = game_id;

  gm_id      := get_worker_user_id('TestGM',      0);
  player1_id := get_worker_user_id('TestPlayer1', 0);

  INSERT INTO games (
    id, title, description, genre, gm_user_id,
    max_players, state, is_public, created_at, updated_at
  ) VALUES (
    game_id,
    'E2E Test: Draft Posts',
    'Game for testing the draft post create/edit/publish flow.',
    'Fantasy',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '7 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status)
  VALUES
    (game_id, player1_id, 'player', 'active');

  -- Phase 1: active common room (gives the game a running state)
  INSERT INTO game_phases (
    game_id, phase_number, phase_type, title, description,
    start_time, end_time, is_active, is_published
  ) VALUES (
    game_id, 1, 'common_room',
    'The Lobby',
    'Active common room phase.',
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '30 days',
    true, true
  );

  -- Phase 2: pending common room — the subject of all draft post tests
  INSERT INTO game_phases (
    game_id, phase_number, phase_type, title, description,
    start_time, end_time, is_active, is_published
  ) VALUES (
    game_id, 2, 'common_room',
    'The Gathering Storm',
    'Pending common room phase for draft post testing.',
    NULL,
    NULL,
    false, false
  );

  -- GM NPC character — populates the character selector in the draft post form
  INSERT INTO characters (
    game_id, user_id, name, character_type, status, created_at, updated_at
  ) VALUES (
    game_id, gm_id,
    'The Narrator',
    'npc',
    'approved',
    NOW() - INTERVAL '7 days',
    NOW()
  );

  -- Player1 character
  INSERT INTO characters (
    game_id, user_id, name, character_type, status, created_at, updated_at
  ) VALUES (
    game_id, player1_id,
    'Scout',
    'player_character',
    'approved',
    NOW() - INTERVAL '7 days',
    NOW()
  );

  RAISE NOTICE 'Draft Posts fixture created: Game #%', game_id;
END $$;

SELECT 'E2E Draft Posts fixture created successfully!' AS message;

COMMIT;
