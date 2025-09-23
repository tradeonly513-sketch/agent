import type { WebContainer } from '@webcontainer/api';
import { createScopedLogger } from '~/utils/logger';
import { path as nodePath } from '~/utils/path';

const logger = createScopedLogger('BatchFileOperations');

interface FileWriteOperation {
  relativePath: string;
  content: string;
  timestamp: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  size: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface BackpressureOptions {
  maxMemoryMB: number;
  maxPendingOperations: number;
  emergencyThresholdMB: number;
  adaptiveBackpressure: boolean;
}

class BackpressureController {
  private _options: BackpressureOptions;
  private _currentMemoryMB = 0;
  private _pendingOperationsCount = 0;
  private _rejectedOperations = 0;
  private _backpressureActive = false;

  constructor(options: BackpressureOptions) {
    this._options = options;
  }

  canAcceptOperation(operationSizeMB: number): { allowed: boolean; reason?: string } {
    // Check memory limits
    if (this._currentMemoryMB + operationSizeMB > this._options.maxMemoryMB) {
      this._backpressureActive = true;
      return {
        allowed: false,
        reason: `Memory limit exceeded: ${(this._currentMemoryMB + operationSizeMB).toFixed(2)}MB > ${this._options.maxMemoryMB}MB`,
      };
    }

    // Check pending operations limit
    if (this._pendingOperationsCount >= this._options.maxPendingOperations) {
      this._backpressureActive = true;
      return {
        allowed: false,
        reason: `Too many pending operations: ${this._pendingOperationsCount} >= ${this._options.maxPendingOperations}`,
      };
    }

    // Emergency threshold check
    if (this._currentMemoryMB > this._options.emergencyThresholdMB) {
      this._backpressureActive = true;
      return {
        allowed: false,
        reason: `Emergency memory threshold exceeded: ${this._currentMemoryMB.toFixed(2)}MB > ${this._options.emergencyThresholdMB}MB`,
      };
    }

    this._backpressureActive = false;

    return { allowed: true };
  }

  addOperation(sizeMB: number): void {
    this._currentMemoryMB += sizeMB;
    this._pendingOperationsCount++;
  }

  removeOperation(sizeMB: number): void {
    this._currentMemoryMB = Math.max(0, this._currentMemoryMB - sizeMB);
    this._pendingOperationsCount = Math.max(0, this._pendingOperationsCount - 1);
  }

  rejectOperation(): void {
    this._rejectedOperations++;
  }

  isBackpressureActive(): boolean {
    return this._backpressureActive;
  }

  getStats() {
    return {
      currentMemoryMB: this._currentMemoryMB,
      pendingOperationsCount: this._pendingOperationsCount,
      rejectedOperations: this._rejectedOperations,
      backpressureActive: this._backpressureActive,
      memoryUtilization: (this._currentMemoryMB / this._options.maxMemoryMB) * 100,
    };
  }

  reset(): void {
    this._currentMemoryMB = 0;
    this._pendingOperationsCount = 0;
    this._backpressureActive = false;
  }
}

interface BulkDirectoryOperation {
  rootPath: string;
  subDirectories: string[];
  timestamp: number;
}

/**
 * Batches file system operations to reduce WebContainer API calls and improve performance.
 * Collects operations over a short time window and executes them in batches.
 */
export class BatchFileOperationsManager {
  private _webcontainer: Promise<WebContainer>;
  private _pendingFileWrites = new Map<string, FileWriteOperation>();
  private _pendingDirCreates = new Set<string>();
  private _bulkDirOperations = new Map<string, BulkDirectoryOperation>();
  private _batchTimer: number | null = null;
  private readonly _batchDelay: number;
  private _adaptiveBatchDelay: number;
  private _maxBatchSize = 100; // Maximum operations per batch
  private _backpressureController: BackpressureController;
  private _stats = {
    totalFileWrites: 0,
    batchedFileWrites: 0,
    totalDirCreates: 0,
    batchedDirCreates: 0,
    totalBatches: 0,
    averageBatchSize: 0,
    bulkOperations: 0,
    averageOperationTime: 0,
    backpressureEvents: 0,
    rejectedOperations: 0,
  };

  constructor(webcontainer: Promise<WebContainer>, batchDelayMs: number = 10) {
    this._webcontainer = webcontainer;
    this._batchDelay = batchDelayMs;
    this._adaptiveBatchDelay = batchDelayMs;

    // Initialize backpressure controller with reasonable defaults
    this._backpressureController = new BackpressureController({
      maxMemoryMB: 100, // Max 100MB of pending file operations
      maxPendingOperations: 500, // Max 500 pending operations
      emergencyThresholdMB: 80, // Emergency threshold at 80MB
      adaptiveBackpressure: true,
    });

    logger.debug(`BatchFileOperations initialized with ${batchDelayMs}ms delay and backpressure control`);
  }

  /**
   * Schedule a file write operation for batching with backpressure handling
   */
  async scheduleFileWrite(relativePath: string, content: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._stats.totalFileWrites++;

      const priority = this._detectFilePriority(relativePath, content);
      const size = content.length;
      const sizeMB = size / (1024 * 1024);

      // Check backpressure before accepting operation
      const backpressureCheck = this._backpressureController.canAcceptOperation(sizeMB);

      if (!backpressureCheck.allowed) {
        this._stats.backpressureEvents++;
        this._stats.rejectedOperations++;
        this._backpressureController.rejectOperation();

        // For critical operations, force immediate execution despite backpressure
        if (priority === 'critical') {
          logger.warn(`Critical operation forced despite backpressure: ${relativePath}`);
          this.writeFileImmediate(relativePath, content).then(resolve).catch(reject);

          return;
        }

        // Reject non-critical operations under backpressure
        logger.warn(`Operation rejected due to backpressure: ${backpressureCheck.reason}`);
        reject(new Error(`Backpressure: ${backpressureCheck.reason}`));

        return;
      }

      // Track operation in backpressure controller
      this._backpressureController.addOperation(sizeMB);

      // Remove existing operation if updating same file
      const existingOp = this._pendingFileWrites.get(relativePath);

      if (existingOp) {
        this._backpressureController.removeOperation(existingOp.size / (1024 * 1024));
        existingOp.reject(new Error('Operation superseded by newer write'));
      }

      // Store the latest version of the file (overwrites previous pending writes)
      this._pendingFileWrites.set(relativePath, {
        relativePath,
        content,
        timestamp: Date.now(),
        priority,
        size,
        resolve,
        reject,
      });

      // Schedule directory creation for parent directory
      const dirPath = nodePath.dirname(relativePath);

      if (dirPath !== '.' && dirPath !== '/') {
        this._scheduleBulkDirectoryCreate(dirPath);
      }

      // Critical files bypass batching
      if (priority === 'critical') {
        this.writeFileImmediate(relativePath, content)
          .then(() => {
            this._pendingFileWrites.delete(relativePath);
            this._backpressureController.removeOperation(sizeMB);
            resolve();
          })
          .catch((error) => {
            this._pendingFileWrites.delete(relativePath);
            this._backpressureController.removeOperation(sizeMB);
            reject(error);
          });
        return;
      }

      // Adaptive batching based on priority and pending operations
      this._scheduleAdaptiveBatch();

      logger.debug(`Scheduled file write: ${relativePath} (${size} chars, ${priority} priority)`);
    });
  }

  /**
   * Schedule a directory creation operation for batching
   */
  scheduleDirectoryCreate(dirPath: string): void {
    // Normalize path and add to pending set
    const normalizedPath = dirPath.replace(/\/+$/g, '');

    if (normalizedPath && normalizedPath !== '.') {
      this._pendingDirCreates.add(normalizedPath);
      this._stats.totalDirCreates++;
      logger.debug(`Scheduled directory create: ${normalizedPath}`);
    }
  }

  /**
   * Write a file immediately without batching (for critical operations)
   */
  async writeFileImmediate(relativePath: string, content: string): Promise<void> {
    const webcontainer = await this._webcontainer;

    // Ensure directory exists
    const dirPath = nodePath.dirname(relativePath);

    if (dirPath !== '.' && dirPath !== '/') {
      try {
        await webcontainer.fs.mkdir(dirPath, { recursive: true });
        logger.debug(`Created directory immediately: ${dirPath}`);
      } catch (error) {
        logger.error(`Failed to create directory ${dirPath}:`, error);
      }
    }

    // Write file
    try {
      await webcontainer.fs.writeFile(relativePath, content);
      logger.debug(`File written immediately: ${relativePath}`);
    } catch (error) {
      logger.error(`Failed to write file ${relativePath}:`, error);
      throw error;
    }
  }

  /**
   * Flush all pending operations immediately
   */
  async flush(): Promise<void> {
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
      this._batchTimer = null;
    }

    try {
      await this._executeBatch();
    } catch (error) {
      // Ensure all pending operations are rejected on flush failure
      for (const operation of this._pendingFileWrites.values()) {
        operation.reject(new Error('Flush operation failed'));
        this._backpressureController.removeOperation(operation.size / (1024 * 1024));
      }
      this._pendingFileWrites.clear();
      throw error;
    }
  }

  /**
   * Schedule batch execution with debouncing
   */
  private _scheduleBatch(): void {
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
    }

    this._batchTimer = setTimeout(() => {
      this._executeBatch().catch((error) => {
        logger.error('Batch execution failed:', error);
      });
      this._batchTimer = null;
    }, this._batchDelay) as unknown as number;
  }

  /**
   * Execute all pending operations in batch
   */
  private async _executeBatch(): Promise<void> {
    if (
      this._pendingDirCreates.size === 0 &&
      this._pendingFileWrites.size === 0 &&
      this._bulkDirOperations.size === 0
    ) {
      return; // Nothing to do
    }

    const batchStartTime = Date.now();
    const dirCount = this._pendingDirCreates.size;
    const fileCount = this._pendingFileWrites.size;
    const bulkCount = this._bulkDirOperations.size;

    logger.debug(`Executing batch: ${dirCount} directories, ${fileCount} files, ${bulkCount} bulk operations`);

    try {
      const webcontainer = await this._webcontainer;

      // Batch 1: Execute bulk directory operations first (most efficient)
      if (this._bulkDirOperations.size > 0) {
        await this._executeBulkDirectoryOperations(webcontainer);
      }

      // Batch 2: Create remaining individual directories
      if (this._pendingDirCreates.size > 0) {
        await this._batchCreateDirectories(webcontainer);
      }

      // Batch 3: Write files with priority ordering
      if (this._pendingFileWrites.size > 0) {
        await this._batchWriteFilesByPriority(webcontainer);
      }

      // Update statistics
      this._stats.totalBatches++;
      this._stats.batchedDirCreates += dirCount;
      this._stats.batchedFileWrites += fileCount;
      this._updateAverageBatchSize(dirCount + fileCount + bulkCount);

      const batchTime = Date.now() - batchStartTime;
      this._updateAverageOperationTime(batchTime);

      logger.debug(`Batch completed in ${batchTime}ms (${dirCount} dirs, ${fileCount} files, ${bulkCount} bulk ops)`);
    } catch (error) {
      logger.error('Batch execution failed:', error);
      throw error;
    }
  }

  /**
   * Create directories in batch with optimal ordering
   */
  private async _batchCreateDirectories(webcontainer: WebContainer): Promise<void> {
    // Sort directories by depth (shallow first) to minimize mkdir calls
    const sortedDirs = Array.from(this._pendingDirCreates).sort((a: string, b: string) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;

      return depthA - depthB;
    });

    // Create directories in parallel where possible (different root paths)
    const createPromises: Promise<void>[] = [];

    for (const dirPath of sortedDirs) {
      createPromises.push(
        webcontainer.fs
          .mkdir(dirPath as string, { recursive: true })
          .catch((error) => {
            logger.error(`Failed to create directory ${dirPath}:`, error);

            // Don't throw - continue with other operations
          })
          .then(() => undefined),
      );
    }

    await Promise.all(createPromises);
    this._pendingDirCreates.clear();

    logger.debug(`Created ${sortedDirs.length} directories in batch`);
  }

  /**
   * Write files in batch with parallel execution
   */
  private async _batchWriteFiles(webcontainer: WebContainer): Promise<void> {
    const writeOperations = Array.from(this._pendingFileWrites.values());

    // Execute file writes in parallel
    const writePromises = writeOperations.map(async (operation) => {
      try {
        await webcontainer.fs.writeFile(operation.relativePath, operation.content);
        logger.debug(`Batched file write: ${operation.relativePath}`);
      } catch (error) {
        logger.error(`Failed to write file ${operation.relativePath}:`, error);

        // Don't throw - continue with other operations
      }
    });

    await Promise.all(writePromises);
    this._pendingFileWrites.clear();

    logger.debug(`Wrote ${writeOperations.length} files in batch`);
  }

  /**
   * Write files in batch with priority ordering and proper promise resolution
   */
  private async _batchWriteFilesByPriority(webcontainer: WebContainer): Promise<void> {
    const writeOperations = Array.from(this._pendingFileWrites.values());

    // Sort by priority: critical > high > normal > low
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    writeOperations.sort((a: FileWriteOperation, b: FileWriteOperation) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Within same priority, sort by timestamp (older first)
      return a.timestamp - b.timestamp;
    });

    // Group operations by priority for optimized batching
    const priorityGroups = {
      critical: writeOperations.filter((op: FileWriteOperation) => op.priority === 'critical'),
      high: writeOperations.filter((op: FileWriteOperation) => op.priority === 'high'),
      normal: writeOperations.filter((op: FileWriteOperation) => op.priority === 'normal'),
      low: writeOperations.filter((op: FileWriteOperation) => op.priority === 'low'),
    };

    // Execute critical and high priority files sequentially for reliability
    for (const operation of [...priorityGroups.critical, ...priorityGroups.high]) {
      try {
        await webcontainer.fs.writeFile(operation.relativePath, operation.content);
        this._backpressureController.removeOperation(operation.size / (1024 * 1024));
        operation.resolve();
        logger.debug(`Priority file write: ${operation.relativePath} (${operation.priority})`);
      } catch (error) {
        this._backpressureController.removeOperation(operation.size / (1024 * 1024));
        operation.reject(error as Error);
        logger.error(`Failed to write priority file ${operation.relativePath}:`, error);
      }
    }

    // Execute normal and low priority files in parallel for speed
    const parallelOperations = [...priorityGroups.normal, ...priorityGroups.low];

    if (parallelOperations.length > 0) {
      const writePromises = parallelOperations.map(async (operation: FileWriteOperation) => {
        try {
          await webcontainer.fs.writeFile(operation.relativePath, operation.content);
          this._backpressureController.removeOperation(operation.size / (1024 * 1024));
          operation.resolve();
          logger.debug(`Parallel file write: ${operation.relativePath} (${operation.priority})`);
        } catch (error) {
          this._backpressureController.removeOperation(operation.size / (1024 * 1024));
          operation.reject(error as Error);
          logger.error(`Failed to write file ${operation.relativePath}:`, error);
        }
      });

      await Promise.all(writePromises);
    }

    this._pendingFileWrites.clear();

    logger.debug(
      `Wrote ${writeOperations.length} files by priority: ${priorityGroups.critical.length} critical, ${priorityGroups.high.length} high, ${priorityGroups.normal.length} normal, ${priorityGroups.low.length} low`,
    );
  }

  /**
   * Update rolling average batch size
   */
  private _updateAverageBatchSize(currentBatchSize: number): void {
    const alpha = 0.2; // Exponential moving average factor
    this._stats.averageBatchSize = this._stats.averageBatchSize * (1 - alpha) + currentBatchSize * alpha;
  }

  /**
   * Update rolling average operation time
   */
  private _updateAverageOperationTime(operationTime: number): void {
    const alpha = 0.2; // Exponential moving average factor
    this._stats.averageOperationTime = this._stats.averageOperationTime * (1 - alpha) + operationTime * alpha;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const totalBytes = Array.from(this._pendingFileWrites.values()).reduce((sum, op) => sum + op.size, 0);

    const priorityCounts = Array.from(this._pendingFileWrites.values()).reduce(
      (counts: Record<string, number>, op: FileWriteOperation) => {
        counts[op.priority] = (counts[op.priority] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );

    return {
      ...this._stats,
      pendingFileWrites: this._pendingFileWrites.size,
      pendingDirCreates: this._pendingDirCreates.size,
      pendingBulkOperations: this._bulkDirOperations.size,
      pendingBytes: totalBytes,
      priorityCounts,
      adaptiveBatchDelay: this._adaptiveBatchDelay,
      batchingEfficiency:
        this._stats.totalFileWrites > 0 ? this._stats.batchedFileWrites / this._stats.totalFileWrites : 0,
      backpressure: this._backpressureController.getStats(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._stats = {
      totalFileWrites: 0,
      batchedFileWrites: 0,
      totalDirCreates: 0,
      batchedDirCreates: 0,
      totalBatches: 0,
      averageBatchSize: 0,
      bulkOperations: 0,
      averageOperationTime: 0,
      backpressureEvents: 0,
      rejectedOperations: 0,
    };
    this._backpressureController.reset();
  }

  /**
   * Check if operations are being processed efficiently
   */
  isOperatingEfficiently(): boolean {
    const stats = this.getStats();
    return stats.batchingEfficiency > 0.5 && stats.averageBatchSize > 1 && !stats.backpressure.backpressureActive;
  }

  /**
   * Check if backpressure is currently active
   */
  isBackpressureActive(): boolean {
    return this._backpressureController.isBackpressureActive();
  }

  /**
   * Force flush when backpressure is detected to relieve memory pressure
   */
  async flushDueToBackpressure(): Promise<void> {
    if (this.isBackpressureActive()) {
      logger.warn('Forcing flush due to backpressure');
      await this.flush();
    }
  }

  /**
   * Detect priority level based on file path and content
   */
  private _detectFilePriority(relativePath: string, content: string): 'critical' | 'high' | 'normal' | 'low' {
    // Critical files that need immediate processing
    if (/(package\.json|\.env|index\.html)$/.test(relativePath)) {
      return 'critical';
    }

    // High priority files
    if (/(tsconfig\.json|\.config\.|main\.[jt]sx?|app\.[jt]sx?)$/.test(relativePath)) {
      return 'high';
    }

    // Large files need prompt processing to avoid memory issues
    if (content.length > 100000) {
      return 'high';
    }

    // Binary files are lower priority
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|pdf|zip|tar|gz)$/i.test(relativePath)) {
      return 'low';
    }

    // Small files can wait
    if (content.length < 1000) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Schedule bulk directory creation for better performance
   */
  private _scheduleBulkDirectoryCreate(dirPath: string): void {
    const rootPath = this._findCommonRoot(dirPath);
    const normalizedPath = dirPath.replace(/\/+$/g, '');

    if (!normalizedPath || normalizedPath === '.') {
      return;
    }

    // Check if we already have a bulk operation for this root
    if (this._bulkDirOperations.has(rootPath)) {
      const existing = this._bulkDirOperations.get(rootPath)!;

      // Add this directory to the bulk operation if not already included
      if (!existing.subDirectories.includes(normalizedPath)) {
        existing.subDirectories.push(normalizedPath);
      }
    } else {
      // Create new bulk operation
      this._bulkDirOperations.set(rootPath, {
        rootPath,
        subDirectories: [normalizedPath],
        timestamp: Date.now(),
      });
    }

    // Also add to regular pending for fallback
    this._pendingDirCreates.add(normalizedPath);
    this._stats.totalDirCreates++;
    logger.debug(`Scheduled bulk directory create: ${normalizedPath} under root ${rootPath}`);
  }

  /**
   * Find common root path for bulk operations
   */
  private _findCommonRoot(dirPath: string): string {
    const parts = dirPath.split('/').filter(Boolean);

    // Use first two levels as root for bulk operations
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('/');
    } else if (parts.length === 1) {
      return parts[0];
    }

    return '.';
  }

  /**
   * Schedule batch execution with adaptive timing and backpressure awareness
   */
  private _scheduleAdaptiveBatch(): void {
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
    }

    // Calculate adaptive delay based on pending operations, priorities, and backpressure
    const pendingOps = this._pendingFileWrites.size + this._pendingDirCreates.size;
    const hasHighPriority = Array.from(this._pendingFileWrites.values()).some((op) => op.priority === 'high');
    const backpressureActive = this._backpressureController.isBackpressureActive();

    // Adjust batch delay based on conditions
    if (backpressureActive) {
      // Flush immediately under backpressure
      this._adaptiveBatchDelay = 1;
    } else if (hasHighPriority) {
      this._adaptiveBatchDelay = Math.max(5, this._batchDelay * 0.5);
    } else if (pendingOps > this._maxBatchSize * 0.8) {
      this._adaptiveBatchDelay = Math.max(5, this._batchDelay * 0.7);
    } else {
      this._adaptiveBatchDelay = this._batchDelay;
    }

    this._batchTimer = setTimeout(() => {
      this._executeBatch().catch((error) => {
        logger.error('Batch execution failed:', error);

        // Reject pending operations on batch failure
        for (const operation of this._pendingFileWrites.values()) {
          operation.reject(new Error('Batch execution failed'));
          this._backpressureController.removeOperation(operation.size / (1024 * 1024));
        }
        this._pendingFileWrites.clear();
      });
      this._batchTimer = null;
    }, this._adaptiveBatchDelay) as unknown as number;
  }

  /**
   * Execute bulk directory operations for better performance
   */
  private async _executeBulkDirectoryOperations(webcontainer: WebContainer): Promise<void> {
    if (this._bulkDirOperations.size === 0) {
      return;
    }

    const bulkOps = Array.from(this._bulkDirOperations.values());
    this._stats.bulkOperations += bulkOps.length;

    // Execute bulk operations in parallel
    const bulkPromises = bulkOps.map(async (bulkOp: BulkDirectoryOperation) => {
      try {
        // Create all directories in the bulk operation
        const createPromises = bulkOp.subDirectories.map((dirPath: string) =>
          webcontainer.fs.mkdir(dirPath, { recursive: true }).catch((error) => {
            logger.error(`Failed to create directory ${dirPath}:`, error);
          }),
        );

        await Promise.all(createPromises);
        logger.debug(`Bulk created ${bulkOp.subDirectories.length} directories under ${bulkOp.rootPath}`);
      } catch (error) {
        logger.error(`Bulk directory operation failed for ${bulkOp.rootPath}:`, error);
      }
    });

    await Promise.all(bulkPromises);

    // Clear bulk operations
    this._bulkDirOperations.clear();
  }
}
