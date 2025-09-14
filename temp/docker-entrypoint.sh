#!/bin/sh
set -e

# Run npm install as root to avoid permission issues
echo "Installing/updating dependencies as root..."
npm install

# Build Tailwind CSS if needed
if [ -f "package.json" ] && grep -q "build-css-prod" package.json; then
    echo "Building Tailwind CSS..."
    npm run build-css-prod
fi

# Change ownership of node_modules to nodejs user
if [ -d "/app/node_modules" ]; then
    chown -R nodejs:nodejs /app/node_modules
fi

# Switch to nodejs user and start the application
echo "Starting application as nodejs user..."
exec su-exec nodejs "$@"