# Multi-stage Dockerfile for Next.js application
# Optimized for production with minimal image size

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production
RUN npm install -D @prisma/client prisma

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy source files
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Add non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# Create necessary directories and set permissions
RUN mkdir -p .next/cache
RUN chown -R nextjs:nodejs .next

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set runtime environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health/live', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "server.js"]