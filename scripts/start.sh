#!/bin/sh

# Run database migrations
echo "Running database migrations..."
npx drizzle-kit push --force

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js

