import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class XAIProvider extends BaseProvider {
  name = 'xAI';
  getApiKeyLink = 'https://docs.x.ai/docs/quickstart#creating-an-api-key';

  config = {
    apiTokenKey: 'XAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'grok-4', label: 'xAI Grok 4', provider: 'xAI', maxTokenAllowed: 256000 },
    { name: 'grok-4-07-09', label: 'xAI Grok 4 (07-09)', provider: 'xAI', maxTokenAllowed: 256000 },
    { name: 'grok-3-beta', label: 'xAI Grok 3 Beta', provider: 'xAI', maxTokenAllowed: 131000 },
    { name: 'grok-3-mini-beta', label: 'xAI Grok 3 Mini Beta', provider: 'xAI', maxTokenAllowed: 131000 },
    { name: 'grok-3-mini-fast-beta', label: 'xAI Grok 3 Mini Fast Beta', provider: 'xAI', maxTokenAllowed: 131000 },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'XAI_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.x.ai/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter(
      (model: any) =>
        model.object === 'model' &&
        (model.id.startsWith('grok-') || model.id.includes('grok')) &&
        !staticModelIds.includes(model.id),
    );

    return data.map((m: any) => {
      // Set context windows based on model type
      let contextWindow = 131072; // Default for Grok 3 models
      let maxCompletionTokens = 4096; // Default output tokens

      if (m.id.includes('grok-4')) {
        contextWindow = 256000;
        maxCompletionTokens = 8192;
      } else if (m.id.includes('grok-code-fast-1')) {
        contextWindow = 256000;
        maxCompletionTokens = 4096;
      } else if (m.id.includes('grok-3')) {
        contextWindow = 131072;
        maxCompletionTokens = 4096;
      } else if (m.id.includes('grok-2-image')) {
        contextWindow = 32000;
        maxCompletionTokens = 2048;
      }

      return {
        name: m.id,
        label: `xAI ${m.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens,
      };
    });
  }

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
      defaultApiTokenKey: 'XAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey,
    });

    return openai(model);
  }
}
