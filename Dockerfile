# Two targets:
#   dev  — Vite dev server with hot reload (bind-mounted source)
#   prod — static build served by nginx (what the desktop app will ship)

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


FROM deps AS dev
COPY . .
EXPOSE 4444
# --host binds 0.0.0.0 so the port is reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4444"]


FROM deps AS build
COPY . .
# Vite inlines env vars at BUILD time, so the API URL must be present here.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build


FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
# SPA: every unknown path must fall through to index.html or a deep link 404s.
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / { try_files $uri $uri/ /index.html; }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
