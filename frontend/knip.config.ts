import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/main.tsx',
    'src/setupTests.ts',
    'src/mocks/server.ts',
    'src/mocks/handlers.ts',
    'src/pages/*.tsx',
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
    'src/vite-env.d.ts',
    'e2e/**',
    // UI component library — exports are intentional public API for consumers
    'src/components/ui/**',
  ],

  ignoreDependencies: [
    // types for react-router-dom v5, kept for potential v5-compat imports — verify if truly needed
    '@types/react-router-dom',
  ],
};

export default config;
