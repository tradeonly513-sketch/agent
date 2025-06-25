/**
 * Environment detection utilities for MCP functionality
 */

export interface EnvironmentInfo {
  canUseStdio: boolean;
  isProduction: boolean;
  isDevelopment: boolean;
  runtimeEnvironment: 'nodejs' | 'cloudflare-workers' | 'dev-docker' | 'prod-docker';
}

/**
 * Detects the current runtime environment and MCP capabilities
 */
export function detectEnvironment(): EnvironmentInfo {
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
  const isDev = process.env.NODE_ENV === 'development';
  const isNodeJs = typeof process !== 'undefined' && process.platform;
  
  // In dev mode, allow stdio even in Docker
  const canUseStdio = isNodeJs && (!isDocker || isDev);
  
  return {
    canUseStdio,
    isProduction: isDocker && !isDev,
    isDevelopment: isDev,
    runtimeEnvironment: isDocker 
      ? (isDev ? 'dev-docker' : 'prod-docker') 
      : isNodeJs ? 'nodejs' : 'cloudflare-workers'
  };
}

/**
 * Get user-friendly environment description
 */
export function getEnvironmentDescription(): string {
  const env = detectEnvironment();
  
  switch (env.runtimeEnvironment) {
    case 'nodejs':
      return 'Local Development (Node.js)';
    case 'dev-docker':
      return 'Development Environment (Docker)';
    case 'prod-docker':
      return 'Production Environment (Docker/K8s)';
    case 'cloudflare-workers':
      return 'Cloudflare Workers Environment';
    default:
      return 'Unknown Environment';
  }
}

/**
 * Get stdio availability message
 */
export function getStdioAvailabilityMessage(): string {
  const env = detectEnvironment();
  
  if (env.canUseStdio) {
    return '✅ Stdio MCP servers are available in this environment';
  } else {
    return '⚠️ Stdio MCP servers are not available. Use SSE endpoints or MCP Gateway.';
  }
}