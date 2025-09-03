import { useState } from 'react';
import { Switch } from '~/components/ui/Switch';
import { Button } from '~/components/ui/Button';
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
                  {JSON.stringify(mcpServer.config, null, 2)}
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
