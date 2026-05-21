import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      react(),
      legacy({
        targets: ['ios >= 13', 'chrome >= 64'],
        renderModernChunks: false
      })
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
          // Vendor chunks - separate large dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@headlessui/react', '@heroicons/react', 'lucide-react'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-sanitize', 'react-syntax-highlighter'],
          'vendor-utils': ['axios', 'date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Increase chunk size warning limit since we're now splitting intentionally
    chunkSizeWarningLimit: 1000,
    modulePreload: false,
    minify: 'esbuild',
  },
  esbuild: {
    supported: {
      destructuring: true
    }
  },
  test: {
    environment: 'jsdom',
    server: {
      deps: {
        // react-datepicker ships an ES module that imports named exports from
        // react/jsx-runtime, which jsdom can't resolve without transformation.
        // Inlining it forces Vitest to transform it through the Vite pipeline.
        inline: ['react-datepicker'],
      },
    },
  },
})
