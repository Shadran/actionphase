-- Create Test Users
-- Password for all: testpassword123
-- Hashed with bcrypt cost 10
--
-- Users are created for each worker (0-5) to support parallel test execution
-- Worker-specific users prevent authentication conflicts
--
-- NOTE: All test users have email_verified = TRUE to allow testing of features
--       that require email verification without manual verification steps

BEGIN;

-- Worker 0 users (original test users for backward compatibility)
INSERT INTO users (username, email, password, is_admin, email_verified, created_at)
VALUES
  ('TestGM', 'test_gm@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', true, TRUE, NOW()),
  ('TestPlayer1', 'test_player1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer2', 'test_player2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer3', 'test_player3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer4', 'test_player4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestPlayer5', 'test_player5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience', 'test_audience@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience1', 'test_audience1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW()),
  ('TestAudience2', 'test_audience2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', false, TRUE, NOW())
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, is_admin = EXCLUDED.is_admin, email_verified = EXCLUDED.email_verified;

COMMIT;
