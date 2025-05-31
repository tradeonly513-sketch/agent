import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('BayerMGAProvider');

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
    try {
      const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
        apiKeys,
        providerSettings: settings,
        serverEnv,
        defaultBaseUrlKey: 'BAYER_MGA_API_BASE_URL',
        defaultApiTokenKey: 'BAYER_MGA_API_KEY',
      });

      if (!baseUrl || !apiKey) {
        logger.warn('Missing baseUrl or apiKey configuration for Bayer MGA provider');
        return [];
      }

      const modelsUrl = `${baseUrl}/models?include_hidden_models=false&include_aliases=true`;
      logger.info(`Fetching models from ${modelsUrl}`);

      const response = await fetch(modelsUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Failed to fetch Bayer MGA models: ${response.status} ${errorText}`);
        return [];
      }

      const res = (await response.json()) as any;

      if (!res.data || !Array.isArray(res.data)) {
        logger.error(`Invalid response format from Bayer MGA API: missing data array`);
        return [];
      }

      // Filter for available models and map to ModelInfo format
      const models = res.data
        .filter((model: any) => model.model_status === 'available')
        .map((model: any) => ({
          name: model.model,
          label: model.name || model.model,
          provider: this.name,
          maxTokenAllowed: model.context_window || 8000,
        }));

      logger.info(`Found ${models.length} available models from Bayer MGA`);
      return models;
    } catch (error) {
      logger.error(`Error fetching Bayer MGA models: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    try {
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

      // Ensure baseUrl doesn't have trailing slash since the SDK will append paths
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      logger.info(`Creating model instance for ${model} using Bayer MGA API at ${normalizedBaseUrl}`);

      // The OpenAI SDK will automatically append /chat/completions to the baseURL
      return getOpenAILikeModel(normalizedBaseUrl, apiKey, model);
    } catch (error) {
      logger.error(`Error creating Bayer MGA model instance: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
