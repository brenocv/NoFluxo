FROM node:22-slim
WORKDIR /app

# Copy prisma schema FIRST
COPY prisma ./prisma

# Install dependencies
COPY package.json ./
RUN npm install

# Copy all source code
COPY . .

# Set environment to PRODUCTION (prevents dev mode and memory crashes)
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate --schema=./prisma/schema.prisma

# Build Next.js
RUN npx next build

# Production
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
