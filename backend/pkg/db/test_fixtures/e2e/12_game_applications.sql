-- E2E Test Fixture for Game Application Workflow
-- Creates multiple isolated games for testing different application scenarios
-- Tests: Player applies → GM receives notification → GM reviews → GM approves/rejects
-- Also includes audience joining during character_creation state
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing data before recreating
--
-- Game IDs: 329-333, 341, 346 (offset by worker: Worker 1 = 10329-10333, 10341, 10346, etc.)

BEGIN;

-- Delete existing game application test games to prevent duplicates
DELETE FROM games WHERE id IN (329, 330, 331, 332, 333, 341, 346);

DO $$
DECLARE
  gm_id INTEGER;
  player1_id INTEGER;
  player2_id INTEGER;
  player3_id INTEGER;
  player4_id INTEGER;
  -- Hardcoded game IDs for worker offset support
  game1_id INT := 329;
  game2_id INT := 330;
  game3_id INT := 331;
  game4_id INT := 332;
  game5_id INT := 333;
  game7_id INT := 341;
  game6_id INT := 346;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO player1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO player2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO player3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO player4_id FROM users WHERE email = 'test_player4@example.com';

  -- ============================================
  -- Game #329: For testing player submission (fresh, no applications)
  -- ============================================
  INSERT INTO games (
    id,
    title,
    description,
    genre,
    gm_user_id,
    max_players,
    state,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    game1_id,
    'E2E Test: Game Application - Submit',
    'Fresh recruitment game for testing player application submission.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- ============================================
  -- Game #330: For testing GM viewing applications (with pending application)
  -- ============================================
  INSERT INTO games (
    id,
    title,
    description,
    genre,
    gm_user_id,
    max_players,
    state,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    game2_id,
    'E2E Test: Game Application - View',
    'Game with pending application for testing GM application review.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- Add pending application from PLAYER_4
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES (
    game2_id,
    player4_id,
    'player',
    'I would like to join this fantasy adventure!',
    'pending',
    NOW() - INTERVAL '1 hour'
  );

  -- ============================================
  -- Game #331: For testing GM approving application
  -- ============================================
  INSERT INTO games (
    id,
    title,
    description,
    genre,
    gm_user_id,
    max_players,
    state,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    game3_id,
    'E2E Test: Game Application - Approve',
    'Game with pending application for testing GM approval.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- Add pending application from PLAYER_3
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES (
    game3_id,
    player3_id,
    'player',
    'Excited to join this epic quest!',
    'pending',
    NOW() - INTERVAL '1 hour'
  );

  -- ============================================
  -- Game #332: For testing GM rejecting application
  -- ============================================
  INSERT INTO games (
    id,
    title,
    description,
    genre,
    gm_user_id,
    max_players,
    state,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    game4_id,
    'E2E Test: Game Application - Reject',
    'Game with pending application for testing GM rejection.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- Add pending application from PLAYER_1
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES (
    game4_id,
    player1_id,
    'player',
    'I want to join this game!',
    'pending',
    NOW() - INTERVAL '1 hour'
  );

  -- ============================================
  -- Game #333: For testing duplicate application prevention
  -- ============================================
  INSERT INTO games (
    id,
    title,
    description,
    genre,
    gm_user_id,
    max_players,
    state,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    game5_id,
    'E2E Test: Game Application - Duplicate',
    'Game with existing application for testing duplicate prevention.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- Add existing application from PLAYER_2
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES (
    game5_id,
    player2_id,
    'player',
    'First application attempt',
    'pending',
    NOW() - INTERVAL '2 hours'
  );

  -- ============================================
  -- Game #341: For testing public applicants list visibility
  -- ============================================
  INSERT INTO games (
    id,
    title,
    description,
    genre,
    gm_user_id,
    max_players,
    state,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    game7_id,
    'E2E Test: Game Application - Public List',
    'Recruitment game with pre-seeded applications for testing public applicant list.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- Pre-seed applications from PLAYER_2 and PLAYER_3 (no conditional logic needed in tests)
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES
    (game7_id, player2_id, 'player', 'I want to join!', 'pending', NOW() - INTERVAL '2 hours'),
    (game7_id, player3_id, 'player', 'Count me in!', 'pending', NOW() - INTERVAL '1 hour');

  -- ============================================
  -- Game #334: For testing audience joining during character_creation
  -- ============================================
  INSERT INTO games (
    id,
    title,
    description,
    genre,
    gm_user_id,
    max_players,
    state,
    is_public,
    auto_accept_audience,
    created_at,
    updated_at
  )
  VALUES (
    game6_id,
    'E2E Test: Character Creation Audience',
    'Game in character_creation state for testing audience joining.',
    'Fantasy',
    gm_id,
    5,
    'character_creation',
    true,
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- Add a player participant (not PLAYER_4, so they can join as audience)
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (
    game6_id,
    player1_id,
    'player',
    'active',
    NOW() - INTERVAL '2 days'
  );

  RAISE NOTICE 'Game Application Workflow fixtures created: Games % % % % % % %', game1_id, game2_id, game3_id, game4_id, game5_id, game7_id, game6_id;

END $$;

-- Reset the games sequence to prevent duplicate key errors
-- This ensures new game creations don't collide with hardcoded fixture IDs
SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;

-- Success message
SELECT 'E2E Game Application Workflow fixture created successfully!' as message;
