-- E2E Test: Player with Multiple Characters
-- Tests character selector functionality for players assigned to multiple characters
-- This is a worker-specific fixture (w4) for parallel E2E testing
--
-- Game #40340: Player Multiple Characters Test
-- - Player 1 has TWO approved characters in the same game
-- - Tests that character selector appears and works correctly

BEGIN;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  game_id INTEGER;
  phase_id INTEGER;
  char1_id INTEGER;
  char2_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm_4@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1_4@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2_4@example.com';

  -- ============================================
  -- GAME #40340: Player Multiple Characters Test
  -- ============================================
  DELETE FROM games WHERE id = 40340;

  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    40340,
    'E2E Test: Player Multiple Characters',
    'Game for testing character selector with player assigned to multiple characters.',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '7 days',
    NOW()
  );

  game_id := 40340;

  -- Add game participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_id, p1_id, 'player', 'active', NOW() - INTERVAL '6 days'),
    (game_id, p2_id, 'player', 'active', NOW() - INTERVAL '6 days');

  -- Create active common room phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_id,
    'common_room',
    1,
    'Planning Phase',
    'Active common room for testing player with multiple characters.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    true,
    NOW() - INTERVAL '1 hour'
  ) RETURNING id INTO phase_id;

  -- Create TWO characters for Player 1 (this is the key test scenario)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_id, p1_id, 'Aria Moonwhisper', 'player_character', 'approved', NOW() - INTERVAL '6 days', NOW())
  RETURNING id INTO char1_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_id, p1_id, 'Kael Shadowblade', 'player_character', 'approved', NOW() - INTERVAL '6 days', NOW())
  RETURNING id INTO char2_id;

  -- Create ONE character for Player 2 (control - should not see selector)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_id, p2_id, 'Theron Brightshield', 'player_character', 'approved', NOW() - INTERVAL '6 days', NOW());

  -- Create GM NPC for context
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_id, NULL, 'Mysterious Sage', 'npc', 'approved', NOW() - INTERVAL '6 days', NOW());

  -- Pre-seed a GM post so tests don't need a two-context setup to create one at runtime
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, visibility, mentioned_character_ids, created_at
  ) VALUES (
    game_id, phase_id, gm_id,
    (SELECT id FROM characters c WHERE c.game_id = 40340 AND c.user_id IS NULL LIMIT 1),
    'Character Selector Test Post',
    'post', 'game', '{}',
    NOW() - INTERVAL '1 hour'
  );

  RAISE NOTICE 'Player Multiple Characters fixture created: Game #40340 with Player1_4 having 2 characters (Aria Moonwhisper, Kael Shadowblade)';

END $$;

COMMIT;
