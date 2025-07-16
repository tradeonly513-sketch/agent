import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class MoonshotProvider extends BaseProvider {
  name = 'Moonshot';
  getApiKeyLink = 'https://platform.moonshot.cn/console/api-keys';
  labelForGetApiKey = 'Get Moonshot API Key';
  icon = 'https://platform.moonshot.cn/favicon.ico';

  config = {
    baseUrl: 'https://api.moonshot.cn/v1',
    apiTokenKey: 'MOONSHOT_API_KEY',
    baseUrlKey: 'MOONSHOT_API_BASE_URL',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'kimi-k2-0711-preview',
      label: 'Kimi K2 Preview',
      provider: 'Moonshot',
      maxTokenAllowed: 128000,
    },
    {
      name: 'moonshot-v1-8k',
      label: 'Moonshot v1 8K',
      provider: 'Moonshot',
      maxTokenAllowed: 8000,
    },
    {
      name: 'moonshot-v1-32k',
      label: 'Moonshot v1 32K',
      provider: 'Moonshot',
      maxTokenAllowed: 32000,
    },
    { name: 'moonshot-v1-128k', label: 'Moonshot v1 128K', provider: 'Moonshot', maxTokenAllowed: 128000 },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'MOONSHOT_API_BASE_URL',
      defaultApiTokenKey: 'MOONSHOT_API_KEY',
    });

    if (!apiKey) {
      throw `Missing API Key configuration for ${this.name} provider`;
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data: { data: any[] } = await response.json();
      const staticModelIds = this.staticModels.map((m) => m.name);

      const models = data.data.filter((model: any) => model.object === 'model' && !staticModelIds.includes(model.id));

      return [
        ...this.staticModels,
        ...models.map((m: any) => ({
          name: m.id,
          label: m.id.includes('kimi') ? m.id.replace('kimi-', 'Kimi ') : m.id.replace('moonshot-', 'Moonshot '),
          provider: this.name,
          maxTokenAllowed: m.context_length || 8000,
        })),
      ];
    } catch (error) {
      console.warn(`Failed to fetch dynamic models for ${this.name}:`, error);
      return this.staticModels;
    }
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
      defaultBaseUrlKey: 'MOONSHOT_API_BASE_URL',
      defaultApiTokenKey: 'MOONSHOT_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: baseUrl,
      apiKey,
    });

    return openai(model);
  }
}
