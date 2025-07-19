import { LLMManager } from '~/lib/modules/llm/manager';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import type { ProviderInfo } from '~/types/model';
import type { ModelInfo } from '~/lib/modules/llm/types';

const logger = createScopedLogger('smart-defaults');

/**
 * Smart default model and provider selection based on available configuration
 */
export class SmartDefaults {
  private static instance: SmartDefaults;
  private llmManager: LLMManager;

  private constructor() {
    this.llmManager = LLMManager.getInstance();
  }

  static getInstance(): SmartDefaults {
    if (!SmartDefaults.instance) {
      SmartDefaults.instance = new SmartDefaults();
    }
    return SmartDefaults.instance;
  }

  /**
   * Get the best available default model and provider
   */
  getSmartDefaults(): { model: string; provider: ProviderInfo } {
    try {
      // Get configured providers
      const configuredProviders = this.llmManager.getConfiguredProviders();
      
      if (configuredProviders.length === 0) {
        logger.warn('No configured providers found, using system defaults');
        return {
          model: DEFAULT_MODEL,
          provider: DEFAULT_PROVIDER,
        };
      }

      // Priority order for provider selection
      const providerPriority = [
        'Moonshot',    // User has configured this
        'Ollama',      // Local, no API key needed
        'LMStudio',    // Local, no API key needed
        'OpenAI',      // Popular choice
        'Anthropic',   // High quality
        'Google',      // Good alternative
      ];

      // Find the best configured provider
      let selectedProvider = configuredProviders[0]; // Fallback to first configured
      
      for (const priorityProvider of providerPriority) {
        const found = configuredProviders.find(p => p.name === priorityProvider);
        if (found) {
          selectedProvider = found;
          break;
        }
      }

      // Get the best model for the selected provider
      const selectedModel = this.getBestModelForProvider(selectedProvider);

      logger.info(`Smart defaults selected: ${selectedModel} on ${selectedProvider.name}`);
      
      return {
        model: selectedModel,
        provider: selectedProvider,
      };

    } catch (error) {
      logger.error('Error getting smart defaults:', error);
      return {
        model: DEFAULT_MODEL,
        provider: DEFAULT_PROVIDER,
      };
    }
  }

  /**
   * Get the best model for a specific provider
   */
  private getBestModelForProvider(provider: ProviderInfo): string {
    try {
      const models = this.llmManager.getStaticModelListFromProvider(provider);
      
      if (models.length === 0) {
        logger.warn(`No models found for provider ${provider.name}`);
        return DEFAULT_MODEL;
      }

      // Provider-specific model preferences
      const modelPreferences: Record<string, string[]> = {
        'Moonshot': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        'Ollama': ['llama3.1:8b', 'llama3.1:70b', 'phi3:mini'],
        'LMStudio': ['llama-3.1-8b', 'llama-3.1-70b', 'phi-3-mini'],
        'OpenAI': ['gpt-4o-mini', 'gpt-4o', 'gpt-4'],
        'Anthropic': ['claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
        'Google': ['gemini-1.5-flash', 'gemini-1.5-pro'],
        'Groq': ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile'],
      };

      const preferences = modelPreferences[provider.name] || [];
      
      // Try to find a preferred model
      for (const preferredModel of preferences) {
        const found = models.find(m => m.name === preferredModel);
        if (found) {
          return found.name;
        }
      }

      // Fallback to first available model
      return models[0].name;

    } catch (error) {
      logger.error(`Error getting best model for provider ${provider.name}:`, error);
      return DEFAULT_MODEL;
    }
  }

  /**
   * Check if a model is available in configured providers
   */
  isModelAvailable(modelName: string): boolean {
    try {
      const configuredProviders = this.llmManager.getConfiguredProviders();
      
      for (const provider of configuredProviders) {
        const models = this.llmManager.getStaticModelListFromProvider(provider);
        if (models.some(m => m.name === modelName)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Error checking model availability:', error);
      return false;
    }
  }

  /**
   * Get available models for configured providers
   */
  getAvailableModels(): ModelInfo[] {
    try {
      const configuredProviders = this.llmManager.getConfiguredProviders();
      const allModels: ModelInfo[] = [];
      
      for (const provider of configuredProviders) {
        const models = this.llmManager.getStaticModelListFromProvider(provider);
        allModels.push(...models);
      }
      
      return allModels;
    } catch (error) {
      logger.error('Error getting available models:', error);
      return [];
    }
  }
}
