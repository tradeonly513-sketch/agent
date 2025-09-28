import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class HuggingFaceProvider extends BaseProvider {
  name = 'HuggingFace';
  getApiKeyLink = 'https://huggingface.co/settings/tokens';

  config = {
    apiTokenKey: 'HuggingFace_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // DeepSeek models on HuggingFace - 2025 updates
    {
      name: 'deepseek-ai/DeepSeek-V3.1',
      label: 'DeepSeek V3.1 (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 128000, // Updated context
      maxCompletionTokens: 8192,
    },
    {
      name: 'deepseek-ai/DeepSeek-V3.1-Terminus',
      label: 'DeepSeek V3.1 Terminus (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'deepseek-ai/DeepSeek-Coder-V2',
      label: 'DeepSeek Coder V2 (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Qwen series - 2025 coding models
    {
      name: 'Qwen/Qwen3-Coder-32B-Instruct',
      label: 'Qwen3 Coder 32B (2025)',
      provider: 'HuggingFace',
      maxTokenAllowed: 131072, // 128K context for new models
      maxCompletionTokens: 8192,
    },
    {
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen2.5 Coder 32B',
      provider: 'HuggingFace',
      maxTokenAllowed: 32768, // Updated context
      maxCompletionTokens: 8192,
    },
    {
      name: 'Qwen/Qwen2.5-72B-Instruct',
      label: 'Qwen2.5 72B Instruct',
      provider: 'HuggingFace',
      maxTokenAllowed: 32768,
      maxCompletionTokens: 8192,
    },

    // LLaMA 3.3/4 series - 2025 models
    {
      name: 'meta-llama/Llama-3.3-70B-Instruct',
      label: 'LLaMA 3.3 70B Instruct (2025)',
      provider: 'HuggingFace',
      maxTokenAllowed: 131072, // 128K context for 3.3
      maxCompletionTokens: 8192,
    },
    {
      name: 'meta-llama/Llama-4-8B-Instruct',
      label: 'LLaMA 4 8B Instruct (2025)',
      provider: 'HuggingFace',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'meta-llama/Llama-3.1-70B-Instruct',
      label: 'LLaMA 3.1 70B Instruct',
      provider: 'HuggingFace',
      maxTokenAllowed: 131072, // Updated context
      maxCompletionTokens: 8192,
    },

    // Yi series - 2025 updates
    {
      name: '01-ai/Yi-2.0-34B-Chat',
      label: 'Yi 2.0 34B Chat (2025)',
      provider: 'HuggingFace',
      maxTokenAllowed: 131072, // 2.0 has larger context
      maxCompletionTokens: 8192,
    },
    {
      name: '01-ai/Yi-1.5-34B-Chat',
      label: 'Yi 1.5 34B Chat',
      provider: 'HuggingFace',
      maxTokenAllowed: 32768, // Updated context
      maxCompletionTokens: 8192,
    },

    // CodeLLaMA and coding models
    {
      name: 'codellama/CodeLlama-34b-Instruct-hf',
      label: 'CodeLLaMA 34B Instruct',
      provider: 'HuggingFace',
      maxTokenAllowed: 16384, // Updated context
      maxCompletionTokens: 8192,
    },
    {
      name: 'microsoft/CodeGPT-small-py',
      label: 'CodeGPT Small Python (2025)',
      provider: 'HuggingFace',
      maxTokenAllowed: 16384,
      maxCompletionTokens: 4096,
    },

    // Hermes series - 2025 updates
    {
      name: 'NousResearch/Hermes-3-Llama-3.3-70B',
      label: 'Hermes 3 LLaMA 3.3 70B (2025)',
      provider: 'HuggingFace',
      maxTokenAllowed: 131072, // Updated for 2025
      maxCompletionTokens: 8192,
    },
    {
      name: 'NousResearch/Hermes-3-Llama-3.1-8B',
      label: 'Hermes 3 LLaMA 3.1 8B',
      provider: 'HuggingFace',
      maxTokenAllowed: 32768, // Updated context
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
      defaultApiTokenKey: 'HuggingFace_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api-inference.huggingface.co/v1/',
      apiKey,
    });

    return openai(model);
  }
}
