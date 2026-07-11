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

# Compile server.ts to server.js (so we can run with node, much faster)
RUN npx tsc server.ts --outDir . --module commonjs --moduleResolution node --target es2017 --skipLibCheck --esModuleInterop

# Build Next.js
RUN npx next build

# Production
EXPOSE 3000
CMD ["node", "server.js"]
