import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createCohere } from '@ai-sdk/cohere';

export default class CohereProvider extends BaseProvider {
  name = 'Cohere';
  getApiKeyLink = 'https://dashboard.cohere.com/api-keys';

  config = {
    apiTokenKey: 'COHERE_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Command R series - 2025 models with updated context
    {
      name: 'command-r-plus-01-2025',
      label: 'Command R+ 01-2025 (Latest)',
      provider: 'Cohere',
      maxTokenAllowed: 256000, // 2025 models have 256K context
      maxCompletionTokens: 8192,
    },
    {
      name: 'command-r-01-2025',
      label: 'Command R 01-2025 (Latest)',
      provider: 'Cohere',
      maxTokenAllowed: 128000, // 2025 standard model
      maxCompletionTokens: 8192,
    },

    // Command A series - new 2025 flagship
    {
      name: 'command-a',
      label: 'Command A (Latest)',
      provider: 'Cohere',
      maxTokenAllowed: 256000, // Large context model
      maxCompletionTokens: 8192,
    },

    // Legacy 2024 models (for compatibility)
    {
      name: 'command-r-plus-08-2024',
      label: 'Command R+ 08-2024',
      provider: 'Cohere',
      maxTokenAllowed: 128000, // Updated context for 2024 models
      maxCompletionTokens: 4000,
    },
    {
      name: 'command-r-08-2024',
      label: 'Command R 08-2024',
      provider: 'Cohere',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4000,
    },
    {
      name: 'command-r-plus',
      label: 'Command R+ (Legacy)',
      provider: 'Cohere',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4000,
    },
    {
      name: 'command-r',
      label: 'Command R (Legacy)',
      provider: 'Cohere',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4000,
    },
    {
      name: 'command',
      label: 'Command (Legacy)',
      provider: 'Cohere',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4000,
    },

    // c4AI Aya models - 2025 updates
    {
      name: 'c4ai-aya-expanse-32b',
      label: 'c4AI Aya Expanse 32b',
      provider: 'Cohere',
      maxTokenAllowed: 128000, // Updated context
      maxCompletionTokens: 8192,
    },
    {
      name: 'c4ai-aya-expanse-8b',
      label: 'c4AI Aya Expanse 8b',
      provider: 'Cohere',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'COHERE_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const cohere = createCohere({
      apiKey,
    });

    return cohere(model);
  }
}
