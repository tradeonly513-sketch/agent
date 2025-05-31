import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class BayerMGAProvider extends BaseProvider {
  name = 'BayerMGA';
  getApiKeyLink = 'https://chat.int.bayer.com';
  labelForGetApiKey = 'Get Bayer MGA API Key';

  config = {
    baseUrl: 'https://chat.int.bayer.com/api/v2',
    apiTokenKey: 'BAYER_MGA_API_KEY',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'BAYER_MGA_API_BASE_URL',
      defaultApiTokenKey: 'BAYER_MGA_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      return [];
    }

    const response = await fetch(`${baseUrl}/models?include_hidden_models=false&include_aliases=true`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    // Filter for available models and map to ModelInfo format
    return res.data
      .filter((model: any) => model.model_status === 'available')
      .map((model: any) => ({
        name: model.model,
        label: model.name || model.model,
        provider: this.name,
        maxTokenAllowed: model.context_window || 8000,
      }));
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
      defaultBaseUrlKey: 'BAYER_MGA_API_BASE_URL',
      defaultApiTokenKey: 'BAYER_MGA_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
