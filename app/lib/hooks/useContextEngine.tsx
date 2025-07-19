/**
 * useContextEngine Hook
 *
 * React hook for integrating the Context Engine with the chat interface.
 * Provides intelligent context management and optimization.
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { Message } from 'ai';
import {
  ContextEngineManager,
  type ContextOptimizationResult,
  type ContextEngineManagerOptions,
} from '../context-engine/manager';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '../stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useContextEngine');

export interface ContextEngineState {
  isOptimizing: boolean;
  lastOptimization: ContextOptimizationResult | null;
  statistics: {
    indexedNodes: number;
    lastIndexTime: number;
    cacheSize: number;
  } | null;
  enabled: boolean;
}

export interface ContextEngineHookOptions extends Partial<ContextEngineManagerOptions> {
  autoOptimize: boolean;
  enableDebugLogs: boolean;
}

/**
 * Hook for using the Context Engine in React components
 */
export function useContextEngine(options: Partial<ContextEngineHookOptions> = {}) {
  const files = useStore(workbenchStore.files);

  // Context Engine Manager
  const managerRef = useRef<ContextEngineManager | null>(null);

  // State
  const [state, setState] = useState<ContextEngineState>({
    isOptimizing: false,
    lastOptimization: null,
    statistics: null,
    enabled: options.autoOptimize !== false, // Default to enabled
  });

  // Configuration
  const configRef = useRef<ContextEngineHookOptions>({
    autoOptimize: true,
    enableDebugLogs: false,
    enableSmartRetrieval: true,
    enableCompression: true,
    maxContextRatio: 0.7,
    compressionThreshold: 8000,
    semanticThreshold: 0.7,
    maxRetrievedNodes: 30,
    ...options,
  });

  // Initialize manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new ContextEngineManager(configRef.current);

      // Update statistics
      setState((prev) => ({
        ...prev,
        statistics: managerRef.current!.getStatistics(),
      }));
    }
  }, []);

  // Update statistics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (managerRef.current) {
        setState((prev) => ({
          ...prev,
          statistics: managerRef.current!.getStatistics(),
        }));
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  /**
   * Optimize context for a conversation
   */
  const optimizeContext = useCallback(
    async (messages: Message[], model: string, systemPrompt?: string): Promise<ContextOptimizationResult | null> => {
      if (!state.enabled || !managerRef.current) {
        return null;
      }

      setState((prev) => ({ ...prev, isOptimizing: true }));

      try {
        const result = await managerRef.current.optimizeContext(messages, files, model, systemPrompt);

        setState((prev) => ({
          ...prev,
          lastOptimization: result,
          isOptimizing: false,
          statistics: managerRef.current!.getStatistics(),
        }));

        if (configRef.current.enableDebugLogs) {
          logger.info('Context optimization completed:', {
            strategy: result.strategy,
            originalTokens: result.originalTokens,
            optimizedTokens: result.optimizedTokens,
            compressionRatio: result.compressionRatio,
            processingTime: result.metadata.processingTime,
          });
        }

        return result;
      } catch (error) {
        logger.error('Context optimization failed:', error);
        setState((prev) => ({ ...prev, isOptimizing: false }));

        return null;
      }
    },
    [state.enabled, files],
  );

  /**
   * Enable or disable the context engine
   */
  const setEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enabled }));
  }, []);

  /**
   * Update configuration
   */
  const updateConfig = useCallback((newOptions: Partial<ContextEngineHookOptions>) => {
    configRef.current = { ...configRef.current, ...newOptions };

    if (managerRef.current) {
      managerRef.current.updateOptions(newOptions);
    }
  }, []);

  /**
   * Clear cache and force reindexing
   */
  const clearCache = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.clearCache();
      setState((prev) => ({
        ...prev,
        statistics: managerRef.current!.getStatistics(),
        lastOptimization: null,
      }));
    }
  }, []);

  /**
   * Get performance metrics
   */
  const getMetrics = useCallback(() => {
    return {
      ...state.statistics,
      lastOptimization: state.lastOptimization,
      isEnabled: state.enabled,
    };
  }, [state]);

  /**
   * Check if context optimization is recommended for current conversation
   */
  const shouldOptimize = useCallback(
    (messages: Message[], model: string): boolean => {
      if (!state.enabled || !managerRef.current) {
        return false;
      }

      // Simple heuristics for when to recommend optimization
      const messageCount = messages.length;
      const fileCount = Object.keys(files).length;
      const hasLongMessages = messages.some((m) => m.content.length > 1000);

      return (
        messageCount > 5 || // Long conversation
        fileCount > 10 || // Large codebase
        hasLongMessages || // Complex queries
        (state.lastOptimization?.originalTokens || 0) > configRef.current.compressionThreshold!
      );
    },
    [state.enabled, files, state.lastOptimization],
  );

  /**
   * Auto-optimize if conditions are met
   */
  const autoOptimize = useCallback(
    async (messages: Message[], model: string, systemPrompt?: string): Promise<string | null> => {
      if (!configRef.current.autoOptimize || !shouldOptimize(messages, model)) {
        return null;
      }

      const result = await optimizeContext(messages, model, systemPrompt);

      return result?.optimizedContext || null;
    },
    [optimizeContext, shouldOptimize],
  );

  return {
    // State
    ...state,

    // Actions
    optimizeContext,
    autoOptimize,
    setEnabled,
    updateConfig,
    clearCache,

    // Utilities
    shouldOptimize,
    getMetrics,

    // Configuration
    config: configRef.current,
  };
}

/**
 * Provider component for Context Engine configuration
 */
export function ContextEngineProvider({
  children,
  options = {},
}: {
  children: React.ReactNode;
  options?: Partial<ContextEngineHookOptions>;
}) {
  /*
   * This could be used to provide context engine configuration
   * across the entire application if needed
   */
  return <>{children}</>;
}

/**
 * Hook for getting context engine recommendations
 */
export function useContextRecommendations() {
  const [recommendations, setRecommendations] = useState<{
    shouldEnableCompression: boolean;
    shouldUseSemanticRetrieval: boolean;
    suggestedMaxNodes: number;
    reason: string;
  } | null>(null);

  const files = useStore(workbenchStore.files);

  useEffect(() => {
    const fileCount = Object.keys(files).length;
    const totalSize = Object.values(files).reduce((acc, file) => {
      if (!file || file.type !== 'file') {
        return acc;
      }

      const fileContent = file as any;

      // Type assertion for File interface
      return acc + (fileContent.content?.length || 0);
    }, 0);

    let shouldEnableCompression = false;
    let shouldUseSemanticRetrieval = false;
    let suggestedMaxNodes = 20;
    let reason = '';

    if (fileCount > 50 || totalSize > 100000) {
      shouldEnableCompression = true;
      shouldUseSemanticRetrieval = true;
      suggestedMaxNodes = 30;
      reason = 'Large codebase detected. Recommend enabling both compression and semantic retrieval.';
    } else if (fileCount > 20 || totalSize > 50000) {
      shouldUseSemanticRetrieval = true;
      suggestedMaxNodes = 25;
      reason = 'Medium codebase detected. Recommend enabling semantic retrieval.';
    } else if (fileCount > 10) {
      suggestedMaxNodes = 20;
      reason = 'Small to medium codebase. Default settings should work well.';
    } else {
      suggestedMaxNodes = 15;
      reason = 'Small codebase. Context engine may not be necessary.';
    }

    setRecommendations({
      shouldEnableCompression,
      shouldUseSemanticRetrieval,
      suggestedMaxNodes,
      reason,
    });
  }, [files]);

  return recommendations;
}
