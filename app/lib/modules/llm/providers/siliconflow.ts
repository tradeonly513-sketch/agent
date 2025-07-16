import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class SiliconFlowProvider extends BaseProvider {
  name = 'SiliconFlow';
  getApiKeyLink = 'https://cloud.siliconflow.cn/account/ak';

  config = {
    baseUrlKey: 'SILICONFLOW_API_BASE_URL',
    apiTokenKey: 'SILICONFLOW_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'Qwen/QwQ-32B',
      label: 'QwQ-32B (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen2.5-Coder-32B-Instruct (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'Qwen/Qwen2.5-72B-Instruct',
      label: 'Qwen2.5-72B-Instruct (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'Qwen/Qwen2.5-32B-Instruct',
      label: 'Qwen2.5-32B-Instruct (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'Qwen/Qwen2.5-14B-Instruct',
      label: 'Qwen2.5-14B-Instruct (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'Qwen/Qwen2.5-7B-Instruct',
      label: 'Qwen2.5-7B-Instruct (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'deepseek-ai/DeepSeek-V2.5',
      label: 'DeepSeek-V2.5 (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'meta-llama/Llama-3.1-405B-Instruct',
      label: 'Llama-3.1-405B-Instruct (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'meta-llama/Llama-3.1-70B-Instruct',
      label: 'Llama-3.1-70B-Instruct (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'meta-llama/Llama-3.1-8B-Instruct',
      label: 'Llama-3.1-8B-Instruct (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'internlm/internlm2_5-7b-chat',
      label: 'InternLM2.5-7B-Chat (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
    {
      name: 'internlm/internlm2_5-20b-chat',
      label: 'InternLM2.5-20B-Chat (SiliconFlow)',
      provider: 'SiliconFlow',
      maxTokenAllowed: 32768,
    },
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
      defaultBaseUrlKey: 'SILICONFLOW_API_BASE_URL',
      defaultApiTokenKey: 'SILICONFLOW_API_KEY',
    });

    if (!apiKey) {
      return this.staticModels;
    }

    try {
      const apiBaseUrl = baseUrl || 'https://api.siliconflow.cn/v1';
      const response = await fetch(`${apiBaseUrl}/models?type=text&sub_type=chat`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch SiliconFlow models: ${response.status} ${response.statusText}`);
        return this.staticModels;
      }

      const data = (await response.json()) as any;
      const staticModelIds = this.staticModels.map((m) => m.name);

      const dynamicModels = data.data
        .filter((model: any) => model.object === 'model' && !staticModelIds.includes(model.id))
        .map((model: any) => ({
          name: model.id,
          label: `${model.id} (SiliconFlow)`,
          provider: this.name,
          maxTokenAllowed: 32768, // Default context length
        }));

      return [...this.staticModels, ...dynamicModels];
    } catch (error) {
      console.warn('Failed to fetch dynamic models for SiliconFlow:', error);
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
      defaultBaseUrlKey: 'SILICONFLOW_API_BASE_URL',
      defaultApiTokenKey: 'SILICONFLOW_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: baseUrl || 'https://api.siliconflow.cn/v1',
      apiKey,
    });

    return openai(model);
  }
}
