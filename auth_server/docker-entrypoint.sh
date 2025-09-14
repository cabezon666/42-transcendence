#!/bin/sh
set -e

# Function to wait for a service
wait_for() {
    echo "Waiting for $1..."
    while ! nc -z $1 $2; do
        sleep 1
    done
    echo "$1 is ready!"
}

# Run npm install as root to avoid permission issues
echo "Installing/updating dependencies as root..."
npm install

# Change ownership of node_modules to nodejs user
if [ -d "/app/node_modules" ]; then
    chown -R nodejs:nodejs /app/node_modules
fi

# Wait for SQLite service if needed
if [ ! -z "$SQLITE_HOST" ]; then
    wait_for ${SQLITE_HOST:-sqlite} ${SQLITE_PORT:-7000}
fi

# Switch to nodejs user and start the application
echo "Starting application as nodejs user..."
exec su-exec nodejs "$@"