import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { fileURLToPath, URL } from 'node:url'

// Injects a runtime RegExp polyfill for iOS 15, which doesn't support named
// capture groups (e.g. (?<name>...)). The polyfill patches the RegExp constructor
// to strip named group syntax before handing off to the native implementation.
// This runs before any other JS on the page, so remark-gfm and other libraries
// that use new RegExp() at runtime are covered.
function ios15RegExpPolyfill() {
  const polyfill = `(function() {
      try {
        new RegExp('(?<test>a)');
      } catch(e) {
        var OriginalRegExp = RegExp;
        function PatchedRegExp(pattern, flags) {
          if (typeof pattern === 'string') {
            pattern = pattern.replace(/\\(\\?<([^>]+)>/g, '(?:');
          }
          return new OriginalRegExp(pattern, flags);
        }
        PatchedRegExp.prototype = OriginalRegExp.prototype;
        PatchedRegExp.escape = OriginalRegExp.escape;
        window.RegExp = PatchedRegExp;
      }
    })();`;

  return {
    name: 'ios15-regexp-polyfill',
    transformIndexHtml(html: string) {
      return html.replace(
          '<head>',
          `<head>\n    <script>${polyfill}</script>`
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['ios >= 13', 'chrome >= 64', 'safari >= 13'],
    }),
    ios15RegExpPolyfill(),
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
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-sanitize', 'react-syntax-highlighter'],
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