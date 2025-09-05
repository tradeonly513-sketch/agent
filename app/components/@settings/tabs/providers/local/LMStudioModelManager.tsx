import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { useToast } from '~/components/ui/use-toast';
import { useModelPerformance } from '~/lib/hooks/useModelPerformance';
import ErrorBoundary from './ErrorBoundary';
import { ModelManagerSkeleton } from './LoadingSkeleton';

interface LMStudioModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  // Additional fields we can extract
  isLoaded?: boolean;
  contextLength?: number;
  architecture?: string;
  parameters?: string;
}

interface ModelStatus {
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}

interface LMStudioModelManagerProps {
  baseUrl: string;
  className?: string;
}

export default function LMStudioModelManager({ baseUrl, className }: LMStudioModelManagerProps) {
  const [models, setModels] = useState<LMStudioModel[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { recordMetrics } = useModelPerformance();

  // Normalize base URL - LM Studio server already includes /v1
  const normalizedBaseUrl = baseUrl.includes('/v1') ? baseUrl : baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;

  // Fetch models from LM Studio
  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${normalizedBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'bolt.diy/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from LM Studio');
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
          owned_by: model.owned_by || 'lm-studio',
          // Extract metadata from model ID
          architecture: extractArchitecture(model.id),
          parameters: extractParameters(model.id),
          contextLength: estimateContextLength(model.id),
          isLoaded: true, // If it's in the list, it's loaded
        };
      }).filter(Boolean); // Remove any null entries

      setModels(modelsWithMetadata);
      toast('Successfully loaded LM Studio models');
    } catch (error) {
      console.error('Error fetching LM Studio models:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast(`Failed to fetch LM Studio models: ${errorMessage}`);
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedBaseUrl, toast]);

  // Test model health
  const testModelHealth = useCallback(async (modelId: string): Promise<ModelStatus> => {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'bolt.diy/1.0',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          isHealthy: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
          lastChecked: new Date(),
        };
      }

      const data = await response.json();

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        // Record failed request
        recordMetrics({
          provider: 'LMStudio',
          model: modelId,
          baseUrl: normalizedBaseUrl,
          responseTime,
          success: false,
          error: 'Invalid response format',
        });

        return {
          isHealthy: false,
          responseTime,
          error: 'Invalid response format',
          lastChecked: new Date(),
        };
      }

      // Record successful request
      recordMetrics({
        provider: 'LMStudio',
        model: modelId,
        baseUrl: normalizedBaseUrl,
        responseTime,
        success: true,
      });

      return {
        isHealthy: true,
        responseTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed request
      recordMetrics({
        provider: 'LMStudio',
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
      };
    }
  }, [normalizedBaseUrl, recordMetrics]);

  // Test all models health
  const testAllModelsHealth = useCallback(async () => {
    setIsRefreshing(true);
    const statusPromises = models.map(async (model) => {
      const status = await testModelHealth(model.id);
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
      console.error('Error testing model health:', error);
      toast('Failed to test model health');
    } finally {
      setIsRefreshing(false);
    }
  }, [models, testModelHealth, toast]);

  // Extract architecture from model name
  const extractArchitecture = (modelId: string): string => {
    const id = modelId.toLowerCase();
    if (id.includes('llama')) return 'LLaMA';
    if (id.includes('mistral')) return 'Mistral';
    if (id.includes('phi')) return 'Phi';
    if (id.includes('gemma')) return 'Gemma';
    if (id.includes('qwen')) return 'Qwen';
    if (id.includes('codellama')) return 'Code Llama';
    return 'Unknown';
  };

  // Extract parameter count from model name
  const extractParameters = (modelId: string): string => {
    const match = modelId.match(/(\d+)b/i);
    return match ? `${match[1]}B` : 'Unknown';
  };

  // Estimate context length based on model
  const estimateContextLength = (modelId: string): number => {
    const id = modelId.toLowerCase();
    if (id.includes('32k')) return 32768;
    if (id.includes('16k')) return 16384;
    if (id.includes('8k')) return 8192;
    if (id.includes('4k')) return 4096;
    // Default estimates based on model type
    if (id.includes('llama')) return 4096;
    if (id.includes('mistral')) return 8192;
    if (id.includes('phi')) return 2048;
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
          No Models Loaded
        </h3>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          Make sure LM Studio is running and has models loaded.
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
            LM Studio Models
          </h2>
          <p className="text-sm text-bolt-elements-textSecondary">
            {models.length} model{models.length !== 1 ? 's' : ''} loaded • {baseUrl}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={testAllModelsHealth}
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
              isRefreshing ? 'i-ph:circle-notch animate-spin' : 'i-ph:heart-straight'
            )} />
            {isRefreshing ? 'Testing...' : 'Test Health'}
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
                      {model.parameters && <span>• {model.parameters}</span>}
                      {model.contextLength && <span>• {model.contextLength.toLocaleString()} ctx</span>}
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-bolt-elements-textSecondary">Status:</span>
                        <div className={classNames(
                          'font-medium',
                          status?.isHealthy ? 'text-green-500' : 
                          status?.isHealthy === false ? 'text-red-500' : 'text-gray-500'
                        )}>
                          {status?.isHealthy ? 'Healthy' : 
                           status?.isHealthy === false ? 'Unhealthy' : 'Unknown'}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-bolt-elements-textSecondary">Created:</span>
                        <div className="font-medium text-bolt-elements-textPrimary">
                          {model.created ? new Date(model.created * 1000).toLocaleDateString() : 'Unknown'}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-bolt-elements-textSecondary">Owner:</span>
                        <div className="font-medium text-bolt-elements-textPrimary">
                          {model.owned_by || 'Unknown'}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-bolt-elements-textSecondary">Last Checked:</span>
                        <div className="font-medium text-bolt-elements-textPrimary">
                          {status?.lastChecked ? status.lastChecked.toLocaleTimeString() : 'Never'}
                        </div>
                      </div>
                    </div>

                    {status?.error && (
                      <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
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
