#!/bin/sh
set -e

# Run npm install as root to avoid permission issues
echo "Installing/updating dependencies as root..."
npm install

# Change ownership of node_modules to nodejs user
if [ -d "/app/node_modules" ]; then
    chown -R nodejs:nodejs /app/node_modules
fi

# Switch to nodejs user and start the application
echo "Starting application as nodejs user..."
exec su-exec nodejs "$@"