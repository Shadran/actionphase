-- E2E Worker Users (Workers 1-5)
-- These users are only needed for parallel E2E test execution.
-- DO NOT load this file for demo or dev environments.
-- Loaded by apply_e2e_users.sh, which is called by load-e2e.
--
-- Password for all: testpassword123
-- Hashed with bcrypt cost 10

BEGIN;

-- Worker 1 users
INSERT INTO users (username, email, password, is_admin, email_verified, created_at)
VALUES
  ('TestGM_1', 'test_gm_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', true, TRUE, NOW()),
  ('TestPlayer1_1', 'test_player1_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer2_1', 'test_player2_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer3_1', 'test_player3_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer4_1', 'test_player4_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer5_1', 'test_player5_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience_1', 'test_audience_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience1_1', 'test_audience1_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience2_1', 'test_audience2_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW())
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, is_admin = EXCLUDED.is_admin, email_verified = EXCLUDED.email_verified;

-- Worker 2 users
INSERT INTO users (username, email, password, is_admin, email_verified, created_at)
VALUES
  ('TestGM_2', 'test_gm_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', true, TRUE, NOW()),
  ('TestPlayer1_2', 'test_player1_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer2_2', 'test_player2_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer3_2', 'test_player3_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer4_2', 'test_player4_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer5_2', 'test_player5_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience_2', 'test_audience_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience1_2', 'test_audience1_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience2_2', 'test_audience2_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW())
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, is_admin = EXCLUDED.is_admin, email_verified = EXCLUDED.email_verified;

-- Worker 3 users
INSERT INTO users (username, email, password, is_admin, email_verified, created_at)
VALUES
  ('TestGM_3', 'test_gm_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', true, TRUE, NOW()),
  ('TestPlayer1_3', 'test_player1_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer2_3', 'test_player2_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer3_3', 'test_player3_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer4_3', 'test_player4_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer5_3', 'test_player5_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience_3', 'test_audience_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience1_3', 'test_audience1_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience2_3', 'test_audience2_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW())
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, is_admin = EXCLUDED.is_admin, email_verified = EXCLUDED.email_verified;

-- Worker 4 users
INSERT INTO users (username, email, password, is_admin, email_verified, created_at)
VALUES
  ('TestGM_4', 'test_gm_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', true, TRUE, NOW()),
  ('TestPlayer1_4', 'test_player1_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer2_4', 'test_player2_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer3_4', 'test_player3_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer4_4', 'test_player4_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer5_4', 'test_player5_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience_4', 'test_audience_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience1_4', 'test_audience1_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience2_4', 'test_audience2_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW())
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, is_admin = EXCLUDED.is_admin, email_verified = EXCLUDED.email_verified;

-- Worker 5 users
INSERT INTO users (username, email, password, is_admin, email_verified, created_at)
VALUES
  ('TestGM_5', 'test_gm_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', true, TRUE, NOW()),
  ('TestPlayer1_5', 'test_player1_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer2_5', 'test_player2_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer3_5', 'test_player3_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer4_5', 'test_player4_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer5_5', 'test_player5_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience_5', 'test_audience_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience1_5', 'test_audience1_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience2_5', 'test_audience2_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW())
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, is_admin = EXCLUDED.is_admin, email_verified = EXCLUDED.email_verified;

COMMIT;
