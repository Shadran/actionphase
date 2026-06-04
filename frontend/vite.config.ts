import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import faroUploader from '@grafana/faro-rollup-plugin'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['ios >= 13', 'chrome >= 64', 'safari >= 13'],
    }),
    // Upload source maps to Grafana Faro at build time so stack traces in the
    // Frontend Observability UI are deobfuscated. Only runs when credentials
    // are present (i.e. production builds). Get values from Grafana Cloud →
    // Frontend Observability → your app → Settings → Source Maps.
    ...(process.env.GRAFANA_FARO_API_KEY ? [faroUploader({
      appName: process.env.VITE_FARO_APP_NAME ?? 'actionphase',
      endpoint: process.env.GRAFANA_FARO_SOURCEMAP_ENDPOINT ?? '',
      apiKey: process.env.GRAFANA_FARO_API_KEY,
      appId: process.env.GRAFANA_FARO_APP_ID ?? '',
      stackId: process.env.GRAFANA_FARO_STACK_ID ?? '',
      gzipContents: true,
    })] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/ping': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/docs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/api/v1/docs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ['axios'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@headlessui/react', '@heroicons/react', 'lucide-react'],
          'vendor-markdown': ['marked', 'dompurify', 'react-syntax-highlighter'],
          'vendor-utils': ['axios', 'date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    modulePreload: false,
    minify: 'esbuild',
  },
  esbuild: {
    supported: {
      destructuring: true,
    },
  },
  test: {
    environment: 'jsdom',
    server: {
      deps: {
        inline: ['react-datepicker'],
      },
    },
  },
})