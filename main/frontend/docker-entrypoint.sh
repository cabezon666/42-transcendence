#!/bin/sh
set -e

# Run npm install as root to avoid permission issues
echo "Installing/updating dependencies as root..."
npm install

echo "Starting application..."
exec "$@"