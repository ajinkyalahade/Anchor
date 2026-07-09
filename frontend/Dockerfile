# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Serve stage ──────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

# SPA + /v1 reverse-proxy config. The upstream backend host is templated
# from BACKEND_HOST/BACKEND_PORT at container start.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV BACKEND_HOST=backend \
    BACKEND_PORT=8000

EXPOSE 8080

# nginx:alpine's entrypoint renders /etc/nginx/templates/*.template with envsubst.
