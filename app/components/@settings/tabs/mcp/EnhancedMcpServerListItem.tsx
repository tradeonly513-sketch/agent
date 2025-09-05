import { useState } from 'react';
import { Switch } from '~/components/ui/Switch';
import { Button } from '~/components/ui/Button';

// Helper function to sanitize config for UI display
function sanitizeConfigForDisplay(config: any): any {
  const sanitized = { ...config };

  // Sanitize environment variables
  if (sanitized.env) {
    sanitized.env = {};

    for (const [key, value] of Object.entries(config.env)) {
      if (isSensitiveEnvVar(key)) {
        sanitized.env[key] = '[REDACTED]';
      } else {
        sanitized.env[key] = value;
      }
    }
  }

  // Sanitize headers
  if (sanitized.headers) {
    sanitized.headers = {};

    for (const [key, value] of Object.entries(config.headers)) {
      if (isSensitiveHeader(key)) {
        sanitized.headers[key] = '[REDACTED]';
      } else {
        sanitized.headers[key] = value;
      }
    }
  }

  return sanitized;
}

function isSensitiveEnvVar(key: string): boolean {
  const sensitivePatterns = [
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /password/i,
    /auth/i,
    /credential/i,
    /bearer/i,
    /authorization/i,
    /private[_-]?key/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(key));
}

function isSensitiveHeader(key: string): boolean {
  const sensitivePatterns = [/authorization/i, /api[_-]?key/i, /bearer/i, /token/i, /secret/i];
  return sensitivePatterns.some((pattern) => pattern.test(key));
}
import { Badge } from '~/components/ui/Badge';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { Textarea } from '~/components/ui/Textarea';
import { ConfirmationDialog, Dialog, DialogTitle } from '~/components/ui/Dialog';
import * as RadixDialog from '@radix-ui/react-dialog';
import McpStatusBadge from './McpStatusBadge';
import McpServerListItem from './McpServerListItem';
import { classNames } from '~/utils/classNames';
import { ChevronDown, ChevronRight, Trash2, Settings, Play, Pause, AlertTriangle } from 'lucide-react';
import type { MCPServer } from '~/lib/services/mcpService';

// Helper function to detect server type based on name and config
const detectServerType = (serverName: string, config: any): string | null => {
  // Try to match by server name first
  const lowerName = serverName.toLowerCase();

  if (lowerName.includes('github')) {
    return 'github';
  }

  if (lowerName.includes('slack')) {
    return 'slack';
  }

  if (lowerName.includes('gdrive') || lowerName.includes('google-drive')) {
    return 'gdrive';
  }

  if (lowerName.includes('postgres')) {
    return 'postgres';
  }

  if (lowerName.includes('brave')) {
    return 'brave-search';
  }

  if (lowerName.includes('kubernetes') || lowerName.includes('k8s')) {
    return 'kubernetes';
  }

  if (lowerName.includes('elasticsearch') || lowerName.includes('elastic')) {
    return 'elasticsearch';
  }

  if (lowerName.includes('weather')) {
    return 'weather';
  }

  if (lowerName.includes('sentry')) {
    return 'sentry';
  }

  if (lowerName.includes('twitter') || lowerName.includes('x-')) {
    return 'twitter';
  }

  if (lowerName.includes('reddit')) {
    return 'reddit';
  }

  if (lowerName.includes('youtube') || lowerName.includes('yt-')) {
    return 'youtube';
  }

  if (lowerName.includes('openai') || lowerName.includes('gpt')) {
    return 'openai';
  }

  if (lowerName.includes('anthropic') || lowerName.includes('claude')) {
    return 'anthropic';
  }

  if (lowerName.includes('perplexity')) {
    return 'perplexity';
  }

  if (lowerName.includes('replicate')) {
    return 'replicate';
  }

  if (lowerName.includes('mem0') || lowerName.includes('coding')) {
    return 'mem0-coding';
  }

  if (lowerName.includes('devstandards') || lowerName.includes('standards')) {
    return 'devstandards';
  }

  if (lowerName.includes('code-runner') || lowerName.includes('coderunner')) {
    return 'code-runner';
  }

  if (lowerName.includes('vscode')) {
    return 'vscode-mcp';
  }

  if (lowerName.includes('xcode')) {
    return 'xcode-mcp';
  }

  if (lowerName.includes('context7') || lowerName.includes('documentation')) {
    return 'context7-docs';
  }

  if (lowerName.includes('shrimp') || lowerName.includes('task-manager')) {
    return 'shrimp-task-manager';
  }

  if (lowerName.includes('sonarqube') || lowerName.includes('sonar')) {
    return 'sonarqube';
  }

  if (lowerName.includes('semgrep') || lowerName.includes('security')) {
    return 'semgrep-security';
  }

  if (lowerName.includes('jupyter') || lowerName.includes('notebook')) {
    return 'jupyter-mcp';
  }

  if (lowerName.includes('git-ingest') || lowerName.includes('git-analyzer')) {
    return 'mcp-git-ingest';
  }

  // Try to match by command args for STDIO servers
  if (config.type === 'stdio' && config.args) {
    const argsStr = config.args.join(' ').toLowerCase();

    if (argsStr.includes('server-github')) {
      return 'github';
    }

    if (argsStr.includes('server-slack')) {
      return 'slack';
    }

    if (argsStr.includes('server-gdrive')) {
      return 'gdrive';
    }

    if (argsStr.includes('server-postgres')) {
      return 'postgres';
    }

    if (argsStr.includes('server-sqlite')) {
      return 'sqlite';
    }

    if (argsStr.includes('server-git')) {
      return 'git';
    }

    if (argsStr.includes('hacker-news-mcp')) {
      return 'hacker-news';
    }

    if (argsStr.includes('qdrant')) {
      return 'qdrant';
    }

    if (argsStr.includes('@mem0ai/mem0-mcp')) {
      return 'mem0-coding';
    }

    if (argsStr.includes('@ivangrynenko/devstandards_mcp')) {
      return 'devstandards';
    }

    if (argsStr.includes('@axliupore/mcp-code-runner')) {
      return 'code-runner';
    }

    if (argsStr.includes('@juehang/vscode-mcp-server')) {
      return 'vscode-mcp';
    }

    if (argsStr.includes('@r-huijts/xcode-mcp-server')) {
      return 'xcode-mcp';
    }

    if (argsStr.includes('@context7/server')) {
      return 'context7-docs';
    }

    if (argsStr.includes('@cjo4m06/mcp-shrimp-task-manager')) {
      return 'shrimp-task-manager';
    }

    if (argsStr.includes('@sonarsource/sonarqube-mcp')) {
      return 'sonarqube';
    }

    if (argsStr.includes('@semgrep/mcp-server')) {
      return 'semgrep-security';
    }

    if (argsStr.includes('@datalayer/jupyter-mcp-server')) {
      return 'jupyter-mcp';
    }

    if (argsStr.includes('@adhikasp/mcp-git-ingest')) {
      return 'mcp-git-ingest';
    }

    if (argsStr.includes('@modelcontextprotocol/server-brave-search')) {
      return 'brave-search';
    }
  }

  // Try to match by URL for HTTP servers
  if (config.url) {
    const _urlStr = config.url.toLowerCase();

    // Add other URL-based detections here if needed
  }

  return null;
};

// API key configurations (should match McpServerWizard)
const SERVER_API_CONFIGS: Record<
  string,
  Record<string, { label: string; placeholder: string; description: string; required: boolean }>
> = {
  github: {
    GITHUB_PERSONAL_ACCESS_TOKEN: {
      label: 'GitHub Personal Access Token',
      placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      description: 'Create at github.com/settings/tokens with repo and read:user scopes',
      required: true,
    },
  },
  slack: {
    SLACK_BOT_TOKEN: {
      label: 'Slack Bot Token',
      placeholder: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from your Slack app settings (OAuth & Permissions)',
      required: true,
    },
  },
  gdrive: {
    GOOGLE_CLIENT_ID: {
      label: 'Google Client ID',
      placeholder: 'xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',
      description: 'From Google Cloud Console OAuth 2.0 credentials',
      required: true,
    },
    GOOGLE_CLIENT_SECRET: {
      label: 'Google Client Secret',
      placeholder: 'GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'From Google Cloud Console OAuth 2.0 credentials',
      required: true,
    },
  },
  postgres: {
    DATABASE_URL: {
      label: 'Database URL',
      placeholder: 'postgresql://username:password@hostname:port/database',
      description: 'PostgreSQL connection string',
      required: true,
    },
  },
  'brave-search': {
    BRAVE_API_KEY: {
      label: 'Brave Search API Key',
      placeholder: 'BSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get your API key from https://api.search.brave.com/app/keys',
      required: true,
    },
  },
  kubernetes: {
    KUBECONFIG: {
      label: 'Kubeconfig Path',
      placeholder: '~/.kube/config',
      description: 'Path to your Kubernetes configuration file',
      required: true,
    },
  },
  elasticsearch: {
    ELASTICSEARCH_URL: {
      label: 'Elasticsearch URL',
      placeholder: 'http://localhost:9200',
      description: 'Elasticsearch cluster URL',
      required: true,
    },
    ELASTICSEARCH_API_KEY: {
      label: 'Elasticsearch API Key',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Elasticsearch API key for authentication',
      required: true,
    },
  },
  weather: {
    OPENWEATHER_API_KEY: {
      label: 'OpenWeatherMap API Key',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get your API key from openweathermap.org',
      required: true,
    },
  },
  sentry: {
    SENTRY_AUTH_TOKEN: {
      label: 'Sentry Auth Token',
      placeholder: 'sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Create at sentry.io/settings/account/api/auth-tokens',
      required: true,
    },
  },
  twitter: {
    TWITTER_BEARER_TOKEN: {
      label: 'Twitter Bearer Token',
      placeholder: 'AAAAAAAAAAAAAAAAAAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Twitter Developer Portal (API v2)',
      required: true,
    },
  },
  reddit: {
    REDDIT_CLIENT_ID: {
      label: 'Reddit Client ID',
      placeholder: 'your_client_id_here',
      description: 'From Reddit App Settings',
      required: true,
    },
    REDDIT_CLIENT_SECRET: {
      label: 'Reddit Client Secret',
      placeholder: 'your_client_secret_here',
      description: 'From Reddit App Settings',
      required: true,
    },
  },
  youtube: {
    YOUTUBE_API_KEY: {
      label: 'YouTube API Key',
      placeholder: 'AIzaSyAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Google Cloud Console (YouTube Data API v3)',
      required: true,
    },
  },
  openai: {
    OPENAI_API_KEY: {
      label: 'OpenAI API Key',
      placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from OpenAI Platform (platform.openai.com/api-keys)',
      required: true,
    },
  },
  anthropic: {
    ANTHROPIC_API_KEY: {
      label: 'Anthropic API Key',
      placeholder: 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Anthropic Console (console.anthropic.com/)',
      required: true,
    },
  },
  perplexity: {
    PERPLEXITY_API_KEY: {
      label: 'Perplexity API Key',
      placeholder: 'pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Perplexity API dashboard',
      required: true,
    },
  },
  replicate: {
    REPLICATE_API_TOKEN: {
      label: 'Replicate API Token',
      placeholder: 'r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Replicate account settings',
      required: true,
    },
  },
  sonarqube: {
    SONARQUBE_URL: {
      label: 'SonarQube Server URL',
      placeholder: 'http://localhost:9000',
      description: 'URL of your SonarQube server',
      required: true,
    },
    SONARQUBE_TOKEN: {
      label: 'SonarQube Authentication Token',
      placeholder: 'squ_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Generate from SonarQube: Administration > Security > Users',
      required: true,
    },
  },
};

interface EnhancedMcpServerListItemProps {
  serverName: string;
  mcpServer: MCPServer;
  isEnabled: boolean;
  isExpanded: boolean;
  isCheckingServers: boolean;
  onToggleExpanded: (serverName: string) => void;
  onToggleEnabled: (serverName: string, enabled: boolean) => void;
  onRemoveServer: (serverName: string) => void;
  onEditServer?: (serverName: string, config: any) => void;
}

export default function EnhancedMcpServerListItem({
  serverName,
  mcpServer,
  isEnabled,
  isExpanded,
  isCheckingServers,
  onToggleExpanded,
  onToggleEnabled,
  onRemoveServer,
  onEditServer,
}: EnhancedMcpServerListItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [editedConfig, setEditedConfig] = useState(mcpServer.config);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  const isAvailable = mcpServer.status === 'available';
  const serverTools = isAvailable ? Object.entries(mcpServer.tools) : [];
  const canConnect =
    mcpServer.config.type === 'streamable-http' || mcpServer.config.type === 'sse'
      ? !!mcpServer.config.url
      : !!mcpServer.config.command;

  const handleToggleEnabled = async (enabled: boolean) => {
    if (isToggling) {
      return;
    }

    setIsToggling(true);

    try {
      await onToggleEnabled(serverName, enabled);
    } finally {
      setIsToggling(false);
    }
  };

  const handleRemoveServer = () => {
    onRemoveServer(serverName);
    setShowDeleteConfirm(false);
  };

  const handleEditServer = () => {
    setEditedConfig(mcpServer.config);

    // Extract API keys from existing config
    const existingKeys: Record<string, string> = {};

    if (mcpServer.config.type === 'stdio') {
      const stdioConfig = mcpServer.config as { type: 'stdio'; env?: Record<string, string> };
      const serverType = detectServerType(serverName, mcpServer.config);

      if (serverType && SERVER_API_CONFIGS[serverType] && stdioConfig.env) {
        Object.keys(SERVER_API_CONFIGS[serverType]).forEach((key) => {
          if (stdioConfig.env && stdioConfig.env[key]) {
            existingKeys[key] = stdioConfig.env[key];
          }
        });
      }
    }

    setApiKeys(existingKeys);

    setShowEditDialog(true);
  };

  const handleSaveConfig = () => {
    if (onEditServer) {
      // Merge API keys into config if it's a STDIO server
      let finalConfig = { ...editedConfig };
      const serverType = detectServerType(serverName, editedConfig);

      if (
        editedConfig.type === 'stdio' &&
        serverType &&
        SERVER_API_CONFIGS[serverType] &&
        Object.keys(apiKeys).length > 0
      ) {
        const stdioConfig = editedConfig as {
          type: 'stdio';
          command: string;
          env?: Record<string, string>;
          cwd?: string;
          args?: string[];
        };
        finalConfig = {
          ...stdioConfig,
          env: {
            ...stdioConfig.env,
            ...Object.fromEntries(Object.entries(apiKeys).filter(([_, value]) => value.trim() !== '')),
          },
        };
      }

      onEditServer(serverName, finalConfig);
    }

    setShowEditDialog(false);
  };

  const handleApiKeyChange = (key: string, value: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleConfigChange = (field: string, value: any) => {
    setEditedConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getServerTypeInfo = () => {
    const { type } = mcpServer.config;
    const typeColors = {
      stdio: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
      sse: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
      'streamable-http': 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
    };

    return {
      color:
        typeColors[type] ||
        'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary border border-bolt-elements-borderColor',
      label: type.toUpperCase(),
    };
  };

  const typeInfo = getServerTypeInfo();

  return (
    <div
      className={classNames(
        'rounded-lg border transition-all duration-200',
        isEnabled
          ? 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1'
          : 'border-bolt-elements-borderColor/50 bg-bolt-elements-background-depth-1/50',
      )}
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Expand/Collapse Button */}
            <button
              onClick={() => onToggleExpanded(serverName)}
              className="p-1 rounded !bg-bolt-elements-background-depth-2 hover:!bg-bolt-elements-background-depth-3 transition-colors"
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-bolt-elements-textSecondary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-bolt-elements-textSecondary" />
              )}
            </button>

            {/* Server Name & Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-bolt-elements-textPrimary truncate">{serverName}</h3>
                <Badge variant="subtle" size="sm" className={typeInfo.color}>
                  {typeInfo.label}
                </Badge>
                {!canConnect && (
                  <Badge variant="danger" size="sm" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Config Error
                  </Badge>
                )}
              </div>

              <div className="text-xs text-bolt-elements-textSecondary truncate">
                {mcpServer.config.type === 'stdio' ? (
                  <span>
                    {mcpServer.config.command} {mcpServer.config.args?.join(' ')}
                  </span>
                ) : (
                  <span>{mcpServer.config.url}</span>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status Badge */}
            {isCheckingServers ? (
              <McpStatusBadge status="checking" />
            ) : (
              <McpStatusBadge status={isAvailable ? 'available' : 'unavailable'} />
            )}

            {/* Tool Count */}
            {isAvailable && (
              <Badge variant="secondary" size="sm">
                {serverTools.length} tool{serverTools.length !== 1 ? 's' : ''}
              </Badge>
            )}

            {/* Enable/Disable Toggle */}
            <div className="flex items-center gap-1">
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isToggling || !canConnect}
                aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${serverName}`}
              />
              {isEnabled ? <Play className="w-3 h-3 text-green-600" /> : <Pause className="w-3 h-3 text-gray-400" />}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEditServer}
                className="h-8 w-8 !bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary hover:!bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textSecondary"
                aria-label={`Configure ${serverName}`}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-8 w-8 !bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary hover:!bg-bolt-elements-background-depth-3 hover:text-red-600"
                aria-label={`Remove ${serverName}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {!isAvailable && mcpServer.error && (
          <div className="mt-3 p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400">
              <strong>Error:</strong> {mcpServer.error}
            </p>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pl-7 space-y-3">
            {isAvailable ? (
              <div>
                <h4 className="text-sm font-medium text-bolt-elements-textSecondary mb-2">
                  Available Tools ({serverTools.length})
                </h4>
                {serverTools.length === 0 ? (
                  <p className="text-sm text-bolt-elements-textTertiary italic">No tools available from this server</p>
                ) : (
                  <div className="space-y-2">
                    {serverTools.map(([toolName, toolSchema]) => (
                      <McpServerListItem
                        key={`${serverName}-${toolName}`}
                        toolName={toolName}
                        toolSchema={toolSchema}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
                <p className="text-sm text-bolt-elements-textSecondary">
                  Server is not available. Check the configuration and ensure the server is running.
                </p>
              </div>
            )}

            {/* Server Configuration Preview */}
            <details className="mt-4">
              <summary className="text-sm font-medium text-bolt-elements-textSecondary cursor-pointer hover:text-bolt-elements-textPrimary">
                View Configuration
              </summary>
              <div className="mt-2 p-3 rounded-md bg-bolt-elements-background-depth-2">
                <pre className="text-xs text-bolt-elements-textSecondary font-mono">
                  {JSON.stringify(sanitizeConfigForDisplay(mcpServer.config), null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleRemoveServer}
        title={`Remove ${serverName}?`}
        description="This will permanently remove the MCP server configuration. This action cannot be undone."
        confirmLabel="Remove Server"
        variant="destructive"
      />

      {/* Edit Server Dialog */}
      <RadixDialog.Root open={showEditDialog} onOpenChange={setShowEditDialog}>
        <Dialog className="max-w-2xl">
          <div className="p-6">
            <DialogTitle className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5" />
              Edit Server: {serverName}
            </DialogTitle>

            <div className="space-y-4">
              {editedConfig.type === 'stdio' ? (
                <>
                  <div>
                    <Label htmlFor="edit-command">Command</Label>
                    <Input
                      id="edit-command"
                      value={editedConfig.command || ''}
                      onChange={(e) => handleConfigChange('command', e.target.value)}
                      placeholder="e.g., npx, node, python"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-args">Arguments (one per line)</Label>
                    <Textarea
                      id="edit-args"
                      value={editedConfig.args?.join('\n') || ''}
                      onChange={(e) => handleConfigChange('args', e.target.value.split('\n').filter(Boolean))}
                      className="min-h-[80px]"
                      placeholder="-y\n@modelcontextprotocol/server-example"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="edit-url">Server URL</Label>
                  <Input
                    id="edit-url"
                    value={editedConfig.url || ''}
                    onChange={(e) => handleConfigChange('url', e.target.value)}
                    placeholder="https://api.example.com/mcp"
                  />
                </div>
              )}

              {/* API Key Configuration */}
              {editedConfig.type === 'stdio' &&
                (() => {
                  const serverType = detectServerType(serverName, editedConfig);
                  const apiConfig = serverType ? SERVER_API_CONFIGS[serverType] : null;

                  if (apiConfig) {
                    return (
                      <div className="border border-bolt-elements-borderColor rounded-lg p-4">
                        <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2">
                          🔑 API Configuration
                        </h4>
                        <div className="space-y-4">
                          {Object.entries(apiConfig).map(([key, config]) => (
                            <div key={key}>
                              <Label htmlFor={`api-${key}`} className="flex items-center gap-2">
                                {config.label}
                                {config.required && <span className="text-red-500">*</span>}
                              </Label>
                              <Input
                                id={`api-${key}`}
                                type="password"
                                placeholder={config.placeholder}
                                value={apiKeys[key] || ''}
                                onChange={(e) => handleApiKeyChange(key, e.target.value)}
                                className="font-mono text-xs"
                              />
                              <p className="text-xs text-bolt-elements-textSecondary mt-1">{config.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

              <div className="bg-bolt-elements-background-depth-2 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Configuration Preview</h4>
                <pre className="text-xs text-bolt-elements-textSecondary font-mono">
                  {JSON.stringify(editedConfig, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveConfig}
                className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                disabled={editedConfig.type === 'stdio' ? !editedConfig.command : !editedConfig.url}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Dialog>
      </RadixDialog.Root>
    </div>
  );
}
