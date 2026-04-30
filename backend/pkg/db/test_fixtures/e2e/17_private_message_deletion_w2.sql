--
-- E2E Test Data: Private Message Deletion
--
-- Purpose: Test data for private message deletion E2E tests
-- Test Game: 20354 (E2E Test: Private Messages - from 08_e2e_dedicated_games.sql)
-- Test Users: TestPlayer1, TestPlayer2 (from common fixtures)
-- Characters: Created in 08_e2e_dedicated_games.sql
-- This fixture adds 5 separate conversations, one for each test to avoid data mutation issues
--

-- Conversation 1: For "allows user to delete own message" test
-- Use the first character from game 20354 as the creator
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 29991, 20354, 'Test 1: Delete Own Message', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

-- Add the first two player characters from the game as participants
INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 29991, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

-- Add messages from both participants
INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119911, 29991, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119912, 29991, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 2: For "cannot delete other users messages" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 29992, 20354, 'Test 2: Cannot Delete Others', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 29992, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119921, 29992, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119922, 29992, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 3: For "deleted message visible to all participants" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 29993, 20354, 'Test 3: Visible To All', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 29993, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119931, 29993, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119932, 29993, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 4: For "cancel button prevents deletion" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 29994, 20354, 'Test 4: Cancel Deletion', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 29994, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119941, 29994, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119942, 29994, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 5: For "deleted message does not show delete button again" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 29995, 20354, 'Test 5: No Delete After', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 29995, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119951, 29995, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 119952, 29995, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 6: For permissions test — Player 3 has their own conversation so the messages tab loads
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 29996, 20354, 'Test 6: Player 3 Conversation', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 2
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 29996, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 29996, c.user_id, c.id, 'Message from Player 3', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 20354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 2;
