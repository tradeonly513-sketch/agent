import { create } from 'zustand';
import type { MCPConfig, MCPServerTools } from '~/lib/services/mcpService';
import { mcpConfigSchema } from '~/lib/services/mcpService';
import { z } from 'zod';
import {
  validateModelForToolCalling,
  getRecommendedModelsForServer,
  type ToolCallingCapability,
} from '~/lib/services/model-capabilities';

const MCP_SETTINGS_KEY = 'mcp_settings';
const CURRENT_VERSION = '2.0.0'; // Increment version for new model mapping feature
const isBrowser = typeof window !== 'undefined';

export type ServerModelMapping = {
  provider: string;
  model: string;
  enabled: boolean; // Whether to use custom model for this server
};

export type ModelValidationResult = {
  isSupported: boolean;
  capability: ToolCallingCapability;
  warnings: string[];
  recommendations: string[];
};

type MCPSettings = {
  version?: string;
  mcpConfig: MCPConfig;
  maxLLMSteps: number;
  enabledServers: Record<string, boolean>;
  serverModelMappings: Record<string, ServerModelMapping>; // serverName -> model config
  globalFallbackModel?: ServerModelMapping; // Default model when server-specific not set
};

const serverModelMappingSchema = z.object({
  provider: z.string(),
  model: z.string(),
  enabled: z.boolean().default(true),
});

const mcpSettingsSchema = z.object({
  version: z.string().optional(),
  mcpConfig: mcpConfigSchema,
  maxLLMSteps: z.number().min(1).max(20).default(5),
  enabledServers: z.record(z.boolean()).default({}),
  serverModelMappings: z.record(serverModelMappingSchema).default({}),
  globalFallbackModel: serverModelMappingSchema.optional(),
});

const defaultSettings: MCPSettings = {
  version: CURRENT_VERSION,
  maxLLMSteps: 5,
  mcpConfig: {
    mcpServers: {},
  },
  enabledServers: {},
  serverModelMappings: {},
  globalFallbackModel: {
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    enabled: true,
  },
};

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
  resetToDefaults: () => Promise<void>;
  getValidationErrors: () => string[];

  // Model mapping actions
  setServerModel: (serverName: string, mapping: ServerModelMapping) => Promise<void>;
  removeServerModel: (serverName: string) => Promise<void>;
  setGlobalFallbackModel: (mapping: ServerModelMapping) => Promise<void>;
  validateServerModel: (serverName: string, provider: string, model: string) => ModelValidationResult;
  getRecommendedModels: (serverName: string) => string[];
  getServerModel: (serverName: string) => ServerModelMapping | null;
};

// Helper functions for localStorage operations with better error handling
const safeGetFromLocalStorage = (key: string): string | null => {
  if (!isBrowser) {
    return null;
  }

  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Failed to read from localStorage key "${key}":`, error);
    return null;
  }
};

const safeSetToLocalStorage = (key: string, value: string): boolean => {
  if (!isBrowser) {
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Failed to write to localStorage key "${key}":`, error);
    return false;
  }
};

const safeRemoveFromLocalStorage = (key: string): void => {
  if (!isBrowser) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove from localStorage key "${key}":`, error);
  }
};

const validateAndMigrateSettings = (rawData: any): { settings: MCPSettings; errors: string[] } => {
  const errors: string[] = [];

  // Handle version migration
  if (rawData && rawData.version === '1.0.0') {
    // Migrate from v1.0.0 to v2.0.0 - add model mapping fields
    rawData = {
      ...rawData,
      version: CURRENT_VERSION,
      serverModelMappings: {},
      globalFallbackModel: defaultSettings.globalFallbackModel,
    };
    console.log('MCP Store: Migrated settings from v1.0.0 to v2.0.0');
  }

  // Try to validate with schema
  try {
    const validatedSettings = mcpSettingsSchema.parse(rawData);

    // Add version if missing
    if (!validatedSettings.version) {
      validatedSettings.version = CURRENT_VERSION;
    }

    // Set default values for new fields if missing
    if (!validatedSettings.serverModelMappings) {
      validatedSettings.serverModelMappings = {};
    }

    if (!validatedSettings.globalFallbackModel) {
      validatedSettings.globalFallbackModel = defaultSettings.globalFallbackModel;
    }

    return { settings: validatedSettings, errors };
  } catch (validationError) {
    if (validationError instanceof z.ZodError) {
      errors.push(...validationError.errors.map((err) => `${err.path.join('.')}: ${err.message}`));
    } else {
      errors.push(`Unexpected validation error: ${validationError}`);
    }

    // Try to salvage what we can
    const partialSettings: MCPSettings = { ...defaultSettings };

    if (rawData && typeof rawData === 'object') {
      // Salvage maxLLMSteps if valid
      if (typeof rawData.maxLLMSteps === 'number' && rawData.maxLLMSteps >= 1 && rawData.maxLLMSteps <= 20) {
        partialSettings.maxLLMSteps = rawData.maxLLMSteps;
      }

      // Salvage enabledServers if valid
      if (rawData.enabledServers && typeof rawData.enabledServers === 'object') {
        const validEnabledServers: Record<string, boolean> = {};

        for (const [key, value] of Object.entries(rawData.enabledServers)) {
          if (typeof value === 'boolean') {
            validEnabledServers[key] = value;
          }
        }
        partialSettings.enabledServers = validEnabledServers;
      }

      // Salvage serverModelMappings if valid
      if (rawData.serverModelMappings && typeof rawData.serverModelMappings === 'object') {
        const validMappings: Record<string, ServerModelMapping> = {};

        for (const [serverName, mapping] of Object.entries(rawData.serverModelMappings)) {
          if (
            mapping &&
            typeof mapping === 'object' &&
            typeof (mapping as any).provider === 'string' &&
            typeof (mapping as any).model === 'string'
          ) {
            validMappings[serverName] = mapping as ServerModelMapping;
          }
        }
        partialSettings.serverModelMappings = validMappings;
      }

      // Salvage globalFallbackModel if valid
      if (
        rawData.globalFallbackModel &&
        typeof rawData.globalFallbackModel === 'object' &&
        typeof rawData.globalFallbackModel.provider === 'string' &&
        typeof rawData.globalFallbackModel.model === 'string'
      ) {
        partialSettings.globalFallbackModel = rawData.globalFallbackModel as ServerModelMapping;
      }

      // Try to salvage MCP config
      if (rawData.mcpConfig && rawData.mcpConfig.mcpServers) {
        try {
          const validatedMcpConfig = mcpConfigSchema.parse(rawData.mcpConfig);
          partialSettings.mcpConfig = validatedMcpConfig;
        } catch {
          errors.push('MCP configuration was invalid and could not be recovered');
        }
      }
    }

    return { settings: partialSettings, errors };
  }
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

      const savedConfig = safeGetFromLocalStorage(MCP_SETTINGS_KEY);
      console.log('MCP Store: saved config from localStorage:', savedConfig);

      if (savedConfig) {
        try {
          const rawSettings = JSON.parse(savedConfig);
          const { settings, errors } = validateAndMigrateSettings(rawSettings);

          if (errors.length > 0) {
            console.warn('MCP Store: Configuration validation errors detected:', errors);
            set(() => ({
              error: `Configuration validation errors: ${errors.join('; ')}. Some settings have been reset to defaults.`,
            }));
          }

          console.log('MCP Store: validated settings:', JSON.stringify(settings, null, 2));
          console.log('MCP Store: calling updateServerConfig with:', JSON.stringify(settings.mcpConfig, null, 2));

          try {
            const serverTools = await updateServerConfig(settings.mcpConfig);
            console.log('MCP Store: updateServerConfig returned:', Object.keys(serverTools));

            set(() => ({ settings, serverTools, error: errors.length > 0 ? get().error : null }));

            // Save the validated/migrated settings back to localStorage
            const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(settings));

            if (!success) {
              console.warn('MCP Store: Failed to save validated settings to localStorage');
            }
          } catch (configError) {
            console.error('MCP Store: Failed to update server config:', configError);
            set(() => ({
              settings,
              error: `Failed to initialize MCP servers: ${configError instanceof Error ? configError.message : String(configError)}`,
            }));
          }
        } catch (parseError) {
          console.error('Error parsing saved mcp config:', parseError);

          // Clear corrupted data and use defaults
          safeRemoveFromLocalStorage(MCP_SETTINGS_KEY);

          const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(defaultSettings));

          set(() => ({
            settings: defaultSettings,
            error: `Corrupted configuration detected and reset to defaults. ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          }));

          if (!success) {
            console.error('MCP Store: Failed to save default settings to localStorage');
          }
        }
      } else {
        console.log('MCP Store: no saved config found, using default settings');

        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(defaultSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save default settings to localStorage');
          set(() => ({
            error: 'Unable to save settings to localStorage. Settings will not persist between sessions.',
          }));
        }
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
        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(newSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save settings to localStorage');
        }
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
        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(newSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save settings to localStorage');
        }
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
        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(newSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save settings to localStorage');
        }
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
        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(newSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save settings to localStorage');
        }
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  resetToDefaults: async () => {
    try {
      set(() => ({ isUpdatingConfig: true }));

      const serverTools = await updateServerConfig(defaultSettings.mcpConfig);

      if (isBrowser) {
        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(defaultSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save default settings to localStorage');
        }
      }

      set(() => ({ settings: defaultSettings, serverTools, error: null }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  getValidationErrors: () => {
    const currentSettings = get().settings;

    try {
      mcpSettingsSchema.parse(currentSettings);
      return [];
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return validationError.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      }

      return ['Unknown validation error'];
    }
  },

  // Model mapping actions
  setServerModel: async (serverName: string, mapping: ServerModelMapping) => {
    const currentSettings = get().settings;
    const newSettings = {
      ...currentSettings,
      serverModelMappings: {
        ...currentSettings.serverModelMappings,
        [serverName]: mapping,
      },
    };

    try {
      set(() => ({ isUpdatingConfig: true }));

      if (isBrowser) {
        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(newSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save model mapping to localStorage');
        }
      }

      set(() => ({ settings: newSettings }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },

  removeServerModel: async (serverName: string) => {
    const currentSettings = get().settings;
    const { [serverName]: _, ...remainingMappings } = currentSettings.serverModelMappings;

    const newSettings = {
      ...currentSettings,
      serverModelMappings: remainingMappings,
    };

    try {
      set(() => ({ isUpdatingConfig: true }));

      if (isBrowser) {
        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(newSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save settings to localStorage');
        }
      }

      set(() => ({ settings: newSettings }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },

  setGlobalFallbackModel: async (mapping: ServerModelMapping) => {
    const currentSettings = get().settings;
    const newSettings = {
      ...currentSettings,
      globalFallbackModel: mapping,
    };

    try {
      set(() => ({ isUpdatingConfig: true }));

      if (isBrowser) {
        const success = safeSetToLocalStorage(MCP_SETTINGS_KEY, JSON.stringify(newSettings));

        if (!success) {
          console.warn('MCP Store: Failed to save global fallback model to localStorage');
        }
      }

      set(() => ({ settings: newSettings }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },

  validateServerModel: (serverName: string, provider: string, model: string): ModelValidationResult => {
    return validateModelForToolCalling(provider, model);
  },

  getRecommendedModels: (serverName: string): string[] => {
    // Return model names from all preference levels
    const excellent = getRecommendedModelsForServer(serverName, 'excellent');
    const good = getRecommendedModelsForServer(serverName, 'good');
    const budget = getRecommendedModelsForServer(serverName, 'budget');

    // Combine and deduplicate
    return [...new Set([...excellent, ...good, ...budget])];
  },

  getServerModel: (serverName: string): ServerModelMapping | null => {
    const settings = get().settings;
    return settings.serverModelMappings[serverName] || settings.globalFallbackModel || null;
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
