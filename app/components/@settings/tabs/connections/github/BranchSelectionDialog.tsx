import React, { useState, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { X, GitBranch, Loader2 } from 'lucide-react';
import type { GitHubRepoInfo, GitHubBranch } from '~/types/GitHub';

interface BranchSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  repository: GitHubRepoInfo;
  onClone: (repoUrl: string, branch: string) => void;
  connection: any;
}

export function BranchSelectionDialog({
  isOpen,
  onClose,
  repository,
  onClone,
  connection,
}: BranchSelectionDialogProps) {
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>(repository.default_branch || 'main');
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch branches when dialog opens
  useEffect(() => {
    if (isOpen && repository) {
      fetchBranches();
    }
  }, [isOpen, repository]);

  const fetchBranches = async () => {
    setLoading(true);
    setError(null);

    try {
      let branchesData: GitHubBranch[];

      // Check if we have a client-side token
      if (connection?.token) {
        // Client-side connection - fetch directly from GitHub API
        const apiUrl = `https://api.github.com/repos/${repository.full_name}/branches?per_page=100`;

        const response = await fetch(apiUrl, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${connection.token}`,
            'User-Agent': 'Bolt.diy',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 404) {
            throw new Error("Repository not found or you don't have access to it");
          } else if (response.status === 403) {
            throw new Error('Access forbidden - check your token permissions');
          } else if (response.status === 401) {
            throw new Error('Authentication failed - token may be invalid');
          } else {
            throw new Error(`Failed to fetch branches: ${response.status} - ${errorText}`);
          }
        }

        branchesData = await response.json();
      } else {
        // Server-side connection - fetch via our API
        const response = await fetch('/api/github-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'get_branches',
            repo: repository.full_name,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server API error: ${response.status} - ${errorText}`);
        }

        const data = (await response.json()) as { branches?: GitHubBranch[] };
        branchesData = data.branches || [];
      }

      setBranches(branchesData);

      // Set default branch as selected if it exists
      const defaultBranch = branchesData.find((branch: GitHubBranch) => branch.name === repository.default_branch);

      if (defaultBranch) {
        setSelectedBranch(repository.default_branch);
      } else if (branchesData.length > 0) {
        setSelectedBranch(branchesData[0].name);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch branches';
      setError(errorMessage);

      // Fallback to default branch
      setBranches([{ name: repository.default_branch || 'main', commit: { sha: '', url: '' } }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async () => {
    console.log('BranchSelectionDialog handleClone called with branch:', selectedBranch);
    setCloning(true);

    try {
      const cloneUrl = `https://github.com/${repository.full_name}.git`;
      console.log('Calling onClone with:', { cloneUrl, selectedBranch });
      await onClone(cloneUrl, selectedBranch);
      onClose();
    } catch (error) {
      console.error('Error cloning repository:', error);
    } finally {
      setCloning(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-950 rounded-xl shadow-xl border border-bolt-elements-borderColor max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Select Branch</h3>
                <p className="text-sm text-bolt-elements-textSecondary">
                  Choose a branch to clone from {repository.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-transparent hover:bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <X className="w-5 h-5 transition-transform duration-200 hover:rotate-90" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Branch</label>
              {loading ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-bolt-elements-background-depth-1">
                  <Loader2 className="w-4 h-4 animate-spin text-bolt-elements-textSecondary" />
                  <span className="text-sm text-bolt-elements-textSecondary">Loading branches...</span>
                </div>
              ) : error ? (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <div className="i-ph:warning-circle w-4 h-4" />
                    <span className="text-sm font-medium">Failed to load branches</span>
                  </div>
                  <p className="text-sm text-red-500 dark:text-red-300 mt-1">{error}</p>
                  <p className="text-xs text-red-400 dark:text-red-500 mt-2">
                    Using default branch: {repository.default_branch || 'main'}
                  </p>
                </div>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive focus:border-bolt-elements-borderColorActive"
                >
                  {branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                      {branch.name === repository.default_branch && ' (default)'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
              <GitBranch className="w-3 h-3" />
              <span>{branches.length} branches available</span>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={onClose} variant="outline" className="flex-1" disabled={cloning}>
              Cancel
            </Button>
            <Button onClick={handleClone} disabled={loading || cloning || !selectedBranch} className="flex-1">
              {cloning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cloning...
                </>
              ) : (
                <>
                  <GitBranch className="w-4 h-4 mr-2" />
                  Clone Branch
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
