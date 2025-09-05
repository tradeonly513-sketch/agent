import { create } from 'zustand';
import type { MCPConfig, MCPServerTools } from '~/lib/services/mcpService';
import { mcpConfigSchema } from '~/lib/services/mcpService';
import { z } from 'zod';

const MCP_SETTINGS_KEY = 'mcp_settings';
const CURRENT_VERSION = '1.1.0'; // Updated for security fixes
const isBrowser = typeof window !== 'undefined';

// Simple encryption/decryption for sensitive data (not production-grade but better than plain text)
const ENCRYPTION_KEY = 'bolt_mcp_secure_storage_v1';

function encrypt(text: string): string {
  try {
    // Simple XOR encryption for basic obfuscation
    const key = ENCRYPTION_KEY;
    let result = '';

    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }

    return btoa(result); // Base64 encode
  } catch {
    return text; // Fallback to plain text if encryption fails
  }
}

function decrypt(encryptedText: string): string {
  try {
    const decoded = atob(encryptedText); // Base64 decode
    const key = ENCRYPTION_KEY;
    let result = '';

    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }

    return result;
  } catch {
    return encryptedText; // Fallback to encrypted text if decryption fails
  }
}

// Helper functions for sanitizing sensitive data in logs
function sanitizeMCPSettingsForLogging(settings: MCPSettings): MCPSettings {
  return {
    ...settings,
    mcpConfig: sanitizeMCPConfigForLogging(settings.mcpConfig),
  };
}

function sanitizeMCPConfigForLogging(config: MCPConfig): MCPConfig {
  const sanitized = { ...config };

  if (sanitized.mcpServers) {
    sanitized.mcpServers = {};

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      const sanitizedServerConfig = { ...serverConfig };

      // Sanitize environment variables for STDIO servers
      if (serverConfig.type === 'stdio' && 'env' in serverConfig && sanitizedServerConfig.type === 'stdio') {
        (sanitizedServerConfig as any).env = {};

        for (const [key, value] of Object.entries(serverConfig.env || {})) {
          if (isSensitiveEnvVar(key)) {
            (sanitizedServerConfig as any).env[key] = '[REDACTED]';
          } else {
            (sanitizedServerConfig as any).env[key] = value;
          }
        }
      }

      // Sanitize headers for HTTP/SSE servers
      if (
        (serverConfig.type === 'sse' || serverConfig.type === 'streamable-http') &&
        'headers' in serverConfig &&
        (sanitizedServerConfig.type === 'sse' || sanitizedServerConfig.type === 'streamable-http')
      ) {
        (sanitizedServerConfig as any).headers = {};

        for (const [key, value] of Object.entries((serverConfig as any).headers || {})) {
          if (isSensitiveHeader(key)) {
            (sanitizedServerConfig as any).headers[key] = '[REDACTED]';
          } else {
            (sanitizedServerConfig as any).headers[key] = value;
          }
        }
      }

      sanitized.mcpServers[serverName] = sanitizedServerConfig;
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

type MCPSettings = {
  version?: string;
  mcpConfig: MCPConfig;
  maxLLMSteps: number;
  enabledServers: Record<string, boolean>;
};

const mcpSettingsSchema = z.object({
  version: z.string().optional(),
  mcpConfig: mcpConfigSchema,
  maxLLMSteps: z.number().min(1).max(20).default(5),
  enabledServers: z.record(z.boolean()).default({}),
});

const defaultSettings: MCPSettings = {
  version: CURRENT_VERSION,
  maxLLMSteps: 5,
  mcpConfig: {
    mcpServers: {},
  },
  enabledServers: {},
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
};

// Helper functions for localStorage operations with better error handling
const safeGetFromLocalStorage = (key: string): string | null => {
  if (!isBrowser) {
    return null;
  }

  try {
    const encryptedValue = localStorage.getItem(key);

    if (encryptedValue) {
      return decrypt(encryptedValue);
    }

    return null;
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
    // Encrypt sensitive data before storing
    const encryptedValue = encrypt(value);
    localStorage.setItem(key, encryptedValue);

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
      const sanitizedConfig = savedConfig ? sanitizeMCPConfigForLogging(JSON.parse(savedConfig).mcpConfig) : null;
      console.log(
        'MCP Store: saved config from localStorage:',
        sanitizedConfig ? JSON.stringify(sanitizedConfig, null, 2) : null,
      );

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

          const sanitizedSettings = sanitizeMCPSettingsForLogging(settings);
          console.log('MCP Store: validated settings:', JSON.stringify(sanitizedSettings, null, 2));
          console.log(
            'MCP Store: calling updateServerConfig with:',
            JSON.stringify(sanitizeMCPConfigForLogging(settings.mcpConfig), null, 2),
          );

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
