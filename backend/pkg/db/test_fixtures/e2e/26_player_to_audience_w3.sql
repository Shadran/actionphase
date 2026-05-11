-- E2E Test Fixture: Player to Audience Transition (Permadeath)
-- Creates a game with one player (TestPlayer2) who will be transitioned to audience.
-- A second player (TestPlayer3) remains active as a control participant.
--
-- Game ID: 370 (offset by worker: Worker 1 = 10370, Worker 2 = 20370, etc.)
--
-- IMPORTANT: TestPlayer2 starts as 'player' each time — the serial UI-lifecycle tests
-- reset state via API between runs (transitionPlayerToAudience is irreversible, so the
-- fixture DELETE + re-INSERT gives us a fresh player for each fixture application).
--
-- IDEMPOTENT: Safe to run multiple times — deletes existing data before recreating.

BEGIN;

DO $$
DECLARE
  gm_id            INTEGER;
  player2_id       INTEGER;
  player3_id       INTEGER;
  game_id          INTEGER;
  worker_game_id_offset INTEGER := 30000;
BEGIN
  game_id := 370 + worker_game_id_offset;

  DELETE FROM games WHERE id = game_id;

  gm_id      := get_worker_user_id('TestGM',      3);
  player2_id := get_worker_user_id('TestPlayer2', 3);
  player3_id := get_worker_user_id('TestPlayer3', 3);

  INSERT INTO games (
    id, title, description, genre, gm_user_id,
    max_players, state, is_public, created_at, updated_at
  ) VALUES (
    game_id,
    'E2E Test: Player to Audience',
    'Game for testing the permadeath player-to-audience transition.',
    'Fantasy',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '14 days',
    NOW()
  );

  -- TestPlayer2: the subject of the transition tests
  -- TestPlayer3: control participant — must remain a player throughout
  INSERT INTO game_participants (game_id, user_id, role, status)
  VALUES
    (game_id, player2_id, 'player', 'active'),
    (game_id, player3_id, 'player', 'active');

  -- Active common room phase so the transitioned player can post
  INSERT INTO game_phases (
    game_id, phase_number, phase_type, title, description,
    start_time, end_time, is_active, is_published
  ) VALUES (
    game_id, 1, 'common_room',
    'Common Room',
    'Active common room for post-transition access testing',
    NOW() - INTERVAL '14 days',
    NOW() + INTERVAL '30 days',
    true, true
  );

  -- Approved character for TestPlayer2 (must survive the transition)
  INSERT INTO characters (
    game_id, user_id, name, character_type, status, created_at, updated_at
  ) VALUES (
    game_id, player2_id,
    'Player2 Test Character',
    'player_character',
    'approved',
    NOW() - INTERVAL '10 days',
    NOW()
  );

  RAISE NOTICE 'Player-to-Audience fixture created: Game #% (worker 3)', game_id;
END $$;

SELECT 'E2E Player-to-Audience fixture (worker 3) created successfully!' AS message;

COMMIT;
