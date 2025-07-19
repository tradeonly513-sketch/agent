import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import type { ProviderInfo } from '~/types/model';

interface ProviderValidationResult {
  isValid: boolean;
  configuredProviders: ProviderInfo[];
  recommendedProvider: ProviderInfo | null;
  missingKeys: string[];
}

/**
 * Hook to validate provider configurations and suggest alternatives
 */
export function useProviderValidation() {
  const [validationResult, setValidationResult] = useState<ProviderValidationResult>({
    isValid: true,
    configuredProviders: [],
    recommendedProvider: null,
    missingKeys: [],
  });

  useEffect(() => {
    validateProviders();
  }, []);

  const validateProviders = async () => {
    try {
      const configuredProviders: ProviderInfo[] = [];
      const missingKeys: string[] = [];

      // Check each provider for API key configuration
      for (const provider of PROVIDER_LIST) {
        const isConfigured = await checkProviderConfiguration(provider);
        
        if (isConfigured) {
          configuredProviders.push(provider);
        } else if (provider.config?.apiTokenKey) {
          missingKeys.push(`${provider.name} (${provider.config.apiTokenKey})`);
        }
      }

      // Check if default provider is configured
      const isDefaultConfigured = configuredProviders.some(p => p.name === DEFAULT_PROVIDER.name);

      const result: ProviderValidationResult = {
        isValid: isDefaultConfigured,
        configuredProviders,
        recommendedProvider: configuredProviders.length > 0 ? configuredProviders[0] : null,
        missingKeys,
      };

      setValidationResult(result);

      // Show warning if default provider is not configured
      if (!isDefaultConfigured && configuredProviders.length > 0) {
        console.warn(
          `Default provider ${DEFAULT_PROVIDER.name} is not configured. ` +
          `Recommended: ${configuredProviders[0].name}`
        );
      } else if (configuredProviders.length === 0) {
        console.warn('No providers are configured with API keys');
      }

    } catch (error) {
      console.error('Provider validation failed:', error);
    }
  };

  const checkProviderConfiguration = async (provider: ProviderInfo): Promise<boolean> => {
    try {
      // Local providers don't need API keys
      const localProviders = ['ollama', 'lmstudio'];
      if (localProviders.includes(provider.name.toLowerCase())) {
        return true;
      }

      // Check if provider requires API key
      if (!provider.config?.apiTokenKey) {
        return false;
      }

      // Check if API key is available (this is a simplified check)
      // In a real implementation, you might want to make a test API call
      const apiKeyEnvVar = provider.config.apiTokenKey;
      
      // Check localStorage for API keys (client-side storage)
      const storedApiKeys = localStorage.getItem('apiKeys');
      if (storedApiKeys) {
        const apiKeys = JSON.parse(storedApiKeys);
        return !!(apiKeys[provider.name] && apiKeys[provider.name].trim().length > 0);
      }

      return false;
    } catch (error) {
      console.warn(`Error checking configuration for ${provider.name}:`, error);
      return false;
    }
  };

  const showProviderConfigurationHelp = () => {
    const { configuredProviders, missingKeys } = validationResult;

    if (configuredProviders.length === 0) {
      toast.error(
        '⚠️ No AI providers are configured! Please add API keys in Settings to use the chat feature.',
        { autoClose: 10000 }
      );
    } else if (missingKeys.length > 0) {
      toast.info(
        `💡 You can configure additional providers: ${missingKeys.slice(0, 3).join(', ')}${missingKeys.length > 3 ? '...' : ''}`,
        { autoClose: 8000 }
      );
    }
  };

  const getRecommendedProvider = (): ProviderInfo | null => {
    return validationResult.recommendedProvider;
  };

  const isProviderConfigured = (providerName: string): boolean => {
    return validationResult.configuredProviders.some(p => p.name === providerName);
  };

  return {
    validationResult,
    validateProviders,
    showProviderConfigurationHelp,
    getRecommendedProvider,
    isProviderConfigured,
  };
}
