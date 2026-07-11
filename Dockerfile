FROM node:22-alpine
WORKDIR /app

# Copy prisma schema FIRST
COPY prisma ./prisma

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy all source code
COPY . .

# Production environment
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client and build Next.js
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npx next build

# Start
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
