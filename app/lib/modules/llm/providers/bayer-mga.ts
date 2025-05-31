import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import { createOpenAI } from '@ai-sdk/openai';

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

  /**
   * Normalizes a base URL by removing trailing slashes
   * to prevent double-slash issues in path construction
   */
  private normalizeBaseUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  /**
   * Validates API configuration and returns normalized values
   * or throws descriptive errors for troubleshooting
   */
  private validateApiConfig(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: IProviderSetting;
    serverEnv: Record<string, string>;
    operation: string;
  }): { baseUrl: string; apiKey: string } {
    const { apiKeys, providerSettings, serverEnv, operation } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv,
      defaultBaseUrlKey: 'BAYER_MGA_API_BASE_URL',
      defaultApiTokenKey: 'BAYER_MGA_API_KEY',
    });

    if (!baseUrl) {
      const error = `Missing base URL configuration for ${this.name} provider (${operation})`;
      logger.error(error);
      throw new Error(error);
    }

    if (!apiKey) {
      const error = `Missing API key configuration for ${this.name} provider (${operation})`;
      logger.error(error);
      throw new Error(error);
    }

    return {
      baseUrl: this.normalizeBaseUrl(baseUrl),
      apiKey,
    };
  }

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    try {
      // Validate configuration
      let baseUrl, apiKey;
      try {
        const config = this.validateApiConfig({
          apiKeys,
          providerSettings: settings,
          serverEnv,
          operation: 'getDynamicModels',
        });
        baseUrl = config.baseUrl;
        apiKey = config.apiKey;
      } catch (error) {
        logger.warn(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }

      // Construct models URL with query parameters
      const modelsUrl = `${baseUrl}/models?include_hidden_models=false&include_aliases=true`;
      logger.info(`Fetching models from ${modelsUrl}`);

      // Make API request with proper headers
      const response = await fetch(modelsUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Failed to fetch Bayer MGA models: ${response.status} ${response.statusText}`);
        logger.error(`Error details: ${errorText}`);
        return [];
      }

      // Parse response
      const responseText = await response.text();
      let res;
      try {
        res = JSON.parse(responseText);
      } catch (e) {
        logger.error(`Invalid JSON response from Bayer MGA API: ${responseText.substring(0, 200)}...`);
        return [];
      }

      // Validate response structure
      if (!res.data || !Array.isArray(res.data)) {
        logger.error(`Invalid response format from Bayer MGA API: missing data array`);
        logger.debug(`Response: ${JSON.stringify(res).substring(0, 500)}...`);
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
      logger.error(error instanceof Error && error.stack ? error.stack : 'No stack trace available');
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

      // Validate configuration
      const { baseUrl, apiKey } = this.validateApiConfig({
        apiKeys,
        providerSettings: providerSettings?.[this.name],
        serverEnv: serverEnv as any,
        operation: 'getModelInstance',
      });

      // Log the model instance creation attempt
      logger.info(`Creating model instance for ${model} using Bayer MGA API at ${baseUrl}`);

      // Create the OpenAI-compatible client with the correct base URL
      // The SDK will append /chat/completions to this URL
      const openai = createOpenAI({
        baseURL: baseUrl,
        apiKey,
        // Add custom headers if needed for this provider
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Return the model instance
      return openai(model);
    } catch (error) {
      // Log detailed error information
      logger.error(`Error creating Bayer MGA model instance: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(error instanceof Error && error.stack ? error.stack : 'No stack trace available');
      
      // Rethrow the error with a more descriptive message
      if (error instanceof Error) {
        throw new Error(`Bayer MGA provider error: ${error.message}`);
      }
      throw error;
    }
  }
}
