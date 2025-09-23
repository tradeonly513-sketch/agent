import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import fileSaver from 'file-saver';
import Cookies from 'js-cookie';
import JSZip from 'jszip';
import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { ParallelExecutionManager } from './parallel-execution-manager';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { description } from '~/lib/persistence';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { PerformanceMonitor } from '~/lib/runtime/performance-monitor';
import { webcontainer } from '~/lib/webcontainer';
import type { ActionAlert, DeployAlert, SupabaseAlert } from '~/types/actions';
import type { ITerminal } from '~/types/terminal';
import { ContentAwareSampler } from '~/utils/content-aware-sampler';
import { extractRelativePath } from '~/utils/diff';
import { path } from '~/utils/path';
import { unreachable } from '~/utils/unreachable';

interface WorkbenchCleanupOptions {
  maxArtifacts: number;
  maxFileHistory: number;
  maxAlertHistory: number;
  artifactTtlMs: number;
  cleanupIntervalMs: number;
}

class WorkbenchStateManager {
  private _cleanupOptions: WorkbenchCleanupOptions;
  private _cleanupTimer: NodeJS.Timeout | null = null;
  private _lastCleanup = Date.now();
  private _artifactCreationTimes = new Map<string, number>();
  private _fileModificationTimes = new Map<string, number>();
  private _alertHistory: Array<{ alert: any; timestamp: number }> = [];

  constructor(options: Partial<WorkbenchCleanupOptions> = {}) {
    this._cleanupOptions = {
      maxArtifacts: 50, // Keep max 50 artifacts in memory
      maxFileHistory: 200, // Keep max 200 file modifications
      maxAlertHistory: 20, // Keep max 20 alerts
      artifactTtlMs: 30 * 60 * 1000, // 30 minutes TTL for inactive artifacts
      cleanupIntervalMs: 5 * 60 * 1000, // Cleanup every 5 minutes
      ...options,
    };

    this._scheduleCleanup();
  }

  private _scheduleCleanup(): void {
    if (this._cleanupTimer) {
      clearTimeout(this._cleanupTimer);
    }

    this._cleanupTimer = setTimeout(() => {
      this._performCleanup();
      this._scheduleCleanup();
    }, this._cleanupOptions.cleanupIntervalMs);
  }

  private _performCleanup(): void {
    const now = Date.now();
    this._lastCleanup = now;

    // Clean up old artifact timestamps
    for (const [artifactId, creationTime] of this._artifactCreationTimes.entries()) {
      if (now - creationTime > this._cleanupOptions.artifactTtlMs) {
        this._artifactCreationTimes.delete(artifactId);
      }
    }

    // Clean up old file modification times
    if (this._fileModificationTimes.size > this._cleanupOptions.maxFileHistory) {
      const sorted = Array.from(this._fileModificationTimes.entries()).sort(([, a], [, b]) => a - b);

      const toDelete = sorted.slice(0, sorted.length - this._cleanupOptions.maxFileHistory);

      for (const [filePath] of toDelete) {
        this._fileModificationTimes.delete(filePath);
      }
    }

    // Clean up old alerts
    if (this._alertHistory.length > this._cleanupOptions.maxAlertHistory) {
      this._alertHistory = this._alertHistory.slice(-this._cleanupOptions.maxAlertHistory);
    }
  }

  trackArtifact(artifactId: string): void {
    this._artifactCreationTimes.set(artifactId, Date.now());
  }

  trackFileModification(filePath: string): void {
    this._fileModificationTimes.set(filePath, Date.now());
  }

  trackAlert(alert: any): void {
    this._alertHistory.push({ alert, timestamp: Date.now() });
  }

  shouldCleanupArtifact(artifactId: string): boolean {
    const creationTime = this._artifactCreationTimes.get(artifactId);

    if (!creationTime) {
      return false;
    }

    return Date.now() - creationTime > this._cleanupOptions.artifactTtlMs;
  }

  getOldestArtifacts(count: number): string[] {
    return Array.from(this._artifactCreationTimes.entries())
      .sort(([, a], [, b]) => a - b)
      .slice(0, count)
      .map(([artifactId]) => artifactId);
  }

  getStats() {
    return {
      trackedArtifacts: this._artifactCreationTimes.size,
      trackedFileModifications: this._fileModificationTimes.size,
      alertHistory: this._alertHistory.length,
      lastCleanup: this._lastCleanup,
      cleanupOptions: this._cleanupOptions,
    };
  }

  forceCleanup(): void {
    this._performCleanup();
  }

  destroy(): void {
    if (this._cleanupTimer) {
      clearTimeout(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }
}

const { saveAs } = fileSaver;

export interface ArtifactState {
  id: string;
  title: string;
  type?: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'diff' | 'preview';

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);
  #executionManager = new ParallelExecutionManager();
  #performanceMonitor = new PerformanceMonitor();
  #stateManager = new WorkbenchStateManager();

  #reloadedMessages = new Set<string>();

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data.actionAlert ?? atom<ActionAlert | undefined>(undefined);
  supabaseAlert: WritableAtom<SupabaseAlert | undefined> =
    import.meta.hot?.data.supabaseAlert ?? atom<SupabaseAlert | undefined>(undefined);
  deployAlert: WritableAtom<DeployAlert | undefined> =
    import.meta.hot?.data.deployAlert ?? atom<DeployAlert | undefined>(undefined);
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];
  #maxArtifactIdListSize = 100; // Limit artifact list size
  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.actionAlert = this.actionAlert;
      import.meta.hot.data.supabaseAlert = this.supabaseAlert;
      import.meta.hot.data.deployAlert = this.deployAlert;

      // Ensure binary files are properly preserved across hot reloads
      const filesMap = this.files.get();

      for (const [path, dirent] of Object.entries(filesMap)) {
        if (dirent?.type === 'file' && dirent.isBinary && dirent.content) {
          // Make sure binary content is preserved
          this.files.setKey(path, { ...dirent });
        }
      }

      // Schedule periodic cleanup for development mode
      setInterval(
        () => {
          this.forceStateCleanup();
        },
        10 * 60 * 1000,
      ); // Every 10 minutes in dev mode
    }
  }

  /**
   * Get execution manager statistics for performance monitoring
   */
  getExecutionStats() {
    return this.#executionManager.getStats();
  }

  /**
   * Get execution manager debug information
   */
  getExecutionDebugInfo() {
    return this.#executionManager.getDebugInfo();
  }

  /**
   * Get performance monitor instance
   */
  getPerformanceMonitor() {
    return this.#performanceMonitor;
  }

  /**
   * Get real-time performance summary
   */
  getPerformanceSummary() {
    return this.#performanceMonitor.getPerformanceSummary();
  }

  /**
   * Get current performance metrics
   */
  getCurrentPerformanceMetrics() {
    return this.#performanceMonitor.getCurrentMetrics();
  }

  /**
   * Get performance alerts
   */
  getPerformanceAlerts(limit?: number) {
    return this.#performanceMonitor.getAlerts(limit);
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring(intervalMs: number = 5000) {
    this.#performanceMonitor.startMonitoring(intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring() {
    this.#performanceMonitor.stopMonitoring();
  }

  /**
   * Get content-aware sampler statistics
   */
  getSamplerStats() {
    return this.#contentAwareSampler.getStats();
  }

  /**
   * Adjust content-aware sampler base interval for performance tuning
   */
  adjustSamplerInterval(intervalMs: number) {
    this.#contentAwareSampler.adjustBaseInterval(intervalMs);
  }

  /**
   * Flush any pending sampler operations immediately
   */
  flushSampler() {
    this.#contentAwareSampler.flush();
  }

  /**
   * Get state management statistics
   */
  getStateManagementStats() {
    return this.#stateManager.getStats();
  }

  /**
   * Force cleanup of old state data
   */
  forceStateCleanup() {
    this.#stateManager.forceCleanup();

    // Also clean up modified files set if it gets too large
    if (this.modifiedFiles.size > 500) {
      const files = Array.from(this.modifiedFiles);

      // Keep only the most recent 300 files (arbitrary reasonable limit)
      this.modifiedFiles = new Set(files.slice(-300));
    }

    // Clean up reloaded messages set
    if (this.#reloadedMessages.size > 1000) {
      this.#reloadedMessages.clear();
    }

    // Force garbage collection on sub-stores
    if (typeof (this.#filesStore as any).forceCleanup === 'function') {
      (this.#filesStore as any).forceCleanup();
    }

    if (typeof (this.#editorStore as any).forceCleanup === 'function') {
      (this.#editorStore as any).forceCleanup();
    }

    // Force performance monitor cleanup
    this.#performanceMonitor.clearHistory();
  }

  /**
   * Clean up inactive artifacts based on TTL
   */
  cleanupInactiveArtifacts() {
    const artifacts = this.artifacts.get();
    const artifactIds = Object.keys(artifacts);

    let cleanedCount = 0;

    for (const artifactId of artifactIds) {
      if (this.#stateManager.shouldCleanupArtifact(artifactId)) {
        const artifact = artifacts[artifactId];

        if (artifact) {
          // Cancel any running actions
          artifact.runner.cancelAllActions();
          delete artifacts[artifactId];
          cleanedCount++;

          // Remove from artifact list
          const index = this.artifactIdList.indexOf(artifactId);

          if (index > -1) {
            this.artifactIdList.splice(index, 1);
          }
        }
      }
    }

    if (cleanedCount > 0) {
      this.artifacts.set(artifacts);
    }

    return cleanedCount;
  }

  /**
   * Get comprehensive memory usage statistics
   */
  getMemoryUsageStats() {
    const artifacts = this.artifacts.get();
    const documents = this.#editorStore.documents.get();
    const files = this.files.get();

    return {
      artifacts: {
        count: Object.keys(artifacts).length,
        listSize: this.artifactIdList.length,
      },
      documents: {
        count: Object.keys(documents).length,
      },
      files: {
        count: Object.keys(files).length,
      },
      modifiedFiles: this.modifiedFiles.size,
      reloadedMessages: this.#reloadedMessages.size,
      stateManagement: this.#stateManager.getStats(),
    };
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }
  get boltTerminal() {
    return this.#terminalStore.boltTerminal;
  }
  get alert() {
    return this.actionAlert;
  }
  clearAlert() {
    this.actionAlert.set(undefined);
  }

  private _trackAlert(alert: any) {
    this.#stateManager.trackAlert(alert);
  }

  get SupabaseAlert() {
    return this.supabaseAlert;
  }

  clearSupabaseAlert() {
    this.supabaseAlert.set(undefined);
  }

  get DeployAlert() {
    return this.deployAlert;
  }

  clearDeployAlert() {
    this.deployAlert.set(undefined);
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }
  attachBoltTerminal(terminal: ITerminal) {
    this.#terminalStore.attachBoltTerminal(terminal);
  }

  detachTerminal(terminal: ITerminal) {
    this.#terminalStore.detachTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    // Track file modification
    this.#stateManager.trackFileModification(filePath);

    /*
     * For scoped locks, we would need to implement diff checking here
     * to determine if the user is modifying existing code or just adding new code
     * This is a more complex feature that would be implemented in a future update
     */

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  getModifiedFiles() {
    return this.#filesStore.getModifiedFiles();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  /**
   * Lock a file to prevent edits
   * @param filePath Path to the file to lock
   * @returns True if the file was successfully locked
   */
  lockFile(filePath: string) {
    return this.#filesStore.lockFile(filePath);
  }

  /**
   * Lock a folder and all its contents to prevent edits
   * @param folderPath Path to the folder to lock
   * @returns True if the folder was successfully locked
   */
  lockFolder(folderPath: string) {
    return this.#filesStore.lockFolder(folderPath);
  }

  /**
   * Unlock a file to allow edits
   * @param filePath Path to the file to unlock
   * @returns True if the file was successfully unlocked
   */
  unlockFile(filePath: string) {
    return this.#filesStore.unlockFile(filePath);
  }

  /**
   * Unlock a folder and all its contents to allow edits
   * @param folderPath Path to the folder to unlock
   * @returns True if the folder was successfully unlocked
   */
  unlockFolder(folderPath: string) {
    return this.#filesStore.unlockFolder(folderPath);
  }

  /**
   * Check if a file is locked
   * @param filePath Path to the file to check
   * @returns Object with locked status, lock mode, and what caused the lock
   */
  isFileLocked(filePath: string) {
    return this.#filesStore.isFileLocked(filePath);
  }

  /**
   * Check if a folder is locked
   * @param folderPath Path to the folder to check
   * @returns Object with locked status, lock mode, and what caused the lock
   */
  isFolderLocked(folderPath: string) {
    return this.#filesStore.isFolderLocked(folderPath);
  }

  async createFile(filePath: string, content: string | Uint8Array = '') {
    try {
      const success = await this.#filesStore.createFile(filePath, content);

      if (success) {
        this.setSelectedFile(filePath);

        /*
         * For empty files, we need to ensure they're not marked as unsaved
         * Only check for empty string, not empty Uint8Array
         */
        if (typeof content === 'string' && content === '') {
          const newUnsavedFiles = new Set(this.unsavedFiles.get());
          newUnsavedFiles.delete(filePath);
          this.unsavedFiles.set(newUnsavedFiles);
        }
      }

      return success;
    } catch (error) {
      console.error('Failed to create file:', error);
      throw error;
    }
  }

  async createFolder(folderPath: string) {
    try {
      return await this.#filesStore.createFolder(folderPath);
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string) {
    try {
      const currentDocument = this.currentDocument.get();
      const isCurrentFile = currentDocument?.filePath === filePath;

      const success = await this.#filesStore.deleteFile(filePath);

      if (success) {
        const newUnsavedFiles = new Set(this.unsavedFiles.get());

        if (newUnsavedFiles.has(filePath)) {
          newUnsavedFiles.delete(filePath);
          this.unsavedFiles.set(newUnsavedFiles);
        }

        if (isCurrentFile) {
          const files = this.files.get();

          let nextFile: string | undefined = undefined;

          for (const [path, dirent] of Object.entries(files)) {
            if (dirent?.type === 'file') {
              nextFile = path;
              break;
            }
          }

          this.setSelectedFile(nextFile);
        }
      }

      return success;
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async deleteFolder(folderPath: string) {
    try {
      const currentDocument = this.currentDocument.get();
      const isInCurrentFolder = currentDocument?.filePath?.startsWith(folderPath + '/');

      const success = await this.#filesStore.deleteFolder(folderPath);

      if (success) {
        const unsavedFiles = this.unsavedFiles.get();
        const newUnsavedFiles = new Set<string>();

        for (const file of unsavedFiles) {
          if (!file.startsWith(folderPath + '/')) {
            newUnsavedFiles.add(file);
          }
        }

        if (newUnsavedFiles.size !== unsavedFiles.size) {
          this.unsavedFiles.set(newUnsavedFiles);
        }

        if (isInCurrentFolder) {
          const files = this.files.get();

          let nextFile: string | undefined = undefined;

          for (const [path, dirent] of Object.entries(files)) {
            if (dirent?.type === 'file') {
              nextFile = path;
              break;
            }
          }

          this.setSelectedFile(nextFile);
        }
      }

      return success;
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  }

  abortAllActions() {
    // Cancel all running actions in all artifacts
    const artifacts = this.artifacts.get();

    for (const artifact of Object.values(artifacts)) {
      artifact.runner.cancelAllActions();
    }

    // Force cleanup of state
    this.forceStateCleanup();
  }

  setReloadedMessages(messages: string[]) {
    this.#reloadedMessages = new Set(messages);
  }

  addArtifact({ messageId, title, id, type }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(id);

    if (artifact) {
      return;
    }

    // Track artifact creation
    this.#stateManager.trackArtifact(id);

    if (!this.artifactIdList.includes(id)) {
      this.artifactIdList.push(id);

      // Enforce artifact list size limit
      if (this.artifactIdList.length > this.#maxArtifactIdListSize) {
        const toRemove = this.artifactIdList.shift();

        if (toRemove) {
          // Clean up old artifact
          const artifacts = this.artifacts.get();
          const oldArtifact = artifacts[toRemove];

          if (oldArtifact) {
            // Cancel any running actions in the old artifact
            oldArtifact.runner.cancelAllActions();
            delete artifacts[toRemove];
            this.artifacts.set(artifacts);
          }
        }
      }
    }

    const runner = new ActionRunner(
      webcontainer,
      () => this.boltTerminal,
      (alert) => {
        if (this.#reloadedMessages.has(messageId)) {
          return;
        }

        this.actionAlert.set(alert);
        this._trackAlert(alert);
      },
      (alert) => {
        if (this.#reloadedMessages.has(messageId)) {
          return;
        }

        this.supabaseAlert.set(alert);
        this._trackAlert(alert);
      },
      (alert) => {
        if (this.#reloadedMessages.has(messageId)) {
          return;
        }

        this.deployAlert.set(alert);
        this._trackAlert(alert);
      },
    );

    // Register the action runner with performance monitor
    this.#performanceMonitor.registerActionRunner(runner);

    this.artifacts.setKey(id, {
      id,
      title,
      closed: false,
      type,
      runner,
    });
  }

  updateArtifact({ artifactId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    if (!artifactId) {
      return;
    }

    const artifact = this.#getArtifact(artifactId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(artifactId, { ...artifact, ...state });
  }
  addAction(data: ActionCallbackData) {
    // Use parallel execution manager for better performance
    this.#executionManager.executeOperation(data, () => this._addAction(data));
  }
  async _addAction(data: ActionCallbackData) {
    const { artifactId } = data;

    const artifact = this.#getArtifact(artifactId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    return artifact.runner.addAction(data);
  }

  runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    if (isStreaming) {
      this.actionStreamSampler(data, isStreaming);
    } else {
      // Use parallel execution manager for non-streaming actions
      this.#executionManager.executeOperation(data, () => this._runAction(data, isStreaming));
    }
  }
  async _runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { artifactId } = data;

    const artifact = this.#getArtifact(artifactId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    const action = artifact.runner.actions.get()[data.actionId];

    if (!action || action.executed) {
      return;
    }

    if (data.action.type === 'file') {
      const wc = await webcontainer;
      const fullPath = path.join(wc.workdir, data.action.filePath);

      /*
       * For scoped locks, we would need to implement diff checking here
       * to determine if the AI is modifying existing code or just adding new code
       * This is a more complex feature that would be implemented in a future update
       */

      if (this.selectedFile.value !== fullPath) {
        this.setSelectedFile(fullPath);
      }

      if (this.currentView.value !== 'code') {
        this.currentView.set('code');
      }

      // Always forward file actions to runner so filesystem reflects streaming updates
      await artifact.runner.runAction(data, isStreaming);

      this.#editorStore.updateFile(fullPath, data.action.content);

      if (!isStreaming && data.action.content) {
        await this.saveFile(fullPath);
      }

      if (!isStreaming) {
        await artifact.runner.runAction(data);
        this.resetAllFileModifications();
      }

      // Flush any pending streaming-tracked file changes at end of non-streaming action
      await artifact.runner.flushPendingFileChanges();
    } else {
      await artifact.runner.runAction(data);
    }
  }

  // Content-aware sampler that adapts based on file type, priority, and system performance
  #contentAwareSampler = new ContentAwareSampler(
    async (data: ActionCallbackData, isStreaming: boolean = false) => {
      // For streaming actions, use parallel execution manager with smart sampling
      await this.#executionManager.executeOperation(data, () => this._runAction(data, isStreaming));
    },
    30, // Base interval reduced to 30ms for better responsiveness
  );

  actionStreamSampler = this.#contentAwareSampler.sample;

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  async downloadZip() {
    const zip = new JSZip();
    const files = this.files.get();

    // Get the project name from the description input, or use a default name
    const projectName = (description.value ?? 'project').toLocaleLowerCase().split(' ').join('_');

    // Generate a simple 6-character hash based on the current timestamp
    const timestampHash = Date.now().toString(36).slice(-6);
    const uniqueProjectName = `${projectName}_${timestampHash}`;

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = extractRelativePath(filePath);

        // split the path into segments
        const pathSegments = relativePath.split('/');

        // if there's more than one segment, we need to create folders
        if (pathSegments.length > 1) {
          let currentFolder = zip;

          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentFolder = currentFolder.folder(pathSegments[i])!;
          }
          currentFolder.file(pathSegments[pathSegments.length - 1], dirent.content);
        } else {
          // if there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
        }
      }
    }

    // Generate the zip file and save it
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${uniqueProjectName}.zip`);
  }

  async syncFiles(targetHandle: FileSystemDirectoryHandle) {
    const files = this.files.get();
    const syncedFiles = [];

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = extractRelativePath(filePath);
        const pathSegments = relativePath.split('/');

        let currentHandle = targetHandle;

        for (let i = 0; i < pathSegments.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
        }

        // create or get the file
        const fileHandle = await currentHandle.getFileHandle(pathSegments[pathSegments.length - 1], {
          create: true,
        });

        // write the file content
        const writable = await fileHandle.createWritable();
        await writable.write(dirent.content);
        await writable.close();

        syncedFiles.push(relativePath);
      }
    }

    return syncedFiles;
  }

  async pushToRepository(
    provider: 'github' | 'gitlab',
    repoName: string,
    commitMessage?: string,
    username?: string,
    token?: string,
    isPrivate: boolean = false,
    branchName: string = 'main',
  ) {
    try {
      const isGitHub = provider === 'github';
      const isGitLab = provider === 'gitlab';

      const authToken = token || Cookies.get(isGitHub ? 'githubToken' : 'gitlabToken');
      const owner = username || Cookies.get(isGitHub ? 'githubUsername' : 'gitlabUsername');

      if (!authToken || !owner) {
        throw new Error(`${provider} token or username is not set in cookies or provided.`);
      }

      const files = this.files.get();

      if (!files || Object.keys(files).length === 0) {
        throw new Error('No files found to push');
      }

      if (isGitHub) {
        // Initialize Octokit with the auth token
        const octokit = new Octokit({ auth: authToken });

        // Check if the repository already exists before creating it
        let repo: RestEndpointMethodTypes['repos']['get']['response']['data'];
        let visibilityJustChanged = false;

        try {
          const resp = await octokit.repos.get({ owner, repo: repoName });
          repo = resp.data;
          console.log('Repository already exists, using existing repo');

          // Check if we need to update visibility of existing repo
          if (repo.private !== isPrivate) {
            console.log(
              `Updating repository visibility from ${repo.private ? 'private' : 'public'} to ${isPrivate ? 'private' : 'public'}`,
            );

            try {
              // Update repository visibility using the update method
              const { data: updatedRepo } = await octokit.repos.update({
                owner,
                repo: repoName,
                private: isPrivate,
              });

              console.log('Repository visibility updated successfully');
              repo = updatedRepo;
              visibilityJustChanged = true;

              // Add a delay after changing visibility to allow GitHub to fully process the change
              console.log('Waiting for visibility change to propagate...');
              await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay
            } catch (visibilityError) {
              console.error('Failed to update repository visibility:', visibilityError);

              // Continue with push even if visibility update fails
            }
          }
        } catch (error) {
          if (error instanceof Error && 'status' in error && error.status === 404) {
            // Repository doesn't exist, so create a new one
            console.log(`Creating new repository with private=${isPrivate}`);

            // Create new repository with specified privacy setting
            const createRepoOptions = {
              name: repoName,
              private: isPrivate,
              auto_init: true,
            };

            console.log('Create repo options:', createRepoOptions);

            const { data: newRepo } = await octokit.repos.createForAuthenticatedUser(createRepoOptions);

            console.log('Repository created:', newRepo.html_url, 'Private:', newRepo.private);
            repo = newRepo;

            // Add a small delay after creating a repository to allow GitHub to fully initialize it
            console.log('Waiting for repository to initialize...');
            await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
          } else {
            console.error('Cannot create repo:', error);
            throw error; // Some other error occurred
          }
        }

        // Get all files
        const files = this.files.get();

        if (!files || Object.keys(files).length === 0) {
          throw new Error('No files found to push');
        }

        // Function to push files with retry logic
        const pushFilesToRepo = async (attempt = 1): Promise<string> => {
          const maxAttempts = 3;

          try {
            console.log(`Pushing files to repository (attempt ${attempt}/${maxAttempts})...`);

            // Create blobs for each file
            const blobs = await Promise.all(
              Object.entries(files).map(async ([filePath, dirent]) => {
                if (dirent?.type === 'file' && dirent.content) {
                  const { data: blob } = await octokit.git.createBlob({
                    owner: repo.owner.login,
                    repo: repo.name,
                    content: Buffer.from(dirent.content).toString('base64'),
                    encoding: 'base64',
                  });
                  return { path: extractRelativePath(filePath), sha: blob.sha };
                }

                return null;
              }),
            );

            const validBlobs = blobs.filter(Boolean); // Filter out any undefined blobs

            if (validBlobs.length === 0) {
              throw new Error('No valid files to push');
            }

            // Refresh repository reference to ensure we have the latest data
            const repoRefresh = await octokit.repos.get({ owner, repo: repoName });
            repo = repoRefresh.data;

            // Get the latest commit SHA (assuming main branch, update dynamically if needed)
            const { data: ref } = await octokit.git.getRef({
              owner: repo.owner.login,
              repo: repo.name,
              ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
            });

            const latestCommitSha = ref.object.sha;

            // Create a new tree
            const { data: newTree } = await octokit.git.createTree({
              owner: repo.owner.login,
              repo: repo.name,
              base_tree: latestCommitSha,
              tree: validBlobs.map((blob) => ({
                path: blob!.path,
                mode: '100644',
                type: 'blob',
                sha: blob!.sha,
              })),
            });

            // Create a new commit
            const { data: newCommit } = await octokit.git.createCommit({
              owner: repo.owner.login,
              repo: repo.name,
              message: commitMessage || 'Initial commit from your app',
              tree: newTree.sha,
              parents: [latestCommitSha],
            });

            // Update the reference
            await octokit.git.updateRef({
              owner: repo.owner.login,
              repo: repo.name,
              ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
              sha: newCommit.sha,
            });

            console.log('Files successfully pushed to repository');

            return repo.html_url;
          } catch (error) {
            console.error(`Error during push attempt ${attempt}:`, error);

            // If we've just changed visibility and this is not our last attempt, wait and retry
            if ((visibilityJustChanged || attempt === 1) && attempt < maxAttempts) {
              const delayMs = attempt * 2000; // Increasing delay with each attempt
              console.log(`Waiting ${delayMs}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));

              return pushFilesToRepo(attempt + 1);
            }

            throw error; // Rethrow if we're out of attempts
          }
        };

        // Execute the push function with retry logic
        const repoUrl = await pushFilesToRepo();

        // Return the repository URL
        return repoUrl;
      }

      if (isGitLab) {
        const { GitLabApiService: gitLabApiServiceClass } = await import('~/lib/services/gitlabApiService');
        const gitLabApiService = new gitLabApiServiceClass(authToken, 'https://gitlab.com');

        // Check or create repo
        let repo = await gitLabApiService.getProject(owner, repoName);

        if (!repo) {
          repo = await gitLabApiService.createProject(repoName, isPrivate);
          await new Promise((r) => setTimeout(r, 2000)); // Wait for repo initialization
        }

        // Check if branch exists, create if not
        const branchRes = await gitLabApiService.getFile(repo.id, 'README.md', branchName).catch(() => null);

        if (!branchRes || !branchRes.ok) {
          // Create branch from default
          await gitLabApiService.createBranch(repo.id, branchName, repo.default_branch);
          await new Promise((r) => setTimeout(r, 1000));
        }

        const actions = Object.entries(files).reduce(
          (acc, [filePath, dirent]) => {
            if (dirent?.type === 'file' && dirent.content) {
              acc.push({
                action: 'create',
                file_path: extractRelativePath(filePath),
                content: dirent.content,
              });
            }

            return acc;
          },
          [] as { action: 'create' | 'update'; file_path: string; content: string }[],
        );

        // Check which files exist and update action accordingly
        for (const action of actions) {
          const fileCheck = await gitLabApiService.getFile(repo.id, action.file_path, branchName);

          if (fileCheck.ok) {
            action.action = 'update';
          }
        }

        // Commit all files
        await gitLabApiService.commitFiles(repo.id, {
          branch: branchName,
          commit_message: commitMessage || 'Commit multiple files',
          actions,
        });

        return repo.web_url;
      }

      // Should not reach here since we only handle GitHub and GitLab
      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      console.error('Error pushing to repository:', error);
      throw error; // Rethrow the error for further handling
    }
  }
}

export const workbenchStore = new WorkbenchStore();
