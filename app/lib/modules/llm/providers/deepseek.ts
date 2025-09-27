import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

export default class DeepseekProvider extends BaseProvider {
  name = 'Deepseek';
  getApiKeyLink = 'https://platform.deepseek.com/apiKeys';

  config = {
    apiTokenKey: 'DEEPSEEK_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // V3 Models (Latest and most powerful) - 128k context, enhanced reasoning
    {
      name: 'deepseek-chat',
      label: 'DeepSeek V3 Chat',
      provider: 'Deepseek',
      maxTokenAllowed: 128000, // V3 supports 128k context
      maxCompletionTokens: 8192,
    },
    {
      name: 'deepseek-coder',
      label: 'DeepSeek V3 Coder',
      provider: 'Deepseek',
      maxTokenAllowed: 128000, // V3 supports 128k context
      maxCompletionTokens: 8192,
    },

    // R1 Reasoning Model - advanced reasoning capabilities
    {
      name: 'deepseek-r1',
      label: 'DeepSeek R1',
      provider: 'Deepseek',
      maxTokenAllowed: 64000, // R1 has 64k context
      maxCompletionTokens: 8192,
    },

    // Legacy V2.5 Models (for compatibility) - 32k context
    {
      name: 'deepseek-chat-v2.5',
      label: 'DeepSeek V2.5 Chat (Legacy)',
      provider: 'Deepseek',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 4096,
    },
    {
      name: 'deepseek-coder-v2.5',
      label: 'DeepSeek V2.5 Coder (Legacy)',
      provider: 'Deepseek',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 4096,
    },
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
      defaultApiTokenKey: 'DEEPSEEK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const response = await fetch(`https://api.deepseek.com/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from ${this.name}: ${response.statusText}`);
    }

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    // Filter for DeepSeek models and exclude static models to avoid duplicates
    const data = res.data.filter(
      (model: any) =>
        model.object === 'model' && model.id.startsWith('deepseek-') && !staticModelIds.includes(model.id),
    );

    return data.map((m: any) => {
      // Determine context window based on model name
      let contextWindow = 32000; // default fallback

      if (m.id?.includes('deepseek-v3') || m.id?.includes('deepseek-chat') || m.id?.includes('deepseek-coder')) {
        contextWindow = 128000; // V3 models have 128k context
      } else if (m.id?.includes('deepseek-r1')) {
        contextWindow = 64000; // R1 reasoning model has 64k context
      } else if (m.id?.includes('deepseek-v2.5')) {
        contextWindow = 32000; // V2.5 models have 32k context
      }

      // Determine completion token limits
      let maxCompletionTokens = 4096; // default

      if (m.id?.includes('deepseek-r1')) {
        maxCompletionTokens = 8192; // R1 reasoning model has higher output limits
      } else if (m.id?.includes('deepseek-v3') || m.id?.includes('deepseek-chat') || m.id?.includes('deepseek-coder')) {
        maxCompletionTokens = 8192; // V3 models
      }

      return {
        name: m.id,
        label: `${m.id} (${Math.floor(contextWindow / 1000)}k context)`,
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
      defaultApiTokenKey: 'DEEPSEEK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const deepseek = createDeepSeek({
      apiKey,
    });

    return deepseek(model);
  }
}
