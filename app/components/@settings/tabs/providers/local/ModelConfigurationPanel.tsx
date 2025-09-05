import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import type { ModelCapabilities } from '~/lib/services/modelCapabilitiesDetector';

interface ModelConfigurationPanelProps {
  modelId: string;
  provider: string;
  capabilities?: ModelCapabilities;
  onConfigurationChange?: (config: ModelConfiguration) => void;
  className?: string;
}

export interface ModelConfiguration {
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  streamingEnabled: boolean;
  functionCallingEnabled: boolean;
}

const DEFAULT_CONFIG: ModelConfiguration = {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2048,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  streamingEnabled: true,
  functionCallingEnabled: false,
};

interface ConfigSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function ConfigSlider({ label, value, min, max, step, description, onChange, disabled }: ConfigSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-bolt-elements-textPrimary">{label}</label>
        <span className="text-sm text-bolt-elements-textSecondary bg-bolt-elements-background-depth-3 px-2 py-1 rounded">
          {value}
        </span>
      </div>
      
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className={classNames(
          'w-full h-2 rounded-lg appearance-none cursor-pointer',
          'bg-bolt-elements-background-depth-3',
          'slider-thumb:appearance-none slider-thumb:w-4 slider-thumb:h-4',
          'slider-thumb:rounded-full slider-thumb:bg-purple-500',
          'slider-thumb:cursor-pointer slider-thumb:border-0',
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        )}
      />
      
      <p className="text-xs text-bolt-elements-textTertiary">{description}</p>
    </div>
  );
}

interface CapabilityBadgeProps {
  label: string;
  supported: boolean;
  icon: string;
}

function CapabilityBadge({ label, supported, icon }: CapabilityBadgeProps) {
  return (
    <div className={classNames(
      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
      supported 
        ? 'bg-green-500/10 text-green-500 border border-green-500/20'
        : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
    )}>
      <div className={classNames(icon, 'w-4 h-4')} />
      <span>{label}</span>
      {supported && <div className="i-ph:check w-3 h-3" />}
    </div>
  );
}

export default function ModelConfigurationPanel({
  modelId,
  provider,
  capabilities,
  onConfigurationChange,
  className
}: ModelConfigurationPanelProps) {
  const [config, setConfig] = useState<ModelConfiguration>(DEFAULT_CONFIG);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopSequenceInput, setStopSequenceInput] = useState('');

  // Initialize configuration with recommended settings
  useEffect(() => {
    if (capabilities?.recommendedSettings) {
      setConfig(prev => ({
        ...prev,
        temperature: capabilities.recommendedSettings?.temperature ?? prev.temperature,
        topP: capabilities.recommendedSettings?.topP ?? prev.topP,
        maxTokens: capabilities.recommendedSettings?.maxTokens ?? prev.maxTokens,
        streamingEnabled: capabilities.supportsStreaming,
        functionCallingEnabled: capabilities.supportsFunctionCalling,
      }));
    }
  }, [capabilities]);

  // Notify parent of configuration changes
  useEffect(() => {
    onConfigurationChange?.(config);
  }, [config, onConfigurationChange]);

  const updateConfig = (updates: Partial<ModelConfiguration>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const addStopSequence = () => {
    if (stopSequenceInput.trim() && !config.stopSequences.includes(stopSequenceInput.trim())) {
      updateConfig({
        stopSequences: [...config.stopSequences, stopSequenceInput.trim()]
      });
      setStopSequenceInput('');
    }
  };

  const removeStopSequence = (sequence: string) => {
    updateConfig({
      stopSequences: config.stopSequences.filter(s => s !== sequence)
    });
  };

  const resetToDefaults = () => {
    const defaultConfig = capabilities?.recommendedSettings 
      ? {
          ...DEFAULT_CONFIG,
          temperature: capabilities.recommendedSettings.temperature ?? DEFAULT_CONFIG.temperature,
          topP: capabilities.recommendedSettings.topP ?? DEFAULT_CONFIG.topP,
          maxTokens: capabilities.recommendedSettings.maxTokens ?? DEFAULT_CONFIG.maxTokens,
          streamingEnabled: capabilities.supportsStreaming,
          functionCallingEnabled: capabilities.supportsFunctionCalling,
        }
      : DEFAULT_CONFIG;
    
    setConfig(defaultConfig);
  };

  return (
    <div className={classNames('space-y-6', className)}>
      {/* Model Info Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">
            {modelId}
          </h3>
          <p className="text-sm text-bolt-elements-textSecondary">
            {provider} • Configure model parameters
          </p>
        </div>
        
        <button
          onClick={resetToDefaults}
          className={classNames(
            'px-3 py-2 rounded-lg text-sm font-medium',
            'bg-bolt-elements-background-depth-3',
            'hover:bg-bolt-elements-background-depth-4',
            'text-bolt-elements-textPrimary',
            'transition-colors duration-200'
          )}
        >
          Reset to Defaults
        </button>
      </div>

      {/* Model Capabilities */}
      {capabilities && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Model Capabilities</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <CapabilityBadge
              label="Chat"
              supported={capabilities.supportsChat}
              icon="i-ph:chat-circle"
            />
            <CapabilityBadge
              label="Streaming"
              supported={capabilities.supportsStreaming}
              icon="i-ph:lightning"
            />
            <CapabilityBadge
              label="Functions"
              supported={capabilities.supportsFunctionCalling}
              icon="i-ph:function"
            />
            <CapabilityBadge
              label="Vision"
              supported={capabilities.supportsVision}
              icon="i-ph:eye"
            />
            <CapabilityBadge
              label="Embeddings"
              supported={capabilities.supportsEmbeddings}
              icon="i-ph:vector-three"
            />
            <CapabilityBadge
              label="Completion"
              supported={capabilities.supportsCompletion}
              icon="i-ph:file-text"
            />
            <CapabilityBadge
              label="Verified"
              supported={capabilities.isVerified}
              icon="i-ph:shield-check"
            />
            <CapabilityBadge
              label="Tested"
              supported={capabilities.lastTested !== undefined}
              icon="i-ph:check-circle"
            />
          </div>

          {/* Model Metadata */}
          {(capabilities.modelSize || capabilities.architecture || capabilities.quantization) && (
            <div className="flex items-center gap-4 text-sm text-bolt-elements-textSecondary">
              {capabilities.architecture && (
                <span className="flex items-center gap-1">
                  <div className="i-ph:cpu w-4 h-4" />
                  {capabilities.architecture}
                </span>
              )}
              {capabilities.modelSize && (
                <span className="flex items-center gap-1">
                  <div className="i-ph:database w-4 h-4" />
                  {capabilities.modelSize}
                </span>
              )}
              {capabilities.quantization && (
                <span className="flex items-center gap-1">
                  <div className="i-ph:cube w-4 h-4" />
                  {capabilities.quantization}
                </span>
              )}
              {capabilities.memoryRequirements && (
                <span className="flex items-center gap-1">
                  <div className="i-ph:memory w-4 h-4" />
                  {capabilities.memoryRequirements}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Basic Configuration */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Basic Settings</h4>
        
        <ConfigSlider
          label="Temperature"
          value={config.temperature}
          min={0}
          max={2}
          step={0.1}
          description="Controls randomness. Lower values make output more focused and deterministic."
          onChange={(value) => updateConfig({ temperature: value })}
        />
        
        <ConfigSlider
          label="Top P"
          value={config.topP}
          min={0}
          max={1}
          step={0.05}
          description="Controls diversity via nucleus sampling. Lower values focus on more likely tokens."
          onChange={(value) => updateConfig({ topP: value })}
        />
        
        <ConfigSlider
          label="Max Tokens"
          value={config.maxTokens}
          min={1}
          max={8192}
          step={1}
          description="Maximum number of tokens to generate in the response."
          onChange={(value) => updateConfig({ maxTokens: value })}
        />
      </div>

      {/* Advanced Configuration Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={classNames(
          'flex items-center gap-2 text-sm font-medium',
          'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
          'transition-colors duration-200'
        )}
      >
        <div className={classNames(
          'i-ph:caret-right w-4 h-4 transition-transform duration-200',
          showAdvanced ? 'rotate-90' : ''
        )} />
        Advanced Settings
      </button>

      {/* Advanced Configuration */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <ConfigSlider
              label="Frequency Penalty"
              value={config.frequencyPenalty}
              min={-2}
              max={2}
              step={0.1}
              description="Reduces repetition by penalizing tokens based on their frequency."
              onChange={(value) => updateConfig({ frequencyPenalty: value })}
            />
            
            <ConfigSlider
              label="Presence Penalty"
              value={config.presencePenalty}
              min={-2}
              max={2}
              step={0.1}
              description="Encourages new topics by penalizing tokens that have appeared."
              onChange={(value) => updateConfig({ presencePenalty: value })}
            />

            {/* Stop Sequences */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-bolt-elements-textPrimary">
                Stop Sequences
              </label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={stopSequenceInput}
                  onChange={(e) => setStopSequenceInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStopSequence()}
                  placeholder="Enter stop sequence..."
                  className={classNames(
                    'flex-1 px-3 py-2 rounded-lg text-sm',
                    'bg-bolt-elements-background-depth-3',
                    'border border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500'
                  )}
                />
                <button
                  onClick={addStopSequence}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium',
                    'bg-purple-500/10 text-purple-500',
                    'hover:bg-purple-500/20',
                    'transition-colors duration-200'
                  )}
                >
                  Add
                </button>
              </div>
              
              {config.stopSequences.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.stopSequences.map((sequence, index) => (
                    <span
                      key={index}
                      className={classNames(
                        'flex items-center gap-1 px-2 py-1 rounded text-xs',
                        'bg-bolt-elements-background-depth-3',
                        'text-bolt-elements-textSecondary'
                      )}
                    >
                      {sequence}
                      <button
                        onClick={() => removeStopSequence(sequence)}
                        className="hover:text-red-500 transition-colors duration-200"
                      >
                        <div className="i-ph:x w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-bolt-elements-textTertiary">
                Sequences where the model will stop generating text.
              </p>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-bolt-elements-textPrimary">
                    Streaming
                  </label>
                  <p className="text-xs text-bolt-elements-textTertiary">
                    Enable real-time response streaming
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.streamingEnabled}
                  onChange={(e) => updateConfig({ streamingEnabled: e.target.checked })}
                  disabled={!capabilities?.supportsStreaming}
                  className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-bolt-elements-textPrimary">
                    Function Calling
                  </label>
                  <p className="text-xs text-bolt-elements-textTertiary">
                    Enable function/tool calling capabilities
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.functionCallingEnabled}
                  onChange={(e) => updateConfig({ functionCallingEnabled: e.target.checked })}
                  disabled={!capabilities?.supportsFunctionCalling}
                  className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
