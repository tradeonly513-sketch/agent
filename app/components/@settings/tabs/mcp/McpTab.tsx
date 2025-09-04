import { useEffect, useMemo, useState } from 'react';
import { classNames } from '~/utils/classNames';
import type { MCPConfig } from '~/lib/services/mcpService';
import { toast } from 'react-toastify';
import { useMCPStore } from '~/lib/stores/mcp';
import McpServerList from '~/components/@settings/tabs/mcp/McpServerList';
import McpServerWizard from '~/components/@settings/tabs/mcp/McpServerWizard';
import EnhancedMcpServerListItem from '~/components/@settings/tabs/mcp/EnhancedMcpServerListItem';
import ToolBrowser from '~/components/@settings/tabs/mcp/ToolBrowser';
import ModelConfigurationTab from '~/components/@settings/tabs/mcp/ModelConfigurationTab';
import { Button } from '~/components/ui/Button';
import { Badge } from '~/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Textarea } from '~/components/ui/Textarea';
import { Input } from '~/components/ui/Input';
import { RotateCcw, ExternalLink, Save, Settings, Play, Pause, CheckCircle, Server, Wrench, Brain } from 'lucide-react';

const EXAMPLE_MCP_CONFIG: MCPConfig = {
  mcpServers: {
    everything: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
    },
    deepwiki: {
      type: 'streamable-http',
      url: 'https://mcp.deepwiki.com/mcp',
    },
    'local-sse': {
      type: 'sse',
      url: 'http://localhost:8000/sse',
      headers: {
        Authorization: 'Bearer mytoken123',
      },
    },
  },
};

export default function McpTab() {
  const settings = useMCPStore((state) => state.settings);
  const isInitialized = useMCPStore((state) => state.isInitialized);
  const serverTools = useMCPStore((state) => state.serverTools);
  const initialize = useMCPStore((state) => state.initialize);
  const updateSettings = useMCPStore((state) => state.updateSettings);
  const checkServersAvailabilities = useMCPStore((state) => state.checkServersAvailabilities);
  const toggleServer = useMCPStore((state) => state.toggleServer);
  const addServer = useMCPStore((state) => state.addServer);
  const removeServer = useMCPStore((state) => state.removeServer);

  const [isSaving, setIsSaving] = useState(false);
  const [mcpConfigText, setMCPConfigText] = useState('');
  const [maxLLMSteps, setMaxLLMSteps] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingServers, setIsCheckingServers] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'enhanced' | 'json'>('enhanced');
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('servers');

  useEffect(() => {
    if (!isInitialized) {
      initialize().catch((err) => {
        setError(`Failed to initialize MCP settings: ${err instanceof Error ? err.message : String(err)}`);
        toast.error('Failed to load MCP configuration');
      });
    }
  }, [isInitialized]);

  useEffect(() => {
    setMCPConfigText(JSON.stringify(settings.mcpConfig, null, 2));
    setMaxLLMSteps(settings.maxLLMSteps);
    setError(null);
  }, [settings]);

  const parsedConfig = useMemo(() => {
    try {
      setError(null);
      return JSON.parse(mcpConfigText) as MCPConfig;
    } catch (e) {
      setError(`Invalid JSON format: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }, [mcpConfigText]);

  const handleMaxLLMCallChange = (value: string) => {
    setMaxLLMSteps(parseInt(value, 10));
  };

  const handleSave = async () => {
    if (!parsedConfig) {
      return;
    }

    setIsSaving(true);

    try {
      await updateSettings({
        mcpConfig: parsedConfig,
        maxLLMSteps,
        enabledServers: settings.enabledServers,
        serverModelMappings: settings.serverModelMappings,
        globalFallbackModel: settings.globalFallbackModel,
        version: settings.version,
      });
      toast.success('MCP configuration saved');

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save configuration');
      toast.error('Failed to save MCP configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadExample = () => {
    setMCPConfigText(JSON.stringify(EXAMPLE_MCP_CONFIG, null, 2));
    setError(null);
  };

  const checkServerAvailability = async () => {
    if (serverEntries.length === 0) {
      return;
    }

    setIsCheckingServers(true);
    setError(null);

    try {
      await checkServersAvailabilities();
    } catch (e) {
      setError(`Failed to check server availability: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsCheckingServers(false);
    }
  };

  const toggleServerExpanded = (serverName: string) => {
    setExpandedServer(expandedServer === serverName ? null : serverName);
  };

  const serverEntries = useMemo(() => Object.entries(serverTools), [serverTools]);

  const serverStats = useMemo(() => {
    const total = serverEntries.length;
    const available = serverEntries.filter(([, server]) => server.status === 'available').length;
    const enabled = Object.keys(settings.mcpConfig.mcpServers).filter(
      (name) => settings.enabledServers[name] !== false,
    ).length;
    const totalTools = serverEntries
      .filter(([, server]) => server.status === 'available')
      .reduce((acc, [, server]) => acc + (server.status === 'available' ? Object.keys(server.tools).length : 0), 0);

    return { total, available, enabled, totalTools };
  }, [serverEntries, settings]);

  const handleAddServer = async (serverName: string, config: any) => {
    try {
      await addServer(serverName, config);
      toast.success(`Added MCP server "${serverName}"`);
    } catch (error) {
      toast.error(`Failed to add server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleToggleServer = async (serverName: string, enabled: boolean) => {
    try {
      await toggleServer(serverName, enabled);
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} server "${serverName}"`);
    } catch (error) {
      toast.error(
        `Failed to ${enabled ? 'enable' : 'disable'} server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  };

  const handleRemoveServer = async (serverName: string) => {
    try {
      await removeServer(serverName);
      toast.success(`Removed server "${serverName}"`);
    } catch (error) {
      toast.error(`Failed to remove server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBulkEnable = async () => {
    const promises = Array.from(selectedServers).map((serverName) => handleToggleServer(serverName, true));
    await Promise.allSettled(promises);
    setSelectedServers(new Set());
    setBulkActionMode(false);
  };

  const handleBulkDisable = async () => {
    const promises = Array.from(selectedServers).map((serverName) => handleToggleServer(serverName, false));
    await Promise.allSettled(promises);
    setSelectedServers(new Set());
    setBulkActionMode(false);
  };

  const handleEditServer = async (serverName: string, newConfig: any) => {
    try {
      const currentSettings = settings;
      const updatedSettings = {
        ...currentSettings,
        mcpConfig: {
          mcpServers: {
            ...currentSettings.mcpConfig.mcpServers,
            [serverName]: newConfig,
          },
        },
      };

      await updateSettings(updatedSettings);
      toast.success(`Updated server "${serverName}"`);
    } catch (error) {
      toast.error(`Failed to update server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const selectAllServers = () => {
    setSelectedServers(new Set(serverEntries.map(([name]) => name)));
  };

  const deselectAllServers = () => {
    setSelectedServers(new Set());
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-bolt-elements-textPrimary">MCP Integration</h1>
          <p className="text-sm text-bolt-elements-textSecondary">
            Manage Model Context Protocol servers and browse available tools
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {serverStats.available}/{serverStats.total} Available
            </Badge>
            <Badge variant="primary" className="flex items-center gap-1">
              <Play className="w-3 h-3" />
              {serverStats.enabled} Enabled
            </Badge>
            <Badge variant="subtle">{serverStats.totalTools} Tools</Badge>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 !bg-bolt-elements-background-depth-2 !border-bolt-elements-borderColor">
          <TabsTrigger
            value="servers"
            className="flex items-center gap-2 !bg-transparent !text-bolt-elements-textSecondary data-[state=active]:!bg-bolt-elements-background-depth-1 data-[state=active]:!text-bolt-elements-textPrimary hover:!bg-bolt-elements-item-backgroundActive hover:!text-bolt-elements-textPrimary"
          >
            <Server className="w-4 h-4" />
            Servers
          </TabsTrigger>
          <TabsTrigger
            value="tools"
            className="flex items-center gap-2 !bg-transparent !text-bolt-elements-textSecondary data-[state=active]:!bg-bolt-elements-background-depth-1 data-[state=active]:!text-bolt-elements-textPrimary hover:!bg-bolt-elements-item-backgroundActive hover:!text-bolt-elements-textPrimary"
          >
            <Wrench className="w-4 h-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger
            value="models"
            className="flex items-center gap-2 !bg-transparent !text-bolt-elements-textSecondary data-[state=active]:!bg-bolt-elements-background-depth-1 data-[state=active]:!text-bolt-elements-textPrimary hover:!bg-bolt-elements-item-backgroundActive hover:!text-bolt-elements-textPrimary"
          >
            <Brain className="w-4 h-4" />
            Models
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="flex items-center gap-2 !bg-transparent !text-bolt-elements-textSecondary data-[state=active]:!bg-bolt-elements-background-depth-1 data-[state=active]:!text-bolt-elements-textPrimary hover:!bg-bolt-elements-item-backgroundActive hover:!text-bolt-elements-textPrimary"
          >
            <Settings className="w-4 h-4" />
            Config
          </TabsTrigger>
        </TabsList>

        {/* Server Management Tab */}
        <TabsContent value="servers" className="space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between bg-bolt-elements-background-depth-1 p-4 rounded-lg border border-bolt-elements-borderColor">
            <div className="flex items-center gap-3">
              <McpServerWizard onAddServer={handleAddServer} />

              <div className="h-6 w-px bg-bolt-elements-borderColor" />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'enhanced' ? 'json' : 'enhanced')}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                {viewMode === 'enhanced' ? 'JSON Mode' : 'Enhanced Mode'}
              </Button>

              {serverEntries.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkActionMode(!bulkActionMode)}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {bulkActionMode ? 'Exit Selection' : 'Bulk Actions'}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkServerAvailability}
                disabled={isCheckingServers || serverEntries.length === 0}
                className="flex items-center gap-2"
              >
                {isCheckingServers ? (
                  <div className="i-svg-spinners:90-ring-with-bg w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                Check Status
              </Button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {bulkActionMode && (
            <div className="bg-bolt-elements-item-backgroundAccent border border-bolt-elements-borderColor p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-bolt-elements-item-contentAccent">
                    {selectedServers.size} server{selectedServers.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllServers}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllServers}>
                      Clear
                    </Button>
                  </div>
                </div>

                {selectedServers.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleBulkEnable}>
                      <Play className="w-3 h-3 mr-1" />
                      Enable Selected
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleBulkDisable}>
                      <Pause className="w-3 h-3 mr-1" />
                      Disable Selected
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Server List */}
          {viewMode === 'enhanced' ? (
            <section aria-labelledby="server-list-heading">
              <div className="space-y-4">
                {serverEntries.length === 0 ? (
                  <div className="text-center py-8 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor">
                    <Server className="w-8 h-8 text-bolt-elements-textTertiary mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-bolt-elements-textSecondary">No MCP Servers</h3>
                    <p className="text-xs text-bolt-elements-textTertiary mt-1 mb-4">
                      Add your first MCP server to get started
                    </p>
                    <McpServerWizard onAddServer={handleAddServer} />
                  </div>
                ) : (
                  serverEntries.map(([serverName, mcpServer]) => (
                    <EnhancedMcpServerListItem
                      key={serverName}
                      serverName={serverName}
                      mcpServer={mcpServer}
                      isEnabled={settings.enabledServers[serverName] !== false}
                      isExpanded={expandedServer === serverName}
                      isCheckingServers={isCheckingServers}
                      onToggleExpanded={toggleServerExpanded}
                      onToggleEnabled={handleToggleServer}
                      onRemoveServer={handleRemoveServer}
                      onEditServer={handleEditServer}
                    />
                  ))
                )}
              </div>
            </section>
          ) : (
            <McpServerList
              checkingServers={isCheckingServers}
              expandedServer={expandedServer}
              serverEntries={serverEntries}
              toggleServerExpanded={toggleServerExpanded}
            />
          )}
        </TabsContent>

        {/* Tool Browser Tab */}
        <TabsContent value="tools" className="space-y-6">
          <ToolBrowser serverTools={serverTools} />
        </TabsContent>

        {/* Model Configuration Tab */}
        <TabsContent value="models" className="space-y-6">
          <ModelConfigurationTab serverTools={serverTools} />
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <section aria-labelledby="config-section-heading">
            <h2 className="text-base font-medium text-bolt-elements-textPrimary mb-3">Advanced Configuration</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="mcp-config" className="block text-sm text-bolt-elements-textSecondary mb-2">
                  Configuration JSON
                </label>
                <Textarea
                  id="mcp-config"
                  value={mcpConfigText}
                  onChange={(e) => setMCPConfigText(e.target.value)}
                  className={classNames(
                    'min-h-[18rem] font-mono text-sm',
                    'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor',
                    error ? 'border-bolt-elements-icon-error' : '',
                    'text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary',
                    'focus:border-bolt-elements-borderColorActive focus:ring-2 focus:ring-bolt-elements-borderColorActive/20',
                  )}
                />
              </div>
              <div>{error && <p className="mt-2 mb-2 text-sm text-bolt-elements-icon-error">{error}</p>}</div>
              <div>
                <label htmlFor="max-llm-steps" className="block text-sm text-bolt-elements-textSecondary mb-2">
                  Maximum number of sequential LLM calls (steps)
                </label>
                <Input
                  id="max-llm-steps"
                  type="number"
                  placeholder="Maximum number of sequential LLM calls"
                  min="1"
                  max="20"
                  value={maxLLMSteps}
                  onChange={(e) => handleMaxLLMCallChange(e.target.value)}
                  className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive"
                />
              </div>
              <div className="mt-2 text-sm text-bolt-elements-textSecondary">
                The MCP configuration format is identical to the one used in Claude Desktop.{' '}
                <a
                  href="https://modelcontextprotocol.io/examples"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bolt-elements-link hover:underline inline-flex items-center gap-1"
                >
                  View example servers
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadExample}
                className="bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3"
              >
                Load Example
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !parsedConfig}
                  className={classNames(
                    'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent',
                    'hover:bg-bolt-elements-item-backgroundActive',
                  )}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
