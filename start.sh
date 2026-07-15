#!/bin/sh
# Start script for Railway — uses the PORT environment variable
# Railway sets PORT automatically (e.g., 8080)
# Next.js needs to be told to listen on that port

PORT="${PORT:-3000}"
echo "Starting Next.js on port $PORT"
exec npx next start -p "$PORT"
