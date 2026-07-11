FROM oven/bun:1.1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build: generate Prisma client (needs a DATABASE_URL to parse schema) + Next.js build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN bunx prisma generate
RUN bun run build

# Production
EXPOSE 3000
CMD ["bun", "server.ts"]
