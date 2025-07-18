import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class GroqProvider extends BaseProvider {
  name = 'Groq';
  getApiKeyLink = 'https://console.groq.com/keys';

  config = {
    apiTokenKey: 'GROQ_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Llama 3.1 Models
    { name: 'llama-3.1-8b-instant', label: 'Llama 3.1 8b Instant (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },
    { name: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70b Versatile (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },
    
    // Llama 3.2 Models
    { name: 'llama-3.2-1b-preview', label: 'Llama 3.2 1b Preview (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
    { name: 'llama-3.2-3b-preview', label: 'Llama 3.2 3b Preview (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
    { name: 'llama-3.2-11b-vision-preview', label: 'Llama 3.2 11b Vision (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
    { name: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90b Vision (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },

    // Llama 3.3 Models  
    { name: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70b Versatile (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },
    { name: 'llama-3.3-70b-specdec', label: 'Llama 3.3 70b Speculative Decoding (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },

    // Llama 4 Models (Latest)
    { name: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17b (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },
    { name: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17b (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },

    // DeepSeek Models
    { name: 'deepseek-r1-distill-llama-70b', label: 'Deepseek R1 Distill Llama 70b (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },
    { name: 'deepseek-r1-distill-qwen-32b', label: 'Deepseek R1 Distill Qwen 32b (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },

    // Qwen Models
    { name: 'qwen-qwq-32b', label: 'Qwen QwQ 32b (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },
    { name: 'qwen/qwen3-32b', label: 'Qwen 3 32b (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },
    { name: 'qwen-2.5-32b', label: 'Qwen 2.5 32b (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },
    { name: 'qwen-2.5-coder-32b', label: 'Qwen 2.5 Coder 32b (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },

    // Mistral Models
    { name: 'mistral-saba-24b', label: 'Mistral Saba 24b (Groq)', provider: 'Groq', maxTokenAllowed: 32768 },
    { name: 'mixtral-8x7b-32768', label: 'Mixtral 8x7b (Groq)', provider: 'Groq', maxTokenAllowed: 32768 },

    // Moonshot AI Models
    { name: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2 Instruct (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },

    // Gemma Models
    { name: 'gemma2-9b-it', label: 'Gemma 2 9b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
    { name: 'gemma-7b-it', label: 'Gemma 7b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },

    // Llama Guard Models
    { name: 'meta-llama/llama-guard-4-12b', label: 'Llama Guard 4 12b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
    { name: 'llama-guard-3-8b', label: 'Llama Guard 3 8b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },

    // Speculative Decoding Models
    { name: 'deepseek-r1-distill-llama-70b-specdec', label: 'Deepseek R1 Distill Llama 70b SpecDec (Groq)', provider: 'Groq', maxTokenAllowed: 131072 },

    // Legacy Models (may be deprecated)
    { name: 'llama3-70b-8192', label: 'Llama 3 70b Legacy (Groq)', provider: 'Groq', maxTokenAllowed: 8192 },
    { name: 'llama3-8b-8192', label: 'Llama 3 8b Legacy (Groq)', provider: 'Groq', maxTokenAllowed: 8192 },
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
      defaultApiTokenKey: 'GROQ_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.groq.com/openai/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    const data = res.data.filter(
      (model: any) => model.object === 'model' && model.active && model.context_window > 8000,
    );

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.id} - context ${m.context_window ? Math.floor(m.context_window / 1000) + 'k' : 'N/A'} [ by ${m.owned_by}]`,
      provider: this.name,
      maxTokenAllowed: Math.min(m.context_window || 8192, 16384),
    }));
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
      defaultApiTokenKey: 'GROQ_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey,
    });

    return openai(model);
  }
}
