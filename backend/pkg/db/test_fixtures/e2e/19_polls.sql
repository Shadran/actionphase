-- Create Polls Test Game (Isolated for E2E Testing)
-- This fixture creates a dedicated game for testing the Common Room Polling System
-- Game is ISOLATED to prevent test interference when running in parallel
--
-- Game #169: For polls-flow.spec.ts tests

BEGIN;

DELETE FROM games WHERE id = 169;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  aud_id INTEGER;
  phase_id INTEGER;
  c1_id INTEGER;
  c2_id INTEGER;
  c3_id INTEGER;
  poll_id INTEGER;
  opt1_id INTEGER;
  opt2_id INTEGER;
  opt3_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO aud_id FROM users WHERE email = 'test_audience@example.com';

  -- ============================================
  -- GAME #169: Common Room Polls (polls-flow.spec.ts)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    169,
    'E2E Common Room - Polls',
    'Isolated game for polls-flow.spec.ts E2E tests (polling system functionality).',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  -- Add game participants (including audience member)
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (169, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (169, p2_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (169, p3_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (169, aud_id, 'audience', 'active', NOW() - INTERVAL '3 days');

  -- Create active common_room phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    169,
    'common_room',
    1,
    'Planning Session',
    'Active common room phase for testing the polling system.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    true,
    NOW() - INTERVAL '1 hour'
  )
  RETURNING id INTO phase_id;

  -- Create characters for participants
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (169, gm_id, 'GM Narrator', 'npc', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (169, p1_id, 'Polls Test Char 1', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (169, p2_id, 'Polls Test Char 2', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (169, p3_id, 'Polls Test Char 3', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW());

  -- Pre-seed an active poll so tests don't depend on runtime creation for read/vote/permission tests
  INSERT INTO common_room_polls (game_id, phase_id, created_by_user_id, question, description, deadline, show_individual_votes, allow_other_option, created_at, updated_at)
  VALUES (169, phase_id, gm_id, 'What should the party do next?', 'Vote for the next adventure direction', NOW() + INTERVAL '1 day', false, true, NOW() - INTERVAL '30 minutes', NOW())
  RETURNING id INTO poll_id;

  INSERT INTO poll_options (poll_id, option_text, display_order) VALUES (poll_id, 'Explore the abandoned castle', 1) RETURNING id INTO opt1_id;
  INSERT INTO poll_options (poll_id, option_text, display_order) VALUES (poll_id, 'Investigate the mysterious forest', 2) RETURNING id INTO opt2_id;
  INSERT INTO poll_options (poll_id, option_text, display_order) VALUES (poll_id, 'Return to town for supplies', 3) RETURNING id INTO opt3_id;

  -- Pre-seed PLAYER_1's vote so persistence tests don't depend on test 2 running first
  INSERT INTO poll_votes (poll_id, user_id, selected_option_id, created_at, updated_at)
  VALUES (poll_id, p1_id, opt2_id, NOW() - INTERVAL '20 minutes', NOW());

  RAISE NOTICE 'Created Game #169: E2E Common Room - Polls (Phase ID: %)', phase_id;

END $$;

COMMIT;
