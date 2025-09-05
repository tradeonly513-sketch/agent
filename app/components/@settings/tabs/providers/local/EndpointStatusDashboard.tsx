import React from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { useLocalModelHealth } from '~/lib/hooks/useLocalModelHealth';

interface EndpointInfo {
  provider: string;
  configuredUrl: string;
  status: 'healthy' | 'unhealthy' | 'checking' | 'unknown';
  responseTime?: number;
  availableModels?: number;
  version?: string;
  error?: string;
  lastChecked?: Date;
}

interface EndpointStatusDashboardProps {
  className?: string;
}

export default function EndpointStatusDashboard({ className }: EndpointStatusDashboardProps) {
  const { healthStatuses } = useLocalModelHealth();

  const endpointData: EndpointInfo[] = healthStatuses.map(status => ({
    provider: status.provider,
    configuredUrl: status.baseUrl,
    status: status.status,
    responseTime: status.responseTime,
    availableModels: status.availableModels?.length || 0,
    version: status.version,
    error: status.error,
    lastChecked: status.lastChecked,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'unhealthy': return 'bg-red-500';
      case 'checking': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/10 border-green-500/20';
      case 'unhealthy': return 'bg-red-500/10 border-red-500/20';
      case 'checking': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatTime = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatLastChecked = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
  };

  if (endpointData.length === 0) {
    return (
      <div className={classNames(
        'p-6 text-center rounded-lg border border-bolt-elements-borderColor',
        'bg-bolt-elements-background-depth-2',
        className
      )}>
        <div className="i-ph:plug w-12 h-12 mx-auto text-bolt-elements-textTertiary mb-4" />
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
          No Endpoints Configured
        </h3>
        <p className="text-sm text-bolt-elements-textSecondary">
          Configure and enable local providers to see their endpoint status here.
        </p>
      </div>
    );
  }

  return (
    <div className={classNames('space-y-6', className)}>
      <div className="flex items-center gap-3">
        <div className="i-ph:plug w-5 h-5 text-bolt-elements-textSecondary" />
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">
          Endpoint Status Dashboard
        </h3>
      </div>

      <div className="grid gap-4">
        {endpointData.map((endpoint, index) => (
          <motion.div
            key={`${endpoint.provider}-${endpoint.configuredUrl}`}
            className={classNames(
              'p-4 rounded-xl border',
              'bg-bolt-elements-background-depth-2',
              getStatusBg(endpoint.status)
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={classNames(
                  'w-3 h-3 rounded-full',
                  getStatusColor(endpoint.status)
                )} />
                <div>
                  <h4 className="font-medium text-bolt-elements-textPrimary">
                    {endpoint.provider}
                  </h4>
                  <p className="text-xs text-bolt-elements-textSecondary font-mono">
                    {endpoint.configuredUrl}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-medium text-bolt-elements-textPrimary">
                  {endpoint.status.charAt(0).toUpperCase() + endpoint.status.slice(1)}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">
                  {formatLastChecked(endpoint.lastChecked)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-bolt-elements-textSecondary">Response Time</div>
                <div className="font-medium text-bolt-elements-textPrimary">
                  {formatTime(endpoint.responseTime)}
                </div>
              </div>

              <div>
                <div className="text-bolt-elements-textSecondary">Models</div>
                <div className="font-medium text-bolt-elements-textPrimary">
                  {endpoint.availableModels || 0}
                </div>
              </div>

              <div>
                <div className="text-bolt-elements-textSecondary">Version</div>
                <div className="font-medium text-bolt-elements-textPrimary">
                  {endpoint.version || 'Unknown'}
                </div>
              </div>

              <div>
                <div className="text-bolt-elements-textSecondary">Status</div>
                <div className={classNames(
                  'font-medium',
                  endpoint.status === 'healthy' ? 'text-green-500' :
                  endpoint.status === 'unhealthy' ? 'text-red-500' :
                  endpoint.status === 'checking' ? 'text-blue-500' : 'text-gray-500'
                )}>
                  {endpoint.status === 'checking' ? 'Checking...' : endpoint.status}
                </div>
              </div>
            </div>

            {endpoint.error && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <div className="i-ph:warning-circle w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600">Error</span>
                </div>
                <div className="text-sm text-red-600">
                  {endpoint.error.includes('CORS_ERROR') ? (
                    <div className="space-y-2">
                      <p>{endpoint.error.replace('CORS_ERROR: ', '')}</p>
                      <div className="text-xs space-y-1">
                        <p className="font-medium">Try these solutions:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Check LM Studio's Local Server settings for CORS option</li>
                          <li>Try starting LM Studio server with <code className="bg-red-500/20 px-1 rounded">lmstudio-server --cors</code></li>
                          <li>Use Bolt's desktop app (no CORS restrictions)</li>
                          <li>Install a CORS browser extension</li>
                        </ol>
                        <p className="mt-2 text-amber-400">Note: CORS options may vary by LM Studio version</p>
                      </div>
                    </div>
                  ) : (
                    <p>{endpoint.error}</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
        <div className="text-center">
          <div className="text-2xl font-bold text-bolt-elements-textPrimary">
            {endpointData.filter(e => e.status === 'healthy').length}
          </div>
          <div className="text-sm text-bolt-elements-textSecondary">Healthy</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-bolt-elements-textPrimary">
            {endpointData.filter(e => e.status === 'unhealthy').length}
          </div>
          <div className="text-sm text-bolt-elements-textSecondary">Unhealthy</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-bolt-elements-textPrimary">
            {endpointData.filter(e => e.status === 'checking').length}
          </div>
          <div className="text-sm text-bolt-elements-textSecondary">Checking</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-bolt-elements-textPrimary">
            {endpointData.reduce((sum, e) => sum + (e.availableModels || 0), 0)}
          </div>
          <div className="text-sm text-bolt-elements-textSecondary">Total Models</div>
        </div>
      </div>
    </div>
  );
}
