import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { useToast } from '~/components/ui/use-toast';
import { useModelPerformance } from '~/lib/hooks/useModelPerformance';
import ErrorBoundary from './ErrorBoundary';
import { ModelManagerSkeleton } from './LoadingSkeleton';

interface OpenAILikeModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  permission?: any[];
  root?: string;
  parent?: string;
  // Additional fields we can extract
  isAvailable?: boolean;
  contextLength?: number;
  architecture?: string;
  capabilities?: string[];
}

interface ModelStatus {
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
  supportsChat?: boolean;
  supportsCompletion?: boolean;
  supportsStreaming?: boolean;
}

interface OpenAILikeModelManagerProps {
  baseUrl: string;
  apiKey?: string;
  providerName?: string;
  className?: string;
}

export default function OpenAILikeModelManager({ 
  baseUrl, 
  apiKey, 
  providerName = 'OpenAI-like',
  className 
}: OpenAILikeModelManagerProps) {
  const [models, setModels] = useState<OpenAILikeModel[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { recordMetrics } = useModelPerformance();

  // Normalize base URL - OpenAI-compatible APIs use /v1 prefix
  const normalizedBaseUrl = baseUrl.endsWith('/v1') ? baseUrl : baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;

  // Fetch models from OpenAI-like API
  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'bolt.diy/1.0',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${normalizedBaseUrl}/models`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error(`Invalid response format from ${providerName}`);
      }

      const modelsWithMetadata = data.data.map((model: any) => {
        // Ensure we have the required fields
        if (!model.id) {
          console.warn('Model missing ID:', model);
          return null;
        }

        return {
          id: model.id,
          object: model.object || 'model',
          created: model.created || Date.now() / 1000,
          owned_by: model.owned_by || providerName.toLowerCase(),
          permission: model.permission || [],
          root: model.root,
          parent: model.parent,
          // Extract metadata from model ID
          architecture: extractArchitecture(model.id),
          contextLength: estimateContextLength(model.id),
          capabilities: extractCapabilities(model.id),
          isAvailable: true, // If it's in the list, it's available
        };
      }).filter(Boolean); // Remove any null entries

      setModels(modelsWithMetadata);
      toast(`Successfully loaded ${modelsWithMetadata.length} models from ${providerName}`);
    } catch (error) {
      console.error(`Error fetching ${providerName} models:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast(`Failed to fetch ${providerName} models: ${errorMessage}`);
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedBaseUrl, apiKey, providerName, toast]);

  // Test model capabilities
  const testModelCapabilities = useCallback(async (modelId: string): Promise<ModelStatus> => {
    const startTime = Date.now();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'bolt.diy/1.0',
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const status: ModelStatus = {
      isHealthy: false,
      lastChecked: new Date(),
      supportsChat: false,
      supportsCompletion: false,
      supportsStreaming: false,
    };

    try {
      // Test chat completions
      const chatResponse = await fetch(`${normalizedBaseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const responseTime = Date.now() - startTime;
      status.responseTime = responseTime;

      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        if (chatData.choices && Array.isArray(chatData.choices) && chatData.choices.length > 0) {
          status.supportsChat = true;
          status.isHealthy = true;

          // Record successful chat request
          recordMetrics({
            provider: 'OpenAILike',
            model: modelId,
            baseUrl: normalizedBaseUrl,
            responseTime,
            success: true,
          });
        }
      } else {
        // Record failed chat request
        recordMetrics({
          provider: 'OpenAILike',
          model: modelId,
          baseUrl: normalizedBaseUrl,
          responseTime,
          success: false,
          error: `HTTP ${chatResponse.status}: ${chatResponse.statusText}`,
        });
      }

      // Test streaming if chat works
      if (status.supportsChat) {
        try {
          const streamResponse = await fetch(`${normalizedBaseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: modelId,
              messages: [{ role: 'user', content: 'Hi' }],
              max_tokens: 5,
              stream: true,
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (streamResponse.ok) {
            const contentType = streamResponse.headers.get('content-type');
            status.supportsStreaming = contentType?.includes('text/event-stream') || 
                                     contentType?.includes('application/x-ndjson') || false;
          }
        } catch {
          // Streaming test failed, but that's okay
        }
      }

      // Test completions endpoint
      try {
        const completionResponse = await fetch(`${normalizedBaseUrl}/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelId,
            prompt: 'Hello',
            max_tokens: 5,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (completionResponse.ok) {
          const completionData = await completionResponse.json();
          if (completionData.choices && Array.isArray(completionData.choices) && completionData.choices.length > 0) {
            status.supportsCompletion = true;
            if (!status.isHealthy) {
              status.isHealthy = true;
            }
          }
        }
      } catch {
        // Completion test failed, but that's okay if chat works
      }

      if (!status.isHealthy) {
        status.error = 'Model does not respond to chat or completion requests';
      }

      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed request
      recordMetrics({
        provider: 'OpenAILike',
        model: modelId,
        baseUrl: normalizedBaseUrl,
        responseTime,
        success: false,
        error: errorMessage,
      });

      return {
        isHealthy: false,
        responseTime,
        error: errorMessage,
        lastChecked: new Date(),
        supportsChat: false,
        supportsCompletion: false,
        supportsStreaming: false,
      };
    }
  }, [normalizedBaseUrl, apiKey, recordMetrics]);

  // Test all models capabilities
  const testAllModelsCapabilities = useCallback(async () => {
    setIsRefreshing(true);
    const statusPromises = models.map(async (model) => {
      const status = await testModelCapabilities(model.id);
      return { modelId: model.id, status };
    });

    try {
      const results = await Promise.all(statusPromises);
      const newStatuses: Record<string, ModelStatus> = {};
      
      results.forEach(({ modelId, status }) => {
        newStatuses[modelId] = status;
      });
      
      setModelStatuses(newStatuses);
    } catch (error) {
      console.error('Error testing model capabilities:', error);
      toast('Failed to test model capabilities');
    } finally {
      setIsRefreshing(false);
    }
  }, [models, testModelCapabilities, toast]);

  // Extract architecture from model name
  const extractArchitecture = (modelId: string): string => {
    const id = modelId.toLowerCase();
    if (id.includes('gpt-4')) return 'GPT-4';
    if (id.includes('gpt-3.5')) return 'GPT-3.5';
    if (id.includes('gpt-3')) return 'GPT-3';
    if (id.includes('claude')) return 'Claude';
    if (id.includes('llama')) return 'LLaMA';
    if (id.includes('mistral')) return 'Mistral';
    if (id.includes('gemini')) return 'Gemini';
    if (id.includes('palm')) return 'PaLM';
    return 'Unknown';
  };

  // Extract capabilities from model name
  const extractCapabilities = (modelId: string): string[] => {
    const capabilities: string[] = [];
    const id = modelId.toLowerCase();
    
    if (id.includes('vision') || id.includes('v')) capabilities.push('Vision');
    if (id.includes('code') || id.includes('codex')) capabilities.push('Code');
    if (id.includes('instruct') || id.includes('chat')) capabilities.push('Chat');
    if (id.includes('embedding')) capabilities.push('Embeddings');
    if (id.includes('function') || id.includes('tool')) capabilities.push('Functions');
    
    return capabilities;
  };

  // Estimate context length based on model
  const estimateContextLength = (modelId: string): number => {
    const id = modelId.toLowerCase();
    if (id.includes('128k')) return 128000;
    if (id.includes('32k')) return 32768;
    if (id.includes('16k')) return 16384;
    if (id.includes('8k')) return 8192;
    if (id.includes('4k')) return 4096;
    
    // Default estimates based on model type
    if (id.includes('gpt-4')) return 8192;
    if (id.includes('gpt-3.5')) return 4096;
    if (id.includes('claude')) return 100000;
    if (id.includes('gemini')) return 32768;
    
    return 4096;
  };

  // Format response time
  const formatResponseTime = (ms: number): string => {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  // Load models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  if (isLoading) {
    return <ModelManagerSkeleton className={className} />;
  }

  if (models.length === 0) {
    return (
      <div className={classNames(
        'p-8 text-center rounded-lg border border-bolt-elements-borderColor',
        'bg-bolt-elements-background-depth-2',
        className
      )}>
        <div className="i-ph:robot w-12 h-12 mx-auto text-bolt-elements-textTertiary mb-4" />
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
          No Models Available
        </h3>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          Make sure {providerName} is accessible and properly configured.
        </p>
        <button
          onClick={fetchModels}
          className={classNames(
            'px-4 py-2 rounded-lg text-sm font-medium',
            'bg-bolt-elements-button-primary-background',
            'text-bolt-elements-button-primary-text',
            'hover:bg-bolt-elements-button-primary-backgroundHover',
            'transition-colors duration-200'
          )}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={classNames('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-bolt-elements-textPrimary">
            {providerName} Models
          </h2>
          <p className="text-sm text-bolt-elements-textSecondary">
            {models.length} model{models.length !== 1 ? 's' : ''} available • {baseUrl}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={testAllModelsCapabilities}
            disabled={isRefreshing}
            className={classNames(
              'px-3 py-2 rounded-lg text-sm font-medium',
              'bg-bolt-elements-background-depth-3',
              'hover:bg-bolt-elements-background-depth-4',
              'text-bolt-elements-textPrimary',
              'transition-colors duration-200',
              'flex items-center gap-2',
              isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
            )}
          >
            <div className={classNames(
              'w-4 h-4',
              isRefreshing ? 'i-ph:circle-notch animate-spin' : 'i-ph:flask'
            )} />
            {isRefreshing ? 'Testing...' : 'Test Capabilities'}
          </button>
          
          <button
            onClick={fetchModels}
            disabled={isLoading}
            className={classNames(
              'px-3 py-2 rounded-lg text-sm font-medium',
              'bg-bolt-elements-background-depth-3',
              'hover:bg-bolt-elements-background-depth-4',
              'text-bolt-elements-textPrimary',
              'transition-colors duration-200',
              'flex items-center gap-2',
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            )}
          >
            <div className={classNames(
              'w-4 h-4',
              isLoading ? 'i-ph:circle-notch animate-spin' : 'i-ph:arrow-clockwise'
            )} />
            Refresh
          </button>
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid gap-4">
        {models.map((model) => {
          const status = modelStatuses[model.id];
          const isSelected = selectedModel === model.id;
          
          return (
            <motion.div
              key={model.id}
              className={classNames(
                'border rounded-lg p-4 cursor-pointer',
                'bg-bolt-elements-background-depth-2',
                'border-bolt-elements-borderColor',
                'hover:border-bolt-elements-borderColorHover',
                'transition-all duration-200',
                isSelected ? 'ring-2 ring-bolt-elements-focus' : ''
              )}
              onClick={() => setSelectedModel(isSelected ? null : model.id)}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Status Indicator */}
                  <div className={classNames(
                    'w-3 h-3 rounded-full',
                    status?.isHealthy ? 'bg-green-500' : 
                    status?.isHealthy === false ? 'bg-red-500' : 'bg-gray-500'
                  )} />
                  
                  <div>
                    <h3 className="font-medium text-bolt-elements-textPrimary">
                      {model.id}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                      {model.architecture && <span>{model.architecture}</span>}
                      {model.contextLength && <span>• {model.contextLength.toLocaleString()} ctx</span>}
                      {model.capabilities && model.capabilities.length > 0 && (
                        <span>• {model.capabilities.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {status?.responseTime && (
                    <span className="text-xs text-bolt-elements-textSecondary">
                      {formatResponseTime(status.responseTime)}
                    </span>
                  )}
                  
                  <div className={classNames(
                    'w-4 h-4 transition-transform duration-200',
                    isSelected ? 'rotate-180' : '',
                    'i-ph:caret-down text-bolt-elements-textSecondary'
                  )} />
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 pt-4 border-t border-bolt-elements-borderColor"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-bolt-elements-textSecondary">Status:</span>
                        <div className={classNames(
                          'font-medium',
                          status?.isHealthy ? 'text-green-500' : 
                          status?.isHealthy === false ? 'text-red-500' : 'text-gray-500'
                        )}>
                          {status?.isHealthy ? 'Available' : 
                           status?.isHealthy === false ? 'Unavailable' : 'Unknown'}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-bolt-elements-textSecondary">Chat Support:</span>
                        <div className={classNames(
                          'font-medium',
                          status?.supportsChat ? 'text-green-500' : 'text-gray-500'
                        )}>
                          {status?.supportsChat ? 'Yes' : 'Unknown'}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-bolt-elements-textSecondary">Streaming:</span>
                        <div className={classNames(
                          'font-medium',
                          status?.supportsStreaming ? 'text-green-500' : 'text-gray-500'
                        )}>
                          {status?.supportsStreaming ? 'Yes' : 'Unknown'}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-bolt-elements-textSecondary">Owner:</span>
                        <div className="font-medium text-bolt-elements-textPrimary">
                          {model.owned_by || 'Unknown'}
                        </div>
                      </div>
                    </div>

                    {status?.error && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-500">{status.error}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      </div>
    </ErrorBoundary>
  );
}
