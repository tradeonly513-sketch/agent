# CodeCraft Studio - Mobile-Optimized Dockerfile
# Multi-stage build for efficient container deployment

# Build stage
FROM node:20-alpine AS build-stage

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm run build

# Development target
FROM node:20-alpine AS codecraft-studio-development

WORKDIR /app

# Install pnpm and curl for health checks
RUN npm install -g pnpm && apk add --no-cache curl

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 5173

# Set environment for mobile optimization
ENV HOST=0.0.0.0
ENV PORT=5173
ENV NODE_ENV=development
ENV VITE_MOBILE_OPTIMIZED=true

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5173/api/health || exit 1

# Development command
CMD ["pnpm", "run", "dev", "--host", "0.0.0.0"]

# Production target
FROM node:20-alpine AS codecraft-studio-production

WORKDIR /app

# Install pnpm and required tools
RUN npm install -g pnpm wrangler && apk add --no-cache curl

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from build stage
COPY --from=build-stage /app/build ./build
COPY --from=build-stage /app/public ./public
COPY --from=build-stage /app/bindings.sh ./
COPY --from=build-stage /app/package.json ./

# Make bindings script executable
RUN chmod +x bindings.sh

# Expose port
EXPOSE 5173

# Set production environment with mobile optimization
ENV HOST=0.0.0.0
ENV PORT=5173
ENV NODE_ENV=production
ENV VITE_MOBILE_OPTIMIZED=true
ENV RUNNING_IN_DOCKER=true

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5173/api/health || exit 1

# Production command optimized for mobile
CMD ["pnpm", "run", "dockerstart"]

# Optimized lightweight target for containerized deployments
FROM node:20-alpine AS codecraft-studio-slim

WORKDIR /app

# Install minimal dependencies
RUN npm install -g pnpm && apk add --no-cache curl

# Copy only necessary files
COPY --from=build-stage /app/build ./build
COPY --from=build-stage /app/public ./public
COPY --from=build-stage /app/package.json ./
COPY bindings.sh ./

# Install minimal runtime dependencies
RUN pnpm install --frozen-lockfile --prod && \
    npm install -g wrangler && \
    chmod +x bindings.sh

# Expose port
EXPOSE 5173

# Optimized environment
ENV HOST=0.0.0.0
ENV PORT=5173
ENV NODE_ENV=production
ENV VITE_MOBILE_OPTIMIZED=true
ENV RUNNING_IN_DOCKER=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5173/api/health || exit 1

# Lightweight startup
CMD ["pnpm", "run", "dockerstart"]
