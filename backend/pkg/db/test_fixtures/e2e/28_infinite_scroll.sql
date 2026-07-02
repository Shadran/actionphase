-- E2E Test Fixture: Infinite Scroll (Common Room)
-- Creates a game with a single post that has 20 top-level comments.
-- This exceeds THREADS_PER_PAGE (5 for local / 15 for prod) so the infinite-scroll
-- sentinel has to fire at least once before all threads are visible.
--
-- Game ID: 710 (shared, not worker-specific — read-only test, no state mutation)
--
-- IDEMPOTENT: Safe to run multiple times — deletes existing data before recreating.

BEGIN;

DO $$
DECLARE
  gm_id    INTEGER;
  p1_id    INTEGER;
  phase_id INTEGER;
  post_id  INTEGER;
  char_gm  INTEGER;
  char_p1  INTEGER;
  i        INTEGER;
BEGIN
  DELETE FROM games WHERE id = 710;

  gm_id := get_worker_user_id('TestGM',      0);
  p1_id := get_worker_user_id('TestPlayer1', 0);

  INSERT INTO games (
    id, title, description, genre, gm_user_id,
    max_players, state, is_public, created_at, updated_at
  ) VALUES (
    710,
    'E2E Test: Infinite Scroll',
    'Game for testing common room infinite scroll — has a post with 20 top-level comments.',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '7 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status)
  VALUES
    (710, p1_id, 'player', 'active');

  INSERT INTO game_phases (
    game_id, phase_type, phase_number, title, description,
    start_time, deadline, is_active, is_published, created_at
  ) VALUES (
    710, 'common_room', 1, 'Open Discussion', 'Active common room for infinite-scroll E2E tests.',
    NOW() - INTERVAL '2 hours', NOW() + INTERVAL '22 hours',
    true, true, NOW() - INTERVAL '2 hours'
  ) RETURNING id INTO phase_id;

  -- GM NPC
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (710, gm_id, 'The Narrator', 'npc', 'approved', NOW() - INTERVAL '6 days', NOW())
  RETURNING id INTO char_gm;

  -- Player character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (710, p1_id, 'Scroll Tester', 'player_character', 'approved', NOW() - INTERVAL '6 days', NOW())
  RETURNING id INTO char_p1;

  -- The post everything hangs from (message_type='post', no parent_id)
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, created_at, edited_at
  ) VALUES (
    710, phase_id, gm_id, char_gm,
    'Infinite scroll test post — this post has 20 top-level comments to trigger pagination.',
    'post',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ) RETURNING id INTO post_id;

  -- 20 top-level comments, oldest-first. The API returns newest-first, so comment 20
  -- appears at the top (first page) and comment 1 at the bottom (last page).
  FOR i IN 1..20 LOOP
    INSERT INTO messages (
      game_id, phase_id, author_id, character_id, parent_id,
      content, message_type, thread_depth, created_at, edited_at
    ) VALUES (
      710, phase_id, p1_id, char_p1, post_id,
      format('Top-level comment %s of 20 — for infinite scroll testing.', i),
      'comment', 0,
      NOW() - INTERVAL '5 days' + (i * INTERVAL '1 minute'),
      NOW() - INTERVAL '5 days' + (i * INTERVAL '1 minute')
    );
  END LOOP;

  RAISE NOTICE 'Created Game #710: E2E Test: Infinite Scroll (20 top-level comments on 1 post)';
END $$;

COMMIT;
