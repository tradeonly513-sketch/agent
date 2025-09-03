import { create } from 'zustand';
import type { MCPConfig, MCPServerTools } from '~/lib/services/mcpService';

const MCP_SETTINGS_KEY = 'mcp_settings';
const isBrowser = typeof window !== 'undefined';

type MCPSettings = {
  mcpConfig: MCPConfig;
  maxLLMSteps: number;
  enabledServers: Record<string, boolean>;
};

const defaultSettings = {
  maxLLMSteps: 5,
  mcpConfig: {
    mcpServers: {},
  },
  enabledServers: {},
} satisfies MCPSettings;

type Store = {
  isInitialized: boolean;
  settings: MCPSettings;
  serverTools: MCPServerTools;
  error: string | null;
  isUpdatingConfig: boolean;
};

type Actions = {
  initialize: () => Promise<void>;
  updateSettings: (settings: MCPSettings) => Promise<void>;
  checkServersAvailabilities: () => Promise<void>;
  toggleServer: (serverName: string, enabled: boolean) => Promise<void>;
  addServer: (serverName: string, config: any) => Promise<void>;
  removeServer: (serverName: string) => Promise<void>;
};

export const useMCPStore = create<Store & Actions>((set, get) => ({
  isInitialized: false,
  settings: defaultSettings,
  serverTools: {},
  error: null,
  isUpdatingConfig: false,
  initialize: async () => {
    console.log('MCP Store: initialize called');

    if (get().isInitialized) {
      console.log('MCP Store: already initialized, returning');
      return;
    }

    if (isBrowser) {
      console.log('MCP Store: running in browser, checking localStorage');

      const savedConfig = localStorage.getItem(MCP_SETTINGS_KEY);
      console.log('MCP Store: saved config from localStorage:', savedConfig);

      if (savedConfig) {
        try {
          const settings = JSON.parse(savedConfig) as MCPSettings;
          console.log('MCP Store: parsed settings:', JSON.stringify(settings, null, 2));
          console.log('MCP Store: calling updateServerConfig with:', JSON.stringify(settings.mcpConfig, null, 2));

          const serverTools = await updateServerConfig(settings.mcpConfig);
          console.log('MCP Store: updateServerConfig returned:', Object.keys(serverTools));

          set(() => ({ settings, serverTools }));
        } catch (error) {
          console.error('Error parsing saved mcp config:', error);
          set(() => ({
            error: `Error parsing saved mcp config: ${error instanceof Error ? error.message : String(error)}`,
          }));
        }
      } else {
        console.log('MCP Store: no saved config found, using default settings');
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(defaultSettings));
      }
    }

    console.log('MCP Store: setting isInitialized to true');
    set(() => ({ isInitialized: true }));
  },
  updateSettings: async (newSettings: MCPSettings) => {
    if (get().isUpdatingConfig) {
      return;
    }

    try {
      set(() => ({ isUpdatingConfig: true }));

      const serverTools = await updateServerConfig(newSettings.mcpConfig);

      if (isBrowser) {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(newSettings));
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  checkServersAvailabilities: async () => {
    const response = await fetch('/api/mcp-check', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }

    const serverTools = (await response.json()) as MCPServerTools;

    set(() => ({ serverTools }));
  },
  toggleServer: async (serverName: string, enabled: boolean) => {
    const currentSettings = get().settings;
    const newSettings = {
      ...currentSettings,
      enabledServers: {
        ...currentSettings.enabledServers,
        [serverName]: enabled,
      },
    };

    try {
      set(() => ({ isUpdatingConfig: true }));

      // Create filtered config with only enabled servers
      const filteredMcpConfig = {
        mcpServers: Object.fromEntries(
          Object.entries(currentSettings.mcpConfig.mcpServers).filter(
            ([name]) => newSettings.enabledServers[name] !== false,
          ),
        ),
      };

      const serverTools = await updateServerConfig(filteredMcpConfig);

      if (isBrowser) {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(newSettings));
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  addServer: async (serverName: string, config: any) => {
    const currentSettings = get().settings;
    const newSettings = {
      ...currentSettings,
      mcpConfig: {
        mcpServers: {
          ...currentSettings.mcpConfig.mcpServers,
          [serverName]: config,
        },
      },
      enabledServers: {
        ...currentSettings.enabledServers,
        [serverName]: true,
      },
    };

    try {
      set(() => ({ isUpdatingConfig: true }));

      const serverTools = await updateServerConfig(newSettings.mcpConfig);

      if (isBrowser) {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(newSettings));
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  removeServer: async (serverName: string) => {
    const currentSettings = get().settings;
    const { [serverName]: _, ...remainingServers } = currentSettings.mcpConfig.mcpServers;
    const { [serverName]: __, ...remainingEnabledServers } = currentSettings.enabledServers;

    const newSettings = {
      ...currentSettings,
      mcpConfig: {
        mcpServers: remainingServers,
      },
      enabledServers: remainingEnabledServers,
    };

    try {
      set(() => ({ isUpdatingConfig: true }));

      const serverTools = await updateServerConfig(newSettings.mcpConfig);

      if (isBrowser) {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(newSettings));
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
}));

async function updateServerConfig(config: MCPConfig) {
  const response = await fetch('/api/mcp-update-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as MCPServerTools;

  return data;
}
