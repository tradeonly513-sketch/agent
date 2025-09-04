import React, { useState, useMemo, useCallback } from 'react';
import { useMCPStore } from '~/lib/stores/mcp';
import { Button } from '~/components/ui/Button';
import { Badge } from '~/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import {
  Brain,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Zap,
  Clock,
  Settings,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getCapabilitySummary,
  getRecommendedModelsForServer,
  getModelCapability,
  MCP_SERVER_MODEL_RECOMMENDATIONS,
  MODEL_CAPABILITIES,
  type ToolCallingCapability,
} from '~/lib/services/model-capabilities';
import type { MCPServer } from '~/lib/services/mcpService';

// Provider list - this should be imported from a shared constant
const PROVIDERS = [
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Anthropic', label: 'Anthropic' },
  { value: 'Google', label: 'Google' },
  { value: 'xAI', label: 'xAI' },
  { value: 'Deepseek', label: 'DeepSeek' },
  { value: 'Mistral', label: 'Mistral' },
  { value: 'Groq', label: 'Groq' },
];

// Filter models by tool calling capability
const getToolCallingModelsForProvider = (
  providerName: string,
  minCapability: ToolCallingCapability = 'good',
): Array<{ model: string; capability: ToolCallingCapability; reliability: number }> => {
  const providerModels = MODEL_CAPABILITIES[providerName];

  if (!providerModels) {
    return [];
  }

  const capabilityOrder = { excellent: 4, good: 3, limited: 2, poor: 1 };
  const minLevel = capabilityOrder[minCapability];

  return Object.entries(providerModels)
    .filter(([_, info]) => capabilityOrder[info.toolCalling] >= minLevel)
    .map(([model, info]) => ({
      model,
      capability: info.toolCalling,
      reliability: info.reliability,
    }))
    .sort((a, b) => {
      // Sort by capability first, then reliability
      const capabilityDiff = capabilityOrder[b.capability] - capabilityOrder[a.capability];

      if (capabilityDiff !== 0) {
        return capabilityDiff;
      }

      return b.reliability - a.reliability;
    });
};

// Get all tool calling capable models for provider
const PROVIDER_TOOL_CALLING_MODELS: Record<string, string[]> = {
  OpenAI: getToolCallingModelsForProvider('OpenAI').map((m) => m.model),
  Anthropic: getToolCallingModelsForProvider('Anthropic').map((m) => m.model),
  Google: getToolCallingModelsForProvider('Google').map((m) => m.model),
  xAI: getToolCallingModelsForProvider('xAI').map((m) => m.model),
  Deepseek: getToolCallingModelsForProvider('Deepseek').map((m) => m.model),
  Mistral: getToolCallingModelsForProvider('Mistral').map((m) => m.model),
  Groq: getToolCallingModelsForProvider('Groq', 'limited').map((m) => m.model), // Include limited for Groq as they're fast
};

interface ModelConfigurationTabProps {
  serverTools: Record<string, MCPServer>;
}

export default function ModelConfigurationTab({ serverTools }: ModelConfigurationTabProps) {
  const settings = useMCPStore((state) => state.settings);
  const setServerModel = useMCPStore((state) => state.setServerModel);
  const removeServerModel = useMCPStore((state) => state.removeServerModel);
  const setGlobalFallbackModel = useMCPStore((state) => state.setGlobalFallbackModel);

  const [selectedProvider, setSelectedProvider] = useState<string>('OpenAI');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [serverSpecificProvider, setServerSpecificProvider] = useState<Record<string, string>>({});
  const [serverSpecificModel, setServerSpecificModel] = useState<Record<string, string>>({});

  const serverEntries = useMemo(() => Object.entries(serverTools), [serverTools]);

  // Get smart recommendation for a server
  const getSmartRecommendation = useCallback(
    (serverName: string): { provider: string; model: string; reasoning: string } | null => {
      const recommendations = getRecommendedModelsForServer(serverName, 'excellent');

      if (recommendations.length === 0) {
        return null;
      }

      const firstModel = recommendations[0];
      let provider = 'OpenAI';

      // Map model to provider
      if (firstModel.startsWith('claude')) {
        provider = 'Anthropic';
      } else if (firstModel.startsWith('gemini')) {
        provider = 'Google';
      } else if (firstModel.startsWith('grok')) {
        provider = 'xAI';
      } else if (firstModel.startsWith('deepseek')) {
        provider = 'Deepseek';
      } else if (firstModel.startsWith('mistral')) {
        provider = 'Mistral';
      }

      const serverType = Object.keys(MCP_SERVER_MODEL_RECOMMENDATIONS).find((type) =>
        serverName.toLowerCase().includes(type),
      );

      return {
        provider,
        model: firstModel,
        reasoning: serverType ? `Optimized for ${serverType} server operations` : 'General purpose optimization',
      };
    },
    [],
  );

  // Auto-configure optimal models for all servers
  const handleAutoConfigureAll = useCallback(async () => {
    const promises = serverEntries.map(async ([serverName]) => {
      const recommendation = getSmartRecommendation(serverName);

      if (recommendation) {
        try {
          await setServerModel(serverName, {
            provider: recommendation.provider,
            model: recommendation.model,
            enabled: true,
          });
        } catch (error) {
          console.error(`Failed to set model for ${serverName}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
    toast.success('Auto-configured optimal models for all servers');
  }, [serverEntries, setServerModel, getSmartRecommendation]);

  // Get provider/model for server-specific selection
  const getServerProvider = useCallback(
    (serverName: string) => {
      return serverSpecificProvider[serverName] || selectedProvider;
    },
    [serverSpecificProvider, selectedProvider],
  );

  const getServerModel = useCallback(
    (serverName: string) => {
      return serverSpecificModel[serverName] || selectedModel;
    },
    [serverSpecificModel, selectedModel],
  );

  const setServerProvider = useCallback((serverName: string, provider: string) => {
    setServerSpecificProvider((prev) => ({ ...prev, [serverName]: provider }));

    // Reset model when provider changes
    const availableModels = PROVIDER_TOOL_CALLING_MODELS[provider] || [];

    if (availableModels.length > 0) {
      setServerSpecificModel((prev) => ({ ...prev, [serverName]: availableModels[0] }));
    }
  }, []);

  const setServerModelForServer = useCallback((serverName: string, model: string) => {
    setServerSpecificModel((prev) => ({ ...prev, [serverName]: model }));
  }, []);

  // Validate model selection and show warnings
  const validateModelSelection = useCallback((provider: string, model: string) => {
    const capability = getModelCapability(provider, model);

    if (!capability) {
      return {
        isValid: false,
        warning: 'Model not found in capability matrix - tool calling support unknown',
        severity: 'error' as const,
      };
    }

    if (capability.toolCalling === 'poor') {
      return {
        isValid: false,
        warning: 'This model has poor tool calling capabilities and may not work reliably with MCP servers',
        severity: 'error' as const,
      };
    }

    if (capability.toolCalling === 'limited') {
      return {
        isValid: true,
        warning:
          'This model has limited tool calling capabilities. May work for simple operations but avoid complex workflows',
        severity: 'warning' as const,
      };
    }

    const warnings = [];

    if (!capability.multiStepWorkflows) {
      warnings.push('May struggle with multi-step workflows');
    }

    if (!capability.complexParameters) {
      warnings.push('May have difficulty with complex tool parameters');
    }

    return {
      isValid: true,
      warning: warnings.length > 0 ? warnings.join(', ') : null,
      severity: warnings.length > 0 ? ('info' as const) : null,
    };
  }, []);

  // Enhanced model setting with validation
  const handleSetServerModelWithValidation = useCallback(
    async (serverName: string, provider: string, model: string) => {
      const validation = validateModelSelection(provider, model);

      if (!validation.isValid && validation.severity === 'error') {
        toast.error(`Cannot set model: ${validation.warning}`);
        return;
      }

      if (validation.warning && validation.severity === 'warning') {
        toast.warning(`Warning: ${validation.warning}`);
      }

      try {
        await setServerModel(serverName, { provider, model, enabled: true });
        toast.success(`Set model for "${serverName}"`);

        if (validation.warning && validation.severity === 'info') {
          toast.info(validation.warning);
        }
      } catch (error) {
        toast.error(`Failed to set model: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [setServerModel, validateModelSelection],
  );

  // Bulk configuration functions
  const handleBulkConfigureByServerType = useCallback(
    async (serverType: string) => {
      const serversOfType = serverEntries.filter(([name]) => name.toLowerCase().includes(serverType.toLowerCase()));

      if (serversOfType.length === 0) {
        toast.info(`No servers of type "${serverType}" found`);
        return;
      }

      const recommendations =
        MCP_SERVER_MODEL_RECOMMENDATIONS[serverType as keyof typeof MCP_SERVER_MODEL_RECOMMENDATIONS];

      if (!recommendations) {
        toast.error(`No recommendations available for server type "${serverType}"`);
        return;
      }

      const bestModel = recommendations.excellent[0];
      let provider = 'OpenAI';

      if (bestModel.startsWith('claude')) {
        provider = 'Anthropic';
      } else if (bestModel.startsWith('gemini')) {
        provider = 'Google';
      } else if (bestModel.startsWith('grok')) {
        provider = 'xAI';
      } else if (bestModel.startsWith('deepseek')) {
        provider = 'Deepseek';
      } else if (bestModel.startsWith('mistral')) {
        provider = 'Mistral';
      }

      const promises = serversOfType.map(async ([serverName]) => {
        try {
          await setServerModel(serverName, { provider, model: bestModel, enabled: true });
        } catch (error) {
          console.error(`Failed to set model for ${serverName}:`, error);
        }
      });

      await Promise.allSettled(promises);
      toast.success(`Configured ${serversOfType.length} ${serverType} servers with ${provider}/${bestModel}`);
    },
    [serverEntries, setServerModel],
  );

  const handleRemoveServerModel = async (serverName: string) => {
    try {
      await removeServerModel(serverName);
      toast.success(`Removed custom model for "${serverName}"`);
    } catch (error) {
      toast.error(`Failed to remove model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSetGlobalFallback = async () => {
    try {
      await setGlobalFallbackModel({ provider: selectedProvider, model: selectedModel, enabled: true });
      toast.success('Updated global fallback model');
    } catch (error) {
      toast.error(`Failed to set global fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getCapabilityBadge = (provider: string, model: string) => {
    const summary = getCapabilitySummary(provider, model);

    const badgeProps = {
      success: { className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
      warning: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
      error: { className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
      neutral: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' },
    };

    const IconComponent = {
      success: CheckCircle,
      warning: AlertTriangle,
      error: XCircle,
      neutral: Info,
    }[summary.badge];

    return (
      <Badge variant="secondary" className={`flex items-center gap-1 ${badgeProps[summary.badge].className}`}>
        <IconComponent className="w-3 h-3" />
        {summary.summary}
      </Badge>
    );
  };

  const getRecommendationBadges = (serverName: string) => {
    const serverType = Object.keys(MCP_SERVER_MODEL_RECOMMENDATIONS).find((type) =>
      serverName.toLowerCase().includes(type),
    ) as keyof typeof MCP_SERVER_MODEL_RECOMMENDATIONS;

    if (!serverType) {
      return null;
    }

    const recommendations = MCP_SERVER_MODEL_RECOMMENDATIONS[serverType];

    return (
      <div className="flex flex-wrap gap-1">
        <Badge variant="subtle" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Excellent: {recommendations.excellent.join(', ')}
        </Badge>
        <Badge variant="subtle" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          Good: {recommendations.good.join(', ')}
        </Badge>
        <Badge variant="subtle" className="text-xs bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
          Budget: {recommendations.budget.join(', ')}
        </Badge>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Global Fallback Model Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Global Fallback Model
          </CardTitle>
          <p className="text-sm text-bolt-elements-textSecondary">
            Default model used when no server-specific model is configured
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">Provider</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {(PROVIDER_TOOL_CALLING_MODELS[selectedProvider] || []).map((model) => {
                    const modelInfo = getToolCallingModelsForProvider(selectedProvider).find((m) => m.model === model);
                    return (
                      <SelectItem key={model} value={model}>
                        <div className="flex items-center justify-between w-full">
                          <span>{model}</span>
                          {modelInfo && (
                            <Badge
                              variant="secondary"
                              className={`ml-2 text-xs ${
                                modelInfo.capability === 'excellent'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                  : modelInfo.capability === 'good'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                              }`}
                            >
                              {modelInfo.capability}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSetGlobalFallback} className="w-full">
                Update Fallback
              </Button>
            </div>
          </div>

          {settings.globalFallbackModel && (
            <div className="p-3 bg-bolt-elements-background-depth-1 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">
                    Current: {settings.globalFallbackModel.provider} / {settings.globalFallbackModel.model}
                  </span>
                  <div className="mt-1">
                    {getCapabilityBadge(settings.globalFallbackModel.provider, settings.globalFallbackModel.model)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Configuration Section */}
      {serverEntries.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Bulk Configuration
            </CardTitle>
            <p className="text-sm text-bolt-elements-textSecondary">
              Configure multiple servers of the same type with optimal models
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.keys(MCP_SERVER_MODEL_RECOMMENDATIONS).map((serverType) => {
                const serversOfType = serverEntries.filter(([name]) =>
                  name.toLowerCase().includes(serverType.toLowerCase()),
                ).length;

                if (serversOfType === 0) {
                  return null;
                }

                const recommendation =
                  MCP_SERVER_MODEL_RECOMMENDATIONS[serverType as keyof typeof MCP_SERVER_MODEL_RECOMMENDATIONS]
                    .excellent[0];
                let provider = 'OpenAI';

                if (recommendation.startsWith('claude')) {
                  provider = 'Anthropic';
                } else if (recommendation.startsWith('gemini')) {
                  provider = 'Google';
                } else if (recommendation.startsWith('grok')) {
                  provider = 'xAI';
                } else if (recommendation.startsWith('deepseek')) {
                  provider = 'Deepseek';
                } else if (recommendation.startsWith('mistral')) {
                  provider = 'Mistral';
                }

                return (
                  <div
                    key={serverType}
                    className="p-3 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-1"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm capitalize">{serverType} Servers</div>
                      <Badge variant="secondary" className="text-xs">
                        {serversOfType}
                      </Badge>
                    </div>
                    <div className="text-xs text-bolt-elements-textSecondary mb-3">
                      Recommended:{' '}
                      <code className="bg-bolt-elements-background-depth-2 px-1 rounded">
                        {provider}/{recommendation}
                      </code>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => handleBulkConfigureByServerType(serverType)}
                    >
                      Configure {serversOfType} {serverType} server{serversOfType !== 1 ? 's' : ''}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-bolt-elements-borderColor">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-bolt-elements-textSecondary">Quick Actions</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleAutoConfigureAll}>
                    <Zap className="w-3 h-3 mr-1" />
                    Auto-Configure All ({serverEntries.length})
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Server-Specific Model Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Server-Specific Models
              </CardTitle>
              <p className="text-sm text-bolt-elements-textSecondary">
                Configure custom models for specific MCP servers to optimize performance
              </p>
            </div>
            {serverEntries.length > 0 && (
              <Button
                onClick={handleAutoConfigureAll}
                className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundActive"
                size="sm"
              >
                <Zap className="w-4 h-4 mr-2" />
                Auto-Configure All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {serverEntries.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="w-8 h-8 text-bolt-elements-textTertiary mx-auto mb-3" />
              <h3 className="text-sm font-medium text-bolt-elements-textSecondary">No MCP Servers</h3>
              <p className="text-xs text-bolt-elements-textTertiary">Add MCP servers first to configure their models</p>
            </div>
          ) : (
            <div className="space-y-4">
              {serverEntries.map(([serverName, server]) => {
                const currentMapping = settings.serverModelMappings[serverName];
                const isEnabled = settings.enabledServers[serverName] !== false;

                return (
                  <div
                    key={serverName}
                    className={`p-4 border rounded-lg ${
                      isEnabled
                        ? 'bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor'
                        : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-bolt-elements-textPrimary">{serverName}</h3>
                          <Badge
                            variant={server.status === 'available' ? 'default' : 'secondary'}
                            className={
                              server.status === 'available'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            }
                          >
                            {server.status}
                          </Badge>
                          {!isEnabled && (
                            <Badge
                              variant="secondary"
                              className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            >
                              Disabled
                            </Badge>
                          )}
                        </div>

                        {/* Smart Recommendation */}
                        {(() => {
                          const recommendation = getSmartRecommendation(serverName);
                          return recommendation &&
                            (!currentMapping ||
                              currentMapping.provider !== recommendation.provider ||
                              currentMapping.model !== recommendation.model) ? (
                            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                                    Recommended: {recommendation.provider} / {recommendation.model}
                                  </div>
                                  <div className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                                    {recommendation.reasoning}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
                                    onClick={() =>
                                      handleSetServerModelWithValidation(
                                        serverName,
                                        recommendation.provider,
                                        recommendation.model,
                                      )
                                    }
                                    disabled={!isEnabled}
                                  >
                                    Apply Recommendation
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Current Model */}
                        {currentMapping ? (
                          <div className="mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium">Custom Model:</span>
                              <code className="px-2 py-1 bg-bolt-elements-background-depth-2 rounded text-sm">
                                {currentMapping.provider} / {currentMapping.model}
                              </code>
                              {getCapabilityBadge(currentMapping.provider, currentMapping.model)}
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3">
                            <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                              <RotateCcw className="w-4 h-4" />
                              Using global fallback model
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-bolt-elements-textSecondary mb-2">
                            Recommended Models:
                          </h4>
                          {getRecommendationBadges(serverName)}
                        </div>

                        {/* Model Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Select
                            value={getServerProvider(serverName)}
                            onValueChange={(value) => setServerProvider(serverName, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Provider" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROVIDERS.filter(
                                (provider) =>
                                  PROVIDER_TOOL_CALLING_MODELS[provider.value] &&
                                  PROVIDER_TOOL_CALLING_MODELS[provider.value].length > 0,
                              ).map((provider) => (
                                <SelectItem key={provider.value} value={provider.value}>
                                  <div className="flex items-center gap-2">
                                    {provider.label}
                                    <Badge variant="secondary" className="text-xs">
                                      {PROVIDER_TOOL_CALLING_MODELS[provider.value]?.length || 0} models
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={getServerModel(serverName)}
                            onValueChange={(value) => setServerModelForServer(serverName, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Model" />
                            </SelectTrigger>
                            <SelectContent>
                              {(PROVIDER_TOOL_CALLING_MODELS[getServerProvider(serverName)] || []).map((model) => {
                                const modelInfo = getToolCallingModelsForProvider(getServerProvider(serverName)).find(
                                  (m) => m.model === model,
                                );
                                const isRecommended = getRecommendedModelsForServer(serverName, 'excellent').includes(
                                  model,
                                );

                                return (
                                  <SelectItem key={model} value={model}>
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center gap-2">
                                        {isRecommended && <Zap className="w-3 h-3 text-yellow-500" />}
                                        <span>{model}</span>
                                      </div>
                                      {modelInfo && (
                                        <Badge
                                          variant="secondary"
                                          className={`ml-2 text-xs ${
                                            modelInfo.capability === 'excellent'
                                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                              : modelInfo.capability === 'good'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                                          }`}
                                        >
                                          {modelInfo.capability}
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {/* Model Validation Display */}
                          {(() => {
                            const validation = validateModelSelection(
                              getServerProvider(serverName),
                              getServerModel(serverName),
                            );
                            return validation.warning ? (
                              <div
                                className={`mt-2 p-2 rounded text-xs ${
                                  validation.severity === 'error'
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                    : validation.severity === 'warning'
                                      ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
                                      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  {validation.severity === 'error' ? (
                                    <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  ) : validation.severity === 'warning' ? (
                                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  )}
                                  <span>{validation.warning}</span>
                                </div>
                              </div>
                            ) : null;
                          })()}

                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleSetServerModelWithValidation(
                                  serverName,
                                  getServerProvider(serverName),
                                  getServerModel(serverName),
                                )
                              }
                              disabled={
                                !isEnabled ||
                                !validateModelSelection(getServerProvider(serverName), getServerModel(serverName))
                                  .isValid
                              }
                              className="flex-1"
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Set Model
                            </Button>
                            {currentMapping && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveServerModel(serverName)}
                                disabled={!isEnabled}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Tool Calling Optimization Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Capability Levels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Excellent Models</span>
                  </div>
                  <p className="text-bolt-elements-textTertiary text-xs">
                    Perfect for complex multi-step workflows, reliable tool execution, and sophisticated parameter
                    handling
                  </p>
                  <div className="text-xs text-bolt-elements-textTertiary">
                    <strong>Best for:</strong> GitHub operations, complex file management, database queries
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Good Models</span>
                  </div>
                  <p className="text-bolt-elements-textTertiary text-xs">
                    Reliable for most operations with occasional limitations on complex workflows
                  </p>
                  <div className="text-xs text-bolt-elements-textTertiary">
                    <strong>Best for:</strong> File operations, shell commands, simple database queries
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Provider Specializations</span>
                  </div>
                  <div className="space-y-1 text-xs text-bolt-elements-textTertiary">
                    <div>
                      <strong>DeepSeek:</strong> Excellent for code/git servers, cost-effective, single-turn operations
                    </div>
                    <div>
                      <strong>xAI Grok:</strong> Native tool use, multi-step workflows, real-time capabilities
                    </div>
                    <div>
                      <strong>OpenAI GPT-4o:</strong> Most reliable, best for complex operations
                    </div>
                    <div>
                      <strong>Claude 3.5:</strong> Excellent file operations and structured data
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Performance Tips</span>
                  </div>
                  <div className="text-xs text-bolt-elements-textTertiary">
                    Use auto-configure for optimal settings, match model strengths to server types, monitor tool success
                    rates
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-bolt-elements-borderColor">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-bolt-elements-textSecondary">
                  Need help choosing? Try our recommendations
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleAutoConfigureAll}>
                    <Zap className="w-3 h-3 mr-1" />
                    Auto-Configure All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
