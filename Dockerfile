FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy all source files
COPY . .

# Production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV PORT=8080

# Generate Prisma client and build Next.js
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npx next build

# Expose the port Railway expects
EXPOSE 8080

# Start the custom server (Next.js + Socket.io integrated on the same port).
# `prisma db push` runs first to sync any schema changes (e.g. new columns)
# to the real production database — this only runs at container startup,
# where Railway injects the real DATABASE_URL (not the build-time dummy
# above). Safe to leave here permanently: it's a no-op if the schema already
# matches. Deliberately NOT using --accept-data-loss — if a future schema
# change would be destructive (e.g. dropping a column), this should fail
# loudly and block the deploy rather than silently delete data.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx server.ts"]
