import { describe, it, expect, beforeEach } from 'vitest';
import { LLMManager } from '~/lib/modules/llm/manager';
import OpenAIProvider from '~/lib/modules/llm/providers/openai';
import AnthropicProvider from '~/lib/modules/llm/providers/anthropic';
import GoogleProvider from '~/lib/modules/llm/providers/google';
import GroqProvider from '~/lib/modules/llm/providers/groq';
import MistralProvider from '~/lib/modules/llm/providers/mistral';
import PerplexityProvider from '~/lib/modules/llm/providers/perplexity';
import DeepseekProvider from '~/lib/modules/llm/providers/deepseek';
import CohereProvider from '~/lib/modules/llm/providers/cohere';
import XAIProvider from '~/lib/modules/llm/providers/xai';
import GithubProvider from '~/lib/modules/llm/providers/github';
import HuggingFaceProvider from '~/lib/modules/llm/providers/huggingface';
import OpenRouterProvider from '~/lib/modules/llm/providers/open-router';
import SiliconFlowProvider from '~/lib/modules/llm/providers/siliconflow';

describe('LLM Providers BaseURL Support', () => {
  let manager: LLMManager;

  beforeEach(() => {
    manager = LLMManager.getInstance();
  });

  describe('Provider Configuration', () => {
    it('should have baseUrlKey configured for all providers', () => {
      const providers = [
        { provider: new OpenAIProvider(), expectedKey: 'OPENAI_API_BASE_URL' },
        { provider: new AnthropicProvider(), expectedKey: 'ANTHROPIC_API_BASE_URL' },
        { provider: new GoogleProvider(), expectedKey: 'GOOGLE_GENERATIVE_AI_API_BASE_URL' },
        { provider: new GroqProvider(), expectedKey: 'GROQ_API_BASE_URL' },
        { provider: new MistralProvider(), expectedKey: 'MISTRAL_API_BASE_URL' },
        { provider: new PerplexityProvider(), expectedKey: 'PERPLEXITY_API_BASE_URL' },
        { provider: new DeepseekProvider(), expectedKey: 'DEEPSEEK_API_BASE_URL' },
        { provider: new CohereProvider(), expectedKey: 'COHERE_API_BASE_URL' },
        { provider: new XAIProvider(), expectedKey: 'XAI_API_BASE_URL' },
        { provider: new GithubProvider(), expectedKey: 'GITHUB_API_BASE_URL' },
        { provider: new HuggingFaceProvider(), expectedKey: 'HUGGINGFACE_API_BASE_URL' },
        { provider: new OpenRouterProvider(), expectedKey: 'OPEN_ROUTER_API_BASE_URL' },
        { provider: new SiliconFlowProvider(), expectedKey: 'SILICONFLOW_API_BASE_URL' },
      ];

      providers.forEach(({ provider, expectedKey }) => {
        expect(provider.config.baseUrlKey).toBe(expectedKey);
      });
    });
  });

  describe('BaseURL Resolution', () => {
    it('should resolve baseUrl from environment variables', () => {
      const provider = new OpenAIProvider();
      const customBaseUrl = 'https://custom-openai-proxy.com/v1';

      const { baseUrl } = provider.getProviderBaseUrlAndKey({
        serverEnv: { OPENAI_API_BASE_URL: customBaseUrl },
        defaultBaseUrlKey: 'OPENAI_API_BASE_URL',
        defaultApiTokenKey: 'OPENAI_API_KEY',
      });

      expect(baseUrl).toBe(customBaseUrl);
    });

    it('should resolve baseUrl from provider settings', () => {
      const provider = new AnthropicProvider();
      const customBaseUrl = 'https://custom-anthropic-proxy.com';

      const { baseUrl } = provider.getProviderBaseUrlAndKey({
        providerSettings: { baseUrl: customBaseUrl },
        defaultBaseUrlKey: 'ANTHROPIC_API_BASE_URL',
        defaultApiTokenKey: 'ANTHROPIC_API_KEY',
      });

      expect(baseUrl).toBe(customBaseUrl);
    });

    it('should prioritize provider settings over environment variables', () => {
      const provider = new GoogleProvider();
      const envBaseUrl = 'https://env-google-proxy.com';
      const settingsBaseUrl = 'https://settings-google-proxy.com';

      const { baseUrl } = provider.getProviderBaseUrlAndKey({
        serverEnv: { GOOGLE_GENERATIVE_AI_API_BASE_URL: envBaseUrl },
        providerSettings: { baseUrl: settingsBaseUrl },
        defaultBaseUrlKey: 'GOOGLE_GENERATIVE_AI_API_BASE_URL',
        defaultApiTokenKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
      });

      expect(baseUrl).toBe(settingsBaseUrl);
    });

    it('should remove trailing slash from baseUrl', () => {
      const provider = new GroqProvider();
      const baseUrlWithSlash = 'https://custom-groq-proxy.com/';

      const { baseUrl } = provider.getProviderBaseUrlAndKey({
        serverEnv: { GROQ_API_BASE_URL: baseUrlWithSlash },
        defaultBaseUrlKey: 'GROQ_API_BASE_URL',
        defaultApiTokenKey: 'GROQ_API_KEY',
      });

      expect(baseUrl).toBe('https://custom-groq-proxy.com');
    });
  });

  describe('Model Instance Creation with Custom BaseURL', () => {
    it('should create OpenAI model instance with custom baseURL', () => {
      const provider = new OpenAIProvider();
      const customBaseUrl = 'https://custom-openai-proxy.com/v1';

      // Mock environment
      const mockEnv = {
        OPENAI_API_KEY: 'test-key',
        OPENAI_API_BASE_URL: customBaseUrl,
      } as any;

      expect(() => {
        provider.getModelInstance({
          model: 'gpt-4',
          serverEnv: mockEnv,
        });
      }).not.toThrow();
    });

    it('should create Anthropic model instance with custom baseURL', () => {
      const provider = new AnthropicProvider();
      const customBaseUrl = 'https://custom-anthropic-proxy.com';

      const mockEnv = {
        ANTHROPIC_API_KEY: 'test-key',
        ANTHROPIC_API_BASE_URL: customBaseUrl,
      } as any;

      expect(() => {
        provider.getModelInstance({
          model: 'claude-3-sonnet-20240229',
          serverEnv: mockEnv,
        });
      }).not.toThrow();
    });

    it('should create SiliconFlow model instance with custom baseURL', () => {
      const provider = new SiliconFlowProvider();
      const customBaseUrl = 'https://custom-siliconflow-proxy.com/v1';

      const mockEnv = {
        SILICONFLOW_API_KEY: 'test-key',
        SILICONFLOW_API_BASE_URL: customBaseUrl,
      } as any;

      expect(() => {
        provider.getModelInstance({
          model: 'Qwen/QwQ-32B',
          serverEnv: mockEnv,
        });
      }).not.toThrow();
    });
  });

  describe('Default BaseURL Fallback', () => {
    it('should use default baseURL when custom baseURL is not provided', () => {
      const provider = new OpenAIProvider();

      const mockEnv = {
        OPENAI_API_KEY: 'test-key',
      } as any;

      expect(() => {
        provider.getModelInstance({
          model: 'gpt-4',
          serverEnv: mockEnv,
        });
      }).not.toThrow();
    });

    it('should handle missing API key gracefully', () => {
      const provider = new MistralProvider();

      const mockEnv = {
        MISTRAL_API_BASE_URL: 'https://custom-mistral-proxy.com',
      } as any;

      expect(() => {
        provider.getModelInstance({
          model: 'mistral-large-latest',
          serverEnv: mockEnv,
        });
      }).toThrow('Missing API key');
    });
  });
});
