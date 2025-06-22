#!/bin/bash

echo "🧪 Testing Bayer MGA Provider in Docker Container"
echo "================================================"

# Check if container is running
if ! docker ps | grep -q "buildify-app-prod-1"; then
    echo "❌ Docker container not running. Please start it with: docker-compose up -d app-prod"
    exit 1
fi

echo "✅ Docker container is running"

# Test 1: Health check
echo -e "\n🏥 Testing application health..."
health_response=$(curl -s -w "%{http_code}" http://localhost:5173/api/health -o /dev/null)
if [ "$health_response" = "200" ]; then
    echo "✅ Application health check passed"
else
    echo "❌ Application health check failed (HTTP $health_response)"
fi

# Test 2: Test the models endpoint (correct API route)
echo -e "\n📋 Testing models endpoint..."
models_response=$(curl -s http://localhost:5173/api/models)
if echo "$models_response" | grep -q "BayerMGA"; then
    echo "✅ BayerMGA provider found in models endpoint"
else
    echo "❌ BayerMGA provider NOT found in models endpoint"
    echo "Response: $models_response"
fi

# Test 3: Use debug endpoint to test Bayer MGA
echo -e "\n🔍 Testing Bayer MGA debug endpoint..."

# Get the API key from .env.local
BAYER_API_KEY=$(grep "BAYER_MGA_API_KEY=" .env.local | cut -d'=' -f2)

if [ -z "$BAYER_API_KEY" ]; then
    echo "❌ No Bayer MGA API key found in .env.local"
else
    # Test the debug endpoint with Claude 3.7 Sonnet
    debug_response=$(curl -s "http://localhost:5173/api/debug-bayer-mga?apiKey=$BAYER_API_KEY&model=claude-3-7-sonnet")
    
    if echo "$debug_response" | grep -q "success\|OK"; then
        echo "✅ Bayer MGA debug test PASSED"
    else
        echo "❌ Bayer MGA debug test FAILED"
        echo "Response: $debug_response"
    fi
fi

# Test 4: Test multiple models through debug endpoint
echo -e "\n🔬 Testing multiple models through debug endpoint..."

models_to_test=("claude-sonnet-4" "grok-3" "gpt-4o-mini" "claude-3-5-sonnet")

for model in "${models_to_test[@]}"; do
    echo -e "\n   Testing $model..."
    model_response=$(curl -s "http://localhost:5173/api/debug-bayer-mga?apiKey=$BAYER_API_KEY&model=$model")
    
    if echo "$model_response" | grep -q "success\|OK\|Hello"; then
        echo "   ✅ $model: PASSED"
    else
        echo "   ❌ $model: FAILED"
        # Show first 200 chars of error for debugging
        echo "   Error: $(echo "$model_response" | head -c 200)..."
    fi
    
    # Small delay between requests
    sleep 1
done

# Test 6: Check Docker logs for errors
echo -e "\n📋 Checking recent Docker logs for errors..."
error_count=$(docker logs buildify-app-prod-1 --tail 50 2>&1 | grep -i "error\|failed\|exception" | wc -l)
if [ "$error_count" -gt 0 ]; then
    echo "⚠️ Found $error_count recent errors in Docker logs"
    echo "Recent errors:"
    docker logs buildify-app-prod-1 --tail 20 2>&1 | grep -i "error\|failed\|exception"
else
    echo "✅ No recent errors in Docker logs"
fi

echo -e "\n🏁 Docker Provider Tests Complete!"
echo -e "\n💡 To test manually:"
echo "   1. Open http://localhost:5173"
echo "   2. Try different models in the UI"
echo "   3. Check browser console for errors"