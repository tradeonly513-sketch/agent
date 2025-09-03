import { useState, useMemo } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Dialog, DialogTitle } from '~/components/ui/Dialog';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Label } from '~/components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Badge } from '~/components/ui/Badge';
import {
  Plus,
  Server,
  Globe,
  Terminal,
  Zap,
  FileText,
  Search,
  Database,
  Brain,
  MessageSquare,
  Cloud,
  Github,
} from 'lucide-react';
import type { MCPServerConfig } from '~/lib/services/mcpService';

const SERVER_TEMPLATES = {
  stdio: [
    {
      id: 'everything',
      name: 'Everything Server',
      description: 'Comprehensive MCP server with multiple tools - great for testing',
      category: 'General',
      icon: <Zap className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
      },
      tags: ['verified', 'popular', 'multi-tool', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'filesystem',
      name: 'Filesystem Server',
      description: 'Access and manipulate local files and directories',
      category: 'Files',
      icon: <FileText className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      },
      tags: ['verified', 'files', 'local', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'memory',
      name: 'Memory Server',
      description: 'Persistent memory and knowledge storage',
      category: 'AI',
      icon: <Brain className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      },
      tags: ['verified', 'memory', 'ai', 'storage', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'postgres',
      name: 'PostgreSQL Server',
      description: 'Connect and query PostgreSQL databases',
      category: 'Database',
      icon: <Database className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
      },
      tags: ['verified', 'database', 'sql', 'postgres', 'requires-setup'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires PostgreSQL database credentials',
    },
    {
      id: 'github',
      name: 'GitHub Server',
      description: 'GitHub repository and issue management',
      category: 'Development',
      icon: <Github className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
      },
      tags: ['verified', 'github', 'git', 'issues', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires GitHub Personal Access Token',
    },
    {
      id: 'puppeteer',
      name: 'Puppeteer Server',
      description: 'Web scraping and browser automation',
      category: 'Web',
      icon: <Globe className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      },
      tags: ['verified', 'scraping', 'automation', 'browser', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'slack',
      name: 'Slack Server',
      description: 'Slack workspace and messaging integration',
      category: 'Communication',
      icon: <MessageSquare className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
      },
      tags: ['verified', 'slack', 'messaging', 'communication', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Slack Bot Token',
    },
    {
      id: 'gdrive',
      name: 'Google Drive Server',
      description: 'Google Drive file management and operations',
      category: 'Cloud',
      icon: <Cloud className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-gdrive'],
      },
      tags: ['verified', 'google', 'drive', 'cloud', 'files', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Google OAuth credentials',
    },
  ],
  http: [
    {
      id: 'deepwiki',
      name: 'DeepWiki Server',
      description: 'Access Wikipedia and knowledge base functionality',
      category: 'Knowledge',
      icon: <Search className="w-5 h-5" />,
      config: {
        type: 'streamable-http' as const,
        url: 'https://mcp.deepwiki.com/mcp',
      },
      tags: ['verified', 'wikipedia', 'search', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'exa-search',
      name: 'Exa Web Search',
      description: 'Advanced web search with Exa (formerly Metaphor)',
      category: 'Web',
      icon: <Search className="w-5 h-5" />,
      config: {
        type: 'streamable-http' as const,
        url: 'https://mcp.exa.ai/search',
      },
      tags: ['verified', 'search', 'web', 'ai', 'semantic', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Exa API key',
    },
  ],
};

const CATEGORIES = [
  'All',
  'General',
  'Files',
  'Development',
  'Database',
  'Web',
  'Knowledge',
  'Cloud',
  'AI',
  'Communication',
];

interface ApiKeyConfig {
  [key: string]: {
    label: string;
    placeholder: string;
    description: string;
    required: boolean;
  };
}

const SERVER_API_CONFIGS: Record<string, ApiKeyConfig> = {
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
  'exa-search': {
    EXA_API_KEY: {
      label: 'Exa API Key',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get your API key from exa.ai dashboard',
      required: true,
    },
  },
};

interface McpServerWizardProps {
  onAddServer: (serverName: string, config: MCPServerConfig) => void;
}

export default function McpServerWizard({ onAddServer }: McpServerWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'template' | 'custom' | 'configure'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [customConfig, setCustomConfig] = useState<any>({
    type: 'stdio',
  });
  const [serverName, setServerName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  const filteredTemplates = useMemo(() => {
    const allTemplates = [...SERVER_TEMPLATES.stdio, ...SERVER_TEMPLATES.http];
    return selectedCategory === 'All'
      ? allTemplates
      : allTemplates.filter((template) => template.category === selectedCategory);
  }, [selectedCategory]);

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setServerName(template.id);
    setStep('configure');
  };

  const handleCustomConfigure = () => {
    setSelectedTemplate(null);
    setStep('configure');
  };

  const handleSubmit = () => {
    const baseConfig = selectedTemplate ? selectedTemplate.config : (customConfig as MCPServerConfig);

    // Add API keys as environment variables for STDIO servers
    let finalConfig = { ...baseConfig };

    if (selectedTemplate && selectedTemplate.requiresAuth && Object.keys(apiKeys).length > 0) {
      if (baseConfig.type === 'stdio') {
        finalConfig = {
          ...baseConfig,
          env: {
            ...baseConfig.env,
            ...apiKeys,
          },
        };
      } else if (baseConfig.type === 'streamable-http') {
        // For HTTP servers, add API keys as headers
        const authHeaders: Record<string, string> = {};

        if (apiKeys.EXA_API_KEY) {
          authHeaders.Authorization = `Bearer ${apiKeys.EXA_API_KEY}`;
        }

        finalConfig = {
          ...baseConfig,
          headers: {
            ...baseConfig.headers,
            ...authHeaders,
          },
        };
      }
    }

    onAddServer(serverName, finalConfig);
    setIsOpen(false);
    resetWizard();
  };

  const resetWizard = () => {
    setStep('template');
    setSelectedTemplate(null);
    setCustomConfig({ type: 'stdio' });
    setServerName('');
    setApiKeys({});
  };

  const isConfigValid = () => {
    if (!serverName.trim()) {
      return false;
    }

    // Check if required API keys are provided
    if (selectedTemplate && selectedTemplate.requiresAuth) {
      const requiredKeys = SERVER_API_CONFIGS[selectedTemplate.id];

      if (requiredKeys) {
        const missingKeys = Object.entries(requiredKeys)
          .filter(([key, config]) => config.required && !apiKeys[key])
          .map(([key]) => key);

        if (missingKeys.length > 0) {
          return false;
        }
      }
    }

    if (selectedTemplate) {
      return true;
    }

    if (customConfig.type === 'stdio') {
      return !!customConfig.command;
    } else {
      return !!customConfig.url;
    }
  };

  const handleApiKeyChange = (key: string, value: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <RadixDialog.Trigger asChild>
        <Button className="flex items-center gap-2 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover">
          <Plus className="w-4 h-4" />
          Add MCP Server
        </Button>
      </RadixDialog.Trigger>
      <Dialog className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Add MCP Server
          </DialogTitle>

          {step === 'template' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-bolt-elements-textSecondary mb-4">
                  Choose a template to get started quickly, or create a custom configuration
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="secondary" onClick={() => setStep('template')}>
                    Use Template
                  </Button>
                  <Button variant="outline" onClick={handleCustomConfigure}>
                    Custom Configuration
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((category) => (
                    <Badge
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {filteredTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:border-bolt-elements-borderColorActive transition-colors"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-bolt-elements-background-depth-2">{template.icon}</div>
                            <div>
                              <CardTitle className="text-sm">{template.name}</CardTitle>
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            {template.status === 'verified' && (
                              <Badge variant="success" size="sm" className="text-xs">
                                Verified
                              </Badge>
                            )}
                            {template.requiresAuth && (
                              <Badge variant="warning" size="sm" className="text-xs">
                                Needs Auth
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-xs mb-2">{template.description}</CardDescription>
                        {template.authNote && (
                          <div className="mb-2 p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                            <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {template.authNote}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {template.tags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'custom' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium">Custom MCP Server Configuration</h3>
                <p className="text-bolt-elements-textSecondary text-sm">Configure your own MCP server connection</p>
              </div>

              <Tabs
                value={customConfig.type}
                onValueChange={(value) => setCustomConfig({ ...customConfig, type: value as any })}
              >
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="stdio" className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    STDIO
                  </TabsTrigger>
                  <TabsTrigger value="sse" className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    SSE
                  </TabsTrigger>
                  <TabsTrigger value="streamable-http" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    HTTP
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="stdio" className="space-y-4">
                  <div>
                    <Label htmlFor="command">Command</Label>
                    <Input
                      id="command"
                      placeholder="e.g., npx, node, python"
                      value={customConfig.command || ''}
                      onChange={(e) => setCustomConfig({ ...customConfig, command: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="args">Arguments (one per line)</Label>
                    <Textarea
                      id="args"
                      className="min-h-[80px]"
                      placeholder="-y&#10;@modelcontextprotocol/server-example"
                      value={customConfig.args?.join('\n') || ''}
                      onChange={(e) =>
                        setCustomConfig({
                          ...customConfig,
                          args: e.target.value.split('\n').filter(Boolean),
                        })
                      }
                    />
                  </div>
                </TabsContent>

                <TabsContent value="sse" className="space-y-4">
                  <div>
                    <Label htmlFor="url">Server URL</Label>
                    <Input
                      id="url"
                      placeholder="http://localhost:8000/sse"
                      value={customConfig.url || ''}
                      onChange={(e) => setCustomConfig({ ...customConfig, url: e.target.value })}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="streamable-http" className="space-y-4">
                  <div>
                    <Label htmlFor="http-url">Server URL</Label>
                    <Input
                      id="http-url"
                      placeholder="https://api.example.com/mcp"
                      value={customConfig.url || ''}
                      onChange={(e) => setCustomConfig({ ...customConfig, url: e.target.value })}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {step === 'configure' && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">
                  {selectedTemplate ? `Configure ${selectedTemplate.name}` : 'Configure Custom Server'}
                </h3>
                <p className="text-bolt-elements-textSecondary text-sm">Finalize your server configuration</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="server-name">Server Name</Label>
                  <Input
                    id="server-name"
                    placeholder="Enter a unique server name"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                  />
                </div>

                {selectedTemplate && selectedTemplate.requiresAuth && SERVER_API_CONFIGS[selectedTemplate.id] && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">🔑 API Configuration Required</CardTitle>
                      <CardDescription className="text-xs">
                        This server requires API keys or credentials to function properly
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(SERVER_API_CONFIGS[selectedTemplate.id]).map(([key, config]) => (
                        <div key={key}>
                          <Label htmlFor={key} className="flex items-center gap-2">
                            {config.label}
                            {config.required && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            id={key}
                            type="password"
                            placeholder={config.placeholder}
                            value={apiKeys[key] || ''}
                            onChange={(e) => handleApiKeyChange(key, e.target.value)}
                            className="font-mono text-xs"
                          />
                          <p className="text-xs text-bolt-elements-textSecondary mt-1">{config.description}</p>
                        </div>
                      ))}

                      <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <h4 className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                          🔒 Security Notice
                        </h4>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          API keys are stored locally and passed securely to the MCP server via environment variables.
                          They are never sent to external services.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedTemplate && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        {selectedTemplate.icon}
                        <div>
                          <CardTitle className="text-sm">{selectedTemplate.name}</CardTitle>
                          <CardDescription className="text-xs">{selectedTemplate.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-bolt-elements-background-depth-1 p-3 rounded-lg">
                        <pre className="text-xs text-bolt-elements-textSecondary">
                          {JSON.stringify(selectedTemplate.config, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setStep('template')}>
                  Back
                </Button>
                <Button
                  className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                  onClick={handleSubmit}
                  disabled={!isConfigValid()}
                >
                  Add Server
                </Button>
              </div>
            </div>
          )}

          {step === 'custom' && (
            <div className="flex gap-3 justify-end mt-6">
              <Button variant="outline" onClick={() => setStep('template')}>
                Back
              </Button>
              <Button
                className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                onClick={() => setStep('configure')}
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}
