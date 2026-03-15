# zkCredit - Dockerfile
# Multi-stage build for the zkCredit lending protocol

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# ============================================
# Stage 2: Oracle Server
# ============================================
FROM node:20-alpine AS oracle-server

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy root package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy offchain source
COPY offchain/ ./offchain/

# Copy built frontend for serving (optional)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Environment variables
ENV NODE_ENV=production
ENV PORT=8787

# Expose ports
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/agents || exit 1

# Start oracle server
CMD ["node", "offchain/oracle-server.js"]

# ============================================
# Stage 3: Development (optional)
# ============================================
FROM node:20-alpine AS development

WORKDIR /app

# Install all dependencies including dev
RUN apk add --no-cache python3 make g++ git

# Copy all source files
COPY . .

# Install root dependencies
RUN npm install

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install

WORKDIR /app

# Expose ports for both services
EXPOSE 8787 5173

# Development command
CMD ["sh", "-c", "npm run dev & cd frontend && npm run dev"]
