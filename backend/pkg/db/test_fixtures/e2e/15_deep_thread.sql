-- E2E Test Fixture: Deep Threaded Comments
-- Purpose: Pre-create deeply nested comments (6+ levels) to test "Continue this thread" button
-- Game: #700 - E2E Deep Thread Testing
-- Created: For testing deeply nested comment navigation

-- Clean up any existing test data for this fixture
DELETE FROM games WHERE id = 700;

-- Create dedicated game for deep thread testing
INSERT INTO games (
  id,
  gm_user_id,
  title,
  description,
  genre,
  max_players,
  state,
  is_public,
  created_at,
  updated_at
)
SELECT
  700,
  id,
  'E2E Deep Thread - Continue Button',
  'Test deeply nested comments and "Continue this thread" button functionality.',
  'Test',
  5,
  'in_progress',
  false,
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days'
FROM users WHERE username = 'TestGM';

-- Create active Discussion phase
DO $$
DECLARE
  game_deep_thread_id INT := 700;
  phase_id INT;
  gm_id INT;
  player1_id INT;
  player2_id INT;
  gm_char_id INT;
  player1_char_id INT;
  player2_char_id INT;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE username = 'TestGM';
  SELECT id INTO player1_id FROM users WHERE username = 'TestPlayer1';
  SELECT id INTO player2_id FROM users WHERE username = 'TestPlayer2';

  -- Create GM character (NPC)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_deep_thread_id,
    NULL,  -- NPCs have no owner
    'E2E GM',
    'npc',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ) RETURNING id INTO gm_char_id;

  -- Create Player 1 character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_deep_thread_id,
    player1_id,
    'Player 1',
    'player_character',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ) RETURNING id INTO player1_char_id;

  -- Create Player 2 character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_deep_thread_id,
    player2_id,
    'Player 2',
    'player_character',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ) RETURNING id INTO player2_char_id;

  -- Add participants (GM is already tracked in games.gm_user_id)
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_deep_thread_id, player1_id, 'player', 'active', NOW() - INTERVAL '9 days'),
    (game_deep_thread_id, player2_id, 'player', 'active', NOW() - INTERVAL '9 days');

  -- Create active Discussion phase
  INSERT INTO game_phases (
    game_id,
    phase_type,
    phase_number,
    title,
    description,
    start_time,
    deadline,
    is_active,
    is_published,
    created_at
  ) VALUES (
    game_deep_thread_id,
    'common_room',
    1,
    'Discussion',
    'Active discussion phase for deep thread testing',
    NOW() - INTERVAL '8 days',
    NOW() + INTERVAL '1 day',
    true,
    true,
    NOW() - INTERVAL '8 days'
  ) RETURNING id INTO phase_id;

  -- Note: Post and comments are pre-created in 07_common_room.sql for game 610.
  -- Game 700 is kept as a shell only — the test uses game 610 (COMMON_ROOM_DEEP_NESTING).
  RAISE NOTICE 'Deep Thread fixture created: Game #700 (shell only)';
END $$;

-- Reset the games sequence to prevent duplicate key errors
-- This ensures new game creations don't collide with hardcoded fixture IDs
SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

-- Verify fixture
DO $$
BEGIN
  RAISE NOTICE 'Deep Thread Testing fixture created successfully!';
END $$;
