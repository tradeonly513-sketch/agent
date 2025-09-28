import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class MoonshotProvider extends BaseProvider {
  name = 'Moonshot';
  getApiKeyLink = 'https://platform.moonshot.ai/console/api-keys';

  config = {
    apiTokenKey: 'MOONSHOT_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Kimi K3 series - 2025 flagship models
    {
      name: 'kimi-k3-0125',
      label: 'Kimi K3 (2025)',
      provider: 'Moonshot',
      maxTokenAllowed: 2000000, // 2M context for 2025
      maxCompletionTokens: 16384,
    },
    {
      name: 'kimi-k3-turbo-0125',
      label: 'Kimi K3 Turbo (2025)',
      provider: 'Moonshot',
      maxTokenAllowed: 1000000, // 1M context for turbo
      maxCompletionTokens: 16384,
    },
    {
      name: 'kimi-k3-reasoning-0125',
      label: 'Kimi K3 Reasoning (2025)',
      provider: 'Moonshot',
      maxTokenAllowed: 512000, // 512K for reasoning model
      maxCompletionTokens: 32768,
    },

    // Kimi K2 series - current stable (updated context)
    {
      name: 'kimi-latest',
      label: 'Kimi Latest',
      provider: 'Moonshot',
      maxTokenAllowed: 1000000, // Updated to 1M context
      maxCompletionTokens: 16384,
    },
    {
      name: 'kimi-k2-0711-preview',
      label: 'Kimi K2 Preview',
      provider: 'Moonshot',
      maxTokenAllowed: 512000, // Updated context
      maxCompletionTokens: 8192,
    },
    {
      name: 'kimi-k2-turbo-preview',
      label: 'Kimi K2 Turbo',
      provider: 'Moonshot',
      maxTokenAllowed: 256000, // Updated context
      maxCompletionTokens: 8192,
    },
    {
      name: 'kimi-thinking-preview',
      label: 'Kimi Thinking',
      provider: 'Moonshot',
      maxTokenAllowed: 256000, // Reasoning model
      maxCompletionTokens: 16384,
    },

    // Moonshot v2 series - 2025 coding models
    {
      name: 'moonshot-v2-128k',
      label: 'Moonshot v2 128K (Coding)',
      provider: 'Moonshot',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'moonshot-v2-256k',
      label: 'Moonshot v2 256K (Coding)',
      provider: 'Moonshot',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'moonshot-v2-auto',
      label: 'Moonshot v2 Auto (Coding)',
      provider: 'Moonshot',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 8192,
    },

    // Legacy Moonshot v1 models
    {
      name: 'moonshot-v1-128k',
      label: 'Moonshot v1 128K (Legacy)',
      provider: 'Moonshot',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },
    {
      name: 'moonshot-v1-32k',
      label: 'Moonshot v1 32K (Legacy)',
      provider: 'Moonshot',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 4096,
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
      defaultApiTokenKey: 'MOONSHOT_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.moonshot.ai/v1',
      apiKey,
    });

    return openai(model);
  }
}
