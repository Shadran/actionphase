--
-- E2E Test Data: Private Message Editing
--
-- Purpose: Test data for private message editing E2E tests
-- Test Game: 10354 (E2E Test: Private Messages - from 08_e2e_dedicated_games.sql)
-- Test Users: TestPlayer1, TestPlayer2 (from common fixtures)
-- Characters: Created in 08_e2e_dedicated_games.sql
-- This fixture adds 5 separate conversations, one for each test to avoid data mutation issues
--

-- Conversation 1: For "edit button visible for own/hidden for others" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 18881, 10354, 'Edit Test 1: Button Visibility', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 18881, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98811, 18881, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98812, 18881, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 2: For "inline editor opens with existing content" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 18882, 10354, 'Edit Test 2: Editor Pre-fill', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 18882, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98821, 18882, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98822, 18882, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 3: For "cancel discards changes" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 18883, 10354, 'Edit Test 3: Cancel Discards', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 18883, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98831, 18883, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98832, 18883, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 4: For "saves edited content and shows (edited) label" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 18884, 10354, 'Edit Test 4: Save Shows Edited', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 18884, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98841, 18884, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98842, 18884, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

-- Conversation 5: For "edited message visible to other participants" test
INSERT INTO conversations (id, game_id, title, conversation_type, created_by_user_id, created_at)
SELECT 18885, 10354, 'Edit Test 5: Visible To All', 'direct', c.user_id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, game_id = EXCLUDED.game_id;

INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
SELECT 18885, c.user_id, c.id, NOW()
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 2
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98851, 18885, c.user_id, c.id, 'Message from Player 1', NOW() - interval '10 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO private_messages (id, conversation_id, sender_user_id, sender_character_id, content, created_at, is_deleted, deleted_at)
SELECT 98852, 18885, c.user_id, c.id, 'Message from Player 2', NOW() - interval '5 minutes', false, NULL::timestamp
FROM characters c
WHERE c.game_id = 10354 AND c.character_type = 'player_character'
ORDER BY c.id LIMIT 1 OFFSET 1
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;
