-- E2E Test Games for Character Workflows and Messaging
-- These games test character creation, approval, and GM/Audience messaging with multiple characters
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing E2E games before recreating

BEGIN;

-- Delete existing E2E character workflow games to prevent duplicates
DELETE FROM games WHERE id IN (300, 301, 302, 600, 601, 602, 603, 604);

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  aud1_id INTEGER;
  game_char_creation_id INTEGER;
  game_char_pending_id INTEGER;
  game_char_view_pending_id INTEGER;
  game_char_approve_id INTEGER;
  game_char_reject_id INTEGER;
  game_char_resubmit_id INTEGER;
  game_char_in_game_id INTEGER;
  game_gm_messaging_id INTEGER;
  phase_id INTEGER;
  gm_char_id INTEGER;
  npc1_id INTEGER;
  npc2_id INTEGER;
  npc3_id INTEGER;
  aud_char_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO aud1_id FROM users WHERE email = 'test_audience@example.com';

  -- ============================================
  -- GAME #300: Character Creation (character-creation-flow.spec.ts)
  -- ============================================
  -- State: character_creation
  -- Purpose: Test player character creation without needing full game setup
  -- Participants: GM + approved Player 1 (no character yet)

  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    300,
    'E2E Test: Character Creation',
    'Game in character_creation state for testing character creation workflow.',
    'Test',
    gm_id,
    4,
    'character_creation',
    true,
    NOW() - INTERVAL '2 days',
    NOW()
  );

  game_char_creation_id := 300;

  -- Add approved player (no character yet - ready for character creation)
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_char_creation_id, p1_id, 'player', 'active', NOW() - INTERVAL '1 day');

  -- GM character (for context)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_char_creation_id,
    gm_id,
    'E2E GM Character',
    'npc',
    'approved',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  );

  -- Deletable NPCs for character-deletion.spec.ts (no messages/actions — safe to delete)
  -- Each test that deletes gets its own character since deletion is destructive
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_char_creation_id, NULL, 'Deletable NPC', 'npc', 'approved', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
    (game_char_creation_id, NULL, 'Cancel Delete NPC', 'npc', 'approved', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour');

  -- ============================================
  -- GAME #301: Character Pending State Test (character starts in pending state after creation)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    301,
    'E2E Test: Character Approval - Pending State',
    'Test character starts in pending state after creation.',
    'Test',
    gm_id,
    4,
    'character_creation',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );
  game_char_pending_id := 301;
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (game_char_pending_id, p1_id, 'player', 'active', NOW() - INTERVAL '2 days');
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_char_pending_id, gm_id, 'E2E GM', 'npc', 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');
  -- Pre-created pending character for test assertions (no runtime creation needed)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_char_pending_id, p1_id, 'Pending State Test Character', 'player_character', 'pending', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour');

  -- ============================================
  -- GAME #321: Character View Pending Test (GM can view pending characters)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    600,
    'E2E Test: Character Approval - View Pending',
    'Test GM viewing pending characters.',
    'Test',
    gm_id,
    4,
    'character_creation',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );
  game_char_view_pending_id := 600;
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (game_char_view_pending_id, p2_id, 'player', 'active', NOW() - INTERVAL '2 days');
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_char_view_pending_id, gm_id, 'E2E GM', 'npc', 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

  -- ============================================
  -- GAME #322: Character Approval Test (GM can approve character)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    601,
    'E2E Test: Character Approval - Approve',
    'Test GM approving characters.',
    'Test',
    gm_id,
    4,
    'character_creation',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );
  game_char_approve_id := 601;
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (game_char_approve_id, p1_id, 'player', 'active', NOW() - INTERVAL '2 days');
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_char_approve_id, gm_id, 'E2E GM', 'npc', 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');
  -- Pre-created pending character for GM approval test (no runtime creation needed)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_char_approve_id, p1_id, 'Approval Test Character', 'player_character', 'pending', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour');

  -- ============================================
  -- GAME #323: Character Rejection Test (GM can reject character and player sees rejection)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    602,
    'E2E Test: Character Approval - Reject',
    'Test GM rejecting characters.',
    'Test',
    gm_id,
    4,
    'character_creation',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );
  game_char_reject_id := 602;
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (game_char_reject_id, p2_id, 'player', 'active', NOW() - INTERVAL '2 days');
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_char_reject_id, gm_id, 'E2E GM', 'npc', 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

  -- ============================================
  -- GAME #324: Character Resubmission Test (rejected character can be edited and resubmitted)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    603,
    'E2E Test: Character Approval - Resubmit',
    'Test character resubmission after rejection.',
    'Test',
    gm_id,
    4,
    'character_creation',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );
  game_char_resubmit_id := 603;
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (game_char_resubmit_id, p1_id, 'player', 'active', NOW() - INTERVAL '2 days');
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_char_resubmit_id, gm_id, 'E2E GM', 'npc', 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');
  -- Pre-created resubmitted character (simulates rejected → edited → resubmitted workflow)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_char_resubmit_id,
    p1_id,
    'Resubmitted Test Character',
    'player_character',
    'pending',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  );

  -- ============================================
  -- GAME #325: Character In-Game Test (approved characters appear in active game)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    604,
    'E2E Test: Character Approval - In Game',
    'Test approved characters appearing in active game.',
    'Test',
    gm_id,
    4,
    'character_creation',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );
  game_char_in_game_id := 604;
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (game_char_in_game_id, p3_id, 'player', 'active', NOW() - INTERVAL '2 days');
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_char_in_game_id, gm_id, 'E2E GM', 'npc', 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');
  -- Pre-created approved character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_char_in_game_id,
    p3_id,
    'Approved Test Character',
    'player_character',
    'approved',
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '12 hours'
  );

  -- ============================================
  -- GAME #302: GM Messaging with Multiple NPCs (private-messages-flow.spec.ts)
  -- ============================================
  -- State: in_progress (common room)
  -- Purpose: Test GM and Audience sending private messages as different characters
  -- Participants: GM (with 3 NPCs) + Audience (with 1 assigned NPC) + 2 Players

  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    302,
    'E2E Test: GM Messaging',
    'Game for testing GM and Audience private messaging with multiple characters.',
    'Mystery',
    gm_id,
    6,
    'in_progress',
    true,
    NOW() - INTERVAL '10 days',
    NOW()
  );

  game_gm_messaging_id := 302;

  -- Add participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_gm_messaging_id, p1_id, 'player', 'active', NOW() - INTERVAL '9 days'),
    (game_gm_messaging_id, p2_id, 'player', 'active', NOW() - INTERVAL '9 days'),
    (game_gm_messaging_id, aud1_id, 'audience', 'active', NOW() - INTERVAL '8 days');

  -- Create common room phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, is_active, is_published, created_at)
  VALUES (
    game_gm_messaging_id,
    'common_room',
    1,
    'Investigation Phase',
    'Gather information and communicate with NPCs',
    NOW() - INTERVAL '1 day',
    true,
    false,
    NOW() - INTERVAL '1 day'
  ) RETURNING id INTO phase_id;

  -- GM Character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_gm_messaging_id,
    NULL,  -- NPCs have no owner, controlled by GM or assigned users
    'E2E GM',
    'npc',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ) RETURNING id INTO gm_char_id;

  -- NPC 1: Detective
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_gm_messaging_id,
    NULL,  -- NPCs have no owner, controlled by GM or assigned users
    'Detective Morrison',
    'npc',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ) RETURNING id INTO npc1_id;

  -- NPC 2: Informant
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_gm_messaging_id,
    NULL,  -- NPCs have no owner, controlled by GM or assigned users
    'Whisper (Informant)',
    'npc',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ) RETURNING id INTO npc2_id;

  -- NPC 3: Suspect
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_gm_messaging_id,
    NULL,  -- NPCs have no owner, controlled by GM or assigned users
    'Victor Ashford',
    'npc',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ) RETURNING id INTO npc3_id;

  -- Audience NPC (assigned to audience member)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_gm_messaging_id,
    NULL,  -- NPCs have no owner, assigned via npc_assignments table
    'The Narrator',
    'npc',
    'approved',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
  ) RETURNING id INTO aud_char_id;

  -- Assign The Narrator to the audience member
  INSERT INTO npc_assignments (character_id, assigned_user_id, assigned_by_user_id, assigned_at)
  VALUES (aud_char_id, aud1_id, gm_id, NOW() - INTERVAL '8 days');

  -- Player 1 Character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_gm_messaging_id,
    p1_id,
    'E2E Test Char 1',
    'player_character',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  );

  -- Player 2 Character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    game_gm_messaging_id,
    p2_id,
    'E2E Test Char 2',
    'player_character',
    'approved',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  );

  -- Update games sequence to avoid conflicts
  PERFORM setval('games_id_seq', 325);

  RAISE NOTICE 'Character Workflow fixtures created: Games 300 301 302 600 601 602 603 604 (301/601 include pre-baked pending characters)';
END $$;

SELECT 'E2E Character Workflow fixtures created successfully!' AS message;

COMMIT;
