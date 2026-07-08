import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/mocks/server.ts',
    'src/pages/*.tsx',
    'src/**/*.test.{ts,tsx}',
  ],
  project: ['src/**/*.{ts,tsx}'],

  vite: {
    config: ['vite.config.ts'],
  },
  playwright: {
    config: ['playwright.config.ts'],
  },
  vitest: {
    config: ['vitest.config.ts'],
  },

  // Barrel re-exports are real public API — don't flag their contents as unused
  includeEntryExports: true,

  ignore: [
    // UI component library — exports are intentional public API for consumers
    'src/components/ui/**',
  ],

  ignoreDependencies: [
    // types for react-router-dom v5, kept for potential v5-compat imports — verify if truly needed
    '@types/react-router-dom',
    // dompurify ships its own types in newer versions; @types/dompurify still needed for TS to resolve them
    '@types/dompurify',
  ],
};

export default config;
