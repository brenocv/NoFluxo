FROM oven/bun:1.1 AS base
WORKDIR /app

# Copy prisma schema FIRST
COPY prisma ./prisma

# Install dependencies
COPY package.json bun.lock ./
RUN bun install

# Copy all source code
COPY . .

# Set dummy DATABASE_URL for Prisma during build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN bunx prisma generate --schema=./prisma/schema.prisma

# Build Next.js using Node.js (Bun has issues with Turbopack worker_threads)
RUN npx next build

# Production
EXPOSE 3000
CMD ["bun", "server.ts"]
