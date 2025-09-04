import { initializeVercelConnection } from '../stores/vercel';
import { initializeSupabaseConnection } from '../stores/supabase';
import { initializeNetlifyConnection } from '../stores/netlify';
import { initializeGitHubConnection } from '../stores/github';
import { logStore } from '../stores/logs';

/**
 * Global API initialization service that loads all API connections upfront
 * when the application starts
 */
export class ApiInitializationService {
  private static instance: ApiInitializationService;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): ApiInitializationService {
    if (!ApiInitializationService.instance) {
      ApiInitializationService.instance = new ApiInitializationService();
    }

    return ApiInitializationService.instance;
  }

  /**
   * Initialize all API connections upfront
   */
  async initializeAllApis(): Promise<void> {
    // Prevent multiple initialization attempts
    if (this.initialized || this.initializationPromise) {
      return this.initializationPromise || Promise.resolve();
    }

    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
    this.initialized = true;

    return this.initializationPromise;
  }

  /**
   * Check if all APIs have been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset initialization state (useful for testing or re-initialization)
   */
  reset(): void {
    this.initialized = false;
    this.initializationPromise = null;
  }

  private async performInitialization(): Promise<void> {
    try {
      logStore.logSystem('Starting global API initialization', {
        timestamp: new Date().toISOString(),
      });

      // Initialize all API connections in parallel
      const initializationPromises: Promise<void>[] = [
        this.initializeVercelApi(),
        this.initializeSupabaseApi(),
        this.initializeGitHubApi(),
        this.initializeNetlifyApi(),
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

  private async initializeVercelApi(): Promise<void> {
    try {
      await initializeVercelConnection();
      logStore.logSystem('Vercel API initialized successfully');
    } catch (error) {
      console.warn('Vercel API initialization failed:', error);
    }
  }

  private async initializeSupabaseApi(): Promise<void> {
    try {
      await initializeSupabaseConnection();
      logStore.logSystem('Supabase API initialized successfully');
    } catch (error) {
      console.warn('Supabase API initialization failed:', error);
    }
  }

  private async initializeGitHubApi(): Promise<void> {
    try {
      await initializeGitHubConnection();
      logStore.logSystem('GitHub API initialized successfully');
    } catch (error) {
      console.warn('GitHub API initialization failed:', error);
    }
  }

  private async initializeNetlifyApi(): Promise<void> {
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
