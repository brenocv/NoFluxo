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

# Make startup script executable
RUN chmod +x start.sh

# Expose the port Railway expects
EXPOSE 8080

# Start: runs prisma db push (syncs schema with DB) then next start
CMD ["sh", "start.sh"]
