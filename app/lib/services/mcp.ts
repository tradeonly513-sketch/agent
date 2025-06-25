import { experimental_createMCPClient } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('mcp-service');

// MCP config types
export type StdioMCPConfig = {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

export type SSEMCPConfig = {
  type: 'sse';
  url: string;
};

export type ProxyMCPConfig = {
  type: 'proxy';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  proxyUrl?: string; // URL of the MCP proxy server
};

export type MCPConfig = StdioMCPConfig | SSEMCPConfig | ProxyMCPConfig;

export interface MCPClient {
  tools: () => Promise<any>;
  close: () => Promise<void>;
}

type ServerConfig = {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  type?: string;
  cwd?: string;
};

/**
 * Creates a single MCP client for a server configuration
 */
export async function createMCPClient(serverName: string, serverConfig: ServerConfig): Promise<MCPClient | null> {
  if (!serverConfig) {
    throw new Error(`Invalid configuration for server "${serverName}"`);
  }

  const isSSE = serverConfig.type === 'sse' || (!serverConfig.command && serverConfig.url);

  if (isSSE && !serverConfig.url) {
    throw new Error(`Missing URL for SSE server "${serverName}"`);
  }

  if (!isSSE && !serverConfig.command) {
    throw new Error(`Missing command for stdio server "${serverName}"`);
  }

  const client = isSSE
    ? await createSSEClient(serverName, serverConfig.url!)
    : await createStdioClient(serverName, serverConfig);

  // Verify that the client can get tools
  try {
    await client.tools();
    return client;
  } catch (e) {
    throw new Error(`Server connection established but failed to get available tools: ${errorToString(e)}`);
  }
}

async function createSSEClient(serverName: string, url: string): Promise<MCPClient> {
  logger.debug(`Creating SSE MCP client for ${serverName} with URL: ${url}`);

  try {
    return await experimental_createMCPClient({
      transport: { type: 'sse', url },
    });
  } catch (e) {
    throw new Error(`Failed to connect to SSE endpoint "${url}": ${errorToString(e)}`);
  }
}

async function createStdioClient(serverName: string, config: ServerConfig): Promise<MCPClient> {
  const { command, args, env, cwd } = config;

  logger.debug(`Creating stdio MCP client for '${serverName}' with command: '${command}' ${args?.join(' ') || ''}`);

  try {
    // Check if we're in a Node.js environment that supports child_process
    if (typeof process !== 'undefined' && process.platform) {
      // Try to import child_process to test availability
      try {
        const { spawn } = await import('node:child_process');
        logger.debug('child_process is available, proceeding with stdio transport');
      } catch (cpError) {
        throw new Error(`Node.js child_process not available: ${cpError instanceof Error ? cpError.message : String(cpError)}`);
      }
    }

    // Dynamic import to handle potential missing export
    const { Experimental_StdioMCPTransport } = await import('ai/mcp-stdio');
    
    const transport = new Experimental_StdioMCPTransport({
      command: command!,
      args,
      env,
      cwd,
    });

    return await experimental_createMCPClient({ transport });
  } catch (e) {
    if (e instanceof Error && e.message.includes('Missing')) {
      throw new Error(`MCP stdio transport not available. Please use SSE-based servers instead. See: https://modelcontextprotocol.io/examples`);
    }
    if (e instanceof Error && e.message.includes('child_process.spawn is not implemented')) {
      throw new Error(`Stdio MCP servers require Node.js child_process which is not available in Cloudflare Workers. Try enabling nodejs_compat_v2 or use SSE-based servers. See: https://modelcontextprotocol.io/examples`);
    }
    if (e instanceof Error && e.message.includes('child_process not available')) {
      throw new Error(`Node.js child_process not available in this environment. Please use SSE-based servers instead. See: https://modelcontextprotocol.io/examples`);
    }
    throw new Error(`Failed to start command "${command}": ${errorToString(e)}`);
  }
}

export async function createMCPClients(mcpConfig?: {
  mcpServers: Record<string, ServerConfig>;
}): Promise<{ tools: Record<string, any>; clients: MCPClient[] }> {
  const tools = {};
  const clients: MCPClient[] = [];

  if (!mcpConfig?.mcpServers) {
    return { tools, clients };
  }

  for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
    try {
      const client = await createMCPClient(serverName, serverConfig);

      if (client) {
        clients.push(client);

        const toolSet = await client.tools();
        Object.assign(tools, toolSet);
      }
    } catch (error) {
      logger.error(`Failed to initialize MCP client for server: ${serverName}`, error);

      // Continue to the next server rather than failing completely
    }
  }

  return { tools, clients };
}

export async function closeMCPClients(clients: MCPClient[]): Promise<void> {
  const closePromises = clients.map((client) =>
    client.close().catch((e) => logger.error('Error closing MCP client:', e)),
  );

  await Promise.allSettled(closePromises);
}

// Helper function to consistently format errors
function errorToString(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
