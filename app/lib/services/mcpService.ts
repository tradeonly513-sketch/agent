import {
  experimental_createMCPClient,
  type ToolSet,
  type Message,
  type DataStreamWriter,
  convertToCoreMessages,
  formatDataStreamPart,
} from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';
import type { ToolCallAnnotation } from '~/types/context';
import {
  TOOL_EXECUTION_APPROVAL,
  TOOL_EXECUTION_DENIED,
  TOOL_EXECUTION_ERROR,
  TOOL_NO_EXECUTE_FUNCTION,
} from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import { getCapabilitySummary, getRecommendedModelsForServer } from '~/lib/services/model-capabilities';

const logger = createScopedLogger('mcp-service');

export const stdioServerConfigSchema = z
  .object({
    type: z.enum(['stdio']).optional(),
    command: z.string().min(1, 'Command cannot be empty'),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    env: z.record(z.string()).optional(),
  })
  .transform((data) => ({
    ...data,
    type: 'stdio' as const,
  }));
export type STDIOServerConfig = z.infer<typeof stdioServerConfigSchema>;

export const sseServerConfigSchema = z
  .object({
    type: z.enum(['sse']).optional(),
    url: z.string().url('URL must be a valid URL format'),
    headers: z.record(z.string()).optional(),
  })
  .transform((data) => ({
    ...data,
    type: 'sse' as const,
  }));
export type SSEServerConfig = z.infer<typeof sseServerConfigSchema>;

export const streamableHTTPServerConfigSchema = z
  .object({
    type: z.enum(['streamable-http']).optional(),
    url: z.string().url('URL must be a valid URL format'),
    headers: z.record(z.string()).optional(),
  })
  .transform((data) => ({
    ...data,
    type: 'streamable-http' as const,
  }));

export type StreamableHTTPServerConfig = z.infer<typeof streamableHTTPServerConfigSchema>;

export const mcpServerConfigSchema = z.union([
  stdioServerConfigSchema,
  sseServerConfigSchema,
  streamableHTTPServerConfigSchema,
]);
export type MCPServerConfig = z.infer<typeof mcpServerConfigSchema>;

export const mcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerConfigSchema),
});
export type MCPConfig = z.infer<typeof mcpConfigSchema>;

export type MCPClient = {
  tools: () => Promise<ToolSet>;
  close: () => Promise<void>;
} & {
  serverName: string;
};

export type ToolCall = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
};

export type MCPServerTools = Record<string, MCPServer>;

export type MCPServerAvailable = {
  status: 'available';
  tools: ToolSet;
  client: MCPClient;
  config: MCPServerConfig;
};
export type MCPServerUnavailable = {
  status: 'unavailable';
  error: string;
  client: MCPClient | null;
  config: MCPServerConfig;
};
export type MCPServer = MCPServerAvailable | MCPServerUnavailable;

type ToolAnalytics = {
  toolName: string;
  serverName: string;
  invocations: number;
  successCount: number;
  errorCount: number;
  totalResponseTime: number;
  averageResponseTime: number;
  lastUsed: string;
  errorMessages: string[];
  userSatisfactionScore?: number;

  // Model-specific analytics
  modelPerformance: Record<
    string,
    {
      provider: string;
      model: string;
      invocations: number;
      successCount: number;
      averageResponseTime: number;
      lastUsed: string;
    }
  >;
};

type ServerAnalytics = {
  serverName: string;
  toolCount: number;
  totalInvocations: number;
  successRate: number;
  averageResponseTime: number;
  uptimePercentage: number;
  lastHealthCheck: string;
  issueCounts: {
    connection: number;
    timeout: number;
    authentication: number;
    other: number;
  };

  // Model-specific server performance
  modelPerformance: Record<
    string,
    {
      provider: string;
      model: string;
      toolInvocations: number;
      successRate: number;
      averageResponseTime: number;
      lastUsed: string;
      compatibilityScore: 'excellent' | 'good' | 'limited' | 'poor' | 'unknown';
    }
  >;
  recommendedModel?: {
    provider: string;
    model: string;
    reasoning: string;
  };
};

type AnalyticsData = {
  tools: Record<string, ToolAnalytics>;
  servers: Record<string, ServerAnalytics>;
  recommendations: {
    accuracy: number;
    totalRecommendations: number;
    acceptedRecommendations: number;
  };
  lastUpdated: string;
};

type ConflictResolutionStrategy =
  | 'server-prefix' // Add server name as prefix: github:read_file, filesystem:read_file
  | 'priority-based' // Use server priority ranking
  | 'user-choice' // Let user choose preferred tool
  | 'last-wins' // Last registered server wins (current behavior)
  | 'merge-capabilities'; // Merge tools with different capabilities

type ToolConflict = {
  toolName: string;
  servers: Array<{
    serverName: string;
    tool: any;
    priority?: number;
  }>;
  resolutionStrategy: ConflictResolutionStrategy;
  userPreference?: string; // Preferred server for this tool
  resolved: boolean;
};

type ConflictResolutionConfig = {
  defaultStrategy: ConflictResolutionStrategy;
  serverPriorities: Record<string, number>; // Higher number = higher priority
  userToolPreferences: Record<string, string>; // toolName -> preferredServerName
  autoResolveConflicts: boolean;
  usePrefixedNames: boolean;
};

export class MCPService {
  private static _instance: MCPService;
  private _tools: ToolSet = {};
  private _toolsWithoutExecute: ToolSet = {};
  private _mcpToolsPerServer: MCPServerTools = {};
  private _toolNamesToServerNames = new Map<string, string>();
  private _toolsByServer: Map<string, ToolSet> = new Map();
  private _serverCapabilities: Map<string, string[]> = new Map();
  private _config: MCPConfig = {
    mcpServers: {},
  };
  private _retryAttempts: Map<string, number> = new Map();
  private readonly _maxRetries = 3;
  private readonly _baseRetryDelay = 1000; // 1 second
  private _analytics: AnalyticsData = {
    tools: {},
    servers: {},
    recommendations: {
      accuracy: 0,
      totalRecommendations: 0,
      acceptedRecommendations: 0,
    },
    lastUpdated: new Date().toISOString(),
  };
  private readonly _analyticsStorageKey = 'mcp_analytics_data';
  private _conflictResolutionConfig: ConflictResolutionConfig = {
    defaultStrategy: 'user-choice',
    serverPriorities: {
      github: 100,
      filesystem: 90,
      git: 80,
      shell: 70,
      sqlite: 60,
      everything: 50,
    },
    userToolPreferences: {},
    autoResolveConflicts: false,
    usePrefixedNames: true,
  };
  private _toolConflicts: Map<string, ToolConflict> = new Map();
  private readonly _conflictConfigStorageKey = 'mcp_conflict_resolution_config';

  static getInstance(): MCPService {
    if (!MCPService._instance) {
      MCPService._instance = new MCPService();
      MCPService._instance._initializeAnalytics();
      MCPService._instance._initializeConflictResolution();
    }

    return MCPService._instance;
  }

  private _initializeAnalytics(): void {
    if (typeof window !== 'undefined') {
      try {
        const savedAnalytics = localStorage.getItem(this._analyticsStorageKey);

        if (savedAnalytics) {
          const parsed = JSON.parse(savedAnalytics) as AnalyticsData;

          // Validate and migrate analytics data if needed
          this._analytics = this._validateAndMigrateAnalytics(parsed);
        }
      } catch (error) {
        logger.warn('Failed to load analytics data:', error);
        this._resetAnalytics();
      }
    }
  }

  private _validateAndMigrateAnalytics(data: any): AnalyticsData {
    // Basic validation and migration of analytics data structure
    const defaultAnalytics: AnalyticsData = {
      tools: {},
      servers: {},
      recommendations: {
        accuracy: 0,
        totalRecommendations: 0,
        acceptedRecommendations: 0,
      },
      lastUpdated: new Date().toISOString(),
    };

    if (!data || typeof data !== 'object') {
      return defaultAnalytics;
    }

    return {
      tools: data.tools && typeof data.tools === 'object' ? data.tools : {},
      servers: data.servers && typeof data.servers === 'object' ? data.servers : {},
      recommendations:
        data.recommendations && typeof data.recommendations === 'object'
          ? data.recommendations
          : defaultAnalytics.recommendations,
      lastUpdated: data.lastUpdated || defaultAnalytics.lastUpdated,
    };
  }

  private _resetAnalytics(): void {
    this._analytics = {
      tools: {},
      servers: {},
      recommendations: {
        accuracy: 0,
        totalRecommendations: 0,
        acceptedRecommendations: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
    this._saveAnalytics();
  }

  private _saveAnalytics(): void {
    if (typeof window !== 'undefined') {
      try {
        this._analytics.lastUpdated = new Date().toISOString();
        localStorage.setItem(this._analyticsStorageKey, JSON.stringify(this._analytics));
      } catch (error) {
        logger.warn('Failed to save analytics data:', error);
      }
    }
  }

  private _initializeConflictResolution(): void {
    if (typeof window !== 'undefined') {
      try {
        const savedConfig = localStorage.getItem(this._conflictConfigStorageKey);

        if (savedConfig) {
          const parsed = JSON.parse(savedConfig) as ConflictResolutionConfig;
          this._conflictResolutionConfig = this._validateConflictConfig(parsed);
        }
      } catch (error) {
        logger.warn('Failed to load conflict resolution config:', error);
      }
    }
  }

  private _validateConflictConfig(config: any): ConflictResolutionConfig {
    const defaultConfig: ConflictResolutionConfig = {
      defaultStrategy: 'user-choice',
      serverPriorities: {
        github: 100,
        filesystem: 90,
        git: 80,
        shell: 70,
        sqlite: 60,
        everything: 50,
      },
      userToolPreferences: {},
      autoResolveConflicts: false,
      usePrefixedNames: true,
    };

    if (!config || typeof config !== 'object') {
      return defaultConfig;
    }

    return {
      defaultStrategy: ['server-prefix', 'priority-based', 'user-choice', 'last-wins', 'merge-capabilities'].includes(
        config.defaultStrategy,
      )
        ? config.defaultStrategy
        : defaultConfig.defaultStrategy,
      serverPriorities:
        config.serverPriorities && typeof config.serverPriorities === 'object'
          ? { ...defaultConfig.serverPriorities, ...config.serverPriorities }
          : defaultConfig.serverPriorities,
      userToolPreferences:
        config.userToolPreferences && typeof config.userToolPreferences === 'object' ? config.userToolPreferences : {},
      autoResolveConflicts:
        typeof config.autoResolveConflicts === 'boolean'
          ? config.autoResolveConflicts
          : defaultConfig.autoResolveConflicts,
      usePrefixedNames:
        typeof config.usePrefixedNames === 'boolean' ? config.usePrefixedNames : defaultConfig.usePrefixedNames,
    };
  }

  private _saveConflictConfig(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this._conflictConfigStorageKey, JSON.stringify(this._conflictResolutionConfig));
      } catch (error) {
        logger.warn('Failed to save conflict resolution config:', error);
      }
    }
  }

  private _trackToolInvocation(
    toolName: string,
    serverName: string,
    success: boolean,
    responseTime: number,
    errorMessage?: string,
    modelInfo?: { provider: string; model: string },
  ): void {
    const toolKey = `${serverName}:${toolName}`;

    // Initialize tool analytics if not exists
    if (!this._analytics.tools[toolKey]) {
      this._analytics.tools[toolKey] = {
        toolName,
        serverName,
        invocations: 0,
        successCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        lastUsed: new Date().toISOString(),
        errorMessages: [],
        userSatisfactionScore: undefined,
        modelPerformance: {},
      };
    }

    const toolAnalytics = this._analytics.tools[toolKey];

    // Update metrics
    toolAnalytics.invocations += 1;
    toolAnalytics.totalResponseTime += responseTime;
    toolAnalytics.averageResponseTime = toolAnalytics.totalResponseTime / toolAnalytics.invocations;
    toolAnalytics.lastUsed = new Date().toISOString();

    if (success) {
      toolAnalytics.successCount += 1;
    } else {
      toolAnalytics.errorCount += 1;

      if (errorMessage) {
        // Keep only last 5 error messages to prevent storage bloat
        toolAnalytics.errorMessages.push(errorMessage);

        if (toolAnalytics.errorMessages.length > 5) {
          toolAnalytics.errorMessages.shift();
        }
      }
    }

    // Track model-specific performance
    if (modelInfo) {
      const modelKey = `${modelInfo.provider}:${modelInfo.model}`;

      if (!toolAnalytics.modelPerformance[modelKey]) {
        toolAnalytics.modelPerformance[modelKey] = {
          provider: modelInfo.provider,
          model: modelInfo.model,
          invocations: 0,
          successCount: 0,
          averageResponseTime: 0,
          lastUsed: new Date().toISOString(),
        };
      }

      const modelPerf = toolAnalytics.modelPerformance[modelKey];
      modelPerf.invocations += 1;

      if (success) {
        modelPerf.successCount += 1;
      }

      // Update average response time using running average
      modelPerf.averageResponseTime =
        (modelPerf.averageResponseTime * (modelPerf.invocations - 1) + responseTime) / modelPerf.invocations;
      modelPerf.lastUsed = new Date().toISOString();
    }

    // Update server analytics
    this._updateServerAnalytics(serverName, success, responseTime);

    // Save analytics data
    this._saveAnalytics();
  }

  private _updateServerAnalytics(serverName: string, success: boolean, responseTime: number): void {
    // Initialize server analytics if not exists
    if (!this._analytics.servers[serverName]) {
      this._analytics.servers[serverName] = {
        serverName,
        toolCount: 0,
        totalInvocations: 0,
        successRate: 0,
        averageResponseTime: 0,
        uptimePercentage: 100,
        lastHealthCheck: new Date().toISOString(),
        issueCounts: {
          connection: 0,
          timeout: 0,
          authentication: 0,
          other: 0,
        },
        modelPerformance: {},
      };
    }

    const serverAnalytics = this._analytics.servers[serverName];

    // Update server metrics
    serverAnalytics.totalInvocations += 1;
    serverAnalytics.averageResponseTime =
      (serverAnalytics.averageResponseTime * (serverAnalytics.totalInvocations - 1) + responseTime) /
      serverAnalytics.totalInvocations;

    // Update tool count for this server
    const serverTools = this._toolsByServer.get(serverName);

    if (serverTools) {
      serverAnalytics.toolCount = Object.keys(serverTools).length;
    }

    // Recalculate success rate based on all tool invocations for this server
    let totalSuccesses = 0;
    let totalInvocations = 0;

    Object.values(this._analytics.tools).forEach((tool) => {
      if (tool.serverName === serverName) {
        totalSuccesses += tool.successCount;
        totalInvocations += tool.invocations;
      }
    });

    serverAnalytics.successRate = totalInvocations > 0 ? (totalSuccesses / totalInvocations) * 100 : 0;
  }

  private _trackRecommendation(accepted: boolean): void {
    this._analytics.recommendations.totalRecommendations += 1;

    if (accepted) {
      this._analytics.recommendations.acceptedRecommendations += 1;
    }

    this._analytics.recommendations.accuracy =
      (this._analytics.recommendations.acceptedRecommendations / this._analytics.recommendations.totalRecommendations) *
      100;

    this._saveAnalytics();
  }

  private _validateServerConfig(serverName: string, config: any): MCPServerConfig {
    // Enhanced validation with better error messages
    if (!config || typeof config !== 'object') {
      throw new Error(`Server "${serverName}" configuration must be an object. Received: ${typeof config}`);
    }

    const hasStdioField = config.command !== undefined;
    const hasUrlField = config.url !== undefined;

    // Validate mutual exclusivity
    if (hasStdioField && hasUrlField) {
      throw new Error(
        `Server "${serverName}" cannot have both "command" and "url" fields. Use "command" for STDIO servers or "url" for remote servers.`,
      );
    }

    if (!hasStdioField && !hasUrlField) {
      throw new Error(
        `Server "${serverName}" must have either a "command" field (for STDIO) or "url" field (for SSE/Streamable-HTTP). Please specify one.`,
      );
    }

    // Auto-detect type if missing
    if (!config.type && hasStdioField) {
      config.type = 'stdio';
      logger.debug(`Server "${serverName}": Auto-detected type as "stdio" based on command field`);
    }

    if (hasUrlField && !config.type) {
      throw new Error(
        `Server "${serverName}" with URL field must specify "type" as either "sse" or "streamable-http".`,
      );
    }

    // Validate type field
    const validTypes = ['stdio', 'sse', 'streamable-http'];

    if (!validTypes.includes(config.type)) {
      throw new Error(
        `Server "${serverName}" has invalid type "${config.type}". Valid types are: ${validTypes.join(', ')}`,
      );
    }

    // Type-specific validation with helpful messages
    if (config.type === 'stdio') {
      if (!hasStdioField) {
        throw new Error(
          `Server "${serverName}" of type "stdio" requires a "command" field specifying the executable path.`,
        );
      }

      if (typeof config.command !== 'string' || config.command.trim() === '') {
        throw new Error(
          `Server "${serverName}" command must be a non-empty string. Received: ${typeof config.command}`,
        );
      }

      if (config.args && !Array.isArray(config.args)) {
        throw new Error(`Server "${serverName}" args must be an array of strings. Received: ${typeof config.args}`);
      }

      if (config.env && typeof config.env !== 'object') {
        throw new Error(
          `Server "${serverName}" env must be an object with string values. Received: ${typeof config.env}`,
        );
      }
    }

    if (['sse', 'streamable-http'].includes(config.type)) {
      if (!hasUrlField) {
        throw new Error(`Server "${serverName}" of type "${config.type}" requires a "url" field.`);
      }

      if (typeof config.url !== 'string') {
        throw new Error(`Server "${serverName}" url must be a string. Received: ${typeof config.url}`);
      }

      // Basic URL validation
      try {
        new URL(config.url);
      } catch {
        throw new Error(
          `Server "${serverName}" has invalid URL format: "${config.url}". Please provide a valid URL starting with http:// or https://`,
        );
      }

      if (config.headers && typeof config.headers !== 'object') {
        throw new Error(
          `Server "${serverName}" headers must be an object with string values. Received: ${typeof config.headers}`,
        );
      }
    }

    // Schema validation with enhanced error messages
    try {
      return mcpServerConfigSchema.parse(config);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const detailedErrors = validationError.errors.map((err) => {
          const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
          return `${path}${err.message}`;
        });
        throw new Error(
          `Server "${serverName}" configuration validation failed:\n${detailedErrors.map((e) => `  • ${e}`).join('\n')}`,
        );
      }

      throw new Error(`Server "${serverName}" configuration validation failed: ${validationError}`);
    }
  }

  async updateConfig(config: MCPConfig) {
    logger.debug('updateConfig called with:', JSON.stringify(config, null, 2));
    logger.debug('Number of servers in config:', Object.keys(config.mcpServers || {}).length);

    this._config = config;
    await this._createClients();

    logger.debug('After createClients, registered servers:', Object.keys(this._mcpToolsPerServer));

    return this._mcpToolsPerServer;
  }

  private async _createStreamableHTTPClient(
    serverName: string,
    config: StreamableHTTPServerConfig,
  ): Promise<MCPClient> {
    logger.debug(`Creating Streamable-HTTP client for ${serverName} with URL: ${config.url}`);

    const client = await experimental_createMCPClient({
      transport: new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: {
          headers: config.headers,
        },
      }),
    });

    return Object.assign(client, { serverName });
  }

  private async _createSSEClient(serverName: string, config: SSEServerConfig): Promise<MCPClient> {
    logger.debug(`Creating SSE client for ${serverName} with URL: ${config.url}`);

    const client = await experimental_createMCPClient({
      transport: config,
    });

    return Object.assign(client, { serverName });
  }

  private async _createStdioClient(serverName: string, config: STDIOServerConfig): Promise<MCPClient> {
    logger.debug(
      `Creating STDIO client for '${serverName}' with command: '${config.command}' ${config.args?.join(' ') || ''}`,
    );

    const client = await experimental_createMCPClient({ transport: new Experimental_StdioMCPTransport(config) });

    return Object.assign(client, { serverName });
  }

  private _registerTools(serverName: string, tools: ToolSet) {
    // Store tools grouped by server
    this._toolsByServer.set(serverName, tools);

    // Analyze server capabilities based on tool names and descriptions
    const capabilities = this._analyzeServerCapabilities(tools);
    this._serverCapabilities.set(serverName, capabilities);

    // Process each tool with enhanced conflict resolution
    for (const [toolName, tool] of Object.entries(tools)) {
      this._processToolRegistration(toolName, tool, serverName);
    }
  }

  private _processToolRegistration(toolName: string, tool: any, serverName: string): void {
    const existingTool = this._tools[toolName];

    if (existingTool) {
      const existingServerName = this._toolNamesToServerNames.get(toolName);

      if (existingServerName && existingServerName !== serverName) {
        // Handle tool conflict
        this._handleToolConflict(toolName, tool, serverName, existingTool, existingServerName);
        return;
      }
    }

    // No conflict, register normally
    this._registerSingleTool(toolName, tool, serverName);
  }

  private _handleToolConflict(
    toolName: string,
    newTool: any,
    newServerName: string,
    existingTool: any,
    existingServerName: string,
  ): void {
    // Check if we already have a conflict record for this tool
    let conflict = this._toolConflicts.get(toolName);

    if (!conflict) {
      // Create new conflict record
      conflict = {
        toolName,
        servers: [
          {
            serverName: existingServerName,
            tool: existingTool,
            priority: this._conflictResolutionConfig.serverPriorities[existingServerName] || 0,
          },
          {
            serverName: newServerName,
            tool: newTool,
            priority: this._conflictResolutionConfig.serverPriorities[newServerName] || 0,
          },
        ],
        resolutionStrategy: this._conflictResolutionConfig.defaultStrategy,
        userPreference: this._conflictResolutionConfig.userToolPreferences[toolName],
        resolved: false,
      };
    } else {
      // Add new server to existing conflict
      conflict.servers.push({
        serverName: newServerName,
        tool: newTool,
        priority: this._conflictResolutionConfig.serverPriorities[newServerName] || 0,
      });
    }

    this._toolConflicts.set(toolName, conflict);

    // Attempt to resolve conflict based on strategy
    this._resolveToolConflict(conflict);
  }

  private _resolveToolConflict(conflict: ToolConflict): void {
    const { toolName, servers, resolutionStrategy, userPreference } = conflict;

    logger.info(`Resolving tool conflict for "${toolName}" using strategy: ${resolutionStrategy}`);

    switch (resolutionStrategy) {
      case 'server-prefix':
        this._resolveWithServerPrefix(conflict);
        break;

      case 'priority-based':
        this._resolveWithPriority(conflict);
        break;

      case 'user-choice':
        if (userPreference) {
          this._resolveWithUserChoice(conflict, userPreference);
        } else if (this._conflictResolutionConfig.autoResolveConflicts) {
          // Fall back to priority-based if no user preference and auto-resolve is enabled
          this._resolveWithPriority(conflict);
        } else {
          logger.warn(
            `Tool conflict for "${toolName}" requires user choice. Falling back to priority-based resolution.`,
          );
          this._resolveWithPriority(conflict);
        }

        break;

      case 'last-wins':
        this._resolveWithLastWins(conflict);
        break;

      case 'merge-capabilities':
        this._resolveWithMergeCapabilities(conflict);
        break;

      default:
        logger.warn(`Unknown conflict resolution strategy: ${resolutionStrategy}. Using priority-based fallback.`);
        this._resolveWithPriority(conflict);
    }

    conflict.resolved = true;
  }

  private _resolveWithServerPrefix(conflict: ToolConflict): void {
    // Register all versions with server prefixes
    conflict.servers.forEach(({ serverName, tool }) => {
      const prefixedName = `${serverName}:${conflict.toolName}`;
      this._registerSingleTool(prefixedName, tool, serverName);
      logger.info(`Registered tool "${prefixedName}" from server "${serverName}"`);
    });

    // Also register the highest priority version without prefix if enabled
    if (!this._conflictResolutionConfig.usePrefixedNames) {
      const highestPriority = conflict.servers.reduce((max, current) =>
        (current.priority || 0) > (max.priority || 0) ? current : max,
      );
      this._registerSingleTool(conflict.toolName, highestPriority.tool, highestPriority.serverName);
      logger.info(
        `Registered default tool "${conflict.toolName}" from highest priority server "${highestPriority.serverName}"`,
      );
    }
  }

  private _resolveWithPriority(conflict: ToolConflict): void {
    // Sort by priority (highest first)
    const sortedServers = [...conflict.servers].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const winner = sortedServers[0];

    this._registerSingleTool(conflict.toolName, winner.tool, winner.serverName);
    logger.info(
      `Resolved conflict for "${conflict.toolName}": "${winner.serverName}" wins (priority: ${winner.priority})`,
    );

    // Optionally register other versions with prefixes
    if (this._conflictResolutionConfig.usePrefixedNames) {
      sortedServers.slice(1).forEach(({ serverName, tool }) => {
        const prefixedName = `${serverName}:${conflict.toolName}`;
        this._registerSingleTool(prefixedName, tool, serverName);
      });
    }
  }

  private _resolveWithUserChoice(conflict: ToolConflict, preferredServer: string): void {
    const preferredTool = conflict.servers.find((s) => s.serverName === preferredServer);

    if (preferredTool) {
      this._registerSingleTool(conflict.toolName, preferredTool.tool, preferredTool.serverName);
      logger.info(`Resolved conflict for "${conflict.toolName}": user prefers "${preferredServer}"`);

      // Register other versions with prefixes if enabled
      if (this._conflictResolutionConfig.usePrefixedNames) {
        conflict.servers
          .filter((s) => s.serverName !== preferredServer)
          .forEach(({ serverName, tool }) => {
            const prefixedName = `${serverName}:${conflict.toolName}`;
            this._registerSingleTool(prefixedName, tool, serverName);
          });
      }
    } else {
      logger.warn(
        `User preferred server "${preferredServer}" not found for tool "${conflict.toolName}". Using priority-based fallback.`,
      );
      this._resolveWithPriority(conflict);
    }
  }

  private _resolveWithLastWins(conflict: ToolConflict): void {
    // Last server wins (current behavior)
    const lastServer = conflict.servers[conflict.servers.length - 1];
    this._registerSingleTool(conflict.toolName, lastServer.tool, lastServer.serverName);
    logger.info(`Resolved conflict for "${conflict.toolName}": "${lastServer.serverName}" wins (last registered)`);
  }

  private _resolveWithMergeCapabilities(conflict: ToolConflict): void {
    /*
     * For now, fall back to priority-based. Merging capabilities is complex and would require
     * analyzing tool schemas and creating composite tools
     */
    logger.info(`Merge capabilities not yet implemented for "${conflict.toolName}". Using priority-based fallback.`);
    this._resolveWithPriority(conflict);
  }

  private _registerSingleTool(toolName: string, tool: any, serverName: string): void {
    this._tools[toolName] = tool;
    this._toolsWithoutExecute[toolName] = { ...tool, execute: undefined };
    this._toolNamesToServerNames.set(toolName, serverName);
  }

  private _analyzeServerCapabilities(tools: ToolSet): string[] {
    const capabilities: Set<string> = new Set();

    for (const [toolName, tool] of Object.entries(tools)) {
      const description = tool.description?.toLowerCase() || '';

      // Common capability patterns
      if (toolName.includes('read') || description.includes('read') || description.includes('get')) {
        capabilities.add('read');
      }

      if (
        toolName.includes('write') ||
        description.includes('write') ||
        description.includes('create') ||
        description.includes('update')
      ) {
        capabilities.add('write');
      }

      if (toolName.includes('delete') || description.includes('delete') || description.includes('remove')) {
        capabilities.add('delete');
      }

      if (toolName.includes('search') || description.includes('search') || description.includes('find')) {
        capabilities.add('search');
      }

      if (toolName.includes('git') || description.includes('git') || description.includes('repository')) {
        capabilities.add('git');
      }

      if (toolName.includes('file') || description.includes('file') || description.includes('directory')) {
        capabilities.add('filesystem');
      }

      if (
        toolName.includes('web') ||
        description.includes('web') ||
        description.includes('http') ||
        description.includes('api')
      ) {
        capabilities.add('web');
      }

      if (toolName.includes('database') || description.includes('database') || description.includes('sql')) {
        capabilities.add('database');
      }
    }

    return Array.from(capabilities);
  }

  private async _createMCPClient(serverName: string, serverConfig: MCPServerConfig): Promise<MCPClient> {
    const validatedConfig = this._validateServerConfig(serverName, serverConfig);

    if (validatedConfig.type === 'stdio') {
      return await this._createStdioClient(serverName, serverConfig as STDIOServerConfig);
    } else if (validatedConfig.type === 'sse') {
      return await this._createSSEClient(serverName, serverConfig as SSEServerConfig);
    } else {
      return await this._createStreamableHTTPClient(serverName, serverConfig as StreamableHTTPServerConfig);
    }
  }

  private async _createClients() {
    await this._closeClients();

    logger.debug('_createClients called with config servers:', Object.keys(this._config?.mcpServers || {}));

    const createClientPromises = Object.entries(this._config?.mcpServers || []).map(async ([serverName, config]) => {
      let client: MCPClient | null = null;

      logger.debug(`Processing server: ${serverName}`, JSON.stringify(config, null, 2));

      try {
        client = await this._createMCPClientWithRetry(serverName, config);

        try {
          const tools = await client.tools();

          this._registerTools(serverName, tools);

          this._mcpToolsPerServer[serverName] = {
            status: 'available',
            client,
            tools,
            config,
          };

          logger.info(`Successfully initialized MCP server "${serverName}" with ${Object.keys(tools).length} tools`);
        } catch (error) {
          logger.error(`Failed to get tools from server ${serverName}:`, error);
          this._mcpToolsPerServer[serverName] = {
            status: 'unavailable',
            error: `Could not retrieve tools from server: ${(error as Error).message}`,
            client,
            config,
          };
        }
      } catch (error) {
        logger.error(`Failed to initialize MCP client for server: ${serverName}`, error);
        this._mcpToolsPerServer[serverName] = {
          status: 'unavailable',
          error: (error as Error).message,
          client,
          config,
        };
      }
    });

    await Promise.allSettled(createClientPromises);
  }

  async checkServersAvailabilities() {
    this._tools = {};
    this._toolsWithoutExecute = {};
    this._toolNamesToServerNames.clear();
    this._toolsByServer.clear();
    this._serverCapabilities.clear();

    const checkPromises = Object.entries(this._mcpToolsPerServer).map(async ([serverName, server]) => {
      let client = server.client;

      try {
        logger.debug(`Checking MCP server "${serverName}" availability: start`);

        if (!client) {
          client = await this._createMCPClientWithRetry(serverName, this._config?.mcpServers[serverName]);
        }

        try {
          const tools = await client.tools();

          this._registerTools(serverName, tools);

          this._mcpToolsPerServer[serverName] = {
            status: 'available',
            client,
            tools,
            config: server.config,
          };
        } catch (error) {
          logger.error(`Failed to get tools from server ${serverName}:`, error);
          this._mcpToolsPerServer[serverName] = {
            status: 'unavailable',
            error: 'could not retrieve tools from server',
            client,
            config: server.config,
          };
        }

        logger.debug(`Checking MCP server "${serverName}" availability: end`);
      } catch (error) {
        logger.error(`Failed to connect to server ${serverName}:`, error);
        this._mcpToolsPerServer[serverName] = {
          status: 'unavailable',
          error: `Could not connect to server: ${(error as Error).message}`,
          client,
          config: server.config,
        };
      }
    });

    await Promise.allSettled(checkPromises);

    // Log summary of server health after check
    const availableServers = Object.entries(this._mcpToolsPerServer).filter(
      ([_, server]) => server.status === 'available',
    );
    const unavailableServers = Object.entries(this._mcpToolsPerServer).filter(
      ([_, server]) => server.status === 'unavailable',
    );

    logger.info(
      `MCP Server Health Check Complete: ${availableServers.length} available, ${unavailableServers.length} unavailable`,
    );

    if (unavailableServers.length > 0) {
      logger.warn(
        'Unavailable MCP servers:',
        unavailableServers.map(
          ([name, server]) => `${name}: ${server.status === 'unavailable' ? server.error : 'Unknown error'}`,
        ),
      );

      // Schedule retry for failed servers (background process)
      this._scheduleFailedServerRetry(unavailableServers.map(([name]) => name));
    }

    return this._mcpToolsPerServer;
  }

  private _scheduleFailedServerRetry(failedServerNames: string[]): void {
    // Schedule background retry for failed servers after a longer delay
    setTimeout(async () => {
      logger.info('Attempting background retry for failed MCP servers:', failedServerNames);

      for (const serverName of failedServerNames) {
        const server = this._mcpToolsPerServer[serverName];

        if (server?.status === 'unavailable' && this._config.mcpServers[serverName]) {
          try {
            const client = await this._createMCPClientWithRetry(serverName, this._config.mcpServers[serverName]);
            const tools = await client.tools();

            this._registerTools(serverName, tools);
            this._mcpToolsPerServer[serverName] = {
              status: 'available',
              client,
              tools,
              config: server.config,
            };

            logger.info(`Background retry successful for MCP server "${serverName}"`);
          } catch (error) {
            logger.debug(`Background retry failed for MCP server "${serverName}":`, error);
          }
        }
      }
    }, 30000); // Retry after 30 seconds
  }

  getServerHealth(): { available: string[]; unavailable: Array<{ name: string; error: string }> } {
    const available: string[] = [];
    const unavailable: Array<{ name: string; error: string }> = [];

    Object.entries(this._mcpToolsPerServer).forEach(([name, server]) => {
      if (server.status === 'available') {
        available.push(name);
      } else {
        unavailable.push({ name, error: server.error || 'Unknown error' });
      }
    });

    return { available, unavailable };
  }

  private async _closeClients(): Promise<void> {
    const closePromises = Object.entries(this._mcpToolsPerServer).map(async ([serverName, server]) => {
      if (!server.client) {
        return;
      }

      logger.debug(`Closing client for server "${serverName}"`);

      try {
        await server.client.close();
      } catch (error) {
        logger.error(`Error closing client for ${serverName}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    this._tools = {};
    this._toolsWithoutExecute = {};
    this._mcpToolsPerServer = {};
    this._toolNamesToServerNames.clear();
    this._toolsByServer.clear();
    this._serverCapabilities.clear();
  }

  isValidToolName(toolName: string): boolean {
    return toolName in this._tools;
  }

  private _sanitizeParameters(params: any): Record<string, string | number | boolean | null> {
    if (!params || typeof params !== 'object') {
      return {};
    }

    const sanitized: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
        sanitized[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        // Convert complex objects to JSON strings for display
        sanitized[key] = JSON.stringify(value);
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  private async _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private _getRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this._baseRetryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * baseDelay;

    return baseDelay + jitter;
  }

  private async _createMCPClientWithRetry(serverName: string, config: MCPServerConfig): Promise<MCPClient> {
    const currentAttempts = this._retryAttempts.get(serverName) || 0;

    for (let attempt = currentAttempts; attempt <= this._maxRetries; attempt++) {
      this._retryAttempts.set(serverName, attempt);

      try {
        if (attempt > 0) {
          const delay = this._getRetryDelay(attempt - 1);
          logger.debug(
            `Retrying MCP client creation for ${serverName}, attempt ${attempt}/${this._maxRetries} after ${delay}ms delay`,
          );
          await this._sleep(delay);
        }

        const client = await this._createMCPClient(serverName, config);

        // Reset retry count on success
        this._retryAttempts.set(serverName, 0);
        logger.debug(`Successfully created MCP client for ${serverName} on attempt ${attempt + 1}`);

        return client;
      } catch (error) {
        logger.warn(
          `MCP client creation failed for ${serverName}, attempt ${attempt + 1}/${this._maxRetries + 1}:`,
          error,
        );

        if (attempt === this._maxRetries) {
          // Final attempt failed, enhance error message
          const enhancedError = new Error(
            `Failed to create MCP client for ${serverName} after ${this._maxRetries + 1} attempts. Last error: ${(error as Error).message}`,
          );
          throw enhancedError;
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error(`Unexpected error in retry logic for ${serverName}`);
  }

  processToolCall(
    toolCall: ToolCall,
    dataStream: DataStreamWriter,
    options?: {
      currentModel?: { provider: string; model: string };
      serverModelMappings?: Record<string, any>;
    },
  ): void {
    const { toolCallId, toolName } = toolCall;

    if (this.isValidToolName(toolName)) {
      const tool = this.toolsWithoutExecute[toolName];
      const { description = 'No description available', parameters } = tool;
      const serverName = this._toolNamesToServerNames.get(toolName);

      if (serverName) {
        const server = this._mcpToolsPerServer[serverName];
        const serverStatus = server?.status || 'unavailable';
        const serverType = server?.config?.type || 'stdio';
        const serverError = server?.status === 'unavailable' ? server.error : undefined;

        // Get analyzed server capabilities
        const serverCapabilities = this._serverCapabilities.get(serverName) || [];

        // Enhance with model context
        let modelContext;

        if (options?.currentModel) {
          // Functions are now imported at the top of the file

          // Get current model compatibility
          const currentCompatibility = getCapabilitySummary(options.currentModel.provider, options.currentModel.model);

          // Get recommended model for this server
          const recommendedModels = getRecommendedModelsForServer(serverName, 'excellent');
          let recommendedModel;

          if (recommendedModels.length > 0) {
            const firstRecommended = recommendedModels[0];
            let provider = 'OpenAI';

            if (firstRecommended.startsWith('claude')) {
              provider = 'Anthropic';
            } else if (firstRecommended.startsWith('gemini')) {
              provider = 'Google';
            } else if (firstRecommended.startsWith('grok')) {
              provider = 'xAI';
            } else if (firstRecommended.startsWith('deepseek')) {
              provider = 'Deepseek';
            } else if (firstRecommended.startsWith('mistral')) {
              provider = 'Mistral';
            }

            recommendedModel = {
              provider,
              model: firstRecommended,
              reasoning: `Optimized for ${serverName} server operations`,
            };
          }

          // Get user's server preference
          let serverPreference;

          if (options.serverModelMappings?.[serverName]) {
            const mapping = options.serverModelMappings[serverName];

            if (mapping.enabled) {
              serverPreference = {
                provider: mapping.provider,
                model: mapping.model,
                isUserConfigured: true,
              };
            }
          }

          modelContext = {
            currentModel: options.currentModel,
            ...(recommendedModel && { recommendedModel }),
            compatibilityScore: currentCompatibility.level,
            ...(serverPreference && { serverPreference }),
          };
        }

        const annotation: ToolCallAnnotation = {
          type: 'toolCall',
          toolCallId,
          serverName,
          toolName,
          toolDescription: description,
          serverStatus,
          serverType,
          ...(parameters && {
            toolSchema: {
              parameters: this._sanitizeParameters(parameters.properties || parameters),
              required: parameters.required || [],
            },
          }),
          ...(serverError && { serverError }),
          serverCapabilities,
          ...(modelContext && { modelContext }),
        };

        dataStream.writeMessageAnnotation(annotation);
      }
    }
  }

  async processToolInvocations(messages: Message[], dataStream: DataStreamWriter): Promise<Message[]> {
    const lastMessage = messages[messages.length - 1];
    const parts = lastMessage.parts;

    if (!parts) {
      return messages;
    }

    const processedParts = await Promise.all(
      parts.map(async (part) => {
        // Only process tool invocations parts
        if (part.type !== 'tool-invocation') {
          return part;
        }

        const { toolInvocation } = part;
        const { toolName, toolCallId } = toolInvocation;

        // return part as-is if tool does not exist, or if it's not a tool call result
        if (!this.isValidToolName(toolName) || toolInvocation.state !== 'result') {
          return part;
        }

        let result;

        if (toolInvocation.result === TOOL_EXECUTION_APPROVAL.APPROVE) {
          const toolInstance = this._tools[toolName];
          const serverName = this._toolNamesToServerNames.get(toolName);

          if (toolInstance && typeof toolInstance.execute === 'function') {
            logger.debug(`calling tool "${toolName}" with args: ${JSON.stringify(toolInvocation.args)}`);

            const startTime = Date.now();

            try {
              result = await toolInstance.execute(toolInvocation.args, {
                messages: convertToCoreMessages(messages),
                toolCallId,
              });

              // Track successful tool execution
              const responseTime = Date.now() - startTime;
              this._trackToolInvocation(toolName, serverName || 'unknown', true, responseTime);
            } catch (error) {
              logger.error(`error while calling tool "${toolName}":`, error);
              result = TOOL_EXECUTION_ERROR;

              // Track failed tool execution
              const responseTime = Date.now() - startTime;
              this._trackToolInvocation(
                toolName,
                serverName || 'unknown',
                false,
                responseTime,
                (error as Error).message,
              );
            }
          } else {
            result = TOOL_NO_EXECUTE_FUNCTION;
          }
        } else if (toolInvocation.result === TOOL_EXECUTION_APPROVAL.REJECT) {
          result = TOOL_EXECUTION_DENIED;
        } else {
          // For any unhandled responses, return the original part.
          return part;
        }

        // Forward updated tool result to the client.
        dataStream.write(
          formatDataStreamPart('tool_result', {
            toolCallId,
            result,
          }),
        );

        // Return updated toolInvocation with the actual result.
        return {
          ...part,
          toolInvocation: {
            ...toolInvocation,
            result,
          },
        };
      }),
    );

    // Finally return the processed messages
    return [...messages.slice(0, -1), { ...lastMessage, parts: processedParts }];
  }

  get tools() {
    return this._tools;
  }

  get toolsWithoutExecute() {
    return this._toolsWithoutExecute;
  }

  getToolsByServer(serverName?: string): Record<string, ToolSet> | ToolSet | undefined {
    if (serverName) {
      return this._toolsByServer.get(serverName);
    }

    return Object.fromEntries(this._toolsByServer.entries());
  }

  getServerCapabilities(serverName?: string): Record<string, string[]> | string[] | undefined {
    if (serverName) {
      return this._serverCapabilities.get(serverName);
    }

    return Object.fromEntries(this._serverCapabilities.entries());
  }

  getToolGroupingInfo(): {
    serverCount: number;
    toolCount: number;
    serverGroups: Array<{
      name: string;
      status: 'available' | 'unavailable';
      toolCount: number;
      capabilities: string[];
      tools: string[];
    }>;
  } {
    const serverGroups = Object.entries(this._mcpToolsPerServer).map(([name, server]) => ({
      name,
      status: server.status,
      toolCount: server.status === 'available' ? Object.keys(server.tools).length : 0,
      capabilities: this._serverCapabilities.get(name) || [],
      tools: server.status === 'available' ? Object.keys(server.tools) : [],
    }));

    return {
      serverCount: Object.keys(this._mcpToolsPerServer).length,
      toolCount: Object.keys(this._tools).length,
      serverGroups,
    };
  }

  getRecommendedToolsForTask(taskDescription: string): Array<{
    toolName: string;
    serverName: string;
    relevanceScore: number;
    reason: string;
  }> {
    const taskKeywords = taskDescription.toLowerCase().split(/\s+/);
    const recommendations: Array<{
      toolName: string;
      serverName: string;
      relevanceScore: number;
      reason: string;
    }> = [];

    for (const [toolName, tool] of Object.entries(this._tools)) {
      const serverName = this._toolNamesToServerNames.get(toolName);

      if (!serverName) {
        continue;
      }

      const toolDescription = (tool.description || '').toLowerCase();
      const toolNameLower = toolName.toLowerCase();

      let relevanceScore = 0;
      const matchReasons: string[] = [];

      // Check for direct keyword matches
      for (const keyword of taskKeywords) {
        if (toolNameLower.includes(keyword)) {
          relevanceScore += 3;
          matchReasons.push(`tool name contains "${keyword}"`);
        }

        if (toolDescription.includes(keyword)) {
          relevanceScore += 2;
          matchReasons.push(`description contains "${keyword}"`);
        }
      }

      // Boost score for server capabilities matching task
      const capabilities = this._serverCapabilities.get(serverName) || [];

      for (const capability of capabilities) {
        if (taskKeywords.some((keyword) => keyword.includes(capability) || capability.includes(keyword))) {
          relevanceScore += 1;
          matchReasons.push(`server has ${capability} capability`);
        }
      }

      if (relevanceScore > 0) {
        recommendations.push({
          toolName,
          serverName,
          relevanceScore,
          reason: matchReasons.join(', '),
        });
      }
    }

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10); // Top 10 recommendations
  }

  async performHealthCheck(): Promise<{
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    serverHealth: Array<{
      name: string;
      status: 'available' | 'unavailable';
      lastCheck: string;
      responseTime?: number;
      toolCount: number;
      capabilities: string[];
      issues: string[];
    }>;
    summary: {
      totalServers: number;
      availableServers: number;
      totalTools: number;
      lastFullCheck: string;
    };
  }> {
    const startTime = Date.now();
    logger.info('Starting comprehensive MCP health check');

    const serverHealth = await Promise.all(
      Object.entries(this._config.mcpServers).map(async ([serverName, config]) => {
        const serverStartTime = Date.now();
        const issues: string[] = [];
        let serverStatus: 'available' | 'unavailable' = 'unavailable';
        let toolCount = 0;
        let capabilities: string[] = [];

        try {
          // Validate configuration
          this._validateServerConfig(serverName, config);

          const existingServer = this._mcpToolsPerServer[serverName];

          if (existingServer) {
            serverStatus = existingServer.status;

            if (existingServer.status === 'available') {
              toolCount = Object.keys(existingServer.tools).length;
              capabilities = this._serverCapabilities.get(serverName) || [];
            } else {
              issues.push(existingServer.error || 'Unknown error');
            }
          } else {
            issues.push('Server not initialized');
          }

          // Additional health checks
          if (config.type === 'stdio') {
            // For STDIO servers, we could check if the command exists
            if (typeof config.command === 'string' && config.command.includes('/')) {
              issues.push('Consider using command name instead of full path for better portability');
            }
          }

          if (['sse', 'streamable-http'].includes(config.type)) {
            const configWithUrl = config as SSEServerConfig | StreamableHTTPServerConfig;

            if (configWithUrl.url) {
              const url = new URL(configWithUrl.url);

              if (url.protocol === 'http:' && url.hostname !== 'localhost' && !url.hostname.startsWith('127.')) {
                issues.push('Using HTTP instead of HTTPS for non-local server may be insecure');
              }
            }
          }
        } catch (error) {
          issues.push(`Configuration validation failed: ${(error as Error).message}`);
        }

        return {
          name: serverName,
          status: serverStatus,
          lastCheck: new Date().toISOString(),
          responseTime: Date.now() - serverStartTime,
          toolCount,
          capabilities,
          issues,
        };
      }),
    );

    const availableCount = serverHealth.filter((s) => s.status === 'available').length;
    const totalServers = serverHealth.length;
    const totalTools = Object.keys(this._tools).length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (availableCount === totalServers && totalServers > 0) {
      overallStatus = 'healthy';
    } else if (availableCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const healthCheckResult = {
      overallStatus,
      serverHealth,
      summary: {
        totalServers,
        availableServers: availableCount,
        totalTools,
        lastFullCheck: new Date().toISOString(),
      },
    };

    logger.info(
      `Health check completed in ${Date.now() - startTime}ms: ${overallStatus} (${availableCount}/${totalServers} servers available)`,
    );

    return healthCheckResult;
  }

  validateAllConfigurations(): {
    valid: boolean;
    errors: Array<{
      serverName: string;
      errors: string[];
    }>;
  } {
    const validationResults: Array<{
      serverName: string;
      errors: string[];
    }> = [];

    for (const [serverName, config] of Object.entries(this._config.mcpServers)) {
      try {
        this._validateServerConfig(serverName, config);
      } catch (error) {
        validationResults.push({
          serverName,
          errors: [(error as Error).message],
        });
      }
    }

    return {
      valid: validationResults.length === 0,
      errors: validationResults,
    };
  }

  // Analytics public methods
  getAnalytics(): AnalyticsData {
    return { ...this._analytics };
  }

  getToolAnalytics(limit?: number): ToolAnalytics[] {
    const tools = Object.values(this._analytics.tools).sort((a, b) => b.invocations - a.invocations);

    return limit ? tools.slice(0, limit) : tools;
  }

  getServerAnalytics(): ServerAnalytics[] {
    return Object.values(this._analytics.servers).sort((a, b) => b.totalInvocations - a.totalInvocations);
  }

  getMostUsedTools(limit: number = 10): Array<ToolAnalytics & { successRate: number }> {
    return Object.values(this._analytics.tools)
      .map((tool) => ({
        ...tool,
        successRate: tool.invocations > 0 ? (tool.successCount / tool.invocations) * 100 : 0,
      }))
      .sort((a, b) => b.invocations - a.invocations)
      .slice(0, limit);
  }

  getProblematicTools(limit: number = 5): Array<ToolAnalytics & { errorRate: number }> {
    return Object.values(this._analytics.tools)
      .filter((tool) => tool.errorCount > 0)
      .map((tool) => ({
        ...tool,
        errorRate: (tool.errorCount / tool.invocations) * 100,
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }

  getPerformanceInsights(): {
    overallStats: {
      totalInvocations: number;
      averageSuccessRate: number;
      averageResponseTime: number;
      mostActiveServer: string;
      recommendationAccuracy: number;
    };
    recommendations: Array<{
      type: 'performance' | 'reliability' | 'usage';
      priority: 'high' | 'medium' | 'low';
      message: string;
      serverName?: string;
      toolName?: string;
    }>;
  } {
    const tools = Object.values(this._analytics.tools);
    const servers = Object.values(this._analytics.servers);

    const totalInvocations = tools.reduce((sum, tool) => sum + tool.invocations, 0);
    const totalSuccesses = tools.reduce((sum, tool) => sum + tool.successCount, 0);
    const averageSuccessRate = totalInvocations > 0 ? (totalSuccesses / totalInvocations) * 100 : 0;
    const averageResponseTime = tools.reduce((sum, tool) => sum + tool.averageResponseTime, 0) / tools.length || 0;

    const mostActiveServer =
      servers.reduce((max, server) => (server.totalInvocations > (max?.totalInvocations || 0) ? server : max))
        ?.serverName || 'none';

    const recommendations: Array<{
      type: 'performance' | 'reliability' | 'usage';
      priority: 'high' | 'medium' | 'low';
      message: string;
      serverName?: string;
      toolName?: string;
    }> = [];

    // Generate performance recommendations
    tools.forEach((tool) => {
      const errorRate = (tool.errorCount / tool.invocations) * 100;

      if (errorRate > 50) {
        recommendations.push({
          type: 'reliability',
          priority: 'high',
          message: `Tool "${tool.toolName}" has high error rate (${errorRate.toFixed(1)}%)`,
          serverName: tool.serverName,
          toolName: tool.toolName,
        });
      }

      if (tool.averageResponseTime > 10000) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          message: `Tool "${tool.toolName}" has slow response time (${(tool.averageResponseTime / 1000).toFixed(1)}s)`,
          serverName: tool.serverName,
          toolName: tool.toolName,
        });
      }
    });

    servers.forEach((server) => {
      if (server.successRate < 80) {
        recommendations.push({
          type: 'reliability',
          priority: 'high',
          message: `Server "${server.serverName}" has low success rate (${server.successRate.toFixed(1)}%)`,
          serverName: server.serverName,
        });
      }
    });

    return {
      overallStats: {
        totalInvocations,
        averageSuccessRate,
        averageResponseTime,
        mostActiveServer,
        recommendationAccuracy: this._analytics.recommendations.accuracy,
      },
      recommendations: recommendations
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
        .slice(0, 10),
    };
  }

  recordToolSatisfaction(toolName: string, score: number): void {
    const serverName = this._toolNamesToServerNames.get(toolName);

    if (serverName) {
      const toolKey = `${serverName}:${toolName}`;
      const toolAnalytics = this._analytics.tools[toolKey];

      if (toolAnalytics) {
        toolAnalytics.userSatisfactionScore = score;
        this._saveAnalytics();
      }
    }
  }

  recordRecommendationFeedback(accepted: boolean): void {
    this._trackRecommendation(accepted);
  }

  resetAnalytics(): void {
    this._resetAnalytics();
  }

  exportAnalytics(): string {
    return JSON.stringify(this._analytics, null, 2);
  }

  /**
   * Get the optimal model for a given set of tool calls
   * This analyzes which servers the tools belong to and recommends the best model
   */
  getOptimalModelForToolCalls(toolCalls: Array<{ toolName: string }>): {
    provider: string;
    model: string;
    reasoning: string;
  } | null {
    if (toolCalls.length === 0) {
      return null;
    }

    // Group tool calls by server
    const serverToolCounts: Record<string, number> = {};
    const serversInvolved: Set<string> = new Set();

    for (const { toolName } of toolCalls) {
      const serverName = this._toolNamesToServerNames.get(toolName);

      if (serverName) {
        serverToolCounts[serverName] = (serverToolCounts[serverName] || 0) + 1;
        serversInvolved.add(serverName);
      }
    }

    // If no servers involved, return null
    if (serversInvolved.size === 0) {
      return null;
    }

    /*
     * Get server-specific model preferences from MCP store
     * For now, we'll use a simple heuristic - if majority of tools are from one server type,
     * use that server's recommended model
     */
    const serverArray = Array.from(serversInvolved);

    // Simple strategy: use model recommendations for the server with the most tool calls
    const dominantServer = Object.entries(serverToolCounts).sort(([, a], [, b]) => b - a)[0][0];

    /*
     * Import the model capabilities to get recommendations
     * Functions are now imported at the top of the file
     */

    const recommendedModels = getRecommendedModelsForServer(dominantServer, 'excellent');

    if (recommendedModels.length > 0) {
      /*
       * For now, return the first excellent model
       * In the future, this could be enhanced to check model availability
       */
      const [firstModel] = recommendedModels;

      /*
       * Parse provider and model from the model string
       * This is a simplified approach - in practice you'd have a mapping
       */
      let provider = 'OpenAI';
      const model = firstModel;

      if (firstModel.startsWith('claude')) {
        provider = 'Anthropic';
      } else if (firstModel.startsWith('gemini')) {
        provider = 'Google';
      } else if (firstModel.startsWith('grok')) {
        provider = 'xAI';
      } else if (firstModel.startsWith('deepseek')) {
        provider = 'Deepseek';
      } else if (firstModel.startsWith('mistral')) {
        provider = 'Mistral';
      }

      return {
        provider,
        model,
        reasoning: `Optimized for ${dominantServer} server (${serverToolCounts[dominantServer]} of ${toolCalls.length} tool calls)`,
      };
    }

    return null;
  }

  /**
   * Get model preference for a specific server from MCP store
   * This would need to access the MCP store which requires a different approach
   * For now, we'll provide a method that can be called with server model mappings
   */
  getPreferredModelForServer(
    serverName: string,
    serverModelMappings: Record<string, any>,
  ): {
    provider: string;
    model: string;
  } | null {
    const mapping = serverModelMappings[serverName];

    if (mapping && mapping.enabled) {
      return {
        provider: mapping.provider,
        model: mapping.model,
      };
    }

    return null;
  }

  /**
   * Group available tools by their server capabilities for better model selection
   */
  getToolGroupingSuggestion(): {
    serverGroups: Array<{
      serverName: string;
      toolCount: number;
      capabilities: string[];
      suggestedModel: string | null;
    }>;
    overallRecommendation: {
      provider: string;
      model: string;
      reasoning: string;
    } | null;
  } {
    const serverGroups: Array<{
      serverName: string;
      toolCount: number;
      capabilities: string[];
      suggestedModel: string | null;
    }> = [];

    // Analyze each server
    for (const [serverName, tools] of this._toolsByServer.entries()) {
      const capabilities = this._serverCapabilities.get(serverName) || [];

      // Functions are now imported at the top of the file
      const recommendations = getRecommendedModelsForServer(serverName, 'excellent');

      serverGroups.push({
        serverName,
        toolCount: Object.keys(tools).length,
        capabilities,
        suggestedModel: recommendations[0] || null,
      });
    }

    // Overall recommendation based on the most significant server
    const primaryServer = serverGroups.reduce(
      (max, current) => (current.toolCount > max.toolCount ? current : max),
      serverGroups[0],
    );

    let overallRecommendation = null;

    if (primaryServer?.suggestedModel) {
      const model = primaryServer.suggestedModel;
      let provider = 'OpenAI';

      if (model.startsWith('claude')) {
        provider = 'Anthropic';
      } else if (model.startsWith('gemini')) {
        provider = 'Google';
      } else if (model.startsWith('grok')) {
        provider = 'xAI';
      } else if (model.startsWith('deepseek')) {
        provider = 'Deepseek';
      } else if (model.startsWith('mistral')) {
        provider = 'Mistral';
      }

      overallRecommendation = {
        provider,
        model,
        reasoning: `Primary server "${primaryServer.serverName}" handles ${primaryServer.toolCount} tools with capabilities: ${primaryServer.capabilities.join(', ')}`,
      };
    }

    return { serverGroups, overallRecommendation };
  }
}
