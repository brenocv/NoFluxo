FROM oven/bun:1.1 AS base
WORKDIR /app

# Install dependencies (without frozen-lockfile to avoid issues)
COPY package.json bun.lock ./
RUN bun install

# Copy source code
COPY . .

# Set dummy DATABASE_URL for Prisma during build (doesn't connect, just parses schema)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN bunx prisma generate

# Build Next.js
RUN bunx next build

# Production
EXPOSE 3000
CMD ["bun", "server.ts"]
