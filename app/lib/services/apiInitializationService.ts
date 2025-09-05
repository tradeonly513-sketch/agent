import { initializeVercelConnection } from '~/lib/stores/vercel';
import { initializeSupabaseConnection } from '~/lib/stores/supabase';
import { initializeNetlifyConnection } from '~/lib/stores/netlify';
import { initializeGitHubConnection } from '~/lib/stores/github';
import { logStore } from '~/lib/stores/logs';

/**
 * Global API initialization service that loads all API connections upfront
 * when the application starts
 */
export class ApiInitializationService {
  private static _instance: ApiInitializationService;
  private _initialized = false;
  private _initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): ApiInitializationService {
    if (!ApiInitializationService._instance) {
      ApiInitializationService._instance = new ApiInitializationService();
    }

    return ApiInitializationService._instance;
  }

  /**
   * Initialize all API connections upfront
   */
  async initializeAllApis(): Promise<void> {
    // Prevent multiple initialization attempts
    if (this._initialized || this._initializationPromise) {
      return this._initializationPromise || Promise.resolve();
    }

    this._initializationPromise = this._performInitialization();
    await this._initializationPromise;
    this._initialized = true;

    return this._initializationPromise;
  }

  /**
   * Check if all APIs have been initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Reset initialization state (useful for testing or re-initialization)
   */
  reset(): void {
    this._initialized = false;
    this._initializationPromise = null;
  }

  private async _performInitialization(): Promise<void> {
    try {
      logStore.logSystem('Starting global API initialization', {
        timestamp: new Date().toISOString(),
      });

      // Initialize all API connections in parallel
      const initializationPromises: Promise<void>[] = [
        this._initializeVercelApi(),
        this._initializeSupabaseApi(),
        this._initializeGitHubApi(),
        this._initializeNetlifyApi(),
      ];

      // Wait for all initializations to complete
      await Promise.allSettled(initializationPromises);

      logStore.logSystem('Global API initialization completed', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error during global API initialization:', error);
      logStore.logError('Global API initialization failed', { error });
    }
  }

  private async _initializeVercelApi(): Promise<void> {
    try {
      await initializeVercelConnection();
      logStore.logSystem('Vercel API initialized successfully');
    } catch (error) {
      console.warn('Vercel API initialization failed:', error);
    }
  }

  private async _initializeSupabaseApi(): Promise<void> {
    try {
      await initializeSupabaseConnection();
      logStore.logSystem('Supabase API initialized successfully');
    } catch (error) {
      console.warn('Supabase API initialization failed:', error);
    }
  }

  private async _initializeGitHubApi(): Promise<void> {
    try {
      await initializeGitHubConnection();
      logStore.logSystem('GitHub API initialized successfully');
    } catch (error) {
      console.warn('GitHub API initialization failed:', error);
    }
  }

  private async _initializeNetlifyApi(): Promise<void> {
    try {
      await initializeNetlifyConnection();
      logStore.logSystem('Netlify API initialized successfully');
    } catch (error) {
      console.warn('Netlify API initialization failed:', error);
    }
  }
}

// Export singleton instance
export const apiInitializationService = ApiInitializationService.getInstance();
