import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { modelCapabilitiesDetector, type ModelCapabilities } from '~/lib/services/modelCapabilitiesDetector';
import ModelConfigurationPanel, { type ModelConfiguration } from './ModelConfigurationPanel';

interface ModelManagementDashboardProps {
  provider: string;
  baseUrl: string;
  apiKey?: string;
  models: Array<{ id: string; name: string }>;
  className?: string;
}

interface ModelWithCapabilities {
  id: string;
  name: string;
  capabilities?: ModelCapabilities;
  configuration?: ModelConfiguration;
  isLoading: boolean;
  error?: string;
}

interface ModelCardProps {
  model: ModelWithCapabilities;
  onConfigurationChange: (modelId: string, config: ModelConfiguration) => void;
  onRefreshCapabilities: (modelId: string) => void;
}

function ModelCard({ model, onConfigurationChange, onRefreshCapabilities }: ModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const getStatusColor = () => {
    if (model.isLoading) return 'text-blue-500';
    if (model.error) return 'text-red-500';
    if (model.capabilities?.isVerified) return 'text-green-500';
    return 'text-gray-500';
  };

  const getStatusIcon = () => {
    if (model.isLoading) return 'i-ph:circle-notch animate-spin';
    if (model.error) return 'i-ph:warning-circle';
    if (model.capabilities?.isVerified) return 'i-ph:check-circle';
    return 'i-ph:question';
  };

  const formatResponseTime = (ms?: number) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <motion.div
      className={classNames(
        'border rounded-lg overflow-hidden',
        'bg-bolt-elements-background-depth-2',
        'border-bolt-elements-borderColor'
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Model Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames('w-3 h-3 rounded-full', getStatusColor())}>
              <div className={classNames(getStatusIcon(), 'w-3 h-3')} />
            </div>
            
            <div>
              <h3 className="font-medium text-bolt-elements-textPrimary">
                {model.name}
              </h3>
              {model.capabilities && (
                <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                  {model.capabilities.architecture && (
                    <span>{model.capabilities.architecture}</span>
                  )}
                  {model.capabilities.modelSize && (
                    <span>• {model.capabilities.modelSize}</span>
                  )}
                  {model.capabilities.quantization && (
                    <span>• {model.capabilities.quantization}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {model.capabilities?.averageResponseTime && (
              <span className="text-xs text-bolt-elements-textSecondary">
                {formatResponseTime(model.capabilities.averageResponseTime)}
              </span>
            )}
            
            <button
              onClick={() => onRefreshCapabilities(model.id)}
              disabled={model.isLoading}
              className={classNames(
                'p-1 rounded-md text-xs',
                'hover:bg-bolt-elements-background-depth-3',
                'text-bolt-elements-textSecondary',
                'transition-colors duration-200',
                model.isLoading ? 'opacity-50 cursor-not-allowed' : ''
              )}
              title="Refresh capabilities"
            >
              <div className={classNames(
                'w-3 h-3',
                model.isLoading ? 'i-ph:circle-notch animate-spin' : 'i-ph:arrow-clockwise'
              )} />
            </button>
            
            <button
              onClick={() => setExpanded(!expanded)}
              className={classNames(
                'p-1 rounded-md text-xs',
                'hover:bg-bolt-elements-background-depth-3',
                'text-bolt-elements-textSecondary',
                'transition-all duration-200'
              )}
            >
              <div className={classNames(
                'w-3 h-3 transition-transform duration-200',
                expanded ? 'rotate-180' : '',
                'i-ph:caret-down'
              )} />
            </button>
          </div>
        </div>

        {/* Error Display */}
        {model.error && (
          <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-500">{model.error}</p>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-bolt-elements-borderColor"
          >
            {model.capabilities && (
              <div className="p-4 space-y-4">
                {/* Capabilities Grid */}
                <div>
                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                    Capabilities
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { key: 'supportsChat', label: 'Chat', icon: 'i-ph:chat-circle' },
                      { key: 'supportsStreaming', label: 'Streaming', icon: 'i-ph:lightning' },
                      { key: 'supportsFunctionCalling', label: 'Functions', icon: 'i-ph:function' },
                      { key: 'supportsVision', label: 'Vision', icon: 'i-ph:eye' },
                      { key: 'supportsEmbeddings', label: 'Embeddings', icon: 'i-ph:vector-three' },
                      { key: 'isVerified', label: 'Verified', icon: 'i-ph:shield-check' },
                    ].map(({ key, label, icon }) => (
                      <div
                        key={key}
                        className={classNames(
                          'flex items-center gap-2 px-2 py-1 rounded text-xs',
                          model.capabilities![key as keyof ModelCapabilities]
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-gray-500/10 text-gray-500'
                        )}
                      >
                        <div className={classNames(icon, 'w-3 h-3')} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Model Metadata */}
                {(model.capabilities.memoryRequirements || model.capabilities.contextWindow) && (
                  <div>
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                      Specifications
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {model.capabilities.memoryRequirements && (
                        <div>
                          <span className="text-bolt-elements-textSecondary">Memory:</span>
                          <span className="ml-1 text-bolt-elements-textPrimary">
                            {model.capabilities.memoryRequirements}
                          </span>
                        </div>
                      )}
                      {model.capabilities.contextWindow && (
                        <div>
                          <span className="text-bolt-elements-textSecondary">Context:</span>
                          <span className="ml-1 text-bolt-elements-textPrimary">
                            {model.capabilities.contextWindow.toLocaleString()} tokens
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Validation Warnings */}
                {model.capabilities.validationWarnings && model.capabilities.validationWarnings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                      Warnings
                    </h4>
                    <div className="space-y-1">
                      {model.capabilities.validationWarnings.map((warning, index) => (
                        <div key={index} className="text-xs text-orange-500 bg-orange-500/10 p-2 rounded">
                          {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Configuration Panel Toggle */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    className={classNames(
                      'px-3 py-2 rounded-lg text-sm font-medium',
                      'bg-purple-500/10 text-purple-500',
                      'hover:bg-purple-500/20',
                      'transition-colors duration-200'
                    )}
                  >
                    {showConfig ? 'Hide Configuration' : 'Configure Model'}
                  </button>
                </div>

                {/* Configuration Panel */}
                <AnimatePresence>
                  {showConfig && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-bolt-elements-borderColor pt-4"
                    >
                      <ModelConfigurationPanel
                        modelId={model.id}
                        provider="Local"
                        capabilities={model.capabilities}
                        onConfigurationChange={(config) => onConfigurationChange(model.id, config)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ModelManagementDashboard({
  provider,
  baseUrl,
  apiKey,
  models,
  className
}: ModelManagementDashboardProps) {
  const [modelsWithCapabilities, setModelsWithCapabilities] = useState<ModelWithCapabilities[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize models
  useEffect(() => {
    setModelsWithCapabilities(
      models.map(model => ({
        id: model.id,
        name: model.name,
        isLoading: false,
      }))
    );
  }, [models]);

  // Load capabilities for all models
  const loadAllCapabilities = async () => {
    setIsLoading(true);
    
    const updatedModels = await Promise.allSettled(
      modelsWithCapabilities.map(async (model) => {
        try {
          setModelsWithCapabilities(prev => 
            prev.map(m => m.id === model.id ? { ...m, isLoading: true, error: undefined } : m)
          );

          const capabilities = await modelCapabilitiesDetector.detectCapabilities(
            provider,
            model.id,
            baseUrl,
            apiKey
          );

          return {
            ...model,
            capabilities,
            isLoading: false,
            error: undefined,
          };
        } catch (error) {
          return {
            ...model,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const finalModels = updatedModels.map((result, index) => 
      result.status === 'fulfilled' ? result.value : modelsWithCapabilities[index]
    );

    setModelsWithCapabilities(finalModels);
    setIsLoading(false);
  };

  // Refresh capabilities for a specific model
  const refreshModelCapabilities = async (modelId: string) => {
    const model = modelsWithCapabilities.find(m => m.id === modelId);
    if (!model) return;

    setModelsWithCapabilities(prev => 
      prev.map(m => m.id === modelId ? { ...m, isLoading: true, error: undefined } : m)
    );

    try {
      const capabilities = await modelCapabilitiesDetector.detectCapabilities(
        provider,
        modelId,
        baseUrl,
        apiKey
      );

      setModelsWithCapabilities(prev => 
        prev.map(m => m.id === modelId ? { ...m, capabilities, isLoading: false, error: undefined } : m)
      );
    } catch (error) {
      setModelsWithCapabilities(prev => 
        prev.map(m => m.id === modelId ? { 
          ...m, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } : m)
      );
    }
  };

  // Handle configuration changes
  const handleConfigurationChange = (modelId: string, config: ModelConfiguration) => {
    setModelsWithCapabilities(prev => 
      prev.map(m => m.id === modelId ? { ...m, configuration: config } : m)
    );
  };

  if (models.length === 0) {
    return (
      <div className={classNames(
        'p-8 text-center rounded-lg',
        'bg-bolt-elements-background-depth-2',
        'border border-bolt-elements-borderColor',
        className
      )}>
        <div className="i-ph:robot w-12 h-12 mx-auto text-bolt-elements-textTertiary mb-4" />
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
          No Models Available
        </h3>
        <p className="text-sm text-bolt-elements-textSecondary">
          Make sure your {provider} server is running and has models loaded.
        </p>
      </div>
    );
  }

  return (
    <div className={classNames('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-bolt-elements-textPrimary">
            Model Management
          </h2>
          <p className="text-sm text-bolt-elements-textSecondary">
            {provider} • {models.length} model{models.length !== 1 ? 's' : ''} available
          </p>
        </div>
        
        <button
          onClick={loadAllCapabilities}
          disabled={isLoading}
          className={classNames(
            'px-4 py-2 rounded-lg text-sm font-medium',
            'bg-purple-500/10 text-purple-500',
            'hover:bg-purple-500/20',
            'transition-colors duration-200',
            'flex items-center gap-2',
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          )}
        >
          <div className={classNames(
            'w-4 h-4',
            isLoading ? 'i-ph:circle-notch animate-spin' : 'i-ph:magnifying-glass'
          )} />
          {isLoading ? 'Analyzing...' : 'Analyze All Models'}
        </button>
      </div>

      {/* Models Grid */}
      <div className="space-y-4">
        {modelsWithCapabilities.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onConfigurationChange={handleConfigurationChange}
            onRefreshCapabilities={refreshModelCapabilities}
          />
        ))}
      </div>
    </div>
  );
}
