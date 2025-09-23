import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ParallelExecutionManager');

/**
 * Manages parallel execution of operations while ensuring safety for conflicting operations.
 * Operations on different files can run in parallel, while operations on the same file are serialized.
 */
export class ParallelExecutionManager {
  // File-specific execution queues to serialize operations on the same file
  #fileQueues = new Map<string, Promise<void>>();

  // Global queue for operations that need full serialization (shell commands, etc.)
  #globalQueue = Promise.resolve();

  // Track active operations for debugging
  #activeOperations = new Set<string>();

  // Statistics for monitoring
  #stats = {
    totalOperations: 0,
    parallelOperations: 0,
    serializedOperations: 0,
    averageWaitTime: 0,
  };

  constructor() {
    logger.debug('ParallelExecutionManager initialized');
  }

  /**
   * Add operation to appropriate execution queue based on operation type and file path
   */
  async executeOperation(actionData: ActionCallbackData, callback: () => Promise<void>): Promise<void> {
    const operationId = `${actionData.artifactId}-${actionData.actionId}`;
    const startTime = Date.now();

    this.#stats.totalOperations++;
    this.#activeOperations.add(operationId);

    try {
      if (this.#shouldRunInGlobalQueue(actionData)) {
        // Operations that need full serialization (shell commands, etc.)
        logger.debug(`Queuing operation ${operationId} in global queue (${actionData.action.type})`);
        this.#stats.serializedOperations++;

        this.#globalQueue = this.#globalQueue.then(async () => {
          await this.#executeWithLogging(operationId, callback, startTime);
        });

        await this.#globalQueue;
      } else if (actionData.action.type === 'file') {
        // File operations can run in parallel for different files
        const filePath = actionData.action.filePath;
        logger.debug(`Queuing file operation ${operationId} for ${filePath}`);

        if (!this.#fileQueues.has(filePath)) {
          // First operation on this file - can start immediately
          this.#stats.parallelOperations++;
          this.#fileQueues.set(filePath, this.#executeWithLogging(operationId, callback, startTime));
        } else {
          // Serialize with other operations on the same file
          this.#stats.serializedOperations++;

          const existingQueue = this.#fileQueues.get(filePath)!;

          this.#fileQueues.set(
            filePath,
            existingQueue.then(async () => {
              await this.#executeWithLogging(operationId, callback, startTime);
            }),
          );
        }

        await this.#fileQueues.get(filePath);

        // Clean up completed file queue if no other operations are pending
        if (this.#fileQueues.get(filePath)) {
          this.#fileQueues.delete(filePath);
        }
      } else {
        // Unknown operation type - use global queue for safety
        logger.warn(`Unknown operation type ${actionData.action.type}, using global queue`);
        this.#stats.serializedOperations++;

        this.#globalQueue = this.#globalQueue.then(async () => {
          await this.#executeWithLogging(operationId, callback, startTime);
        });

        await this.#globalQueue;
      }
    } finally {
      this.#activeOperations.delete(operationId);
    }
  }

  /**
   * Execute callback with logging and timing
   */
  async #executeWithLogging(operationId: string, callback: () => Promise<void>, startTime: number): Promise<void> {
    const waitTime = Date.now() - startTime;
    this.#updateAverageWaitTime(waitTime);

    logger.debug(`Executing operation ${operationId} (waited ${waitTime}ms)`);

    const executeStart = Date.now();

    try {
      await callback();

      const executeTime = Date.now() - executeStart;
      logger.debug(`Operation ${operationId} completed in ${executeTime}ms`);
    } catch (error) {
      const executeTime = Date.now() - executeStart;
      logger.error(`Operation ${operationId} failed after ${executeTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Determine if operation should run in the global queue (full serialization)
   */
  #shouldRunInGlobalQueue(actionData: ActionCallbackData): boolean {
    const { action } = actionData;

    // Shell commands need full serialization as they can affect global state
    if (action.type === 'shell' || action.type === 'start') {
      return true;
    }

    // Build operations need full serialization
    if (action.type === 'build') {
      return true;
    }

    // Supabase operations need serialization
    if (action.type === 'supabase') {
      return true;
    }

    return false;
  }

  /**
   * Update rolling average wait time
   */
  #updateAverageWaitTime(waitTime: number): void {
    const alpha = 0.1; // Exponential moving average factor
    this.#stats.averageWaitTime = this.#stats.averageWaitTime * (1 - alpha) + waitTime * alpha;
  }

  /**
   * Get execution statistics for monitoring
   */
  getStats() {
    return {
      ...this.#stats,
      activeOperations: this.#activeOperations.size,
      activeFileQueues: this.#fileQueues.size,
      parallelizationRate:
        this.#stats.totalOperations > 0 ? this.#stats.parallelOperations / this.#stats.totalOperations : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.#stats = {
      totalOperations: 0,
      parallelOperations: 0,
      serializedOperations: 0,
      averageWaitTime: 0,
    };
  }

  /**
   * Get debug information about current state
   */
  getDebugInfo() {
    return {
      activeOperations: Array.from(this.#activeOperations),
      activeFileQueues: Array.from(this.#fileQueues.keys()),
      stats: this.getStats(),
    };
  }
}
