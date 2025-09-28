import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createScopedLogger } from '~/utils/logger';
import { filterCodeModelInfos } from '~/lib/modules/llm/utils/code-model-filter';

export default class GithubProvider extends BaseProvider {
  name = 'Github';
  getApiKeyLink = 'https://github.com/settings/personal-access-tokens';
  private _logger = createScopedLogger('GithubProvider');

  config = {
    apiTokenKey: 'GITHUB_API_KEY',
  };

  /*
   * GitHub Models - Available models through GitHub's native API
   * Updated for the new GitHub Models API at https://models.github.ai
   * Model IDs use the format: publisher/model-name
   */
  staticModels: ModelInfo[] = [
    // GPT-5 series - latest 2025 models
    {
      name: 'openai/gpt-5',
      label: 'GPT-5',
      provider: 'Github',
      maxTokenAllowed: 400000, // GPT-5 has 400K context in API
      maxCompletionTokens: 128000,
    },
    {
      name: 'openai/gpt-5-mini',
      label: 'GPT-5 Mini',
      provider: 'Github',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'openai/gpt-5-nano',
      label: 'GPT-5 Nano',
      provider: 'Github',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },

    // GPT-4.1 series
    {
      name: 'openai/gpt-4.1',
      label: 'GPT-4.1',
      provider: 'Github',
      maxTokenAllowed: 1048576, // 1M context for GitHub
      maxCompletionTokens: 32768,
    },
    {
      name: 'openai/gpt-4.1-mini',
      label: 'GPT-4.1-mini',
      provider: 'Github',
      maxTokenAllowed: 1048576,
      maxCompletionTokens: 32768,
    },

    // GPT-4o series
    { name: 'openai/gpt-4o', label: 'GPT-4o', provider: 'Github', maxTokenAllowed: 131072, maxCompletionTokens: 4096 },
    {
      name: 'openai/gpt-4o-mini',
      label: 'GPT-4o Mini',
      provider: 'Github',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 4096,
    },

    // o-series reasoning models
    {
      name: 'openai/o1-preview',
      label: 'o1-preview',
      provider: 'Github',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 32000,
    },
    {
      name: 'openai/o1-mini',
      label: 'o1-mini',
      provider: 'Github',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 65000,
    },
    { name: 'openai/o1', label: 'o1', provider: 'Github', maxTokenAllowed: 200000, maxCompletionTokens: 100000 },

    // DeepSeek models on GitHub
    {
      name: 'deepseek/deepseek-r1',
      label: 'DeepSeek-R1',
      provider: 'Github',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192, // Updated to match DeepSeek specs
    },
    {
      name: 'deepseek/deepseek-v3.1-terminus',
      label: 'DeepSeek V3.1 Terminus',
      provider: 'Github',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Claude 4 series (if available on GitHub)
    {
      name: 'anthropic/claude-sonnet-4',
      label: 'Claude Sonnet 4',
      provider: 'Github',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
    },
    {
      name: 'anthropic/claude-opus-4',
      label: 'Claude Opus 4',
      provider: 'Github',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 32000,
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
      defaultApiTokenKey: 'GITHUB_API_KEY',
    });

    if (!apiKey) {
      this._logger.warn('No API key found. Make sure GITHUB_API_KEY is set in your .env.local file');

      // Return static models if no API key is available
      return this.staticModels;
    }

    this._logger.info('API key found, attempting to fetch dynamic models...');

    try {
      // Try to fetch dynamic models from GitHub API
      const response = await fetch('https://models.github.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { data?: any[] };
        this._logger.info('Successfully fetched models from API');

        if (data.data && Array.isArray(data.data)) {
          const models = data.data.map((model: any) => ({
            name: model.id,
            label: model.name || model.id.split('/').pop() || model.id,
            provider: 'Github',
            maxTokenAllowed: model.limits?.max_input_tokens || 128000,
            maxCompletionTokens: model.limits?.max_output_tokens || 16384,
          }));
          return filterCodeModelInfos(this.name, models);
        }
      } else {
        this._logger.warn('API request failed with status:', response.status, response.statusText);
      }
    } catch (error) {
      this._logger.warn('Failed to fetch models, using static models:', error);
    }

    // Fallback to static models
    this._logger.info('Using static models as fallback');

    return this.staticModels;
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    this._logger.info('Creating model instance for', model);

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'GITHUB_API_KEY',
    });

    if (!apiKey) {
      this._logger.error('No API key found');
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    this._logger.info('API key configured successfully');

    const openai = createOpenAI({
      baseURL: 'https://models.github.ai/inference',
      apiKey,
    });

    this._logger.info('Created OpenAI client, requesting model:', model);

    return openai(model);
  }
}
