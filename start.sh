#!/bin/bash

echo "🚀 Starting Ft Transcendence with new architecture..."
echo ""
echo "📋 Services that will be started:"
echo "  - Auth Server (backend only): Port 3000 (internal)"
echo "  - Main Frontend (Next.js SPA): Port 3000 (internal)" 
echo "  - Main Backend (API): Port 3000 (internal)"
echo "  - Nginx (reverse proxy): Port 8443 (HTTPS)"
echo "  - SQLite Database: Port 7000 (internal)"
echo ""
echo "🔗 Access URL: https://localhost:8443"
echo ""
echo "⚠️  Note: You may see SSL warnings since we use self-signed certificates"
echo "   Just click 'Advanced' and 'Proceed to localhost (unsafe)'"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating basic .env file..."
    cat > .env << EOF
JWT_SECRET=your-super-secret-jwt-key-change-me-in-production-$(date +%s)
SQLITE_API_TOKEN=secure-random-token-change-me-$(date +%s)
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
EOF
    echo "✅ Basic .env file created. Update OAuth credentials if you want to test OAuth."
    echo ""
fi

echo "🔨 Building and starting services..."
docker-compose down
docker-compose up --build

echo ""
echo "🎉 Ft Transcendence is now running!"
echo "   Open https://localhost:8443 in your browser"