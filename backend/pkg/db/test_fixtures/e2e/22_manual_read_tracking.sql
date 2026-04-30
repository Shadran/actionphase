-- E2E Test Fixture: Manual Read Tracking
-- Purpose: Dedicated game with a pre-seeded GM post and a Player 2 comment so
--          manual-read-tracking.spec.ts tests never need a beforeAll setup step.
--          Player 1 is the reader; Player 2 is the commenter.
-- Game ID: 702 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id = 702;

DO $$
DECLARE
  gm_id      INTEGER;
  p1_id      INTEGER;
  p2_id      INTEGER;
  phase_id   INTEGER;
  post_id    INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';

  INSERT INTO games (
    id, title, description, genre, gm_user_id, max_players,
    state, is_public, created_at, updated_at
  ) VALUES (
    702,
    'E2E Test: Manual Read Tracking',
    'Stable fixture for manual comment read tracking E2E tests.',
    'Test',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '7 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (702, p1_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (702, p2_id, 'player', 'active', NOW() - INTERVAL '7 days');

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (702, gm_id, 'GM Character',      'npc',              'approved', NOW() - INTERVAL '7 days', NOW()),
    (702, p1_id, 'Reader Character',  'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()),
    (702, p2_id, 'Commenter Character','player_character', 'approved', NOW() - INTERVAL '7 days', NOW());

  -- Active common_room phase
  INSERT INTO game_phases (
    game_id, phase_type, phase_number, title, description,
    start_time, deadline, is_active, is_published, created_at
  ) VALUES (
    702, 'common_room', 1, 'Discussion', 'Common room for read-tracking tests.',
    NOW() - INTERVAL '6 days', NOW() + INTERVAL '30 days',
    true, true, NOW() - INTERVAL '6 days'
  ) RETURNING id INTO phase_id;

  -- GM post
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, visibility, mentioned_character_ids, created_at
  ) VALUES (
    702, phase_id, gm_id,
    (SELECT id FROM characters WHERE game_id = 702 AND user_id = gm_id LIMIT 1),
    'Read Tracking Test Post',
    'post', 'game', '{}',
    NOW() - INTERVAL '5 days'
  ) RETURNING id INTO post_id;

  -- Player 2 comment — the thing Player 1 will mark as read/unread
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, parent_id, visibility, mentioned_character_ids, created_at
  ) VALUES (
    702, phase_id, p2_id,
    (SELECT id FROM characters WHERE game_id = 702 AND user_id = p2_id LIMIT 1),
    'Comment for Player 1 to mark as read',
    'comment', post_id, 'game', '{}',
    NOW() - INTERVAL '4 days'
  );

  RAISE NOTICE 'Manual Read Tracking fixture created: Game #702';
END $$;

SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;
