/**
 * Test Tag Definitions for E2E Tests
 *
 * Tags enable selective test execution:
 * - npm run e2e:smoke   # Quick 5-min health checks
 * - npm run e2e:critical # Must-pass tests for deploy
 * - npm run e2e:auth    # Authentication tests
 * - etc.
 */

// Test tag definitions
export const tags = {
  SMOKE: '@smoke',        // 5-min health check
  CRITICAL: '@critical',  // Must pass for deploy
  AUTH: '@auth',         // Authentication tests
  GAME: '@game',         // Game management
  CHARACTER: '@character', // Character system
  MESSAGE: '@message',   // Messaging/communication
  PHASE: '@phase',       // Phase management
  SLOW: '@slow',         // Tests > 30s
  FLAKY: '@flaky',       // Known flaky tests (to be fixed)
  INTEGRATION: '@integration', // Multi-component integration
  E2E: '@e2e',          // Complete user journeys
  MOBILE: '@mobile',    // Tests that exercise mobile-specific UI behavior (run on Pixel 5)
  GAMEPLAY: '@gameplay', // Core gameplay tests
  CHARACTERS: '@characters', // Character management tests
};

/**
 * Helper to add tags to test names
 *
 * @example
 * test(tagTest([tags.SMOKE, tags.AUTH], 'User can login'), async ({ page }) => {
 *   // test code
 * });
 */
export function tagTest(testTags: string[], name: string): string {
  return `${testTags.join(' ')} ${name}`;
}

/**
 * Check if a test has a specific tag
 */
export function hasTag(testName: string, tag: string): boolean {
  return testName.includes(tag);
}

/**
 * Get all tags from a test name
 */
export function getTags(testName: string): string[] {
  const tagPattern = /@\w+/g;
  return testName.match(tagPattern) || [];
}
