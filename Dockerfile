# syntax=docker/dockerfile:1

# Install dependencies once and reuse them for development and production builds.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


# Local development target only:
#   docker build --target dev -t pharmasynapse-frontend:dev ./frontend
#   docker run --rm -p 4444:4444 pharmasynapse-frontend:dev
FROM deps AS dev
COPY . .
EXPOSE 4444
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4444"]


# Compile the React application once for production. Vite replaces these values
# at build time, so pass the real HTTPS API URL with --build-arg.
FROM deps AS build
WORKDIR /app
COPY . .
ARG VITE_API_BASE_URL=""
ARG VITE_USE_MOCK_API="false"
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_USE_MOCK_API=${VITE_USE_MOCK_API}
RUN npm run build


# The final/default target contains only nginx and the optimized static build.
FROM nginx:1.27-alpine AS prod

RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Serve hashed Vite assets with long-lived caching, keep index.html fresh so it
# always points to the newest hashes, compress text assets, and support React
# Router deep links by falling back to index.html.
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '' \
  '  gzip on;' \
  '  gzip_vary on;' \
  '  gzip_proxied any;' \
  '  gzip_comp_level 6;' \
  '  gzip_min_length 1024;' \
  '  gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;' \
  '' \
  '  location /assets/ {' \
  '    try_files $uri =404;' \
  '    expires 1y;' \
  '    add_header Cache-Control "public, max-age=31536000, immutable";' \
  '  }' \
  '' \
  '  location = /index.html {' \
  '    add_header Cache-Control "no-store, no-cache, must-revalidate" always;' \
  '  }' \
  '' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '    add_header Cache-Control "no-cache" always;' \
  '  }' \
  '}' \
  > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
