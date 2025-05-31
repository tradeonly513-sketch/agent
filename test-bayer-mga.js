// test-bayer-mga.js
// A Node.js test script to debug the BayerMGA provider and identify the 500 error

// Import required modules
const path = require('path');
const { generateText } = require('ai');

// Set up paths for imports
const APP_ROOT = path.resolve(__dirname);
const PROVIDER_PATH = path.join(APP_ROOT, 'app/lib/modules/llm/providers/bayer-mga.js');

// Import the BayerMGA provider directly
let BayerMGAProvider;
try {
  // Try CommonJS import first
  BayerMGAProvider = require(PROVIDER_PATH).default;
} catch (error) {
  console.error(`Error importing BayerMGA provider: ${error.message}`);
  console.error(`Make sure the path is correct: ${PROVIDER_PATH}`);
  process.exit(1);
}

// Test API key - replace with a real one for actual testing
const TEST_API_KEY = process.env.BAYER_MGA_API_KEY || 'your-test-api-key';

// Mock parameters similar to what /api/llmcall would use
const mockApiKeys = {
  BayerMGA: TEST_API_KEY
};

const mockProviderSettings = {
  BayerMGA: {
    enabled: true,
    baseUrl: 'https://chat.int.bayer.com/api/v2'
  }
};

const mockServerEnv = {
  BAYER_MGA_API_KEY: TEST_API_KEY,
  BAYER_MGA_API_BASE_URL: 'https://chat.int.bayer.com/api/v2'
};

// Test model - use one that appears in the UI
const TEST_MODEL = 'claude-3-7-sonnet';

async function testBayerMGAProvider() {
  console.log('='.repeat(80));
  console.log('BAYER MGA PROVIDER TEST');
  console.log('='.repeat(80));
  
  try {
    console.log('Step 1: Creating BayerMGA provider instance...');
    const provider = new BayerMGAProvider();
    console.log('✅ Provider instance created successfully');
    console.log(`Provider name: ${provider.name}`);
    console.log(`Provider config:`, JSON.stringify(provider.config, null, 2));
    
    console.log('\nStep 2: Testing getModelInstance method...');
    console.log('Parameters:');
    console.log(`- Model: ${TEST_MODEL}`);
    console.log(`- API Key: ${TEST_API_KEY.substring(0, 4)}...`);
    
    // This is the exact flow used in /api/llmcall
    const modelInstance = provider.getModelInstance({
      model: TEST_MODEL,
      serverEnv: mockServerEnv,
      apiKeys: mockApiKeys,
      providerSettings: mockProviderSettings
    });
    
    console.log('✅ getModelInstance succeeded');
    console.log(`Model instance type: ${typeof modelInstance}`);
    
    console.log('\nStep 3: Testing generateText with the model instance...');
    // This mimics the generateText call in /api/llmcall
    const result = await generateText({
      system: 'You are a helpful assistant.',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message from the BayerMGA test script.',
        },
      ],
      model: modelInstance,
      maxTokens: 1000,
    });
    
    console.log('✅ generateText succeeded');
    console.log('Response:');
    console.log(result.text);
    console.log('\nUsage:');
    console.log(JSON.stringify(result.usage, null, 2));
    
    console.log('\n✅ All tests passed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(`Error name: ${error.name}`);
    console.error(`Error message: ${error.message}`);
    
    // Log additional error details if available
    if (error.cause) {
      console.error('\nError cause:');
      console.error(error.cause);
    }
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    // Check for common error patterns
    if (error.message.includes('API key')) {
      console.error('\n🔑 This appears to be an API key issue. Make sure you have set a valid BAYER_MGA_API_KEY.');
    } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      console.error('\n🌐 This appears to be a network issue. Check your internet connection and the API base URL.');
    } else if (error.message.includes('not found') || error.message.includes('undefined')) {
      console.error('\n🔍 This appears to be a code issue. The provider or one of its methods might not be properly defined.');
    }
    
    // Try to extract HTTP error details if present
    try {
      if (error.cause && error.cause.response) {
        console.error('\nHTTP Response Details:');
        console.error(`Status: ${error.cause.response.status}`);
        console.error(`Status Text: ${error.cause.response.statusText}`);
        
        // Try to get response body
        if (typeof error.cause.response.text === 'function') {
          const responseText = await error.cause.response.text();
          console.error('Response Body:', responseText);
        }
      }
    } catch (e) {
      console.error('Could not extract HTTP response details:', e.message);
    }
  }
}

// Run the test
console.log('Starting BayerMGA provider test...');
testBayerMGAProvider()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Unhandled error in test:', err));
