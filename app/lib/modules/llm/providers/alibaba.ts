import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { isLikelyCodeModel } from '~/lib/modules/llm/utils/code-model-filter';

export default class AlibabaProvider extends BaseProvider {
  name = 'Alibaba';
  getApiKeyLink = 'https://dashscope.console.aliyun.com/apiKey';

  config = {
    apiTokenKey: 'ALIBABA_API_KEY',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  };

  staticModels: ModelInfo[] = [
    // Qwen3-Max series - 2025 flagship trillion-parameter models
    {
      name: 'qwen3-max-preview',
      label: 'Qwen3-Max-Preview (Trillion Parameters)',
      provider: 'Alibaba',
      maxTokenAllowed: 258048, // 258K input tokens
      maxCompletionTokens: 32768, // 32K output tokens
    },
    {
      name: 'qwen3-max',
      label: 'Qwen3-Max',
      provider: 'Alibaba',
      maxTokenAllowed: 258048,
      maxCompletionTokens: 32768,
    },

    // Qwen3-Coder series - 2025 coding specialists
    {
      name: 'qwen3-coder-480b-a35b-instruct',
      label: 'Qwen3-Coder 480B (35B Active)',
      provider: 'Alibaba',
      maxTokenAllowed: 1000000, // 1M with extrapolation
      maxCompletionTokens: 32768,
    },
    {
      name: 'qwen3-coder-plus',
      label: 'Qwen3-Coder Plus',
      provider: 'Alibaba',
      maxTokenAllowed: 256000, // 256K native context
      maxCompletionTokens: 32768,
    },
    {
      name: 'qwen3-coder-30b-a3b-instruct',
      label: 'Qwen3-Coder 30B (3B Active)',
      provider: 'Alibaba',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 16384,
    },
    {
      name: 'qwen3-coder-14b-instruct',
      label: 'Qwen3-Coder 14B',
      provider: 'Alibaba',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 16384,
    },

    // Qwen3 general models - 2025 thinking capable
    {
      name: 'qwen3-235b-a22b-instruct',
      label: 'Qwen3-235B (22B Active, Thinking)',
      provider: 'Alibaba',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 32768,
    },
    {
      name: 'qwen3-32b-instruct',
      label: 'Qwen3-32B (Thinking)',
      provider: 'Alibaba',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 16384,
    },
    {
      name: 'qwen3-14b-instruct',
      label: 'Qwen3-14B (Thinking)',
      provider: 'Alibaba',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 16384,
    },
    {
      name: 'qwen3-8b-instruct',
      label: 'Qwen3-8B (Thinking)',
      provider: 'Alibaba',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 8192,
    },

    // QwQ reasoning model - 2025 specialized for reasoning
    {
      name: 'qwq-32b-preview',
      label: 'QwQ-32B (Reasoning)',
      provider: 'Alibaba',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 32768,
    },

    // Qwen2.5 series - mature stable models
    {
      name: 'qwen2.5-coder-32b-instruct',
      label: 'Qwen2.5-Coder 32B',
      provider: 'Alibaba',
      maxTokenAllowed: 131072, // 128K context
      maxCompletionTokens: 8192,
    },
    {
      name: 'qwen2.5-72b-instruct',
      label: 'Qwen2.5-72B',
      provider: 'Alibaba',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'qwen2.5-32b-instruct',
      label: 'Qwen2.5-32B',
      provider: 'Alibaba',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'qwen2.5-14b-instruct',
      label: 'Qwen2.5-14B',
      provider: 'Alibaba',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'qwen2.5-7b-instruct',
      label: 'Qwen2.5-7B',
      provider: 'Alibaba',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 8192,
    },

    // Qwen-Turbo - fast inference models
    {
      name: 'qwen-turbo',
      label: 'Qwen-Turbo (Fast)',
      provider: 'Alibaba',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'qwen-plus',
      label: 'Qwen-Plus',
      provider: 'Alibaba',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 8192,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'ALIBABA_BASE_URL',
      defaultApiTokenKey: 'ALIBABA_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const response = await fetch(`${baseUrl || this.config.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from ${this.name}: ${response.statusText}`);
    }

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    // Filter for Qwen models and exclude static models to avoid duplicates
    const data = res.data.filter(
      (model: any) =>
        model.object === 'model' && isLikelyCodeModel(this.name, model.id) && !staticModelIds.includes(model.id),
    );

    return data.map((m: any) => {
      // Determine context window based on model name and generation
      let contextWindow = 131072; // default 128K for Qwen2.5

      if (m.id?.includes('qwen3-max')) {
        contextWindow = 258048; // Qwen3-Max: 258K input
      } else if (m.id?.includes('qwen3-coder-480b') || m.id?.includes('qwen3-coder-plus')) {
        contextWindow = 1000000; // 1M with extrapolation for largest coder
      } else if (m.id?.includes('qwen3')) {
        contextWindow = 256000; // Qwen3 series: 256K native
      } else if (m.id?.includes('qwq')) {
        contextWindow = 256000; // QwQ reasoning model: 256K
      } else if (m.id?.includes('qwen2.5') || m.id?.includes('qwen-turbo') || m.id?.includes('qwen-plus')) {
        contextWindow = 131072; // Qwen2.5/legacy: 128K
      }

      // Determine completion token limits based on model type and size
      let maxCompletionTokens = 8192; // default

      if (m.id?.includes('qwen3-max') || m.id?.includes('qwen3-coder-480b')) {
        maxCompletionTokens = 32768; // Flagship models: 32K output
      } else if (m.id?.includes('qwq') || m.id?.includes('qwen3-235b')) {
        maxCompletionTokens = 32768; // Reasoning models: 32K output
      } else if (m.id?.includes('qwen3') && (m.id?.includes('32b') || m.id?.includes('30b'))) {
        maxCompletionTokens = 16384; // Large Qwen3 models: 16K output
      } else if (m.id?.includes('coder')) {
        maxCompletionTokens = 16384; // Coding models get more output tokens
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

    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'ALIBABA_BASE_URL',
      defaultApiTokenKey: 'ALIBABA_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: baseUrl || this.config.baseUrl,
      apiKey,
      headers: {
        'User-Agent': 'Bolt.DIY/1.0 (https://bolt.diy)', // Identify our client
      },
    });

    return openai(model);
  }
}
