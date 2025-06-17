import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
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

  staticModels: ModelInfo[] = [
    // Temporary static models for testing inference flow
    { name: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet', provider: 'BayerMGA', maxTokenAllowed: 128000 },
    { name: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'BayerMGA', maxTokenAllowed: 128000 },
    // Add other common models if they appear in the UI for testing purposes
  ];

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

      // Normalize base URL (remove trailing slash)
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      // Construct models URL with query parameters
      const modelsUrl = `${normalizedBaseUrl}/models?include_hidden_models=false&include_aliases=true`;
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
        .filter((model: any) => {
          // Only include models with 'available' status and valid model names
          return model.model_status === 'available' && 
                 model.model && 
                 typeof model.model === 'string' && 
                 model.model.trim().length > 0;
        })
        .map((model: any) => ({
          name: model.model.trim(),
          label: model.name || model.model,
          provider: this.name,
          maxTokenAllowed: model.context_window || 8000,
        }));

      logger.info(`Found ${models.length} available models from Bayer MGA`);
      
      // Log model names for debugging
      if (models.length > 0) {
        logger.debug(`Available Bayer MGA models: ${models.map(m => m.name).join(', ')}`);
      } else {
        logger.warn('No available models returned from Bayer MGA API');
      }
      
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
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'BAYER_MGA_API_BASE_URL',
      defaultApiTokenKey: 'BAYER_MGA_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    if (!baseUrl) {
      throw new Error(`Missing base URL for ${this.name} provider`);
    }

    // Normalize base URL (remove trailing slash)
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Get cached models to validate model availability
    const cachedModels = this.getModelsFromCache({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
    });

    // Check if the requested model is available (either in cache or static models)
    const availableModels = [...this.staticModels, ...(cachedModels || [])];
    const modelExists = availableModels.some(m => m.name === model);
    
    let effectiveModel = model;
    if (!modelExists) {
      logger.warn(`Model ${model} not found in available models for Bayer MGA. Available models: ${availableModels.map(m => m.name).join(', ')}`);
      // Fall back to first available model if the requested model is not found
      const fallbackModel = availableModels[0];
      if (fallbackModel) {
        logger.info(`Using fallback model: ${fallbackModel.name}`);
        effectiveModel = fallbackModel.name;
      } else {
        throw new Error(`No models available for ${this.name} provider. Please check your API key and try again.`);
      }
    }
    
    logger.info(`Creating model instance for ${effectiveModel} using Bayer MGA API at ${normalizedBaseUrl}`);

    const openai = createOpenAI({
      baseURL: normalizedBaseUrl,
      apiKey,
    });

    return openai(effectiveModel);
  }
}
