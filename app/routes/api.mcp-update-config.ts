import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { MCPService, type MCPConfig } from '~/lib/services/mcpService';

// Helper function to sanitize MCP config for logging
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

const logger = createScopedLogger('api.mcp-update-config');

export async function action({ request }: ActionFunctionArgs) {
  try {
    logger.debug('MCP update config API called');

    const mcpConfig = (await request.json()) as MCPConfig;

    // Sanitize config for logging to prevent API key exposure
    const sanitizedConfig = sanitizeMCPConfigForLogging(mcpConfig);
    logger.debug('Received MCP config:', JSON.stringify(sanitizedConfig, null, 2));

    if (!mcpConfig || typeof mcpConfig !== 'object') {
      logger.warn('Invalid MCP config received');
      return Response.json({ error: 'Invalid MCP servers configuration' }, { status: 400 });
    }

    logger.debug('Getting MCP service instance');

    const mcpService = MCPService.getInstance();

    logger.debug('Calling updateConfig on MCP service');

    const serverTools = await mcpService.updateConfig(mcpConfig);

    logger.debug('MCP config update completed, returning server tools:', Object.keys(serverTools));

    return Response.json(serverTools);
  } catch (error) {
    logger.error('Error updating MCP config:', error);
    return Response.json({ error: 'Failed to update MCP config' }, { status: 500 });
  }
}
