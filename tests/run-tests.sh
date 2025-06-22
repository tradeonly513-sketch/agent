#!/bin/bash

echo "🧪 Bayer MGA Provider Test Suite"
echo "================================="

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found"
    echo "Please create .env.local with BAYER_MGA_API_KEY and OPEN_ROUTER_API_KEY"
    exit 1
fi

# Check if Docker container is running
if ! docker ps | grep -q "buildify-app-prod-1"; then
    echo "⚠️ Docker container not running. Starting..."
    docker-compose up -d app-prod
    sleep 10
fi

echo "🔄 Running automated provider tests..."
node tests/test-all-providers.cjs

echo ""
echo "🔄 Running Docker integration tests..."
./tests/test-docker-providers.sh

echo ""
echo "✅ Automated tests complete!"
echo ""
echo "📖 For manual UI testing with authentication:"
echo "   node tests/test-manual-login-providers.cjs"
echo ""
echo "📚 See tests/README.md for detailed documentation"