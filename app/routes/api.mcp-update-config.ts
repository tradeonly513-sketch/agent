import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { MCPService, type MCPConfig } from '~/lib/services/mcpService';

const logger = createScopedLogger('api.mcp-update-config');

export async function action({ request }: ActionFunctionArgs) {
  try {
    logger.debug('MCP update config API called');

    const mcpConfig = (await request.json()) as MCPConfig;
    logger.debug('Received MCP config:', JSON.stringify(mcpConfig, null, 2));

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
