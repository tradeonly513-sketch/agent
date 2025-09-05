import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import type {
  GitHubUserResponse,
  GitHubRepoInfo,
  GitHubBranch,
  GitHubOrganization,
  GitHubEvent,
  GitHubLanguageStats,
} from '~/types/GitHub';

export interface GitHubAPIConfig {
  token: string;
  tokenType: 'classic' | 'fine-grained';
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface GitHubAPIError {
  message: string;
  status: number;
  code?: string;
}

export interface UseGitHubAPIReturn {
  // User operations
  getUser: () => Promise<GitHubUserResponse>;

  // Repository operations
  getUserRepos: (options?: { per_page?: number; page?: number }) => Promise<GitHubRepoInfo[]>;
  getReposByUser: (username: string, options?: { per_page?: number; page?: number }) => Promise<GitHubRepoInfo[]>;
  searchRepositories: (query: string, options?: { per_page?: number; page?: number }) => Promise<GitHubRepoInfo[]>;

  // Repository details
  getRepository: (owner: string, repo: string) => Promise<GitHubRepoInfo>;
  getRepositoryBranches: (owner: string, repo: string) => Promise<GitHubBranch[]>;
  getRepositoryLanguages: (owner: string, repo: string) => Promise<GitHubLanguageStats>;

  // User activity
  getUserEvents: (username: string, options?: { per_page?: number }) => Promise<GitHubEvent[]>;
  getUserOrganizations: () => Promise<GitHubOrganization[]>;

  // Rate limiting
  getRateLimit: () => Promise<GitHubRateLimit>;

  // State
  loading: boolean;
  error: GitHubAPIError | null;
}

export function useGitHubAPI(config: GitHubAPIConfig): UseGitHubAPIReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GitHubAPIError | null>(null);

  const makeRequest = useCallback(
    async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`https://api.github.com${endpoint}`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `${config.tokenType === 'classic' ? 'token' : 'Bearer'} ${config.token}`,
            'User-Agent': 'Bolt.diy',
            ...options.headers,
          },
          ...options,
        });

        if (!response.ok) {
          const errorData: any = await response.json().catch(() => ({ message: response.statusText }));
          const apiError: GitHubAPIError = {
            message: errorData.message || response.statusText,
            status: response.status,
            code: errorData.code,
          };

          // Handle specific error cases
          switch (response.status) {
            case 401:
              toast.error('GitHub token has expired or is invalid. Please reconnect your account.');
              break;
            case 403:
              if (errorData.message?.includes('rate limit')) {
                toast.error('GitHub API rate limit exceeded. Please try again later.');
              } else {
                toast.error('Access forbidden. Check your token permissions.');
              }

              break;
            case 404:
              toast.error('Resource not found. It may be private or deleted.');
              break;
            default:
              toast.error(`GitHub API error: ${apiError.message}`);
          }

          setError(apiError);
          throw apiError;
        }

        const data = await response.json();

        return data as T;
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          const apiError: GitHubAPIError = {
            message: err.message || 'Network error',
            status: 0,
          };
          setError(apiError);
          throw apiError;
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.token, config.tokenType],
  );

  const getUser = useCallback(async (): Promise<GitHubUserResponse> => {
    return makeRequest<GitHubUserResponse>('/user');
  }, [makeRequest]);

  const getUserRepos = useCallback(
    async (options: { per_page?: number; page?: number } = {}): Promise<GitHubRepoInfo[]> => {
      const { per_page: perPage = 100, page = 1 } = options;
      return makeRequest<GitHubRepoInfo[]>(`/user/repos?per_page=${perPage}&page=${page}&sort=updated`);
    },
    [makeRequest],
  );

  const getReposByUser = useCallback(
    async (username: string, options: { per_page?: number; page?: number } = {}): Promise<GitHubRepoInfo[]> => {
      const { per_page: perPage = 100, page = 1 } = options;
      return makeRequest<GitHubRepoInfo[]>(`/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated`);
    },
    [makeRequest],
  );

  const searchRepositories = useCallback(
    async (query: string, options: { per_page?: number; page?: number } = {}): Promise<GitHubRepoInfo[]> => {
      const { per_page: perPage = 30, page = 1 } = options;
      const encodedQuery = encodeURIComponent(query);
      const response = await makeRequest<{ items: GitHubRepoInfo[] }>(
        `/search/repositories?q=${encodedQuery}&per_page=${perPage}&page=${page}&sort=updated`,
      );

      return response.items;
    },
    [makeRequest],
  );

  const getRepository = useCallback(
    async (owner: string, repo: string): Promise<GitHubRepoInfo> => {
      return makeRequest<GitHubRepoInfo>(`/repos/${owner}/${repo}`);
    },
    [makeRequest],
  );

  const getRepositoryBranches = useCallback(
    async (owner: string, repo: string): Promise<GitHubBranch[]> => {
      return makeRequest<GitHubBranch[]>(`/repos/${owner}/${repo}/branches`);
    },
    [makeRequest],
  );

  const getRepositoryLanguages = useCallback(
    async (owner: string, repo: string): Promise<GitHubLanguageStats> => {
      return makeRequest<GitHubLanguageStats>(`/repos/${owner}/${repo}/languages`);
    },
    [makeRequest],
  );

  const getUserEvents = useCallback(
    async (username: string, options: { per_page?: number } = {}): Promise<GitHubEvent[]> => {
      const { per_page: perPage = 10 } = options;
      return makeRequest<GitHubEvent[]>(`/users/${username}/events?per_page=${perPage}`);
    },
    [makeRequest],
  );

  const getUserOrganizations = useCallback(async (): Promise<GitHubOrganization[]> => {
    return makeRequest<GitHubOrganization[]>('/user/orgs');
  }, [makeRequest]);

  const getRateLimit = useCallback(async (): Promise<GitHubRateLimit> => {
    const response = await makeRequest<{ rate: GitHubRateLimit }>('/rate_limit');
    return response.rate;
  }, [makeRequest]);

  return {
    // User operations
    getUser,

    // Repository operations
    getUserRepos,
    getReposByUser,
    searchRepositories,

    // Repository details
    getRepository,
    getRepositoryBranches,
    getRepositoryLanguages,

    // User activity
    getUserEvents,
    getUserOrganizations,

    // Rate limiting
    getRateLimit,

    // State
    loading,
    error,
  };
}
