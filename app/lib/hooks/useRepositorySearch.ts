import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import type { GitHubRepoInfo, GitHubBranch, GitHubConnection } from '~/types/GitHub';
import { useGitHubAPI } from './useGitHubAPI';

export interface SearchFilters {
  language?: string;
  stars?: number;
  forks?: number;
  archived?: boolean;
  fork?: boolean;
}

export interface RepositorySearchState {
  // Repository data
  myRepositories: GitHubRepoInfo[];
  searchResults: GitHubRepoInfo[];
  selectedRepository: GitHubRepoInfo | null;

  // Search and filtering
  searchQuery: string;
  activeTab: 'my-repos' | 'search' | 'url';
  filters: SearchFilters;

  // Branch selection
  branches: GitHubBranch[];
  selectedBranch: string;

  // Custom URL input
  customUrl: string;

  // Loading states
  isLoadingRepos: boolean;
  isSearching: boolean;
  isLoadingBranches: boolean;

  // Error states
  error: string | null;
}

export interface UseRepositorySearchReturn extends RepositorySearchState {
  // Actions
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: 'my-repos' | 'search' | 'url') => void;
  setFilters: (filters: SearchFilters) => void;
  setCustomUrl: (url: string) => void;
  setSelectedBranch: (branch: string) => void;

  // Repository operations
  selectRepository: (repo: GitHubRepoInfo) => Promise<void>;
  searchRepositories: () => Promise<void>;
  fetchUserRepos: () => Promise<void>;

  // Utility functions
  clearSelection: () => void;
  resetSearch: () => void;

  // Derived state
  filteredRepositories: GitHubRepoInfo[];
  canSelectRepository: boolean;
}

const INITIAL_STATE: RepositorySearchState = {
  myRepositories: [],
  searchResults: [],
  selectedRepository: null,
  searchQuery: '',
  activeTab: 'my-repos',
  filters: {},
  branches: [],
  selectedBranch: '',
  customUrl: '',
  isLoadingRepos: false,
  isSearching: false,
  isLoadingBranches: false,
  error: null,
};

export function useRepositorySearch(connection: GitHubConnection | null): UseRepositorySearchReturn {
  const [state, setState] = useState<RepositorySearchState>(INITIAL_STATE);

  const githubAPI = useGitHubAPI(
    connection?.token
      ? { token: connection.token, tokenType: connection.tokenType }
      : { token: '', tokenType: 'classic' },
  );

  // Auto-fetch user repositories when connection is available
  useEffect(() => {
    if (connection?.user && state.myRepositories.length === 0) {
      fetchUserRepos();
    }
  }, [connection?.user]);

  const fetchUserRepos = useCallback(async () => {
    if (!connection?.user) {
      setState((prev) => ({ ...prev, error: 'GitHub connection not available' }));
      return;
    }

    setState((prev) => ({ ...prev, isLoadingRepos: true, error: null }));

    try {
      let repos: GitHubRepoInfo[] = [];

      // For server-side connections (no token), try to fetch via API
      if (!connection.token) {
        try {
          const response = await fetch('/api/github-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'get_repos' }),
          });

          if (response.ok) {
            const data = (await response.json()) as { repos: GitHubRepoInfo[] };
            repos = data.repos || [];
          } else {
            throw new Error(`Server-side API failed: ${response.status}`);
          }
        } catch (serverError) {
          console.warn('Server-side API failed, falling back to client API:', serverError);

          // Fall back to client-side API if server-side fails
          repos = await githubAPI.getUserRepos({ per_page: 100 });
        }
      } else {
        // Client-side connection with token
        repos = await githubAPI.getUserRepos({ per_page: 100 });
      }

      setState((prev) => ({
        ...prev,
        myRepositories: repos,
        isLoadingRepos: false,
      }));
    } catch (error) {
      console.error('Error fetching user repositories:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repositories';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoadingRepos: false,
      }));
      toast.error(errorMessage);
    }
  }, [connection?.user, connection?.token, githubAPI]);

  const searchRepositories = useCallback(async () => {
    if (!connection?.user || !state.searchQuery.trim()) {
      return;
    }

    setState((prev) => ({ ...prev, isSearching: true, error: null }));

    try {
      let results: GitHubRepoInfo[] = [];

      // For server-side connections (no token), try to search via API
      if (!connection.token) {
        try {
          const response = await fetch('/api/github-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'search_repos',
              query: state.searchQuery,
              per_page: 30,
            }),
          });

          if (response.ok) {
            const data = (await response.json()) as { repos: GitHubRepoInfo[] };
            results = data.repos || [];
          } else {
            throw new Error(`Server-side API failed: ${response.status}`);
          }
        } catch (serverError) {
          console.warn('Server-side search API failed, falling back to client API:', serverError);

          // Fall back to client-side API if server-side fails
          results = await githubAPI.searchRepositories(state.searchQuery, { per_page: 30 });
        }
      } else {
        // Client-side connection with token
        results = await githubAPI.searchRepositories(state.searchQuery, { per_page: 30 });
      }

      setState((prev) => ({
        ...prev,
        searchResults: results,
        isSearching: false,
      }));
    } catch (error) {
      console.error('Error searching repositories:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to search repositories';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isSearching: false,
        searchResults: [],
      }));
      toast.error(errorMessage);
    }
  }, [connection?.user, connection?.token, state.searchQuery, githubAPI]);

  const selectRepository = useCallback(
    async (repo: GitHubRepoInfo) => {
      setState((prev) => ({
        ...prev,
        selectedRepository: repo,
        isLoadingBranches: true,
        branches: [],
        selectedBranch: '',
        error: null,
      }));

      if (!connection?.user) {
        setState((prev) => ({ ...prev, isLoadingBranches: false }));
        return;
      }

      try {
        const [owner, repoName] = repo.full_name.split('/');
        let branches: GitHubBranch[] = [];

        // For server-side connections (no token), try to fetch branches via API
        if (!connection.token) {
          try {
            const response = await fetch('/api/github-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'get_branches',
                repo: repo.full_name,
              }),
            });

            if (response.ok) {
              const data = (await response.json()) as { branches: GitHubBranch[] };
              branches = data.branches || [];
            } else {
              throw new Error(`Server-side API failed: ${response.status}`);
            }
          } catch (serverError) {
            console.warn('Server-side branch API failed, falling back to client API:', serverError);

            // Fall back to client-side API if server-side fails
            branches = await githubAPI.getRepositoryBranches(owner, repoName);
          }
        } else {
          // Client-side connection with token
          branches = await githubAPI.getRepositoryBranches(owner, repoName);
        }

        const defaultBranch = branches.find((b) => b.name === repo.default_branch) || branches[0];

        setState((prev) => ({
          ...prev,
          branches,
          selectedBranch: defaultBranch?.name || '',
          isLoadingBranches: false,
        }));
      } catch (error) {
        console.error('Error fetching repository branches:', error);

        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch branches';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoadingBranches: false,
        }));
        toast.error(errorMessage);
      }
    },
    [connection?.user, githubAPI],
  );

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setActiveTab = useCallback((tab: 'my-repos' | 'search' | 'url') => {
    setState((prev) => ({
      ...prev,
      activeTab: tab,
      selectedRepository: null,
      branches: [],
      selectedBranch: '',
      error: null,
    }));
  }, []);

  const setFilters = useCallback((filters: SearchFilters) => {
    setState((prev) => ({ ...prev, filters }));
  }, []);

  const setCustomUrl = useCallback((url: string) => {
    setState((prev) => ({ ...prev, customUrl: url }));
  }, []);

  const setSelectedBranch = useCallback((branch: string) => {
    setState((prev) => ({ ...prev, selectedBranch: branch }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedRepository: null,
      branches: [],
      selectedBranch: '',
      error: null,
    }));
  }, []);

  const resetSearch = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // Apply filters to repositories
  const filteredRepositories = useMemo(() => {
    const repos = state.activeTab === 'my-repos' ? state.myRepositories : state.searchResults;

    return repos.filter((repo) => {
      if (state.filters.language && repo.language !== state.filters.language) {
        return false;
      }

      if (state.filters.stars && repo.stargazers_count < state.filters.stars) {
        return false;
      }

      if (state.filters.forks && repo.forks_count < state.filters.forks) {
        return false;
      }

      if (state.filters.archived !== undefined && repo.archived !== state.filters.archived) {
        return false;
      }

      if (state.filters.fork !== undefined && repo.fork !== state.filters.fork) {
        return false;
      }

      return true;
    });
  }, [state.myRepositories, state.searchResults, state.activeTab, state.filters]);

  const canSelectRepository = useMemo(() => {
    if (state.activeTab === 'url') {
      return state.customUrl.trim() !== '';
    }

    return state.selectedRepository !== null && state.selectedBranch !== '';
  }, [state.activeTab, state.customUrl, state.selectedRepository, state.selectedBranch]);

  return {
    ...state,

    // Actions
    setSearchQuery,
    setActiveTab,
    setFilters,
    setCustomUrl,
    setSelectedBranch,

    // Repository operations
    selectRepository,
    searchRepositories,
    fetchUserRepos,

    // Utility functions
    clearSelection,
    resetSearch,

    // Derived state
    filteredRepositories,
    canSelectRepository,
  };
}
