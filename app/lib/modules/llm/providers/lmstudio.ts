import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from 'ai';
import { logger } from '~/utils/logger';
import { modelCapabilitiesDetector, type ModelCapabilities } from '~/lib/services/modelCapabilitiesDetector';

// Interface for LM Studio API model response
interface LMStudioModelResponse {
  data: Array<{
    id: string;
    object: string;
    created?: number;
    owned_by?: string;
  }>;
  object: string;
}

// Enhanced model info with capabilities
interface EnhancedModelInfo extends ModelInfo {
  capabilities?: ModelCapabilities;
  isValidated?: boolean;
  validationErrors?: string[];
}

export default class LMStudioProvider extends BaseProvider {
  name = 'LMStudio';
  getApiKeyLink = 'https://lmstudio.ai/';
  labelForGetApiKey = 'Download LM Studio';
  icon = 'i-ph:desktop';

  config = {
    baseUrlKey: 'LMSTUDIO_API_BASE_URL',
    baseUrl: 'http://localhost:1234',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    try {
      let { baseUrl } = this.getProviderBaseUrlAndKey({
        apiKeys,
        providerSettings: settings,
        serverEnv,
        defaultBaseUrlKey: 'LMSTUDIO_API_BASE_URL',
        defaultApiTokenKey: '',
      });

      if (!baseUrl) {
        console.warn(`${this.name}: No base URL configured, using default localhost:1234`);
        baseUrl = this.config.baseUrl!;
      }

      // Normalize base URL
      baseUrl = this.normalizeBaseUrl(baseUrl, serverEnv);

      const response = await fetch(`${baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'bolt.diy/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as LMStudioModelResponse;

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
            const capabilities = await modelCapabilitiesDetector.detectCapabilities(this.name, model.id, baseUrl);

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

      logger.info(`${this.name}: Successfully loaded ${validModels.length} models`);

      return validModels;
    } catch (error) {
      console.error(`${this.name}: Error fetching models:`, error);
      return [];
    }
  }

  /**
   * Normalize base URL for Docker environments
   */
  private normalizeBaseUrl(baseUrl: string, serverEnv: Record<string, string> = {}): string {
    // Remove trailing slash if present
    let normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // Handle Docker environment
    if (typeof window === 'undefined') {
      const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true' || serverEnv?.RUNNING_IN_DOCKER === 'true';

      if (isDocker) {
        normalizedUrl = normalizedUrl.replace('localhost', 'host.docker.internal');
        normalizedUrl = normalizedUrl.replace('127.0.0.1', 'host.docker.internal');
      }
    }

    return normalizedUrl;
  }

  /**
   * Get appropriate max tokens for a model based on its name
   */
  private getMaxTokensForModel(modelId: string): number {
    // Common model patterns and their typical context windows
    const modelPatterns = [
      { pattern: /llama.*70b/i, tokens: 4096 },
      { pattern: /llama.*13b/i, tokens: 4096 },
      { pattern: /llama.*7b/i, tokens: 4096 },
      { pattern: /mistral.*7b/i, tokens: 8192 },
      { pattern: /mixtral/i, tokens: 32768 },
      { pattern: /codellama/i, tokens: 4096 },
      { pattern: /phi.*3/i, tokens: 4096 },
      { pattern: /gemma/i, tokens: 8192 },
      { pattern: /qwen/i, tokens: 8192 },
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
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { apiKeys, providerSettings, serverEnv, model } = options;

    if (!model || model.trim() === '') {
      throw new Error(`Model name is required for ${this.name} provider`);
    }

    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'LMSTUDIO_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      console.warn(`${this.name}: No base URL configured, using default localhost:1234`);
      baseUrl = this.config.baseUrl!;
    }

    try {
      // Normalize base URL for Docker environments
      const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl, serverEnv as any);

      logger.debug(`${this.name}: Using base URL:`, normalizedBaseUrl);

      const lmstudio = createOpenAI({
        baseURL: `${normalizedBaseUrl}/v1`,
        apiKey: '', // LM Studio doesn't require an API key
      });

      return lmstudio(model);
    } catch (error) {
      throw new Error(
        `Failed to create model instance for ${this.name} provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
