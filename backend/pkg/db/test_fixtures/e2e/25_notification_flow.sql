-- E2E Test Fixture: Notification Flow (reply & mention tests)
-- Purpose: Isolated game for notification-flow.spec.ts.
--   - Game 704: reply/mention notification tests
--     Players 1–4 participate with named characters.
--     Pre-seeded: a GM post + a Player 1 comment so the reply test starts
--     directly at "Player 2 replies" without a GM-context setup step.
--     Also pre-seeds one unread comment_reply notification for Player 1 so
--     the "mark all as read" test has deterministic pre-existing state.
-- Game ID: 704 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id = 704;

DO $$
DECLARE
  game_id    INTEGER := 704;
  gm_id      INTEGER;
  p1_id      INTEGER;
  p2_id      INTEGER;
  p3_id      INTEGER;
  p4_id      INTEGER;
  phase_id   INTEGER;
  post_id    INTEGER;
  comment_id INTEGER;
  gm_char_id INTEGER;
  p1_char_id INTEGER;
  p2_char_id INTEGER;
  p3_char_id INTEGER;
  p4_char_id INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO p4_id FROM users WHERE email = 'test_player4@example.com';

  INSERT INTO games (
    id, title, description, genre, gm_user_id, max_players,
    state, is_public, created_at, updated_at
  ) VALUES (
    704,
    'E2E Test: Notification Flow',
    'Stable fixture for notification E2E tests (reply and mention).',
    'Test',
    gm_id,
    6,
    'in_progress',
    true,
    NOW() - INTERVAL '7 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (704, p1_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (704, p2_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (704, p3_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (704, p4_id, 'player', 'active', NOW() - INTERVAL '7 days');

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (704, gm_id, 'GM Character', 'npc', 'approved', NOW() - INTERVAL '7 days', NOW())
  RETURNING id INTO gm_char_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (704, p1_id, 'Test Notify Char 1', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
  RETURNING id INTO p1_char_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (704, p2_id, 'Test Notify Char 2', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
  RETURNING id INTO p2_char_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (704, p3_id, 'Test Notify Char 3', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
  RETURNING id INTO p3_char_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (704, p4_id, 'Test Notify Char 4', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
  RETURNING id INTO p4_char_id;

  -- Active common_room phase
  INSERT INTO game_phases (
    game_id, phase_type, phase_number, title, description,
    start_time, deadline, is_active, is_published, created_at
  ) VALUES (
    704, 'common_room', 1, 'Discussion', 'Common room for notification tests.',
    NOW() - INTERVAL '6 days', NOW() + INTERVAL '30 days',
    true, true, NOW() - INTERVAL '6 days'
  ) RETURNING id INTO phase_id;

  -- Pre-seeded GM post (reply test starts here — no GM context needed at runtime)
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, visibility, mentioned_character_ids, created_at
  ) VALUES (
    704, phase_id, gm_id, gm_char_id,
    'Notification Test Post',
    'post', 'game', '{}',
    NOW() - INTERVAL '5 days'
  ) RETURNING id INTO post_id;

  -- Pre-seeded Player 1 comment on the post (reply test starts here)
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, parent_id, visibility, mentioned_character_ids, created_at
  ) VALUES (
    704, phase_id, p1_id, p1_char_id,
    'Player 1 comment on notification test post',
    'comment', post_id, 'game', '{}',
    NOW() - INTERVAL '4 days'
  ) RETURNING id INTO comment_id;

  -- Pre-seeded unread notification for Player 1 (for "mark all as read" test)
  -- Simulates a prior reply notification that has not been read yet
  INSERT INTO notifications (
    user_id, game_id, type, title, content,
    related_type, related_id, link_url, is_read, created_at
  ) VALUES (
    p1_id, game_id, 'comment_reply', 'Someone replied to your comment',
    'Pre-seeded reply notification for mark-all-as-read test',
    'comment', comment_id,
    '/games/' || game_id || '?tab=common-room',
    false,
    NOW() - INTERVAL '3 days'
  );

  RAISE NOTICE 'Notification Flow fixture created: Game #704';
END $$;

SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;
