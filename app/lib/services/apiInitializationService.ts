import { initializeVercelConnection } from '../stores/vercel';
import { initializeSupabaseConnection } from '../stores/supabase';
import { initializeNetlifyConnection } from '../stores/netlify';
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
      // Try to initialize GitHub connection via server-side API
      const response = await fetch('/api/github-user');

      if (response.ok) {
        const userData = await response.json();

        // Create connection object for the UI
        const connectionData = {
          user: userData,
          token: '', // Token is stored server-side only
          tokenType: 'classic' as const,
        };

        // Store minimal connection info (no token)
        localStorage.setItem(
          'github_connection',
          JSON.stringify({
            user: userData,
            tokenType: 'classic',
          }),
        );

        // Fetch repositories/stats via server-side API
        await this.fetchGitHubStatsViaAPI();

        logStore.logSystem('GitHub API initialized successfully');
      } else if (response.status === 401) {
        // No GitHub token available, skip silently
        console.log('No GitHub token available for initialization');
      }
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

  private async fetchGitHubStatsViaAPI(): Promise<void> {
    try {
      // Get repositories via server-side API
      const reposResponse = await fetch('/api/github-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_repos' }),
      });

      if (reposResponse.ok) {
        const reposData = (await reposResponse.json()) as { repos: any[] };

        // Update connection with repositories data
        const existingConnection = JSON.parse(localStorage.getItem('github_connection') || '{}');
        const updatedConnection = {
          ...existingConnection,
          stats: {
            repos: reposData.repos || [],
            recentActivity: [],
            languages: {},
            totalGists: 0,
            publicRepos: 0,
            privateRepos: 0,
            stars: 0,
            forks: 0,
            followers: 0,
            publicGists: 0,
            privateGists: 0,
            lastUpdated: new Date().toISOString(),
            organizations: [],
            totalBranches: 0,
            totalContributors: 0,
            totalIssues: 0,
            totalPullRequests: 0,
            mostUsedLanguages: [],
            recentCommits: 0,
            accountAge: 0,
          },
        };

        localStorage.setItem('github_connection', JSON.stringify(updatedConnection));
      }
    } catch (error) {
      console.warn('Failed to fetch GitHub stats during initialization:', error);
    }
  }
}

// Export singleton instance
export const apiInitializationService = ApiInitializationService.getInstance();
