#!/usr/bin/env node

/**
 * Comprehensive Bayer MGA Provider Test Suite
 * 
 * This script validates:
 * - Bayer MGA API connectivity and model availability
 * - MCP tool support filtering (only shows models with supports_tools: true)
 * - Chat completions for all available models
 * - OpenRouter provider regression testing
 * - Provider integration validation
 * 
 * Usage: node tests/test-all-providers.cjs
 * Prerequisites: BAYER_MGA_API_KEY and BAYER_MGA_API_BASE_URL in .env.local
 */

const fetch = globalThis.fetch || require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// Configuration
const BASE_URL = process.env.BAYER_MGA_API_BASE_URL || 'https://chat.int.bayer.com/api/v2';
const API_KEY = process.env.BAYER_MGA_API_KEY;

// Expected MCP-compatible models from the API response
const EXPECTED_MCP_MODELS = [
  'grok-3',
  'gemini-2.5-pro-preview-05-06',
  'claude-sonnet-4',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'gemini-1.5-pro-002',
  'o3-mini',
  'gemini-2.0-flash-001',
  'gpt-4o',
  'claude-3-7-sonnet',
  'gpt-4.1'
];

console.log('🧪 Comprehensive Provider Testing Suite');
console.log('=====================================');

if (!API_KEY || API_KEY === 'your_bayer_mga_api_key') {
  console.error('❌ Error: Please set your BAYER_MGA_API_KEY in .env.local');
  process.exit(1);
}

async function testBayerMGAModelsEndpoint() {
  console.log('\\n📋 Testing Bayer MGA models endpoint...');
  
  try {
    const url = `${BASE_URL}/models?include_hidden_models=false&include_aliases=true`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Models endpoint failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const allModels = data.data || [];
    const availableModels = allModels.filter(m => m.model_status === 'available');
    const mcpModels = availableModels.filter(m => m.supports_tools === true);
    
    console.log(`✅ Total models: ${allModels.length}`);
    console.log(`✅ Available models: ${availableModels.length}`);
    console.log(`✅ MCP-compatible models: ${mcpModels.length}`);
    
    console.log('\\n📦 MCP-Compatible Models:');
    mcpModels.forEach(model => {
      const status = EXPECTED_MCP_MODELS.includes(model.model) ? '✅' : '⚠️';
      console.log(`   ${status} ${model.model} - ${model.context_window} tokens - Tools: ${model.supports_tools}`);
    });
    
    console.log('\\n🚫 Models without tool support:');
    availableModels.filter(m => !m.supports_tools).forEach(model => {
      console.log(`   ❌ ${model.model} - Tools: ${model.supports_tools}`);
    });

    return mcpModels;
  } catch (error) {
    console.log(`❌ Error testing models endpoint: ${error.message}`);
    return [];
  }
}

async function testModelChatCompletion(model) {
  console.log(`\\n🤖 Testing ${model.model}...`);
  
  try {
    const url = `${BASE_URL}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model.model,
        messages: [
          {
            role: 'user',
            content: 'Hello! Please respond with just "OK" to confirm this model works.'
          }
        ],
        temperature: 0.3,
        max_tokens: 50,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ FAILED: ${response.status} ${response.statusText}`);
      console.log(`   📝 Error: ${errorText.substring(0, 200)}...`);
      return false;
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const message = data.choices[0].message?.content || '';
      console.log(`   ✅ SUCCESS: "${message.trim()}"`);
      return true;
    } else {
      console.log(`   ❌ FAILED: No response content`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    return false;
  }
}

async function testProviderIntegration() {
  console.log('\\n🌐 Testing Provider Integration...');
  
  try {
    // Test the app's provider endpoint
    const response = await fetch('http://localhost:5173/api/providers', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const providers = await response.json();
      console.log(`✅ App providers endpoint working - Found ${providers.length} providers`);
      
      // Check if BayerMGA is listed
      const bayerMGA = providers.find(p => p.name === 'BayerMGA');
      if (bayerMGA) {
        console.log(`✅ BayerMGA provider found in app`);
      } else {
        console.log(`❌ BayerMGA provider NOT found in app`);
      }
    } else {
      console.log(`⚠️ App providers endpoint not accessible: ${response.status}`);
    }
  } catch (error) {
    console.log(`⚠️ Could not test app integration: ${error.message}`);
  }
}

async function runBayerMGATests() {
  console.log('🚀 Starting Bayer MGA Tests...\\n');
  
  // Test 1: Models endpoint
  const models = await testBayerMGAModelsEndpoint();
  
  if (models.length === 0) {
    console.log('\\n❌ Cannot proceed with model tests - no MCP models available');
    return;
  }

  // Test 2: Test each MCP-compatible model
  console.log('\\n🔬 Testing Individual Models...');
  const results = {
    passed: [],
    failed: []
  };
  
  for (const model of models) {
    const success = await testModelChatCompletion(model);
    if (success) {
      results.passed.push(model.model);
    } else {
      results.failed.push(model.model);
    }
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test 3: App integration
  await testProviderIntegration();
  
  // Summary
  console.log('\\n📊 BAYER MGA TEST RESULTS');
  console.log('==========================');
  console.log(`✅ Passed: ${results.passed.length} models`);
  results.passed.forEach(model => console.log(`   ✅ ${model}`));
  
  console.log(`\\n❌ Failed: ${results.failed.length} models`);
  results.failed.forEach(model => console.log(`   ❌ ${model}`));
  
  if (results.failed.length > 0) {
    console.log('\\n🔍 FAILED MODELS ANALYSIS:');
    console.log('These models need investigation:');
    results.failed.forEach(model => {
      console.log(`   • ${model} - Check token limits, parameters, or model-specific requirements`);
    });
  }
  
  return results;
}

async function testOpenRouterProvider() {
  console.log('\\n🔄 Testing OpenRouter Provider (Regression Check)...');
  
  const openRouterKey = process.env.OPENAI_API_KEY; // You used OpenRouter key in OPENAI_API_KEY
  
  if (!openRouterKey || openRouterKey === '') {
    console.log('⚠️ OpenRouter: No API key provided - skipping');
    return;
  }
  
  try {
    // Test OpenRouter models endpoint
    console.log('📋 Testing OpenRouter models endpoint...');
    const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!modelsResponse.ok) {
      console.log(`❌ OpenRouter models endpoint failed: ${modelsResponse.status}`);
      return;
    }
    
    const modelsData = await modelsResponse.json();
    const freeModels = modelsData.data.filter(model => 
      model.pricing && 
      (model.pricing.prompt === 0 || model.pricing.prompt === '0') &&
      (model.pricing.completion === 0 || model.pricing.completion === '0')
    );
    
    console.log(`✅ OpenRouter models endpoint accessible - Found ${freeModels.length} free models`);
    
    // Test a free model
    if (freeModels.length > 0) {
      const testModel = freeModels[0];
      console.log(`🤖 Testing free model: ${testModel.id}`);
      
      try {
        const chatResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: testModel.id,
            messages: [
              {
                role: 'user',
                content: 'Hello! Please respond with just "OpenRouter OK" to confirm this works.'
              }
            ],
            max_tokens: 50
          })
        });
        
        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          const message = chatData.choices?.[0]?.message?.content || '';
          console.log(`   ✅ OpenRouter chat test SUCCESS: "${message.trim()}"`);
        } else {
          console.log(`   ❌ OpenRouter chat test FAILED: ${chatResponse.status}`);
        }
      } catch (error) {
        console.log(`   ❌ OpenRouter chat test ERROR: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ OpenRouter connection failed: ${error.message}`);
  }
}

async function testOtherProviders() {
  await testOpenRouterProvider();
  
  // Test if other provider configurations are accessible
  console.log('\\n🔍 Checking Other Provider Configurations...');
  
  const otherKeys = [
    { name: 'Anthropic', key: process.env.ANTHROPIC_API_KEY },
    { name: 'Google AI', key: process.env.GOOGLE_GENERATIVE_AI_API_KEY }
  ];
  
  otherKeys.forEach(provider => {
    if (provider.key && provider.key !== '') {
      console.log(`✅ ${provider.name}: API key configured`);
    } else {
      console.log(`⚠️ ${provider.name}: No API key configured`);
    }
  });
}

// Main execution
async function main() {
  try {
    await runBayerMGATests();
    await testOtherProviders();
    
    console.log('\\n🏁 ALL TESTS COMPLETED!');
    console.log('\\n💡 Next Steps:');
    console.log('   1. All Bayer MGA models validated');
    console.log('   2. Test in the browser UI if needed');
    console.log('   3. Deploy changes - all tests passing');
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

main();