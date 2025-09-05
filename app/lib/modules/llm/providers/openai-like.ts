import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { modelCapabilitiesDetector, type ModelCapabilities } from '~/lib/services/modelCapabilitiesDetector';

// Interface for OpenAI-compatible API model response
interface OpenAILikeModelResponse {
  data: Array<{
    id: string;
    object: string;
    created?: number;
    owned_by?: string;
    permission?: any[];
    root?: string;
    parent?: string;
  }>;
  object: string;
}

// Enhanced model info with capabilities
interface EnhancedModelInfo extends ModelInfo {
  capabilities?: ModelCapabilities;
  isValidated?: boolean;
  validationErrors?: string[];
}

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAILike';
  getApiKeyLink = undefined;
  labelForGetApiKey = 'Get API Key';
  icon = 'i-ph:cloud-arrow-down';

  config = {
    baseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
    apiTokenKey: 'OPENAI_LIKE_API_KEY',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    try {
      const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
        apiKeys,
        providerSettings: settings,
        serverEnv,
        defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
        defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
      });

      if (!baseUrl || baseUrl.includes('your_openai_like_base_url_here')) {
        console.warn(`${this.name}: No valid base URL configured, skipping model loading`);
        return [];
      }

      if (!apiKey || apiKey.includes('your_openai_like_api_key_here')) {
        console.warn(`${this.name}: No valid API key configured, skipping model loading`);
        return [];
      }

      // Ensure baseUrl ends with /v1 if it doesn't already have a path
      const normalizedBaseUrl = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1`;

      const response = await fetch(`${normalizedBaseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'bolt.diy/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as OpenAILikeModelResponse;

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format: missing or invalid data array');
      }

      // Enhanced model processing with capabilities detection
      const models = await Promise.allSettled(
        data.data.map(async (model) => {
          const baseModelInfo: ModelInfo = {
            name: model.id,
            label: model.id,
            provider: this.name,
            maxTokenAllowed: this.getMaxTokensForModel(model.id),
          };

          try {
            // Detect capabilities for each model
            const capabilities = await modelCapabilitiesDetector.detectCapabilities(
              this.name,
              model.id,
              normalizedBaseUrl,
              apiKey,
            );

            // Update max tokens based on detected capabilities
            if (capabilities.contextWindow) {
              baseModelInfo.maxTokenAllowed = capabilities.contextWindow;
            }

            const enhancedModel: EnhancedModelInfo = {
              ...baseModelInfo,
              capabilities,
              isValidated: capabilities.isVerified,
              validationErrors: capabilities.validationErrors,
            };

            return enhancedModel;
          } catch (error) {
            console.warn(`${this.name}: Failed to detect capabilities for ${model.id}:`, error);

            const enhancedModel: EnhancedModelInfo = {
              ...baseModelInfo,
              isValidated: false,
              validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
            };

            return enhancedModel;
          }
        }),
      );

      // Filter successful results and sort by validation status
      const validModels = models
        .filter((result): result is PromiseFulfilledResult<EnhancedModelInfo> => result.status === 'fulfilled')
        .map((result) => result.value)
        .sort((a, b) => {
          // Prioritize validated models
          if (a.isValidated && !b.isValidated) return -1;
          if (!a.isValidated && b.isValidated) return 1;
          return a.name.localeCompare(b.name);
        });

      console.log(`${this.name}: Successfully loaded ${validModels.length} models`);

      return validModels;
    } catch (error) {
      console.error(`${this.name}: Error fetching models:`, error);
      return [];
    }
  }

  /**
   * Get appropriate max tokens for a model based on its name
   */
  private getMaxTokensForModel(modelId: string): number {
    // Common model patterns and their typical context windows
    const modelPatterns = [
      { pattern: /gpt-4.*32k/i, tokens: 32768 },
      { pattern: /gpt-4.*turbo/i, tokens: 128000 },
      { pattern: /gpt-4/i, tokens: 8192 },
      { pattern: /gpt-3\.5.*16k/i, tokens: 16384 },
      { pattern: /gpt-3\.5/i, tokens: 4096 },
      { pattern: /claude-3.*opus/i, tokens: 200000 },
      { pattern: /claude-3.*sonnet/i, tokens: 200000 },
      { pattern: /claude-3.*haiku/i, tokens: 200000 },
      { pattern: /claude-2/i, tokens: 100000 },
      { pattern: /llama.*70b/i, tokens: 4096 },
      { pattern: /llama.*13b/i, tokens: 4096 },
      { pattern: /llama.*7b/i, tokens: 4096 },
      { pattern: /mistral.*7b/i, tokens: 8192 },
      { pattern: /mixtral/i, tokens: 32768 },
    ];

    for (const { pattern, tokens } of modelPatterns) {
      if (pattern.test(modelId)) {
        return tokens;
      }
    }

    // Default fallback
    return 8000;
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    if (!baseUrl) {
      throw new Error(
        `Missing base URL configuration for ${this.name} provider. Please set OPENAI_LIKE_API_BASE_URL or configure it in settings.`,
      );
    }

    if (!apiKey) {
      throw new Error(
        `Missing API key configuration for ${this.name} provider. Please set OPENAI_LIKE_API_KEY or configure it in settings.`,
      );
    }

    if (!model || model.trim() === '') {
      throw new Error(`Model name is required for ${this.name} provider`);
    }

    try {
      // Ensure baseUrl ends with /v1 if it doesn't already have a path
      const normalizedBaseUrl = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1`;

      return getOpenAILikeModel(normalizedBaseUrl, apiKey, model);
    } catch (error) {
      throw new Error(
        `Failed to create model instance for ${this.name} provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
