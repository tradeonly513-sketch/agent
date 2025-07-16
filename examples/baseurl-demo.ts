/**
 * BaseURL Configuration Demo
 *
 * This example demonstrates how to configure custom baseURL for different LLM providers
 * to use third-party proxy services or custom endpoints.
 */

import OpenAIProvider from '~/lib/modules/llm/providers/openai';
import AnthropicProvider from '~/lib/modules/llm/providers/anthropic';
import SiliconFlowProvider from '~/lib/modules/llm/providers/siliconflow';

// Example 1: Using environment variables
console.log('=== Example 1: Environment Variables ===');

// Set environment variables (in real usage, these would be in your .env file)
process.env.OPENAI_API_KEY = 'your-openai-api-key';
process.env.OPENAI_API_BASE_URL = 'https://your-openai-proxy.com/v1';

const openaiProvider = new OpenAIProvider();
try {
  const openaiModel = openaiProvider.getModelInstance({
    model: 'gpt-4',
    serverEnv: process.env as any,
  });
  console.log('✅ OpenAI model instance created with custom baseURL');
} catch (error) {
  console.log('❌ OpenAI model creation failed:', error instanceof Error ? error.message : String(error));
}

// Example 2: Using provider settings
console.log('\n=== Example 2: Provider Settings ===');

const anthropicProvider = new AnthropicProvider();
try {
  const anthropicModel = anthropicProvider.getModelInstance({
    model: 'claude-3-sonnet-20240229',
    serverEnv: { ANTHROPIC_API_KEY: 'your-anthropic-api-key' } as any,
    providerSettings: {
      Anthropic: {
        baseUrl: 'https://your-anthropic-proxy.com',
      },
    },
  });
  console.log('✅ Anthropic model instance created with custom baseURL');
} catch (error) {
  console.log('❌ Anthropic model creation failed:', error instanceof Error ? error.message : String(error));
}

// Example 3: SiliconFlow with custom baseURL
console.log('\n=== Example 3: SiliconFlow Custom BaseURL ===');

const siliconflowProvider = new SiliconFlowProvider();
try {
  const siliconflowModel = siliconflowProvider.getModelInstance({
    model: 'Qwen/QwQ-32B',
    serverEnv: {
      SILICONFLOW_API_KEY: 'your-siliconflow-api-key',
      SILICONFLOW_API_BASE_URL: 'https://your-siliconflow-proxy.com/v1',
    } as any,
  });
  console.log('✅ SiliconFlow model instance created with custom baseURL');
} catch (error) {
  console.log('❌ SiliconFlow model creation failed:', error instanceof Error ? error.message : String(error));
}

// Example 4: Demonstrating baseURL resolution priority
console.log('\n=== Example 4: BaseURL Resolution Priority ===');

const provider = new OpenAIProvider();

// Test 1: Environment variable only
const { baseUrl: envBaseUrl } = provider.getProviderBaseUrlAndKey({
  serverEnv: { OPENAI_API_BASE_URL: 'https://env-proxy.com/v1' },
  defaultBaseUrlKey: 'OPENAI_API_BASE_URL',
  defaultApiTokenKey: 'OPENAI_API_KEY',
});
console.log('Environment variable baseURL:', envBaseUrl);

// Test 2: Provider settings override environment
const { baseUrl: settingsBaseUrl } = provider.getProviderBaseUrlAndKey({
  serverEnv: { OPENAI_API_BASE_URL: 'https://env-proxy.com/v1' },
  providerSettings: { baseUrl: 'https://settings-proxy.com/v1' },
  defaultBaseUrlKey: 'OPENAI_API_BASE_URL',
  defaultApiTokenKey: 'OPENAI_API_KEY',
});
console.log('Provider settings override:', settingsBaseUrl);

// Test 3: Trailing slash removal
const { baseUrl: cleanBaseUrl } = provider.getProviderBaseUrlAndKey({
  serverEnv: { OPENAI_API_BASE_URL: 'https://proxy-with-slash.com/v1/' },
  defaultBaseUrlKey: 'OPENAI_API_BASE_URL',
  defaultApiTokenKey: 'OPENAI_API_KEY',
});
console.log('Cleaned baseURL (trailing slash removed):', cleanBaseUrl);

console.log('\n=== Configuration Examples ===');
console.log(`
Environment Variables (.env file):
# OpenAI with custom proxy
OPENAI_API_KEY=your-openai-api-key
OPENAI_API_BASE_URL=https://your-openai-proxy.com/v1

# Anthropic with custom proxy
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_API_BASE_URL=https://your-anthropic-proxy.com

# SiliconFlow with custom proxy
SILICONFLOW_API_KEY=your-siliconflow-api-key
SILICONFLOW_API_BASE_URL=https://your-siliconflow-proxy.com/v1

# All other providers also support baseURL configuration:
GROQ_API_BASE_URL=https://your-groq-proxy.com/v1
MISTRAL_API_BASE_URL=https://your-mistral-proxy.com
GOOGLE_GENERATIVE_AI_API_BASE_URL=https://your-google-proxy.com
DEEPSEEK_API_BASE_URL=https://your-deepseek-proxy.com
COHERE_API_BASE_URL=https://your-cohere-proxy.com
XAI_API_BASE_URL=https://your-xai-proxy.com/v1
GITHUB_API_BASE_URL=https://your-github-proxy.com
HUGGINGFACE_API_BASE_URL=https://your-huggingface-proxy.com/v1
OPEN_ROUTER_API_BASE_URL=https://your-openrouter-proxy.com/api/v1
PERPLEXITY_API_BASE_URL=https://your-perplexity-proxy.com
MOONSHOT_API_BASE_URL=https://your-moonshot-proxy.com/v1
`);

console.log(`
Provider Settings (programmatic configuration):
const providerSettings = {
  OpenAI: {
    baseUrl: 'https://your-openai-proxy.com/v1'
  },
  Anthropic: {
    baseUrl: 'https://your-anthropic-proxy.com'
  },
  SiliconFlow: {
    baseUrl: 'https://your-siliconflow-proxy.com/v1'
  }
  // ... other providers
};
`);

console.log('\n✅ BaseURL configuration demo completed!');
console.log('📝 All LLM providers now support custom baseURL configuration for third-party proxy services.');
