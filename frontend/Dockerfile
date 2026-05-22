# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build arguments for Vite environment variables
# These are baked into the frontend bundle at build time
ARG VITE_HCAPTCHA_SITE_KEY
ARG VITE_HCAPTCHA_ENABLED=true

# Set environment variables for build (Vite reads VITE_* env vars)
ENV VITE_HCAPTCHA_SITE_KEY=$VITE_HCAPTCHA_SITE_KEY
ENV VITE_HCAPTCHA_ENABLED=$VITE_HCAPTCHA_ENABLED

# Build the application
RUN npm run build
# Generate legacy-only index.html for iOS < 16.
# Strips all type="module" scripts so old Safari never tries to load
# the modern bundle — it only sees the nomodule legacy bundle scripts.
RUN node -e " \
  const fs = require('fs'); \
  let html = fs.readFileSync('dist/index.html', 'utf8'); \
  html = html.replace(/<script type=\"module\"[^>]*>[^<]*<\/script>/g, ''); \
  html = html.replace(/<script type=\"module\"[^>]*\/>/g, ''); \
  html = html.replace(/(<script) nomodule (crossorigin id=\"vite-legacy-polyfill\")/g, '\$1 \$2'); \
  html = html.replace(/(<script) nomodule (crossorigin id=\"vite-legacy-entry\")/g, '\$1 \$2'); \
  html = html.replace(/<script nomodule>[^<]*<\/script>/g, ''); \
  fs.writeFileSync('dist/index.legacy.html', html); \
  console.log('Generated index.legacy.html'); \
  console.log(fs.readFileSync('dist/index.legacy.html', 'utf8')); \
"

# Runtime stage - serve with nginx
FROM nginx:alpine
# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose port
EXPOSE 80
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
# Start nginx
CMD ["nginx", "-g", "daemon off;"]