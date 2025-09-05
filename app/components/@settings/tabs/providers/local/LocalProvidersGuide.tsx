import React from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

interface EndpointInfo {
  provider: string;
  defaultUrl: string;
  endpoints: {
    models: string;
    chat: string;
    completions: string;
    health: string;
    version?: string;
  };
  features: string[];
  notes: string;
}

const PROVIDER_ENDPOINTS: EndpointInfo[] = [
  {
    provider: 'Ollama',
    defaultUrl: 'http://127.0.0.1:11434',
    endpoints: {
      models: '/api/tags',
      chat: '/api/chat',
      completions: '/api/generate',
      health: '/api/tags',
      version: '/api/version'
    },
    features: [
      'Local model inference',
      'Automatic model discovery',
      'Streaming support',
      'Multiple model formats',
      'GPU acceleration support',
      'REST API interface'
    ],
    notes: 'Install models using Ollama CLI or desktop app. Models appear automatically in Bolt.'
  },
  {
    provider: 'LM Studio',
    defaultUrl: 'http://localhost:1234/v1',
    endpoints: {
      models: '/models',
      chat: '/chat/completions',
      completions: '/completions',
      health: '/models'
    },
    features: [
      'Local model hosting',
      'OpenAI-compatible API',
      'Real-time model switching',
      'Multi-modal support',
      'GPU memory management',
      'Local web interface'
    ],
    notes: 'Load models through LM Studio interface. The server runs at http://localhost:1234/v1. Configure server settings in LM Studio preferences.'
  },
  {
    provider: 'OpenAI-like',
    defaultUrl: 'http://localhost:8080',
    endpoints: {
      models: '/v1/models',
      chat: '/v1/chat/completions',
      completions: '/v1/completions',
      health: '/v1/models'
    },
    features: [
      'OpenAI API compatibility',
      'Flexible endpoint configuration',
      'Custom model support',
      'Streaming responses',
      'Function calling',
      'Vision capabilities'
    ],
    notes: 'Compatible with services like vLLM, Text Generation WebUI, and other OpenAI-compatible servers.'
  }
];

const LOCAL_MODEL_ECOSYSTEM = [
  {
    category: 'Popular Local Solutions',
    providers: [
      { name: 'Ollama', description: 'Easy-to-use CLI and API for running LLMs locally', pros: ['Simple setup', 'Large model library', 'Active community'] },
      { name: 'LM Studio', description: 'User-friendly GUI for running LLMs with chat interface', pros: ['Graphical interface', 'Easy model management', 'Good performance'] },
      { name: 'GPT4All', description: 'Cross-platform chat clients for local LLMs', pros: ['Multiple platforms', 'No coding required', 'Model marketplace'] },
      { name: 'LocalAI', description: 'OpenAI-compatible API server for local models', pros: ['API compatibility', 'Multi-modal', 'Extensible'] }
    ]
  },
  {
    category: 'Advanced Solutions',
    providers: [
      { name: 'vLLM', description: 'High-performance inference server for large language models', pros: ['High throughput', 'Distributed inference', 'Production ready'] },
      { name: 'Text Generation WebUI', description: 'Feature-rich web interface for text generation', pros: ['Rich features', 'Extensions', 'Model comparison'] },
      { name: 'KoboldAI', description: 'AI writing assistant with local model support', pros: ['Writing focused', 'Multiple backends', 'Community models'] },
      { name: 'SillyTavern', description: 'Advanced chat interface for character roleplay', pros: ['Roleplay focused', 'Extensions', 'Custom characters'] }
    ]
  }
];

interface LocalProvidersGuideProps {
  className?: string;
}

export default function LocalProvidersGuide({ className }: LocalProvidersGuideProps) {
  return (
    <div className={classNames('space-y-8', className)}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">
          Local AI Providers Guide
        </h2>
        <p className="text-bolt-elements-textSecondary">
          Comprehensive information about local AI model providers and their capabilities
        </p>
      </div>

      {/* Provider Endpoints */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">
          Provider Endpoints & Features
        </h3>

        <div className="grid gap-6">
          {PROVIDER_ENDPOINTS.map((provider, index) => (
            <motion.div
              key={provider.provider}
              className="p-6 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <div className="w-6 h-6 rounded bg-purple-500" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-bolt-elements-textPrimary">
                    {provider.provider}
                  </h4>
                  <p className="text-sm text-bolt-elements-textSecondary">
                    Default: {provider.defaultUrl}
                  </p>
                </div>
              </div>

              {/* Endpoints */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">API Endpoints</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(provider.endpoints).map(([key, endpoint]) => (
                    <div key={key} className="p-2 rounded bg-bolt-elements-background-depth-3">
                      <div className="font-medium text-bolt-elements-textPrimary capitalize">{key}</div>
                      <div className="text-bolt-elements-textSecondary font-mono">{endpoint}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Features</h5>
                <div className="flex flex-wrap gap-2">
                  {provider.features.map((feature, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-600 border border-green-500/20"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-600">{provider.notes}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Local Model Ecosystem */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">
          Local AI Model Ecosystem
        </h3>

        <div className="grid gap-6">
          {LOCAL_MODEL_ECOSYSTEM.map((category, categoryIndex) => (
            <motion.div
              key={category.category}
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: categoryIndex * 0.2 }}
            >
              <h4 className="text-md font-medium text-bolt-elements-textPrimary border-b border-bolt-elements-borderColor pb-2">
                {category.category}
              </h4>

              <div className="grid gap-4">
                {category.providers.map((provider, providerIndex) => (
                  <motion.div
                    key={provider.name}
                    className="p-4 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (categoryIndex * 0.2) + (providerIndex * 0.1) }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-bolt-elements-textPrimary">{provider.name}</h5>
                        <p className="text-sm text-bolt-elements-textSecondary mt-1">{provider.description}</p>
                      </div>
                      <div className="ml-4">
                        <div className="text-xs text-bolt-elements-textSecondary mb-2">Pros:</div>
                        <div className="flex flex-wrap gap-1">
                          {provider.pros.map((pro, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-600"
                            >
                              {pro}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CORS Configuration */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
          CORS Configuration
        </h3>
        <p className="text-bolt-elements-textSecondary mb-4">
          When running local AI providers, you may encounter CORS (Cross-Origin Resource Sharing) errors
          when accessing them from web applications like Bolt.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-bolt-elements-textPrimary mb-2">LM Studio</h4>
            <div className="text-sm text-bolt-elements-textSecondary space-y-2">
              <p className="text-amber-600 font-medium">Note: CORS configuration in LM Studio may vary by version.</p>
              <div className="space-y-2">
                <div>
                  <p className="font-medium">Method 1 - Server Settings:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Open LM Studio</li>
                    <li>Go to "Local Server" tab</li>
                    <li>Look for CORS or "Allow Cross-Origin" option</li>
                    <li>Enable it and restart server</li>
                  </ol>
                </div>
                <div>
                  <p className="font-medium">Method 2 - Command Line:</p>
                  <p className="text-xs">Start LM Studio server with: <code className="bg-bolt-elements-background-depth-3 px-1 rounded">lmstudio-server --cors</code></p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-bolt-elements-textPrimary mb-2">Alternative Solutions</h4>
            <div className="text-sm text-bolt-elements-textSecondary space-y-2">
              <div>
                <p className="font-medium">Browser Extension:</p>
                <p>Install a CORS proxy browser extension (like "CORS Unblock")</p>
              </div>
              <div>
                <p className="font-medium">Development Proxy:</p>
                <p>Use a local proxy server to forward requests</p>
              </div>
              <div>
                <p className="font-medium">Electron App:</p>
                <p>Bolt's desktop version doesn't have CORS restrictions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
          Best Practices for Local AI
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-bolt-elements-textPrimary mb-2">Hardware Considerations</h4>
            <ul className="text-sm text-bolt-elements-textSecondary space-y-1">
              <li>• Minimum 16GB RAM for small models (7B parameters)</li>
              <li>• 32GB+ RAM recommended for larger models</li>
              <li>• NVIDIA GPU with 8GB+ VRAM for acceleration</li>
              <li>• SSD storage for faster model loading</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-bolt-elements-textPrimary mb-2">Performance Tips</h4>
            <ul className="text-sm text-bolt-elements-textSecondary space-y-1">
              <li>• Use quantized models (Q4, Q8) for better performance</li>
              <li>• Enable GPU acceleration when available</li>
              <li>• Monitor RAM/VRAM usage during inference</li>
              <li>• Use streaming for better user experience</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
