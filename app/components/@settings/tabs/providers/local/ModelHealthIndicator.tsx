import React from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { useProviderHealth, useLocalModelHealth } from '~/lib/hooks/useLocalModelHealth';
import type { ModelHealthStatus } from '~/lib/services/localModelHealthMonitor';

interface ModelHealthIndicatorProps {
  provider: 'Ollama' | 'LMStudio' | 'OpenAILike';
  baseUrl: string;
  showDetails?: boolean;
  className?: string;
}

interface HealthStatusBadgeProps {
  status: ModelHealthStatus['status'];
  responseTime?: number;
  className?: string;
}

function HealthStatusBadge({ status, responseTime, className }: HealthStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          color: 'bg-green-500',
          textColor: 'text-green-600',
          bgColor: 'bg-green-500/10 border-green-500/20',
          borderColor: 'border-green-500/20',
          icon: 'i-ph:check-circle-fill',
          label: 'Healthy',
        };
      case 'unhealthy':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-600',
          bgColor: 'bg-red-500/10 border-red-500/20',
          borderColor: 'border-red-500/20',
          icon: 'i-ph:x-circle-fill',
          label: 'Unhealthy',
        };
      case 'checking':
        return {
          color: 'bg-blue-500',
          textColor: 'text-blue-600',
          bgColor: 'bg-blue-500/10 border-blue-500/20',
          borderColor: 'border-blue-500/20',
          icon: 'i-ph:circle-notch',
          label: 'Checking',
        };
      default:
        return {
          color: 'bg-gray-500',
          textColor: 'text-gray-600',
          bgColor: 'bg-gray-500/10 border-gray-500/20',
          borderColor: 'border-gray-500/20',
          icon: 'i-ph:question',
          label: 'Unknown',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={classNames(
      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
      'border transition-all duration-200',
      config.bgColor, config.textColor, config.borderColor, className
    )}>
      <div className={classNames('w-2 h-2 rounded-full flex-shrink-0', config.color)}>
        {status === 'checking' && (
          <div className={classNames('w-2 h-2 rounded-full animate-pulse', config.color)} />
        )}
      </div>
      <span className="font-medium">{config.label}</span>
      {responseTime !== undefined && status === 'healthy' && (
        <span className="text-xs opacity-75 ml-1">({responseTime}ms)</span>
      )}
    </div>
  );
}

export default function ModelHealthIndicator({ 
  provider, 
  baseUrl, 
  showDetails = false, 
  className 
}: ModelHealthIndicatorProps) {
  const { status, isHealthy, performHealthCheck } = useProviderHealth(provider, baseUrl);

  if (!status) {
    return (
      <div className={classNames('flex items-center gap-2', className)}>
        <HealthStatusBadge status="unknown" />
      </div>
    );
  }

  const handleRefresh = async () => {
    await performHealthCheck();
  };

  return (
    <motion.div 
      className={classNames('flex items-center gap-2', className)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <HealthStatusBadge 
        status={status.status} 
        responseTime={status.responseTime}
      />
      
      {showDetails && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className={classNames(
              'p-1 rounded-md text-xs',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'text-gray-600 dark:text-gray-400',
              'transition-colors duration-200'
            )}
            title="Refresh health status"
          >
            <div className="i-ph:arrow-clockwise w-3 h-3" />
          </button>
          
          {status.availableModels && status.availableModels.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {status.availableModels.length} model{status.availableModels.length !== 1 ? 's' : ''}
            </span>
          )}
          
          {status.version && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              v{status.version}
            </span>
          )}
        </div>
      )}
      
      {status.error && (
        <div 
          className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate"
          title={status.error}
        >
          {status.error}
        </div>
      )}
    </motion.div>
  );
}

interface ModelHealthSummaryProps {
  className?: string;
}

export function ModelHealthSummary({ className }: ModelHealthSummaryProps) {
  const { healthStatuses, getOverallHealth } = useLocalModelHealth();
  const stats = getOverallHealth();
  const totalProviders = healthStatuses.length;

  if (totalProviders === 0) {
    return null;
  }

  return (
    <motion.div
      className={classNames(
        'flex items-center justify-between p-4 rounded-xl',
        'bg-bolt-elements-background-depth-2',
        'border border-bolt-elements-borderColor',
        'hover:bg-bolt-elements-background-depth-3',
        'transition-all duration-200',
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <div className="i-ph:activity w-4 h-4 text-purple-500" />
        </div>
        <div>
          <div className="text-sm font-semibold text-bolt-elements-textPrimary">
            Local Providers Health
          </div>
          <div className="text-xs text-bolt-elements-textSecondary">
            {totalProviders} provider{totalProviders !== 1 ? 's' : ''} monitored
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {stats.healthy > 0 && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-green-600">{stats.healthy}</span>
          </div>
        )}

        {stats.unhealthy > 0 && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-medium text-red-600">{stats.unhealthy}</span>
          </div>
        )}

        {stats.checking > 0 && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-600">{stats.checking}</span>
          </div>
        )}

        {stats.unknown > 0 && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-gray-500/10 border border-gray-500/20">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-xs font-medium text-gray-600">{stats.unknown}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
