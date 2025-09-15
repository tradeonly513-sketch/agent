/**
 * Test file to demonstrate provider-specific prompt optimization
 * This shows how different providers get optimized prompts based on their characteristics
 */

import { createProviderOptimizedPrompt } from '../app/lib/common/prompts/provider-optimized-prompt';
import { getProviderCategory, getCategoryConfig } from '../app/lib/common/prompts/provider-categories';
import { getTokenOptimizationConfig, estimateTokenCount } from '../app/lib/common/prompts/token-optimizer';
import type { ModelInfo } from '../app/lib/modules/llm/types';

// Mock model configurations based on real provider data
const mockModels: Record<string, ModelInfo> = {
  // High-context model (Google Gemini)
  'gemini-1.5-pro': {
    name: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    provider: 'Google',
    maxTokenAllowed: 2000000, // 2M context
    maxCompletionTokens: 8192,
  },

  // Reasoning model (OpenAI o1)
  'o1-preview': {
    name: 'o1-preview',
    label: 'o1-preview',
    provider: 'OpenAI',
    maxTokenAllowed: 128000,
    maxCompletionTokens: 32000,
  },

  // Speed-optimized model (Groq)
  'llama-3.1-8b-instant': {
    name: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B',
    provider: 'Groq',
    maxTokenAllowed: 128000,
    maxCompletionTokens: 8192,
  },

  // Local model (Ollama)
  'llama-3.1-8b': {
    name: 'llama-3.1-8b',
    label: 'Llama 3.1 8B',
    provider: 'Ollama',
    maxTokenAllowed: 32000,
    maxCompletionTokens: 4096,
  },

  // Coding-specialized model (DeepSeek)
  'deepseek-coder': {
    name: 'deepseek-coder',
    label: 'DeepSeek V3 Coder',
    provider: 'Deepseek',
    maxTokenAllowed: 128000,
    maxCompletionTokens: 8192,
  },

  // Standard model (OpenAI)
  'gpt-4o': {
    name: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    maxTokenAllowed: 128000,
    maxCompletionTokens: 4096,
  },
};

const basePromptOptions = {
  cwd: '/home/project',
  allowedHtmlElements: ['div', 'span', 'p'],
  modificationTagName: 'boltArtifact',
  chatMode: 'build' as const,
  contextOptimization: false,
  supabase: {
    isConnected: false,
    hasSelectedProject: false,
  },
  projectType: 'web' as const,
};

function runProviderOptimizationTest() {
  console.log('\n🚀 Provider-Specific Prompt Optimization Test\n');
  console.log('=' .repeat(80));

  Object.entries(mockModels).forEach(([modelKey, modelDetails]) => {
    console.log(`\n📊 Testing: ${modelDetails.provider} - ${modelDetails.name}`);
    console.log('-'.repeat(60));

    // Get provider category
    const category = getProviderCategory(modelDetails.provider, modelDetails);
    const categoryConfig = getCategoryConfig(category);

    console.log(`📂 Category: ${category} (${categoryConfig.name})`);
    console.log(`🎯 Characteristics: ${categoryConfig.characteristics.optimizedFor.join(', ')}`);

    // Generate provider-optimized prompt
    const optimizedPrompt = createProviderOptimizedPrompt({
      ...basePromptOptions,
      providerName: modelDetails.provider,
      modelDetails,
    });

    // Get token optimization info
    const tokenConfig = getTokenOptimizationConfig(modelDetails, category);
    const promptTokens = estimateTokenCount(optimizedPrompt);

    console.log(`⚡ Optimization Level: ${tokenConfig.optimizationLevel}`);
    console.log(`📏 Context Window: ${modelDetails.maxTokenAllowed.toLocaleString()} tokens`);
    console.log(`📝 Prompt Size: ${promptTokens.toLocaleString()} tokens (${(promptTokens / modelDetails.maxTokenAllowed * 100).toFixed(1)}% of context)`);
    console.log(`🎛️  Token Reduction: ${categoryConfig.promptOptimizations.tokenReduction}%`);
    console.log(`📋 Priority Sections: ${categoryConfig.promptOptimizations.prioritizeSections.join(', ')}`);

    // Show prompt excerpt for demonstration
    const promptExcerpt = optimizedPrompt.slice(0, 200) + '...';
    console.log(`📄 Prompt Preview: ${promptExcerpt}`);

    console.log('\n');
  });

  // Comparison summary
  console.log('\n📈 Optimization Summary');
  console.log('=' .repeat(80));

  const results = Object.entries(mockModels).map(([modelKey, modelDetails]) => {
    const category = getProviderCategory(modelDetails.provider, modelDetails);
    const categoryConfig = getCategoryConfig(category);
    const tokenConfig = getTokenOptimizationConfig(modelDetails, category);

    const optimizedPrompt = createProviderOptimizedPrompt({
      ...basePromptOptions,
      providerName: modelDetails.provider,
      modelDetails,
    });

    const promptTokens = estimateTokenCount(optimizedPrompt);

    return {
      provider: modelDetails.provider,
      model: modelDetails.name,
      category,
      contextWindow: modelDetails.maxTokenAllowed,
      promptTokens,
      utilizationPercent: (promptTokens / modelDetails.maxTokenAllowed * 100),
      optimizationLevel: tokenConfig.optimizationLevel,
      tokenReduction: categoryConfig.promptOptimizations.tokenReduction,
    };
  });

  // Sort by context window for comparison
  results.sort((a, b) => a.contextWindow - b.contextWindow);

  console.log('\nProvider          | Context   | Prompt    | Usage | Optimization | Reduction');
  console.log('-'.repeat(80));

  results.forEach(result => {
    const contextStr = `${(result.contextWindow / 1000).toFixed(0)}K`.padEnd(8);
    const promptStr = `${(result.promptTokens / 1000).toFixed(1)}K`.padEnd(8);
    const usageStr = `${result.utilizationPercent.toFixed(1)}%`.padEnd(6);
    const optimizationStr = result.optimizationLevel.padEnd(11);
    const reductionStr = `${result.tokenReduction}%`.padEnd(9);

    console.log(`${result.provider.padEnd(16)} | ${contextStr} | ${promptStr} | ${usageStr} | ${optimizationStr} | ${reductionStr}`);
  });

  console.log('\n✅ Provider-specific prompt optimization test completed!');
  console.log('\n💡 Key Observations:');
  console.log('   • High-context models (Google) get expanded prompts with more detail');
  console.log('   • Speed-optimized models (Groq) get ultra-concise prompts');
  console.log('   • Reasoning models (o1) get simplified prompts without step-by-step guidance');
  console.log('   • Local models (Ollama) get simplified language and reduced complexity');
  console.log('   • Coding-specialized models get enhanced code quality guidelines');
  console.log('   • Standard models get balanced, comprehensive prompts');
}

// Run the test
if (require.main === module) {
  runProviderOptimizationTest();
}

export { runProviderOptimizationTest, mockModels };