import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { useModelPerformance } from '~/lib/hooks/useModelPerformance';
import type { AggregatedMetrics } from '~/lib/services/modelPerformanceMonitor';

interface ModelPerformanceDashboardProps {
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: 'green' | 'blue' | 'purple' | 'orange' | 'red';
  trend?: 'up' | 'down' | 'stable';
}

function MetricCard({ title, value, subtitle, icon, color, trend }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const trendIcons = {
    up: 'i-ph:trend-up',
    down: 'i-ph:trend-down',
    stable: 'i-ph:minus',
  };

  return (
    <motion.div
      className={classNames(
        'p-4 rounded-lg border',
        'bg-bolt-elements-background-depth-2',
        'border-bolt-elements-borderColor',
        colorClasses[color]
      )}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div className={classNames('w-8 h-8 rounded-lg flex items-center justify-center', colorClasses[color])}>
          <div className={classNames(icon, 'w-4 h-4')} />
        </div>
        {trend && (
          <div className={classNames(trendIcons[trend], 'w-4 h-4 opacity-60')} />
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-bolt-elements-textPrimary">{value}</div>
        <div className="text-sm font-medium text-bolt-elements-textSecondary">{title}</div>
        {subtitle && (
          <div className="text-xs text-bolt-elements-textTertiary mt-1">{subtitle}</div>
        )}
      </div>
    </motion.div>
  );
}

interface ModelPerformanceRowProps {
  metrics: AggregatedMetrics;
  rank: number;
}

function ModelPerformanceRow({ metrics, rank }: ModelPerformanceRowProps) {
  const [expanded, setExpanded] = useState(false);
  
  const successRate = metrics.totalRequests > 0 ? 
    (metrics.successfulRequests / metrics.totalRequests) * 100 : 0;

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTokensPerSecond = (tps: number) => {
    if (tps === 0) return 'N/A';
    return `${Math.round(tps)} tok/s`;
  };

  return (
    <motion.div
      className={classNames(
        'border rounded-lg overflow-hidden',
        'bg-bolt-elements-background-depth-2',
        'border-bolt-elements-borderColor'
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
    >
      <div
        className={classNames(
          'p-4 cursor-pointer',
          'hover:bg-bolt-elements-background-depth-3',
          'transition-colors duration-200'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
              rank <= 3 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-500/20 text-gray-500'
            )}>
              #{rank}
            </div>
            <div>
              <div className="font-medium text-bolt-elements-textPrimary">
                {metrics.model}
              </div>
              <div className="text-sm text-bolt-elements-textSecondary">
                {metrics.provider}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-bolt-elements-textPrimary">
                {formatTime(metrics.averageResponseTime)}
              </div>
              <div className="text-xs text-bolt-elements-textSecondary">Response</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-bolt-elements-textPrimary">
                {formatTokensPerSecond(metrics.averageTokensPerSecond)}
              </div>
              <div className="text-xs text-bolt-elements-textSecondary">Speed</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-bolt-elements-textPrimary">
                {successRate.toFixed(1)}%
              </div>
              <div className="text-xs text-bolt-elements-textSecondary">Success</div>
            </div>
            
            <div className={classNames(
              'w-4 h-4 transition-transform duration-200',
              expanded ? 'rotate-180' : '',
              'i-ph:caret-down'
            )} />
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-bolt-elements-borderColor"
          >
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-bolt-elements-textPrimary">
                  {metrics.totalRequests}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Total Requests</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-green-500">
                  {metrics.successfulRequests}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Successful</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-red-500">
                  {metrics.failedRequests}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Failed</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-bolt-elements-textPrimary">
                  {metrics.totalTokensProcessed.toLocaleString()}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Total Tokens</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ModelPerformanceDashboard({ className }: ModelPerformanceDashboardProps) {
  const { allMetrics, getPerformanceComparison, clearAllMetrics, exportMetrics } = useModelPerformance();
  const [showComparison, setShowComparison] = useState(false);
  
  const comparison = getPerformanceComparison();
  
  // Calculate overall statistics
  const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const totalSuccessful = allMetrics.reduce((sum, m) => sum + m.successfulRequests, 0);
  const totalFailed = allMetrics.reduce((sum, m) => sum + m.failedRequests, 0);
  const averageResponseTime = allMetrics.length > 0 ? 
    allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length : 0;
  const averageTokensPerSecond = allMetrics.length > 0 ?
    allMetrics.reduce((sum, m) => sum + m.averageTokensPerSecond, 0) / allMetrics.length : 0;

  const handleExport = () => {
    const data = exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-performance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (allMetrics.length === 0) {
    return (
      <div className={classNames(
        'p-8 text-center rounded-lg',
        'bg-bolt-elements-background-depth-2',
        'border border-bolt-elements-borderColor',
        className
      )}>
        <div className="i-ph:chart-line w-12 h-12 mx-auto text-bolt-elements-textTertiary mb-4" />
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
          No Performance Data
        </h3>
        <p className="text-sm text-bolt-elements-textSecondary">
          Start using your local models to see performance metrics here.
        </p>
      </div>
    );
  }

  return (
    <div className={classNames('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-bolt-elements-textPrimary">
            Performance Dashboard
          </h2>
          <p className="text-sm text-bolt-elements-textSecondary">
            Monitor and compare your local model performance
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={classNames(
              'px-3 py-2 rounded-lg text-sm font-medium',
              'bg-bolt-elements-background-depth-3',
              'hover:bg-bolt-elements-background-depth-4',
              'text-bolt-elements-textPrimary',
              'transition-colors duration-200'
            )}
          >
            {showComparison ? 'Hide Comparison' : 'Show Comparison'}
          </button>
          
          <button
            onClick={handleExport}
            className={classNames(
              'px-3 py-2 rounded-lg text-sm font-medium',
              'bg-blue-500/10 text-blue-500',
              'hover:bg-blue-500/20',
              'transition-colors duration-200'
            )}
          >
            Export Data
          </button>
          
          <button
            onClick={clearAllMetrics}
            className={classNames(
              'px-3 py-2 rounded-lg text-sm font-medium',
              'bg-red-500/10 text-red-500',
              'hover:bg-red-500/20',
              'transition-colors duration-200'
            )}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Requests"
          value={totalRequests.toLocaleString()}
          icon="i-ph:chart-bar"
          color="blue"
        />
        
        <MetricCard
          title="Success Rate"
          value={`${totalRequests > 0 ? ((totalSuccessful / totalRequests) * 100).toFixed(1) : 0}%`}
          subtitle={`${totalSuccessful} successful`}
          icon="i-ph:check-circle"
          color="green"
        />
        
        <MetricCard
          title="Avg Response Time"
          value={averageResponseTime < 1000 ? `${Math.round(averageResponseTime)}ms` : `${(averageResponseTime / 1000).toFixed(1)}s`}
          icon="i-ph:clock"
          color="purple"
        />
        
        <MetricCard
          title="Avg Speed"
          value={averageTokensPerSecond > 0 ? `${Math.round(averageTokensPerSecond)}` : 'N/A'}
          subtitle="tokens/sec"
          icon="i-ph:lightning"
          color="orange"
        />
        
        <MetricCard
          title="Active Models"
          value={allMetrics.length}
          icon="i-ph:cpu"
          color="blue"
        />
      </div>

      {/* Model Comparison */}
      <AnimatePresence>
        {showComparison && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">
              Model Performance Ranking
            </h3>
            
            <div className="space-y-3">
              {comparison.map((item, index) => (
                <ModelPerformanceRow
                  key={`${item.provider}-${item.model}-${item.baseUrl}`}
                  metrics={item.metrics}
                  rank={index + 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
