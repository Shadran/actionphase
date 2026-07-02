/**
 * Avatar Utility Functions
 *
 * Shared utilities for generating avatar fallbacks with initials and colors.
 * Uses CSS variables for dark mode compatibility.
 */

/**
 * Avatar color classes using semantic CSS variables that support dark mode.
 * These colors automatically adapt to the current theme.
 */
const AVATAR_COLORS = [
  'bg-blue-600 dark:bg-blue-500',
  'bg-green-600 dark:bg-green-500',
  'bg-purple-600 dark:bg-purple-500',
  'bg-pink-600 dark:bg-pink-500',
  'bg-yellow-600 dark:bg-yellow-500',
  'bg-indigo-600 dark:bg-indigo-500',
  'bg-red-600 dark:bg-red-500',
  'bg-teal-600 dark:bg-teal-500',
] as const;

/**
 * Generate initials from a name (display name or username).
 *
 * Rules:
 * - Single word: First letter (e.g., "John" -> "J")
 * - Multiple words: First letter of first and last word (e.g., "John Doe" -> "JD")
 * - Empty/invalid: Returns "?"
 *
 * @param name - The name to generate initials from
 * @returns Uppercase initials (1-2 characters)
 */
export function getInitials(name: string): string {
  if (!name || name.trim() === '') return '?';

  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    return words[0][0].toUpperCase();
  }

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Generate a consistent color class for an avatar based on the name.
 *
 * Uses a hash function to deterministically assign a color from the palette.
 * The same name will always produce the same color.
 *
 * @param name - The name to generate a color for (display name or username)
 * @returns Tailwind CSS color class string with dark mode support
 */
export function getAvatarColor(name: string): string {
  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colorIndex = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[colorIndex];
}

