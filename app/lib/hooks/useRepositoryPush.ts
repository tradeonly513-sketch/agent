import { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import type { GitHubRepoInfo, GitHubConnection } from '~/types/GitHub';
import { useGitHubAPI } from './useGitHubAPI';
import { workbenchStore } from '~/lib/stores/workbench';

export interface RepositoryPushOptions {
  repoName: string;
  isPrivate: boolean;
  description?: string;
  selectedRepo?: GitHubRepoInfo;
}

export interface RepositoryPushState {
  isLoading: boolean;
  error: string | null;
  recentRepos: GitHubRepoInfo[];
  filteredRepos: GitHubRepoInfo[];
  isFetchingRepos: boolean;
  pushedFiles: Array<{ path: string; size: number }>;
  createdRepoUrl: string;
  showSuccessDialog: boolean;
}

export interface UseRepositoryPushReturn extends RepositoryPushState {
  pushToRepository: (options: RepositoryPushOptions) => Promise<string>;
  pushToExistingRepository: (repo: GitHubRepoInfo) => Promise<void>;
  fetchRecentRepos: () => Promise<void>;
  filterRepos: (query: string) => void;
  resetState: () => void;
  closeSuccessDialog: () => void;
}

export function useRepositoryPush(connection: GitHubConnection | null): UseRepositoryPushReturn {
  const [state, setState] = useState<RepositoryPushState>({
    isLoading: false,
    error: null,
    recentRepos: [],
    filteredRepos: [],
    isFetchingRepos: false,
    pushedFiles: [],
    createdRepoUrl: '',
    showSuccessDialog: false,
  });

  const githubAPI = useGitHubAPI(
    connection?.token
      ? { token: connection.token, tokenType: connection.tokenType }
      : { token: '', tokenType: 'classic' },
  );

  // Load recent repositories on connection change
  useEffect(() => {
    if (connection?.token) {
      fetchRecentRepos();
    }
  }, [connection?.token]);

  const fetchRecentRepos = useCallback(async () => {
    if (!connection?.token) {
      return;
    }

    setState((prev) => ({ ...prev, isFetchingRepos: true, error: null }));

    try {
      const repos = await githubAPI.getUserRepos({ per_page: 20 });
      setState((prev) => ({
        ...prev,
        recentRepos: repos,
        filteredRepos: repos,
        isFetchingRepos: false,
      }));
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to fetch repositories',
        isFetchingRepos: false,
      }));
    }
  }, [connection?.token, githubAPI]);

  const filterRepos = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setState((prev) => ({ ...prev, filteredRepos: prev.recentRepos }));
        return;
      }

      const filtered = state.recentRepos.filter(
        (repo) =>
          repo.name.toLowerCase().includes(query.toLowerCase()) ||
          repo.description?.toLowerCase().includes(query.toLowerCase()),
      );

      setState((prev) => ({ ...prev, filteredRepos: filtered }));
    },
    [state.recentRepos],
  );

  const getWorkbenchFiles = useCallback(() => {
    const files = workbenchStore.files.get();
    const fileEntries: Array<{ path: string; size: number }> = [];

    const processFiles = (fileMap: any, basePath = '') => {
      Object.entries(fileMap).forEach(([name, file]: [string, any]) => {
        const fullPath = basePath ? `${basePath}/${name}` : name;

        if (file.type === 'file') {
          const content = file.content || '';
          const size = new Blob([content]).size;
          fileEntries.push({ path: fullPath, size });
        } else if (file.type === 'folder' && file.children) {
          processFiles(file.children, fullPath);
        }
      });
    };

    processFiles(files);

    return fileEntries;
  }, []);

  const pushToRepository = useCallback(
    async (options: RepositoryPushOptions): Promise<string> => {
      if (!connection?.user) {
        throw new Error('GitHub connection not available');
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const workbenchFiles = getWorkbenchFiles();

        // Create repository if needed (for new repos)
        let repoUrl = '';

        if (!options.selectedRepo) {
          // This would typically call your API to create repo and push files
          const response = await fetch('/api/github/create-repo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: options.repoName,
              private: options.isPrivate,
              description: options.description,
              files: workbenchFiles,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create repository');
          }

          const result: any = await response.json();
          repoUrl = result.html_url;
        } else {
          // Push to existing repository
          const response = await fetch('/api/github/push-to-repo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              owner: options.selectedRepo.full_name.split('/')[0],
              repo: options.selectedRepo.name,
              files: workbenchFiles,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to push to repository');
          }

          repoUrl = options.selectedRepo.html_url;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          pushedFiles: workbenchFiles,
          createdRepoUrl: repoUrl,
          showSuccessDialog: true,
          error: null,
        }));

        toast.success(`Successfully pushed to ${options.selectedRepo?.name || options.repoName}`);

        return repoUrl;
      } catch (error) {
        console.error('Error pushing to repository:', error);

        const errorMessage = error instanceof Error ? error.message : 'Failed to push to repository';

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        toast.error(errorMessage);
        throw error;
      }
    },
    [connection, getWorkbenchFiles],
  );

  const pushToExistingRepository = useCallback(
    async (repo: GitHubRepoInfo) => {
      await pushToRepository({
        repoName: repo.name,
        isPrivate: repo.private || false,
        selectedRepo: repo,
      });
    },
    [pushToRepository],
  );

  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      recentRepos: [],
      filteredRepos: [],
      isFetchingRepos: false,
      pushedFiles: [],
      createdRepoUrl: '',
      showSuccessDialog: false,
    });
  }, []);

  const closeSuccessDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showSuccessDialog: false }));
  }, []);

  return {
    ...state,
    pushToRepository,
    pushToExistingRepository,
    fetchRecentRepos,
    filterRepos,
    resetState,
    closeSuccessDialog,
  };
}
