import type { WebContainer } from '@webcontainer/api';
import { atom, map, type MapStore } from 'nanostores';
import { BatchFileOperationsManager } from './batch-file-operations';
import { CircuitBreakerManager } from './circuit-breaker';

import { fileChangeOptimizer } from './file-change-optimizer';
import type { ActionCallbackData } from './message-parser';
import { PerformanceMonitor } from './performance-monitor';
import { PredictiveDirectoryCreator } from './predictive-directory-creator';
import {
  WebContainerRateLimiterManager,
  WebContainerOperationType,
  OperationPriority,
} from './webcontainer-rate-limiter';
import type { FileMap } from '~/lib/stores/files';
import type {
  ActionAlert,
  BoltAction,
  DeployAlert,
  FileAction,
  FileHistory,
  SupabaseAction,
  SupabaseAlert,
} from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { path as nodePath } from '~/utils/path';
import type { BoltShell } from '~/utils/shell';
import { unreachable } from '~/utils/unreachable';

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

class ActionCommandError extends Error {
  readonly _output: string;
  readonly _header: string;

  constructor(message: string, output: string) {
    // Create a formatted message that includes both the error message and output
    const formattedMessage = `Failed To Execute Shell Command: ${message}\n\nOutput:\n${output}`;
    super(formattedMessage);

    // Set the output separately so it can be accessed programmatically
    this._header = message;
    this._output = output;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ActionCommandError.prototype);

    // Set the name of the error for better debugging
    this.name = 'ActionCommandError';
  }

  // Optional: Add a method to get just the terminal output
  get output() {
    return this._output;
  }
  get header() {
    return this._header;
  }
}

interface QueuedOperation {
  actionId: string;
  operation: () => Promise<void>;
  priority: 'critical' | 'high' | 'normal' | 'low';
  type: 'file' | 'shell' | 'start' | 'build' | 'supabase';
  dependencies?: string[]; // Operations that must complete first
}

class ConcurrencyController {
  private _queues = new Map<string, Promise<void>>(); // Per-file queues
  private _globalQueue = Promise.resolve(); // For operations requiring global serialization
  private _concurrentOperations = new Set<string>();
  private _maxConcurrency: number;
  private _pendingOperations: QueuedOperation[] = [];
  private _running = false;

  constructor(maxConcurrency: number = 10) {
    this._maxConcurrency = maxConcurrency;
  }

  async execute(operation: QueuedOperation): Promise<void> {
    return new Promise((resolve, reject) => {
      const wrappedOperation: QueuedOperation = {
        ...operation,
        operation: async () => {
          try {
            await operation.operation();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      };

      this._pendingOperations.push(wrappedOperation);
      this._scheduleExecution();
    });
  }

  private _scheduleExecution(): void {
    if (this._running) {
      return;
    }

    this._running = true;
    setImmediate(() => this._processQueue());
  }

  private async _processQueue(): Promise<void> {
    while (this._pendingOperations.length > 0 && this._concurrentOperations.size < this._maxConcurrency) {
      const operation = this._getNextReadyOperation();

      if (!operation) {
        break; // No operations ready to run
      }

      this._removeFromPending(operation);

      if (this._requiresGlobalSerialization(operation)) {
        // Execute in global queue
        this._globalQueue = this._globalQueue.then(async () => {
          await this._executeOperation(operation);
        });
        await this._globalQueue;
      } else if (operation.type === 'file') {
        // Execute in file-specific queue
        const fileKey = this._getFileKey(operation);
        const existingQueue = this._queues.get(fileKey) || Promise.resolve();

        const newQueue = existingQueue.then(async () => {
          await this._executeOperation(operation);
        });

        this._queues.set(fileKey, newQueue);

        // Don't await here to allow parallel execution
        newQueue.finally(() => {
          if (this._queues.get(fileKey) === newQueue) {
            this._queues.delete(fileKey);
          }
        });
      } else {
        // Execute immediately with concurrency control
        this._executeOperation(operation);
      }
    }
    this._running = false;
  }

  private _getNextReadyOperation(): QueuedOperation | null {
    // Sort by priority: critical > high > normal > low
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };

    const sortedOps = this._pendingOperations
      .filter((op) => this._dependenciesResolved(op))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return sortedOps[0] || null;
  }

  private _dependenciesResolved(operation: QueuedOperation): boolean {
    if (!operation.dependencies) {
      return true;
    }

    return operation.dependencies.every((dep) => !this._concurrentOperations.has(dep));
  }

  private _removeFromPending(operation: QueuedOperation): void {
    const index = this._pendingOperations.indexOf(operation);

    if (index > -1) {
      this._pendingOperations.splice(index, 1);
    }
  }

  private async _executeOperation(operation: QueuedOperation): Promise<void> {
    this._concurrentOperations.add(operation.actionId);

    try {
      await operation.operation();
    } finally {
      this._concurrentOperations.delete(operation.actionId);

      // Schedule more operations if queue not empty
      if (this._pendingOperations.length > 0) {
        this._scheduleExecution();
      }
    }
  }

  private _requiresGlobalSerialization(operation: QueuedOperation): boolean {
    return ['shell', 'start', 'build', 'supabase'].includes(operation.type);
  }

  private _getFileKey(operation: QueuedOperation): string {
    /*
     * For file operations, we need the actual file path for proper queuing
     * This will be set when creating the operation
     */
    return operation.actionId; // This will be overridden when creating file operations
  }

  cancelAll(): void {
    this._pendingOperations = [];
    this._concurrentOperations.clear();
    this._queues.clear();
    this._globalQueue = Promise.resolve();
  }

  getStats() {
    return {
      pendingOperations: this._pendingOperations.length,
      concurrentOperations: this._concurrentOperations.size,
      activeFileQueues: this._queues.size,
      maxConcurrency: this._maxConcurrency,
    };
  }
}

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #concurrencyController: ConcurrencyController;
  #shellTerminal: () => BoltShell;
  #batchFileOps: BatchFileOperationsManager;
  #predictiveDirectoryCreator: PredictiveDirectoryCreator;
  #circuitBreakerManager = CircuitBreakerManager.getInstance();
  #rateLimiter = WebContainerRateLimiterManager.getInstance().getRateLimiter('action-runner');
  #performanceMonitor = new PerformanceMonitor();
  runnerId = atom<string>(`${Date.now()}`);
  actions: ActionsMap = map({});
  onAlert?: (alert: ActionAlert) => void;

  // Global cancellation support
  #globalAbortController = new AbortController();
  #activeActions = new Set<string>();

  // File optimization tracking
  #fileOptimizationEnabled = true;
  #pendingFileChanges: Map<string, string> = new Map();
  #existingFiles: Map<string, string> = new Map();
  #userRequest: string = '';
  #optDebounceTimer: number | undefined;
  #isStreamingMode: boolean = false;

  #optimizationStats = {
    totalFilesAnalyzed: 0,
    filesSkipped: 0,
    filesModified: 0,
    filesCreated: 0,
    optimizationRate: 0,
    lastOptimization: null as Date | null,
  };

  onSupabaseAlert?: (alert: SupabaseAlert) => void;
  onDeployAlert?: (alert: DeployAlert) => void;
  buildOutput?: { path: string; exitCode: number; output: string };

  constructor(
    webcontainerPromise: Promise<WebContainer>,
    getShellTerminal: () => BoltShell,
    onAlert?: (alert: ActionAlert) => void,
    onSupabaseAlert?: (alert: SupabaseAlert) => void,
    onDeployAlert?: (alert: DeployAlert) => void,
  ) {
    this.#webcontainer = webcontainerPromise;
    this.#concurrencyController = new ConcurrencyController(8); // Allow up to 8 concurrent operations
    this.#shellTerminal = getShellTerminal;
    this.#batchFileOps = new BatchFileOperationsManager(webcontainerPromise);
    this.#predictiveDirectoryCreator = new PredictiveDirectoryCreator(webcontainerPromise);
    this.onAlert = onAlert;
    this.onSupabaseAlert = onSupabaseAlert;
    this.onDeployAlert = onDeployAlert;

    // Register this ActionRunner with the performance monitor and start monitoring
    this.#performanceMonitor.registerActionRunner(this);
    this.#performanceMonitor.startMonitoring();
  }

  // Global cancellation methods
  cancelAllActions() {
    logger.info('Cancelling all actions in ActionRunner');

    // Abort the global controller
    this.#globalAbortController.abort();

    // Mark all active actions as aborted
    for (const actionId of this.#activeActions) {
      this.#updateAction(actionId, { status: 'aborted' });
    }

    // Clear active actions
    this.#activeActions.clear();

    // Cancel all pending operations
    this.#concurrencyController.cancelAll();

    // Create new abort controller for future actions
    this.#globalAbortController = new AbortController();
  }

  isGloballyCancelled(): boolean {
    return this.#globalAbortController.signal.aborted;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // action already added
      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    // Status will be updated when operation actually starts executing
  }

  async runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    // Record activity for hang detection
    this.#performanceMonitor.recordActivity();

    // Check for global cancellation
    if (this.isGloballyCancelled()) {
      logger.debug(`Skipping action ${actionId} due to global cancellation`);
      this.#updateAction(actionId, { status: 'aborted' });

      return;
    }

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return;
    }

    if (isStreaming && action.type !== 'file') {
      return;
    }

    // Track active action
    this.#activeActions.add(actionId);
    this.#updateAction(actionId, { ...action, ...data.action, executed: !isStreaming });

    // Determine operation priority and type
    const priority = this.#determineOperationPriority(action.type, data);

    // Create operation for concurrency controller
    const operation: QueuedOperation = {
      actionId: action.type === 'file' ? (data.action as FileAction).filePath : actionId,
      operation: async () => {
        // Check cancellation before execution
        if (this.isGloballyCancelled()) {
          this.#updateAction(actionId, { status: 'aborted' });
          return;
        }

        this.#updateAction(actionId, { status: 'running' });
        await this.#executeAction(actionId, isStreaming);
      },
      priority,
      type: action.type as any,
    };

    try {
      await this.#concurrencyController.execute(operation);
    } catch (error) {
      logger.error('Action execution failed:', error);
      this.#updateAction(actionId, { status: 'failed', error: 'Action execution failed' });
    } finally {
      this.#activeActions.delete(actionId);
    }
  }

  #determineOperationPriority(actionType: string, data: ActionCallbackData): 'critical' | 'high' | 'normal' | 'low' {
    // Critical operations that should run immediately
    if (actionType === 'shell' || actionType === 'start' || actionType === 'build') {
      return 'critical';
    }

    // High priority for important files
    if (actionType === 'file') {
      const filePath = (data.action as FileAction).filePath;

      if (/(package\.json|index\.html|main\.[jt]sx?)$/.test(filePath)) {
        return 'high';
      }

      // Large files should be processed quickly to avoid memory issues
      if (data.action.content.length > 100000) {
        return 'high';
      }
    }

    // Supabase operations are normal priority
    if (actionType === 'supabase') {
      return 'normal';
    }

    return 'normal';
  }

  async #executeAction(actionId: string, isStreaming: boolean = false) {
    const action = this.actions.get()[actionId];

    // Final cancellation check before execution
    if (this.isGloballyCancelled() || action.abortSignal.aborted) {
      this.#updateAction(actionId, { status: 'aborted' });
      return;
    }

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          const circuitBreaker = this.#circuitBreakerManager.getCircuitBreaker('shell-operations', {
            failureThreshold: 3,
            recoveryTimeout: 30000,
            monitoringPeriod: 60000,
            successThreshold: 2,
            maxConcurrentRequests: 5,
          });

          await circuitBreaker.execute(() => this.#runShellAction(action), `shell-${actionId}`);
          break;
        }
        case 'file': {
          const circuitBreaker = this.#circuitBreakerManager.getCircuitBreaker('file-operations', {
            failureThreshold: 10,
            recoveryTimeout: 15000,
            monitoringPeriod: 60000,
            successThreshold: 5,
            maxConcurrentRequests: 20,
          });

          const prevStreaming = this.#isStreamingMode;
          this.#isStreamingMode = isStreaming;

          try {
            await circuitBreaker.execute(() => this.#runFileAction(action), `file-${action.filePath}`);
          } finally {
            this.#isStreamingMode = prevStreaming;
          }
          break;
        }

        case 'supabase': {
          const circuitBreaker = this.#circuitBreakerManager.getCircuitBreaker('supabase-operations', {
            failureThreshold: 5,
            recoveryTimeout: 45000,
            monitoringPeriod: 120000,
            successThreshold: 3,
            maxConcurrentRequests: 3,
          });

          try {
            await circuitBreaker.execute(
              () => this.handleSupabaseAction(action as SupabaseAction),
              `supabase-${actionId}`,
            );
          } catch (error: any) {
            // Update action status
            this.#updateAction(actionId, {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Supabase action failed',
            });

            // Return early without re-throwing
            return;
          }
          break;
        }
        case 'build': {
          const circuitBreaker = this.#circuitBreakerManager.getCircuitBreaker('build-operations', {
            failureThreshold: 2,
            recoveryTimeout: 60000,
            monitoringPeriod: 120000,
            successThreshold: 1,
            maxConcurrentRequests: 2,
          });

          const buildOutput = await circuitBreaker.execute(() => this.#runBuildAction(action), `build-${actionId}`);

          // Store build output for deployment
          this.buildOutput = buildOutput;
          break;
        }
        case 'start': {
          const circuitBreaker = this.#circuitBreakerManager.getCircuitBreaker('start-operations', {
            failureThreshold: 3,
            recoveryTimeout: 45000,
            monitoringPeriod: 120000,
            successThreshold: 2,
            maxConcurrentRequests: 3,
          });

          // making the start app non blocking
          circuitBreaker
            .execute(() => this.#runStartAction(action), `start-${actionId}`)
            .then(() => this.#updateAction(actionId, { status: 'complete' }))
            .catch((err: Error) => {
              if (action.abortSignal.aborted) {
                return;
              }

              this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
              logger.error(`[${action.type}]:Action failed\n\n`, err);

              if (!(err instanceof ActionCommandError)) {
                return;
              }

              this.onAlert?.({
                type: 'error',
                title: 'Dev Server Failed',
                description: err.header,
                content: err.output,
              });
            });

          /*
           * adding a delay to avoid any race condition between 2 start actions
           * i am up for a better approach
           */
          await new Promise((resolve) => setTimeout(resolve, 2000));

          return;
        }
      }

      this.#updateAction(actionId, {
        status: isStreaming ? 'running' : action.abortSignal.aborted ? 'aborted' : 'complete',
      });
    } catch (error) {
      if (action.abortSignal.aborted) {
        return;
      }

      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
      logger.error(`[${action.type}]:Action failed\n\n`, error);

      if (!(error instanceof ActionCommandError)) {
        return;
      }

      this.onAlert?.({
        type: 'error',
        title: 'Dev Server Failed',
        description: error.header,
        content: error.output,
      });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== 'shell') {
      unreachable('Expected shell action');
    }

    const shell = this.#shellTerminal();
    await shell.ready();

    if (!shell || !shell.terminal || !shell.process) {
      unreachable('Shell terminal not found');
    }

    // Pre-validate command for common issues
    const validationResult = await this.#validateShellCommand(action.content);

    if (validationResult.shouldModify && validationResult.modifiedCommand) {
      logger.debug(`Modified command: ${action.content} -> ${validationResult.modifiedCommand}`);
      action.content = validationResult.modifiedCommand;
    }

    const resp = await shell.executeCommand(this.runnerId.get(), action.content, () => {
      logger.debug(`[${action.type}]:Aborting Action\n\n`, action);
      action.abort();
    });
    logger.debug(`${action.type} Shell Response: [exit code:${resp?.exitCode}]`);

    if (resp?.exitCode != 0) {
      const enhancedError = this.#createEnhancedShellError(action.content, resp?.exitCode, resp?.output);
      throw new ActionCommandError(enhancedError.title, enhancedError.details);
    }
  }

  async #runStartAction(action: ActionState) {
    if (action.type !== 'start') {
      unreachable('Expected shell action');
    }

    if (!this.#shellTerminal) {
      unreachable('Shell terminal not found');
    }

    const shell = this.#shellTerminal();
    await shell.ready();

    if (!shell || !shell.terminal || !shell.process) {
      unreachable('Shell terminal not found');
    }

    const resp = await shell.executeCommand(this.runnerId.get(), action.content, () => {
      logger.debug(`[${action.type}]:Aborting Action\n\n`, action);
      action.abort();
    });
    logger.debug(`${action.type} Shell Response: [exit code:${resp?.exitCode}]`);

    if (resp?.exitCode != 0) {
      throw new ActionCommandError('Failed To Start Application', resp?.output || 'No Output Available');
    }

    return resp;
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const webcontainer = await this.#webcontainer;
    const relativePath = nodePath.relative(webcontainer.workdir, action.filePath);

    // Trigger predictive directory analysis
    try {
      await this.#predictiveDirectoryCreator.analyzeAndPredict(relativePath);
    } catch (error) {
      logger.warn('Predictive directory analysis failed:', error);
    }

    // In streaming mode, write through immediately to avoid UI stalls and timer starvation
    if (this.#isStreamingMode) {
      // Track pending change for end-of-stream optimization/statistics only if optimization is enabled
      if (this.#fileOptimizationEnabled) {
        this.#pendingFileChanges.set(relativePath, action.content);

        // Defer file reading to avoid blocking streaming performance
        this.#deferredExistingFileReads.add(relativePath);
      }

      await this.#writeFileWithLogging(webcontainer, relativePath, action.content, true);

      return;
    }

    // Fast-path decision: Should we bypass optimization entirely?
    if (!this.#fileOptimizationEnabled || this.#shouldBypassOptimization(relativePath, action.content)) {
      logger.debug(`📝 Fast-path write: ${relativePath} (bypassing optimization)`);
      await this.#writeFileWithLogging(webcontainer, relativePath, action.content, false);

      return;
    }

    // Full optimization path
    await this.#runFileActionWithOptimization(webcontainer, relativePath, action.content);
  }

  // Add a set to track deferred file reads
  #deferredExistingFileReads = new Set<string>();

  /**
   * Determine if optimization should be bypassed entirely for performance
   */
  #shouldBypassOptimization(relativePath: string, content: string): boolean {
    // Bypass for very small files (< 500 chars) - not worth optimizing
    if (content.length < 500) {
      return true;
    }

    // Bypass for binary files - optimization doesn't help
    if (this.#isBinaryFile(relativePath)) {
      return true;
    }

    // Bypass for files that are clearly complete and standalone
    if (this.#isStandaloneFile(relativePath, content)) {
      return true;
    }

    // Bypass if we have very few pending changes (< 3 files)
    if (this.#pendingFileChanges.size < 3) {
      return true;
    }

    return false;
  }

  /**
   * Check if a file is likely binary based on extension
   */
  #isBinaryFile(relativePath: string): boolean {
    return /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|pdf|zip|tar|gz|mp4|mp3|wav)$/i.test(relativePath);
  }

  /**
   * Check if a file appears to be standalone and complete
   */
  #isStandaloneFile(relativePath: string, _content: string): boolean {
    // JSON files are usually standalone
    if (relativePath.endsWith('.json')) {
      return true;
    }

    // README and documentation files
    if (/readme|license|changelog/i.test(relativePath)) {
      return true;
    }

    // Config files that are typically standalone
    if (/(\.config\.|\.rc$|\.env)/i.test(relativePath)) {
      return true;
    }

    return false;
  }

  /**
   * Run file action with full optimization pipeline
   */
  async #runFileActionWithOptimization(webcontainer: WebContainer, relativePath: string, content: string) {
    // Track proposed change
    this.#pendingFileChanges.set(relativePath, content);

    // Capture existing content if any (only when needed for optimization)
    try {
      const existing = await this.#rateLimiter.execute(
        () => webcontainer.fs.readFile(relativePath, 'utf-8'),
        WebContainerOperationType.READ,
        OperationPriority.NORMAL,
      );
      this.#existingFiles.set(relativePath, existing);
    } catch {
      // file doesn't exist -> creation
    }

    logger.debug(`📝 Queued file change for optimization: ${relativePath} (len=${content.length})`);

    // Optimize immediately for certain cases; otherwise debounce
    if (this.#shouldOptimizeNow(relativePath, content)) {
      await this.#performFileOptimization();
    } else {
      this.#scheduleOptimizationDebounce(60); // Reduced from 120ms to 60ms
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
  }

  /** Set user request context for better optimization */
  setUserRequest(request: string) {
    this.#userRequest = request;
    logger.debug(`User request context set: "${request.substring(0, 120)}..."`);
  }

  /** Get optimization statistics */
  getOptimizationStats() {
    return { ...this.#optimizationStats };
  }

  /** Enable or disable file optimization */
  setFileOptimizationEnabled(enabled: boolean) {
    this.#fileOptimizationEnabled = enabled;
    logger.info(`File optimization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /** Force optimization of pending file changes */
  async flushPendingFileChanges() {
    if (this.#optDebounceTimer) {
      clearTimeout(this.#optDebounceTimer);
      this.#optDebounceTimer = undefined;
    }

    // Handle deferred file reads from streaming mode
    await this.#processDeferredFileReads();

    if (this.#pendingFileChanges.size > 0) {
      logger.info(`Flushing ${this.#pendingFileChanges.size} pending file changes...`);
      await this.#performFileOptimization();
    }

    // Also flush any pending batch file operations
    await this.#batchFileOps.flush();
  }

  /**
   * Process deferred file reads that were skipped during streaming for performance
   */
  async #processDeferredFileReads() {
    if (this.#deferredExistingFileReads.size === 0) {
      return;
    }

    const webcontainer = await this.#webcontainer;
    const readPromises: Promise<void>[] = [];

    for (const relativePath of this.#deferredExistingFileReads) {
      if (!this.#existingFiles.has(relativePath)) {
        readPromises.push(
          webcontainer.fs
            .readFile(relativePath, 'utf-8')
            .then((content) => {
              this.#existingFiles.set(relativePath, content);
            })
            .catch(() => {
              // File doesn't exist, which is fine
            }),
        );
      }
    }

    await Promise.all(readPromises);
    this.#deferredExistingFileReads.clear();

    logger.debug(`Processed ${readPromises.length} deferred file reads`);
  }

  /** Get batch file operations statistics */
  getBatchFileStats() {
    return this.#batchFileOps.getStats();
  }

  /** Get predictive directory creation statistics */
  getPredictiveDirectoryStats() {
    return this.#predictiveDirectoryCreator.getStats();
  }

  /** Get concurrency controller statistics */
  getConcurrencyStats() {
    return this.#concurrencyController.getStats();
  }

  /** Get circuit breaker statistics */
  getCircuitBreakerStats() {
    return this.#circuitBreakerManager.getAllStats();
  }

  /** Check if any circuit breakers are unhealthy */
  hasUnhealthyCircuitBreakers() {
    return this.#circuitBreakerManager.hasUnhealthyCircuitBreakers();
  }

  /** Get list of unhealthy circuit breakers */
  getUnhealthyCircuitBreakers() {
    return this.#circuitBreakerManager.getUnhealthyCircuitBreakers();
  }

  /** Perform comprehensive directory structure analysis */
  async performComprehensiveDirectoryAnalysis() {
    try {
      await this.#predictiveDirectoryCreator.performComprehensiveAnalysis();
      logger.info('Comprehensive directory analysis completed');
    } catch (error) {
      logger.error('Comprehensive directory analysis failed:', error);
    }
  }

  #scheduleOptimizationDebounce(delayMs: number = 60) {
    if (this.#optDebounceTimer) {
      clearTimeout(this.#optDebounceTimer);
    }

    this.#optDebounceTimer = setTimeout(() => {
      this.#performFileOptimization().catch((e) => logger.error('Optimization failed', e));
      this.#optDebounceTimer = undefined;
    }, delayMs) as unknown as number;
  }

  async getFileHistory(filePath: string): Promise<FileHistory | null> {
    try {
      const webcontainer = await this.#webcontainer;
      const historyPath = this.#getHistoryPath(filePath);

      const content = await this.#rateLimiter.execute(
        () => webcontainer.fs.readFile(historyPath, 'utf-8'),
        WebContainerOperationType.READ,
        OperationPriority.LOW,
      );

      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to get file history:', error);
      return null;
    }
  }

  async saveFileHistory(filePath: string, history: FileHistory) {
    // const webcontainer = await this.#webcontainer;
    const historyPath = this.#getHistoryPath(filePath);

    await this.#runFileAction({
      type: 'file',
      filePath: historyPath,
      content: JSON.stringify(history),
      changeSource: 'auto-save',
    } as any);
  }

  async #writeFileWithLogging(
    webcontainer: WebContainer,
    relativePath: string,
    content: string,
    immediate: boolean = false,
  ) {
    if (immediate) {
      // For critical operations that need immediate execution
      await this.#batchFileOps.writeFileImmediate(relativePath, content);
    } else {
      // Use batching for better performance
      await this.#batchFileOps.scheduleFileWrite(relativePath, content);
    }
  }

  #shouldOptimizeNow(path: string, content: string) {
    // Heuristics: Write immediately if very large or likely to be needed right away

    // 1MB+ files should be written immediately to avoid memory issues
    if (content.length > 1024 * 1024) {
      return true;
    }

    // Binary and asset files should be written immediately
    if (/\.(lock|png|jpg|jpeg|gif|webp|svg|ico|woff2?|pdf|zip|tar|gz)$/i.test(path)) {
      return true;
    }

    // Build outputs and critical files should be written immediately
    if (/^(dist|build|out|\.next)\//.test(path)) {
      return true;
    }

    // Package manager files should be written immediately
    if (/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/.test(path)) {
      return true;
    }

    // Configuration files that might affect builds should be written immediately
    if (/(tsconfig\.json|webpack\.config\.|vite\.config\.|rollup\.config\.)/.test(path)) {
      return true;
    }

    // Entry point files (index.html, main.js, etc.) should be optimized immediately
    if (/(^|\/)index\.(html?|[jt]sx?)$|main\.[jt]sx?$/.test(path)) {
      return true;
    }

    return false;
  }

  async #performFileOptimization() {
    const webcontainer = await this.#webcontainer;

    // Build maps expected by optimizer
    const proposed: FileMap = {};
    const existing: FileMap = {};

    for (const [p, c] of this.#pendingFileChanges.entries()) {
      proposed[p] = { type: 'file', name: p.split('/').pop() || p, path: p, content: c } as any;
    }

    for (const [p, c] of this.#existingFiles.entries()) {
      existing[p] = { type: 'file', name: p.split('/').pop() || p, path: p, content: c } as any;
    }

    const { optimizedFiles, analysis, skippedFiles, modifiedFiles, createdFiles, optimizationRate } =
      await fileChangeOptimizer.optimizeFileChanges(proposed, existing, this.#userRequest);

    // Write the optimized set using batching for maximum efficiency
    for (const [p, dirent] of Object.entries(optimizedFiles)) {
      const content = (dirent as any).content ?? '';
      await this.#writeFileWithLogging(webcontainer, p, content, false);
    }

    // Stats
    this.#optimizationStats.totalFilesAnalyzed += this.#pendingFileChanges.size;
    this.#optimizationStats.filesSkipped += skippedFiles.length;
    this.#optimizationStats.filesModified += modifiedFiles.length;
    this.#optimizationStats.filesCreated += createdFiles.length;
    this.#optimizationStats.optimizationRate = optimizationRate;
    this.#optimizationStats.lastOptimization = new Date();

    // Clear queues
    this.#pendingFileChanges.clear();
    this.#existingFiles.clear();

    // Debug log a few analyses
    let shown = 0;

    for (const [p, a] of analysis.entries()) {
      if (shown++ > 5) {
        break;
      }

      logger.debug(
        `[opt] ${p} -> ${a.changeType} (${(a.similarity * 100).toFixed(1)}% sim, ${a.changePercentage.toFixed(1)}% change) :: ${a.reason}`,
      );
    }
  }

  #getHistoryPath(filePath: string) {
    return nodePath.join('.history', filePath);
  }

  async #runBuildAction(action: ActionState) {
    if (action.type !== 'build') {
      unreachable('Expected build action');
    }

    // Ensure pending file changes are written before building
    await this.flushPendingFileChanges();

    // Trigger build started alert
    this.onDeployAlert?.({
      type: 'info',
      title: 'Building Application',
      description: 'Building your application...',
      stage: 'building',
      buildStatus: 'running',
      deployStatus: 'pending',
      source: 'netlify',
    });

    const webcontainer = await this.#webcontainer;

    // Create a new terminal specifically for the build
    const buildProcess = await this.#rateLimiter.execute(
      () => webcontainer.spawn('npm', ['run', 'build']),
      WebContainerOperationType.SPAWN,
      OperationPriority.HIGH,
    );

    let output = '';
    buildProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
        },
      }),
    );

    const exitCode = await buildProcess.exit;

    if (exitCode !== 0) {
      // Trigger build failed alert
      this.onDeployAlert?.({
        type: 'error',
        title: 'Build Failed',
        description: 'Your application build failed',
        content: output || 'No build output available',
        stage: 'building',
        buildStatus: 'failed',
        deployStatus: 'pending',
        source: 'netlify',
      });

      throw new ActionCommandError('Build Failed', output || 'No Output Available');
    }

    // Trigger build success alert
    this.onDeployAlert?.({
      type: 'success',
      title: 'Build Completed',
      description: 'Your application was built successfully',
      stage: 'deploying',
      buildStatus: 'complete',
      deployStatus: 'running',
      source: 'netlify',
    });

    // Check for common build directories
    const commonBuildDirs = ['dist', 'build', 'out', 'output', '.next', 'public'];

    let buildDir = '';

    // Try to find the first existing build directory
    for (const dir of commonBuildDirs) {
      const dirPath = nodePath.join(webcontainer.workdir, dir);

      try {
        await this.#rateLimiter.execute(
          () => webcontainer.fs.readdir(dirPath),
          WebContainerOperationType.READ,
          OperationPriority.LOW,
        );
        buildDir = dirPath;
        break;
      } catch {
        continue;
      }
    }

    // If no build directory was found, use the default (dist)
    if (!buildDir) {
      buildDir = nodePath.join(webcontainer.workdir, 'dist');
    }

    return {
      path: buildDir,
      exitCode,
      output,
    };
  }
  async handleSupabaseAction(action: SupabaseAction) {
    const { operation, content, filePath } = action;
    logger.debug('[Supabase Action]:', { operation, filePath, content });

    switch (operation) {
      case 'migration':
        if (!filePath) {
          throw new Error('Migration requires a filePath');
        }

        // Show alert for migration action
        this.onSupabaseAlert?.({
          type: 'info',
          title: 'Supabase Migration',
          description: `Create migration file: ${filePath}`,
          content,
          source: 'supabase',
        });

        // Only create the migration file
        await this.#runFileAction({
          type: 'file',
          filePath,
          content,
          changeSource: 'supabase',
        } as any);
        return { success: true };

      case 'query': {
        // Always show the alert and let the SupabaseAlert component handle connection state
        this.onSupabaseAlert?.({
          type: 'info',
          title: 'Supabase Query',
          description: 'Execute database query',
          content,
          source: 'supabase',
        });

        // The actual execution will be triggered from SupabaseChatAlert
        return { pending: true };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  // Add this method declaration to the class
  handleDeployAction(
    stage: 'building' | 'deploying' | 'complete',
    status: ActionStatus,
    details?: {
      url?: string;
      error?: string;
      source?: 'netlify' | 'vercel' | 'github' | 'gitlab';
    },
  ): void {
    if (!this.onDeployAlert) {
      logger.debug('No deploy alert handler registered');
      return;
    }

    const alertType = status === 'failed' ? 'error' : status === 'complete' ? 'success' : 'info';

    const title =
      stage === 'building'
        ? 'Building Application'
        : stage === 'deploying'
          ? 'Deploying Application'
          : 'Deployment Complete';

    const description =
      status === 'failed'
        ? `${stage === 'building' ? 'Build' : 'Deployment'} failed`
        : status === 'running'
          ? `${stage === 'building' ? 'Building' : 'Deploying'} your application...`
          : status === 'complete'
            ? `${stage === 'building' ? 'Build' : 'Deployment'} completed successfully`
            : `Preparing to ${stage === 'building' ? 'build' : 'deploy'} your application`;

    const buildStatus =
      stage === 'building' ? status : stage === 'deploying' || stage === 'complete' ? 'complete' : 'pending';

    const deployStatus = stage === 'building' ? 'pending' : status;

    this.onDeployAlert({
      type: alertType,
      title,
      description,
      content: details?.error || '',
      url: details?.url,
      stage,
      buildStatus: buildStatus as any,
      deployStatus: deployStatus as any,
      source: details?.source || 'netlify',
    });
  }

  async #validateShellCommand(command: string): Promise<{
    shouldModify: boolean;
    modifiedCommand?: string;
    warning?: string;
  }> {
    const trimmedCommand = command.trim();

    // Handle rm commands that might fail due to missing files
    if (trimmedCommand.startsWith('rm ') && !trimmedCommand.includes(' -f')) {
      const rmMatch = trimmedCommand.match(/^rm\s+(.+)$/);

      if (rmMatch) {
        const filePaths = rmMatch[1].split(/\s+/);

        // Check if any of the files exist using WebContainer
        try {
          const webcontainer = await this.#webcontainer;
          const existingFiles = [];

          for (const filePath of filePaths) {
            if (filePath.startsWith('-')) {
              continue;
            } // Skip flags

            try {
              await this.#rateLimiter.execute(
                () => webcontainer.fs.readFile(filePath),
                WebContainerOperationType.READ,
                OperationPriority.LOW,
              );
              existingFiles.push(filePath);
            } catch {
              // File doesn't exist, skip it
            }
          }

          if (existingFiles.length === 0) {
            // No files exist, modify command to use -f flag to avoid error
            return {
              shouldModify: true,
              modifiedCommand: `rm -f ${filePaths.join(' ')}`,
              warning: 'Added -f flag to rm command as target files do not exist',
            };
          } else if (existingFiles.length < filePaths.length) {
            // Some files don't exist, modify to only remove existing ones with -f for safety
            return {
              shouldModify: true,
              modifiedCommand: `rm -f ${filePaths.join(' ')}`,
              warning: 'Added -f flag to rm command as some target files do not exist',
            };
          }
        } catch (error) {
          logger.debug('Could not validate rm command files:', error);
        }
      }
    }

    // Handle cd commands to non-existent directories
    if (trimmedCommand.startsWith('cd ')) {
      const cdMatch = trimmedCommand.match(/^cd\s+(.+)$/);

      if (cdMatch) {
        const targetDir = cdMatch[1].trim();

        try {
          const webcontainer = await this.#webcontainer;
          await this.#rateLimiter.execute(
            () => webcontainer.fs.readdir(targetDir),
            WebContainerOperationType.READ,
            OperationPriority.LOW,
          );
        } catch {
          return {
            shouldModify: true,
            modifiedCommand: `mkdir -p ${targetDir} && cd ${targetDir}`,
            warning: 'Directory does not exist, created it first',
          };
        }
      }
    }

    // Handle cp/mv commands with missing source files
    if (trimmedCommand.match(/^(cp|mv)\s+/)) {
      const parts = trimmedCommand.split(/\s+/);

      if (parts.length >= 3) {
        const sourceFile = parts[1];

        try {
          const webcontainer = await this.#webcontainer;
          await this.#rateLimiter.execute(
            () => webcontainer.fs.readFile(sourceFile),
            WebContainerOperationType.READ,
            OperationPriority.LOW,
          );
        } catch {
          return {
            shouldModify: false,
            warning: `Source file '${sourceFile}' does not exist`,
          };
        }
      }
    }

    return { shouldModify: false };
  }

  #createEnhancedShellError(
    command: string,
    exitCode: number | undefined,
    output: string | undefined,
  ): {
    title: string;
    details: string;
  } {
    const trimmedCommand = command.trim();
    const firstWord = trimmedCommand.split(/\s+/)[0];

    // Common error patterns and their explanations
    const errorPatterns = [
      {
        pattern: /cannot remove.*No such file or directory/,
        title: 'File Not Found',
        getMessage: () => {
          const fileMatch = output?.match(/'([^']+)'/);
          const fileName = fileMatch ? fileMatch[1] : 'file';

          return `The file '${fileName}' does not exist and cannot be removed.\n\nSuggestion: Use 'ls' to check what files exist, or use 'rm -f' to ignore missing files.`;
        },
      },
      {
        pattern: /No such file or directory/,
        title: 'File or Directory Not Found',
        getMessage: () => {
          if (trimmedCommand.startsWith('cd ')) {
            const dirMatch = trimmedCommand.match(/cd\s+(.+)/);
            const dirName = dirMatch ? dirMatch[1] : 'directory';

            return `The directory '${dirName}' does not exist.\n\nSuggestion: Use 'mkdir -p ${dirName}' to create it first, or check available directories with 'ls'.`;
          }

          return `The specified file or directory does not exist.\n\nSuggestion: Check the path and use 'ls' to see available files.`;
        },
      },
      {
        pattern: /Permission denied/,
        title: 'Permission Denied',
        getMessage: () =>
          `Permission denied for '${firstWord}'.\n\nSuggestion: The file may not be executable. Try 'chmod +x filename' first.`,
      },
      {
        pattern: /command not found/,
        title: 'Command Not Found',
        getMessage: () =>
          `The command '${firstWord}' is not available in WebContainer.\n\nSuggestion: Check available commands or use a package manager to install it.`,
      },
      {
        pattern: /Is a directory/,
        title: 'Target is a Directory',
        getMessage: () =>
          `Cannot perform this operation - target is a directory.\n\nSuggestion: Use 'ls' to list directory contents or add appropriate flags.`,
      },
      {
        pattern: /File exists/,
        title: 'File Already Exists',
        getMessage: () => `File already exists.\n\nSuggestion: Use a different name or add '-f' flag to overwrite.`,
      },
    ];

    // Try to match known error patterns
    for (const errorPattern of errorPatterns) {
      if (output && errorPattern.pattern.test(output)) {
        return {
          title: errorPattern.title,
          details: errorPattern.getMessage(),
        };
      }
    }

    // Generic error with suggestions based on command type
    let suggestion = '';

    if (trimmedCommand.startsWith('npm ')) {
      suggestion = '\n\nSuggestion: Try running "npm install" first or check package.json.';
    } else if (trimmedCommand.startsWith('git ')) {
      suggestion = "\n\nSuggestion: Check if you're in a git repository or if remote is configured.";
    } else if (trimmedCommand.match(/^(ls|cat|rm|cp|mv)/)) {
      suggestion = '\n\nSuggestion: Check file paths and use "ls" to see available files.';
    }

    return {
      title: `Command Failed (exit code: ${exitCode})`,
      details: `Command: ${trimmedCommand}\n\nOutput: ${output || 'No output available'}${suggestion}`,
    };
  }
}
