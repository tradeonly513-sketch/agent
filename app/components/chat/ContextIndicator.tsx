import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconButton } from '~/components/ui/IconButton';
import WithTooltip from '~/components/ui/Tooltip';

interface ContextUsage {
  totalTokens: number;
  maxTokens: number;
  utilizationPercentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  messageCount: number;
  recommendations?: string[];
}

interface ContextIndicatorProps {
  usage: ContextUsage;
  className?: string;
}

export const ContextIndicator = memo(({ usage, className = '' }: ContextIndicatorProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = () => {
    if (usage.isOverLimit) {
      return 'text-red-500';
    }

    if (usage.isNearLimit) {
      return 'text-yellow-500';
    }

    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (usage.isOverLimit) {
      return 'i-ph:warning-circle-fill';
    }

    if (usage.isNearLimit) {
      return 'i-ph:warning-fill';
    }

    return 'i-ph:check-circle-fill';
  };

  const getStatusText = () => {
    if (usage.isOverLimit) {
      return 'Over Limit';
    }

    if (usage.isNearLimit) {
      return 'Near Limit';
    }

    return 'Normal';
  };

  const getProgressBarColor = () => {
    if (usage.isOverLimit) {
      return 'bg-red-500';
    }

    if (usage.isNearLimit) {
      return 'bg-yellow-500';
    }

    return 'bg-green-500';
  };

  return (
    <div className={`relative ${className}`}>
      <WithTooltip
        tooltip={`Context Usage: ${usage.totalTokens.toLocaleString()} / ${usage.maxTokens.toLocaleString()} tokens (${usage.utilizationPercentage.toFixed(1)}%)`}
      >
        <IconButton
          icon={getStatusIcon()}
          onClick={() => setShowDetails(!showDetails)}
          className={`${getStatusColor()} hover:bg-bolt-elements-background-depth-2`}
          size="sm"
        />
      </WithTooltip>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-80 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg shadow-lg z-50 p-4"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Context Usage</h3>
                <span className={`text-xs font-medium ${getStatusColor()}`}>{getStatusText()}</span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-bolt-elements-textSecondary">
                  <span>{usage.totalTokens.toLocaleString()} tokens</span>
                  <span>{usage.maxTokens.toLocaleString()} max</span>
                </div>
                <div className="w-full bg-bolt-elements-background-depth-3 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
                    style={{
                      width: `${Math.min(100, usage.utilizationPercentage)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-bolt-elements-textSecondary text-center">
                  {usage.utilizationPercentage.toFixed(1)}% used
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-bolt-elements-background-depth-2 rounded p-2">
                  <div className="text-bolt-elements-textSecondary">Messages</div>
                  <div className="font-medium text-bolt-elements-textPrimary">{usage.messageCount}</div>
                </div>
                <div className="bg-bolt-elements-background-depth-2 rounded p-2">
                  <div className="text-bolt-elements-textSecondary">Available</div>
                  <div className="font-medium text-bolt-elements-textPrimary">
                    {Math.max(0, usage.maxTokens - usage.totalTokens).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {usage.recommendations && usage.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-bolt-elements-textPrimary">Recommendations</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {usage.recommendations.slice(0, 3).map((rec, index) => (
                      <div
                        key={index}
                        className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 rounded p-2"
                      >
                        {rec}
                      </div>
                    ))}
                    {usage.recommendations.length > 3 && (
                      <div className="text-xs text-bolt-elements-textTertiary text-center">
                        +{usage.recommendations.length - 3} more recommendations
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-bolt-elements-borderColor">
                <button
                  onClick={() => {
                    // This would trigger context optimization
                    console.log('Optimize context clicked');
                  }}
                  className="flex-1 text-xs bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded px-2 py-1 transition-colors"
                  disabled={!usage.isNearLimit && !usage.isOverLimit}
                >
                  Optimize
                </button>
                <button
                  onClick={() => {
                    // This would start a new conversation
                    console.log('New conversation clicked');
                  }}
                  className="flex-1 text-xs bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary rounded px-2 py-1 transition-colors"
                >
                  New Chat
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ContextIndicator.displayName = 'ContextIndicator';

// Hook to calculate context usage from messages
export function useContextUsage(messages: any[], _model: string = 'gpt-4') {
  /*
   * This would be implemented to calculate actual token usage
   * For now, return mock data
   */
  const mockUsage: ContextUsage = {
    totalTokens: 45000,
    maxTokens: 65536,
    utilizationPercentage: 68.7,
    isNearLimit: false,
    isOverLimit: false,
    messageCount: messages.length,
    recommendations: [
      '💡 Consider enabling context optimization',
      '📝 Some messages are quite long',
      '🎯 Focus on recent messages for better performance',
    ],
  };

  return mockUsage;
}
