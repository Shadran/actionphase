-- E2E Test Fixture for Co-GM NPC Messaging
-- Creates a stable game for testing co-GM private messaging as NPCs.
-- TestAudience1 is permanently co-GM here — this game is NOT touched by
-- co-gm-management.spec.ts, which uses game 339.
--
-- Game ID: 347 (offset by worker via apply_e2e_worker.sh transformation)
--
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DO $$
DECLARE
  gm_id INTEGER;
  audience1_id INTEGER;
  p1_id INTEGER;
  game_id INTEGER;
  phase347_id INTEGER;
BEGIN
  SELECT id INTO gm_id       FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO audience1_id FROM users WHERE email = 'test_audience1@example.com';
  SELECT id INTO p1_id        FROM users WHERE email = 'test_player1@example.com';

  -- Delete existing game for idempotency
  DELETE FROM games WHERE id = 347;

  INSERT INTO games (
    id, title, description, genre, gm_user_id, max_players,
    state, is_public, created_at, updated_at
  ) VALUES (
    347,
    'E2E Test: Co-GM NPC Messaging',
    'Stable fixture for co-GM NPC private messaging tests.',
    'Fantasy',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '14 days',
    NOW()
  );

  game_id := 347;

  -- TestAudience1 as co-GM (stable — not mutated by co-gm-management.spec.ts)
  INSERT INTO game_participants (game_id, user_id, role, status)
  VALUES
    (game_id, audience1_id, 'co_gm',  'active'),
    (game_id, p1_id,        'player', 'active');

  -- Active common room phase (required for Messages tab to appear)
  INSERT INTO game_phases (
    game_id, phase_number, phase_type, title, description,
    start_time, end_time, is_active, is_published
  ) VALUES (
    game_id, 1, 'common_room', 'Common Room', 'Co-GM NPC messaging test phase',
    NOW() - INTERVAL '14 days', NOW() + INTERVAL '30 days',
    true, true
  );

  -- Player character (messaging target)
  INSERT INTO characters (
    game_id, user_id, name, character_type, status, created_at, updated_at
  ) VALUES (
    game_id, p1_id, 'Test Player Character', 'player_character', 'approved',
    NOW() - INTERVAL '10 days', NOW()
  );

  -- GM character (needed for pre-seeded post authorship)
  INSERT INTO characters (
    game_id, user_id, name, character_type, status, created_at, updated_at
  ) VALUES (game_id, gm_id, 'GM Narrator', 'npc', 'approved', NOW() - INTERVAL '10 days', NOW());

  -- Unassigned NPCs controllable by co-GM
  INSERT INTO characters (
    game_id, user_id, name, character_type, status, created_at, updated_at
  ) VALUES
    (game_id, NULL, 'Mysterious Stranger', 'npc', 'approved', NOW() - INTERVAL '10 days', NOW()),
    (game_id, NULL, 'Town Guard',          'npc', 'approved', NOW() - INTERVAL '10 days', NOW());

  -- Pre-seed a GM post so co-GM comment/reply tests don't need to create one at runtime
  SELECT id INTO phase347_id FROM game_phases gp WHERE gp.game_id = 347 LIMIT 1;
  INSERT INTO messages (game_id, phase_id, author_id, character_id, content, message_type, visibility, mentioned_character_ids, created_at)
  VALUES (game_id, phase347_id, gm_id, (SELECT id FROM characters c WHERE c.game_id = 347 AND c.user_id = gm_id LIMIT 1), 'Has anyone seen unusual activity?', 'post', 'game', '{}', NOW() - INTERVAL '1 hour');

  RAISE NOTICE 'Co-GM NPC Messaging fixture created: Game #347 (worker-offset applied)';
END $$;

SELECT 'E2E Co-GM NPC Messaging fixture created successfully!' AS message;

COMMIT;
