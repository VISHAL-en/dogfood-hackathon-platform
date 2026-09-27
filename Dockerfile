# ==========================================
# DOGFOOD Hackathon Platform - Production Dockerfile
# Multi-stage build: Frontend + Backend -> Lightweight Runner
# ==========================================

# Stage 1: Build Frontend and Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Install native compilation dependencies for SQLite bindings
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig*.json vite.config.ts ./
RUN npm ci

COPY src ./src

# Build React SPA (dist/public) and Express Server (dist/backend)
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Install native build tools for production better-sqlite3 installation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Create database volume directory
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/dogfood.sqlite
ENV FRONTEND_DIST_PATH=/app/dist/public

EXPOSE 3000

CMD ["node", "dist/backend/index.js"]
