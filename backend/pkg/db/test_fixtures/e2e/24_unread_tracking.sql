-- E2E Test Fixture: Unread Comment Tracking
-- Purpose: Dedicated game with a GM post that Player 1 has already "visited"
--          (pre-seeded read marker), and a Player 2 comment seeded AFTER the
--          read marker so it appears as unread to Player 1.
--          unread-tracking.spec.ts only needs one test: Player 1 navigates to
--          the post and sees the NEW badge on the pre-seeded comment.
-- Game ID: 703 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id = 703;

DO $$
DECLARE
  gm_id      INTEGER;
  p1_id      INTEGER;
  p2_id      INTEGER;
  phase_id   INTEGER;
  seeded_post_id INTEGER;
  p1_char_id INTEGER;
  p2_char_id INTEGER;
  gm_char_id INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';

  INSERT INTO games (
    id, title, description, genre, gm_user_id, max_players,
    state, is_public, created_at, updated_at
  ) VALUES (
    703,
    'E2E Test: Unread Tracking',
    'Stable fixture for unread comment badge E2E tests.',
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
    (703, p1_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (703, p2_id, 'player', 'active', NOW() - INTERVAL '7 days');

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (703, gm_id, 'GM Character',       'npc',              'approved', NOW() - INTERVAL '7 days', NOW())
  RETURNING id INTO gm_char_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (703, p1_id, 'Reader Character',   'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
  RETURNING id INTO p1_char_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (703, p2_id, 'Commenter Character','player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
  RETURNING id INTO p2_char_id;

  -- Active common_room phase
  INSERT INTO game_phases (
    game_id, phase_type, phase_number, title, description,
    start_time, deadline, is_active, is_published, created_at
  ) VALUES (
    703, 'common_room', 1, 'Discussion', 'Common room for unread-tracking tests.',
    NOW() - INTERVAL '6 days', NOW() + INTERVAL '30 days',
    true, true, NOW() - INTERVAL '6 days'
  ) RETURNING id INTO phase_id;

  -- GM post — created 5 days ago
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, visibility, mentioned_character_ids, created_at
  ) VALUES (
    703, phase_id, gm_id, gm_char_id,
    'Unread Tracking Test Post',
    'post', 'game', '{}',
    NOW() - INTERVAL '5 days'
  ) RETURNING id INTO seeded_post_id;

  -- Player 1 read marker — visited 3 days ago (before the Player 2 comment below)
  -- Used by test 1: "NEW badge appears"
  INSERT INTO user_common_room_reads (user_id, game_id, post_id, last_read_at, created_at, updated_at)
  VALUES (p1_id, 703, seeded_post_id, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
  ON CONFLICT (user_id, post_id) DO UPDATE
    SET last_read_at = EXCLUDED.last_read_at,
        updated_at   = EXCLUDED.updated_at;

  -- Player 2 read marker — visited 3 days ago (before the comment below)
  -- Used by test 2: "NEW badge is gone after navigating away"
  -- Using a separate user avoids test 1 and test 2 corrupting each other's read state
  INSERT INTO user_common_room_reads (user_id, game_id, post_id, last_read_at, created_at, updated_at)
  VALUES (p2_id, 703, seeded_post_id, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
  ON CONFLICT (user_id, post_id) DO UPDATE
    SET last_read_at = EXCLUDED.last_read_at,
        updated_at   = EXCLUDED.updated_at;

  -- Player 2 comment — created 1 day ago (AFTER both players' last_read_at)
  -- Appears as unread to both Player 1 and Player 2
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, parent_id, visibility, mentioned_character_ids, created_at
  ) VALUES (
    703, phase_id, gm_id, gm_char_id,
    'Unread comment from Player 2',
    'comment', seeded_post_id, 'game', '{}',
    NOW() - INTERVAL '1 day'
  );

  RAISE NOTICE 'Unread Tracking fixture created: Game #703';
END $$;

SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;
