import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Switch } from '~/components/ui/Switch';
import { Card, CardContent, CardHeader } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { Progress } from '~/components/ui/Progress';
import { useSettings } from '~/lib/hooks/useSettings';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import type { IProviderConfig } from '~/types/model';
import { logStore } from '~/lib/stores/logs';
import { classNames } from '~/utils/classNames';
import { providerBaseUrlEnvKeys } from '~/utils/constants';
import { useToast } from '~/components/ui/use-toast';
import { useLocalModelHealth } from '~/lib/hooks/useLocalModelHealth';
import ErrorBoundary from './ErrorBoundary';
import { ModelCardSkeleton } from './LoadingSkeleton';
import {
  Cpu,
  Server,
  Settings,
  RotateCw,
  Trash2,
  ExternalLink,
  Package,
  PackageOpen,
  Code,
  Database,
  Link,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Cable,
  ArrowLeft,
  BookOpen,
  Download,
  Shield,
  Globe,
  Terminal,
  Monitor,
  Wifi,
} from 'lucide-react';

// Type definitions
type ProviderName = 'Ollama' | 'LMStudio' | 'OpenAILike';
type ViewMode = 'dashboard' | 'guide' | 'status';

interface OllamaModel {
  name: string;
  digest: string;
  size: number;
  modified_at: string;
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
  status?: 'idle' | 'updating' | 'updated' | 'error' | 'checking';
  error?: string;
  newDigest?: string;
  progress?: {
    current: number;
    total: number;
    status: string;
  };
}

interface LMStudioModel {
  id: string;
  object: 'model';
  owned_by: string;
  created?: number;
}

// Constants
const OLLAMA_API_URL = 'http://127.0.0.1:11434';

const PROVIDER_ICONS: Record<ProviderName, React.ComponentType<{ className?: string }>> = {
  Ollama: Server,
  LMStudio: Monitor,
  OpenAILike: Globe,
};

const PROVIDER_DESCRIPTIONS: Record<ProviderName, string> = {
  Ollama: 'Run open-source models locally on your machine',
  LMStudio: 'Local model inference with LM Studio',
  OpenAILike: 'Connect to OpenAI-compatible API endpoints',
};

// Health Status Badge Component
interface HealthStatusBadgeProps {
  status: 'healthy' | 'unhealthy' | 'checking' | 'unknown';
  responseTime?: number;
  className?: string;
}

function HealthStatusBadge({ status, responseTime, className }: HealthStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          color: 'text-green-500',
          bgColor: 'bg-green-500/10 border-green-500/20',
          Icon: CheckCircle,
          label: 'Healthy',
        };
      case 'unhealthy':
        return {
          color: 'text-red-500',
          bgColor: 'bg-red-500/10 border-red-500/20',
          Icon: XCircle,
          label: 'Unhealthy',
        };
      case 'checking':
        return {
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10 border-blue-500/20',
          Icon: Loader2,
          label: 'Checking',
        };
      default:
        return {
          color: 'text-bolt-elements-textTertiary',
          bgColor: 'bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor',
          Icon: AlertCircle,
          label: 'Unknown',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.Icon;

  return (
    <div
      className={classNames(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
        config.bgColor,
        config.color,
        className,
      )}
    >
      <Icon className={classNames('w-3 h-3', { 'animate-spin': status === 'checking' })} />
      <span>{config.label}</span>
      {responseTime !== undefined && status === 'healthy' && <span className="opacity-75">({responseTime}ms)</span>}
    </div>
  );
}

// Setup Guide Component
function SetupGuide({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="bg-transparent hover:bg-bolt-elements-background-depth-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Local Provider Setup Guide</h2>
          <p className="text-sm text-bolt-elements-textSecondary">
            Complete setup instructions for running AI models locally
          </p>
        </div>
      </div>

      {/* Ollama Setup Section */}
      <Card className="bg-bolt-elements-background-depth-2">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Ollama Setup</h3>
              <p className="text-sm text-bolt-elements-textSecondary">
                Run large language models like Llama, Mistral, and CodeLlama locally
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Installation Steps */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Download className="w-4 h-4" />
              1. Download & Install
            </h4>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-4 h-4 text-bolt-elements-textPrimary" />
                  <strong className="text-bolt-elements-textPrimary">Windows</strong>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary mb-2">
                  Download OllamaSetup.exe from the official website
                </p>
                <Button variant="outline" size="sm" className="w-full bg-transparent" _asChild>
                  <a href="https://ollama.com/download/windows" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Download
                  </a>
                </Button>
              </div>
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-4 h-4 text-bolt-elements-textPrimary" />
                  <strong className="text-bolt-elements-textPrimary">macOS</strong>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary mb-2">
                  Download, unzip, and drag to Applications folder
                </p>
                <Button variant="outline" size="sm" className="w-full bg-transparent" _asChild>
                  <a href="https://ollama.com/download/mac" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Download
                  </a>
                </Button>
              </div>
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-4 h-4 text-bolt-elements-textPrimary" />
                  <strong className="text-bolt-elements-textPrimary">Linux</strong>
                </div>
                <div className="text-xs bg-bolt-elements-background-depth-4 p-2 rounded font-mono text-bolt-elements-textPrimary">
                  curl -fsSL https://ollama.com/install.sh | sh
                </div>
              </div>
            </div>
          </div>

          {/* Usage Steps */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              2. Start & Download Models
            </h4>
            <div className="bg-bolt-elements-background-depth-3 p-4 rounded-lg">
              <div className="text-xs bg-bolt-elements-background-depth-4 p-3 rounded font-mono text-bolt-elements-textPrimary space-y-1">
                <div># Start Ollama server</div>
                <div>ollama serve</div>
                <div></div>
                <div># Download popular models</div>
                <div>ollama pull llama3.1</div>
                <div>ollama pull codellama</div>
                <div>ollama pull mistral</div>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="font-medium text-green-500">System Requirements</span>
            </div>
            <p className="text-xs text-bolt-elements-textSecondary">
              Minimum: 16GB RAM, 12GB disk space. GPU recommended (NVIDIA CUDA or AMD ROCm).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* LM Studio Setup Section */}
      <Card className="bg-bolt-elements-background-depth-2">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">LM Studio Setup</h3>
              <p className="text-sm text-bolt-elements-textSecondary">
                User-friendly interface for running local language models
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Installation */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Download className="w-4 h-4" />
              1. Download & Install
            </h4>
            <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
              <p className="text-sm text-bolt-elements-textSecondary mb-3">
                Download LM Studio for Windows, macOS, or Linux from the official website.
              </p>
              <Button variant="outline" size="sm" className="bg-transparent" _asChild>
                <a href="https://lmstudio.ai/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Download LM Studio
                </a>
              </Button>
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Settings className="w-4 h-4" />
              2. Configure Server & CORS
            </h4>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
                <h5 className="font-medium text-bolt-elements-textPrimary mb-2">Start Local Server</h5>
                <ol className="text-xs text-bolt-elements-textSecondary space-y-1 list-decimal list-inside">
                  <li>Open LM Studio and go to "Local Server" tab</li>
                  <li>Select your downloaded model</li>
                  <li>Configure port (default: 1234)</li>
                  <li>Click "Start Server"</li>
                </ol>
              </div>

              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="font-medium text-red-500">Critical: Enable CORS</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-bolt-elements-textSecondary">
                    To work with Bolt DIY, you MUST enable CORS in LM Studio:
                  </p>
                  <ol className="text-xs text-bolt-elements-textSecondary space-y-1 list-decimal list-inside ml-2">
                    <li>In Server Settings, check "Enable CORS"</li>
                    <li>Set Network Interface to "0.0.0.0" for external access</li>
                    <li>
                      Or use CLI:{' '}
                      <code className="bg-bolt-elements-background-depth-4 px-1 rounded">lms server start --cors</code>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OpenAI-Compatible Setup Section */}
      <Card className="bg-bolt-elements-background-depth-2">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">OpenAI-Compatible APIs</h3>
              <p className="text-sm text-bolt-elements-textSecondary">Connect to any OpenAI-compatible API server</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Popular Services */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              Popular OpenAI-Compatible Services
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
                <h5 className="font-medium text-bolt-elements-textPrimary mb-2">Local Solutions</h5>
                <ul className="text-xs text-bolt-elements-textSecondary space-y-1 list-disc list-inside">
                  <li>LocalAI (recommended)</li>
                  <li>Jan.ai local server</li>
                  <li>Ollama with OpenAI compatibility</li>
                  <li>LM Studio local server</li>
                  <li>Oobabooga Text Generation WebUI</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
                <h5 className="font-medium text-bolt-elements-textPrimary mb-2">Cloud Services</h5>
                <ul className="text-xs text-bolt-elements-textSecondary space-y-1 list-disc list-inside">
                  <li>OpenRouter (multiple models)</li>
                  <li>Together AI, Groq, Perplexity</li>
                  <li>Custom deployed cloud models</li>
                  <li>Self-hosted HuggingFace endpoints</li>
                </ul>
              </div>
            </div>
          </div>

          {/* LocalAI Recommendation */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Recommended: LocalAI Setup
            </h4>
            <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
              <p className="text-sm text-bolt-elements-textSecondary mb-3">
                LocalAI is a free, open-source drop-in replacement for OpenAI, running entirely locally.
              </p>
              <div className="space-y-2">
                <div className="text-xs bg-bolt-elements-background-depth-4 p-3 rounded font-mono text-bolt-elements-textPrimary">
                  # Quick installation
                  <br />
                  curl https://localai.io/install.sh | sh
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="bg-transparent" _asChild>
                    <a href="https://localai.io/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      LocalAI Docs
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="bg-transparent" _asChild>
                    <a href="https://jan.ai/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Jan.ai
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-blue-500">Configuration in Bolt DIY</span>
            </div>
            <ol className="text-xs text-bolt-elements-textSecondary space-y-1 list-decimal list-inside">
              <li>Enable "OpenAI-like" provider in settings</li>
              <li>Set Base URL (e.g., http://localhost:8080/v1)</li>
              <li>Add API key if required by your service</li>
              <li>Test connection with a simple query</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Status Dashboard Component
function StatusDashboard({ onBack }: { onBack: () => void }) {
  const { healthStatuses } = useLocalModelHealth();

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="bg-transparent hover:bg-bolt-elements-background-depth-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Provider Status</h2>
          <p className="text-sm text-bolt-elements-textSecondary">Monitor the health of your local AI providers</p>
        </div>
      </div>

      {healthStatuses.length === 0 ? (
        <Card className="bg-bolt-elements-background-depth-2">
          <CardContent className="p-8 text-center">
            <Cable className="w-16 h-16 mx-auto text-bolt-elements-textTertiary mb-4" />
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Endpoints Configured</h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Configure and enable local providers to see their endpoint status here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {healthStatuses.map((status) => (
            <Card key={`${status.provider}-${status.baseUrl}`} className="bg-bolt-elements-background-depth-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-bolt-elements-background-depth-3 flex items-center justify-center">
                      {React.createElement(PROVIDER_ICONS[status.provider as ProviderName] || Server, {
                        className: 'w-5 h-5 text-bolt-elements-textPrimary',
                      })}
                    </div>
                    <div>
                      <h3 className="font-semibold text-bolt-elements-textPrimary">{status.provider}</h3>
                      <p className="text-xs text-bolt-elements-textSecondary font-mono">{status.baseUrl}</p>
                    </div>
                  </div>
                  <HealthStatusBadge status={status.status} responseTime={status.responseTime} />
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-bolt-elements-textSecondary">Models</div>
                    <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                      {status.availableModels?.length || 0}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-bolt-elements-textSecondary">Version</div>
                    <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                      {status.version || 'Unknown'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-bolt-elements-textSecondary">Last Check</div>
                    <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                      {status.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : 'Never'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Provider Card Component
interface ProviderCardProps {
  provider: IProviderConfig;
  onToggle: (enabled: boolean) => void;
  onUpdateBaseUrl: (url: string) => void;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
}

function ProviderCard({
  provider,
  onToggle,
  onUpdateBaseUrl,
  isEditing,
  onStartEditing,
  onStopEditing,
}: ProviderCardProps) {
  const Icon = PROVIDER_ICONS[provider.name as ProviderName];

  return (
    <Card className="bg-bolt-elements-background-depth-2">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-12 h-12 rounded-xl bg-bolt-elements-background-depth-3 flex items-center justify-center">
              <Icon
                className={classNames(
                  'w-6 h-6',
                  provider.settings.enabled ? 'text-purple-500' : 'text-bolt-elements-textTertiary',
                )}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">{provider.name}</h3>
                <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-500 font-medium">Local</span>
              </div>
              <p className="text-sm text-bolt-elements-textSecondary mb-4">
                {PROVIDER_DESCRIPTIONS[provider.name as ProviderName]}
              </p>

              {provider.settings.enabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-bolt-elements-textPrimary">API Endpoint</label>
                  {isEditing ? (
                    <input
                      type="text"
                      defaultValue={provider.settings.baseUrl}
                      placeholder={`Enter ${provider.name} base URL`}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdateBaseUrl(e.currentTarget.value);
                          onStopEditing();
                        } else if (e.key === 'Escape') {
                          onStopEditing();
                        }
                      }}
                      onBlur={(e) => {
                        onUpdateBaseUrl(e.target.value);
                        onStopEditing();
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={onStartEditing}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor hover:border-purple-500/30 hover:bg-bolt-elements-background-depth-4 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
                        <Link className="w-4 h-4" />
                        <span className="font-mono">{provider.settings.baseUrl || 'Click to set base URL'}</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={provider.settings.enabled}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${provider.name} provider`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Model Card Component
interface ModelCardProps {
  model: OllamaModel;
  onUpdate: () => void;
  onDelete: () => void;
}

function ModelCard({ model, onUpdate, onDelete }: ModelCardProps) {
  return (
    <Card className="bg-bolt-elements-background-depth-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary font-mono">{model.name}</h4>
              {model.status && model.status !== 'idle' && (
                <span
                  className={classNames('px-2 py-0.5 rounded-full text-xs font-medium', {
                    'bg-yellow-500/10 text-yellow-500': model.status === 'updating',
                    'bg-green-500/10 text-green-500': model.status === 'updated',
                    'bg-red-500/10 text-red-500': model.status === 'error',
                  })}
                >
                  {model.status === 'updating' && 'Updating'}
                  {model.status === 'updated' && 'Updated'}
                  {model.status === 'error' && 'Error'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-bolt-elements-textSecondary">
              <div className="flex items-center gap-1">
                <Code className="w-3 h-3" />
                <span>{model.digest.substring(0, 8)}</span>
              </div>
              {model.details && (
                <>
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>{model.details.parameter_size}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>{model.details.quantization_level}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onUpdate}
              disabled={model.status === 'updating'}
              className={classNames(
                'flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors',
                'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {model.status === 'updating' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Updating
                </>
              ) : (
                <>
                  <RotateCw className="w-3 h-3" />
                  Update
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              disabled={model.status === 'updating'}
              className={classNames(
                'flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors',
                'bg-red-500/10 text-red-500 hover:bg-red-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
        {model.progress && (
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs text-bolt-elements-textSecondary">
              <span>{model.progress.status}</span>
              <span>{Math.round((model.progress.current / model.progress.total) * 100)}%</span>
            </div>
            <Progress value={Math.round((model.progress.current / model.progress.total) * 100)} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LocalProvidersTab() {
  const { providers, updateProviderSettings } = useSettings();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [lmStudioModels, setLMStudioModels] = useState<LMStudioModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingLMStudioModels, setIsLoadingLMStudioModels] = useState(false);
  const { toast } = useToast();
  const { startMonitoring, stopMonitoring } = useLocalModelHealth();

  // Memoized filtered providers to prevent unnecessary re-renders
  const filteredProviders = useMemo(() => {
    return Object.entries(providers || {})
      .filter(([key]) => [...LOCAL_PROVIDERS, 'OpenAILike'].includes(key))
      .map(([key, value]) => {
        const provider = value as IProviderConfig;
        const envKey = providerBaseUrlEnvKeys[key]?.baseUrlKey;
        const envUrl = envKey ? (import.meta.env[envKey] as string | undefined) : undefined;

        // Set default base URLs for local providers
        let defaultBaseUrl = provider.settings.baseUrl || envUrl;

        if (!defaultBaseUrl) {
          if (key === 'Ollama') {
            defaultBaseUrl = 'http://127.0.0.1:11434';
          } else if (key === 'LMStudio') {
            defaultBaseUrl = 'http://127.0.0.1:1234';
          }
        }

        return {
          name: key,
          settings: {
            ...provider.settings,
            baseUrl: defaultBaseUrl,
          },
          staticModels: provider.staticModels || [],
          getDynamicModels: provider.getDynamicModels,
          getApiKeyLink: provider.getApiKeyLink,
          labelForGetApiKey: provider.labelForGetApiKey,
          icon: provider.icon,
        } as IProviderConfig;
      })
      .sort((a, b) => {
        // Custom sort: Ollama first, then LMStudio, then OpenAILike
        const order = { Ollama: 0, LMStudio: 1, OpenAILike: 2 };
        return (order[a.name as keyof typeof order] || 3) - (order[b.name as keyof typeof order] || 3);
      });
  }, [providers]);

  const categoryEnabled = useMemo(() => {
    return filteredProviders.length > 0 && filteredProviders.every((p) => p.settings.enabled);
  }, [filteredProviders]);

  // Start/stop health monitoring for enabled providers
  useEffect(() => {
    filteredProviders.forEach((provider) => {
      const baseUrl = provider.settings.baseUrl;

      if (provider.settings.enabled && baseUrl) {
        console.log(`[LocalProvidersTab] Starting monitoring for ${provider.name} at ${baseUrl}`);
        startMonitoring(provider.name as 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl);
      } else if (!provider.settings.enabled && baseUrl) {
        console.log(`[LocalProvidersTab] Stopping monitoring for ${provider.name} at ${baseUrl}`);
        stopMonitoring(provider.name as 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl);
      }
    });
  }, [filteredProviders, startMonitoring, stopMonitoring]);

  // Fetch Ollama models when enabled
  useEffect(() => {
    const ollamaProvider = filteredProviders.find((p) => p.name === 'Ollama');

    if (ollamaProvider?.settings.enabled) {
      fetchOllamaModels();
    }
  }, [filteredProviders]);

  // Fetch LM Studio models when enabled
  useEffect(() => {
    const lmStudioProvider = filteredProviders.find((p) => p.name === 'LMStudio');

    if (lmStudioProvider?.settings.enabled && lmStudioProvider.settings.baseUrl) {
      fetchLMStudioModels(lmStudioProvider.settings.baseUrl);
    }
  }, [filteredProviders]);

  const fetchOllamaModels = async () => {
    try {
      setIsLoadingModels(true);

      const response = await fetch(`${OLLAMA_API_URL}/api/tags`);

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = (await response.json()) as { models: OllamaModel[] };
      setOllamaModels(
        data.models.map((model) => ({
          ...model,
          status: 'idle' as const,
        })),
      );
    } catch {
      console.error('Error fetching Ollama models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const fetchLMStudioModels = async (baseUrl: string) => {
    try {
      setIsLoadingLMStudioModels(true);

      const response = await fetch(`${baseUrl}/v1/models`);

      if (!response.ok) {
        throw new Error('Failed to fetch LM Studio models');
      }

      const data = (await response.json()) as { data: LMStudioModel[] };
      setLMStudioModels(data.data || []);
    } catch {
      console.error('Error fetching LM Studio models');
      setLMStudioModels([]);
    } finally {
      setIsLoadingLMStudioModels(false);
    }
  };

  const handleToggleCategory = useCallback(
    async (enabled: boolean) => {
      filteredProviders.forEach((provider) => {
        updateProviderSettings(provider.name, { ...provider.settings, enabled });
      });
      toast(enabled ? 'All local providers enabled' : 'All local providers disabled');
    },
    [filteredProviders, updateProviderSettings, toast],
  );

  const handleToggleProvider = useCallback(
    (provider: IProviderConfig, enabled: boolean) => {
      updateProviderSettings(provider.name, {
        ...provider.settings,
        enabled,
      });

      logStore.logProvider(`Provider ${provider.name} ${enabled ? 'enabled' : 'disabled'}`, {
        provider: provider.name,
      });
      toast(`${provider.name} ${enabled ? 'enabled' : 'disabled'}`);
    },
    [updateProviderSettings, toast],
  );

  const handleUpdateBaseUrl = useCallback(
    (provider: IProviderConfig, newBaseUrl: string) => {
      updateProviderSettings(provider.name, {
        ...provider.settings,
        baseUrl: newBaseUrl,
      });
      toast(`${provider.name} base URL updated`);
    },
    [updateProviderSettings, toast],
  );

  const handleUpdateOllamaModel = async (modelName: string) => {
    try {
      setOllamaModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'updating' } : m)));

      const response = await fetch(`${OLLAMA_API_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update ${modelName}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No response reader available');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.status && data.completed && data.total) {
              setOllamaModels((current) =>
                current.map((m) =>
                  m.name === modelName
                    ? {
                        ...m,
                        progress: {
                          current: data.completed,
                          total: data.total,
                          status: data.status,
                        },
                      }
                    : m,
                ),
              );
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }

      setOllamaModels((prev) =>
        prev.map((m) => (m.name === modelName ? { ...m, status: 'updated', progress: undefined } : m)),
      );
      toast(`Successfully updated ${modelName}`);
    } catch {
      setOllamaModels((prev) =>
        prev.map((m) => (m.name === modelName ? { ...m, status: 'error', progress: undefined } : m)),
      );
      toast(`Failed to update ${modelName}`, { type: 'error' });
    }
  };

  const handleDeleteOllamaModel = async (modelName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${modelName}?`)) {
      return;
    }

    try {
      const response = await fetch(`${OLLAMA_API_URL}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete ${modelName}`);
      }

      setOllamaModels((current) => current.filter((m) => m.name !== modelName));
      toast(`Deleted ${modelName}`);
    } catch {
      toast(`Failed to delete ${modelName}`, { type: 'error' });
    }
  };

  // Render different views based on viewMode
  if (viewMode === 'guide') {
    return (
      <ErrorBoundary>
        <SetupGuide onBack={() => setViewMode('dashboard')} />
      </ErrorBoundary>
    );
  }

  if (viewMode === 'status') {
    return (
      <ErrorBoundary>
        <StatusDashboard onBack={() => setViewMode('dashboard')} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Local AI Providers</h2>
              <p className="text-sm text-bolt-elements-textSecondary">Configure and manage your local AI models</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('guide')}
              className="bg-transparent hover:bg-bolt-elements-background-depth-2"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Setup Guide
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('status')}
              className="bg-transparent hover:bg-bolt-elements-background-depth-2"
            >
              <Activity className="w-4 h-4 mr-2" />
              Status
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-bolt-elements-textSecondary">Enable All</span>
              <Switch
                checked={categoryEnabled}
                onCheckedChange={handleToggleCategory}
                aria-label="Toggle all local providers"
              />
            </div>
          </div>
        </div>

        {/* Provider Cards */}
        <div className="space-y-4">
          {filteredProviders.map((provider) => (
            <div key={provider.name}>
              <ProviderCard
                provider={provider}
                onToggle={(enabled) => handleToggleProvider(provider, enabled)}
                onUpdateBaseUrl={(url) => handleUpdateBaseUrl(provider, url)}
                isEditing={editingProvider === provider.name}
                onStartEditing={() => setEditingProvider(provider.name)}
                onStopEditing={() => setEditingProvider(null)}
              />

              {/* Ollama Models Section */}
              {provider.name === 'Ollama' && provider.settings.enabled && (
                <Card className="mt-4 bg-bolt-elements-background-depth-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PackageOpen className="w-5 h-5 text-purple-500" />
                        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Installed Models</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchOllamaModels}
                        disabled={isLoadingModels}
                        className="bg-transparent hover:bg-bolt-elements-background-depth-2"
                      >
                        {isLoadingModels ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RotateCw className="w-4 h-4 mr-2" />
                        )}
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingModels ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <ModelCardSkeleton key={i} />
                        ))}
                      </div>
                    ) : ollamaModels.length === 0 ? (
                      <div className="text-center py-8">
                        <PackageOpen className="w-16 h-16 mx-auto text-bolt-elements-textTertiary mb-4" />
                        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Models Installed</h3>
                        <p className="text-sm text-bolt-elements-textSecondary mb-4">
                          Visit{' '}
                          <a
                            href="https://ollama.com/library"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-500 hover:underline inline-flex items-center gap-1"
                          >
                            ollama.com/library
                            <ExternalLink className="w-3 h-3" />
                          </a>{' '}
                          to browse available models
                        </p>
                        <Button variant="outline" size="sm" className="bg-transparent" _asChild>
                          <a
                            href="https://ollama.com/library"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Browse Models
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {ollamaModels.map((model) => (
                          <ModelCard
                            key={model.name}
                            model={model}
                            onUpdate={() => handleUpdateOllamaModel(model.name)}
                            onDelete={() => handleDeleteOllamaModel(model.name)}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* LM Studio Models Section */}
              {provider.name === 'LMStudio' && provider.settings.enabled && (
                <Card className="mt-4 bg-bolt-elements-background-depth-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Available Models</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchLMStudioModels(provider.settings.baseUrl!)}
                        disabled={isLoadingLMStudioModels}
                        className="bg-transparent hover:bg-bolt-elements-background-depth-2"
                      >
                        {isLoadingLMStudioModels ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RotateCw className="w-4 h-4 mr-2" />
                        )}
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingLMStudioModels ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <ModelCardSkeleton key={i} />
                        ))}
                      </div>
                    ) : lmStudioModels.length === 0 ? (
                      <div className="text-center py-8">
                        <Monitor className="w-16 h-16 mx-auto text-bolt-elements-textTertiary mb-4" />
                        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Models Available</h3>
                        <p className="text-sm text-bolt-elements-textSecondary mb-4">
                          Make sure LM Studio is running with the local server started and CORS enabled.
                        </p>
                        <Button variant="outline" size="sm" className="bg-transparent" _asChild>
                          <a
                            href="https://lmstudio.ai/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Get LM Studio
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {lmStudioModels.map((model) => (
                          <Card key={model.id} className="bg-bolt-elements-background-depth-3">
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary font-mono">
                                    {model.id}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
                                    Available
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-bolt-elements-textSecondary">
                                  <div className="flex items-center gap-1">
                                    <Database className="w-3 h-3" />
                                    <span>{model.object}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Settings className="w-3 h-3" />
                                    <span>Owned by: {model.owned_by}</span>
                                  </div>
                                  {model.created && (
                                    <div className="flex items-center gap-1">
                                      <Activity className="w-3 h-3" />
                                      <span>Created: {new Date(model.created * 1000).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>

        {filteredProviders.length === 0 && (
          <Card className="bg-bolt-elements-background-depth-2">
            <CardContent className="p-8 text-center">
              <Server className="w-16 h-16 mx-auto text-bolt-elements-textTertiary mb-4" />
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Local Providers Available</h3>
              <p className="text-sm text-bolt-elements-textSecondary">
                Local providers will appear here when they're configured in the system.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}
