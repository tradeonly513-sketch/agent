import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X, Github, Folder, Search, Link, ArrowLeft } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui';
import { useGitHubConnection, useRepositorySearch } from '~/lib/hooks';
import { RepositorySelector } from './RepositorySelector';
import { classNames } from '~/utils/classNames';
import type { GitHubRepoInfo } from '~/types/GitHub';

interface RepositorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function RepositorySelectionDialogRefactored({ isOpen, onClose, onSelect }: RepositorySelectionDialogProps) {
  const { connection, isConnected } = useGitHubConnection();
  const {
    myRepositories,
    searchResults,
    selectedRepository,
    searchQuery,
    activeTab,
    branches,
    selectedBranch,
    customUrl,
    isLoadingRepos,
    isSearching,
    isLoadingBranches,
    error,
    filteredRepositories,
    canSelectRepository,
    setSearchQuery,
    setActiveTab,
    setCustomUrl,
    setSelectedBranch,
    selectRepository,
    searchRepositories,
    clearSelection,
  } = useRepositorySearch(connection);

  const handleRepositorySelect = async (repo: GitHubRepoInfo) => {
    await selectRepository(repo);
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchRepositories();
    }
  };

  const handleConfirmSelection = () => {
    if (activeTab === 'url') {
      // Convert GitHub web URL to Git clone URL if needed
      let url = customUrl;

      if (url.includes('github.com') && url.includes('/tree/')) {
        // Extract owner/repo from URL like: https://github.com/owner/repo/tree/branch
        const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);

        if (match) {
          url = `https://github.com/${match[1]}.git`;
        }
      } else if (url.includes('github.com') && !url.endsWith('.git')) {
        // Add .git suffix if missing
        url = url.replace(/\/$/, '') + '.git';
      }

      onSelect(url);

      return;
    }

    if (selectedRepository && selectedBranch) {
      console.log('Selected repository data:', selectedRepository);
      console.log('Selected branch:', selectedBranch);

      // Use clone_url which is the proper Git URL, or construct from html_url as fallback
      let url = selectedRepository.clone_url;

      if (!url) {
        // Fallback: construct clone URL from html_url
        url = selectedRepository.html_url.replace(/\/$/, '') + '.git';
        console.log('No clone_url found, constructed URL:', url);
      } else {
        console.log('Using clone_url:', url);
      }

      console.log('Final URL to select:', url);
      onSelect(url);
    } else {
      console.log('Missing repository or branch:', { selectedRepository, selectedBranch });
    }
  };

  const handleDialogClose = () => {
    clearSelection();
    onClose();
  };

  if (!isConnected || !connection) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={handleDialogClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <Dialog.Content className="bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="text-center">
                <Github className="w-12 h-12 text-bolt-elements-textTertiary mx-auto mb-4" />
                <h2 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">GitHub Connection Required</h2>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Please connect your GitHub account to browse repositories.
                </p>
                <button
                  onClick={handleDialogClose}
                  className="px-4 py-2 bg-bolt-elements-item-contentAccent text-white rounded-lg hover:bg-bolt-elements-item-contentAccent/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleDialogClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            <Dialog.Content className="bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg shadow-xl border border-bolt-elements-borderColor flex flex-col max-h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
                <div className="flex items-center gap-3">
                  <Github className="w-6 h-6 text-bolt-elements-item-contentAccent" />
                  <div>
                    <Dialog.Title className="text-lg font-medium text-bolt-elements-textPrimary">
                      Import from GitHub
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-bolt-elements-textSecondary">
                      Select a repository to import into your workspace
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="p-2 rounded-lg hover:bg-bolt-elements-background-depth-2 transition-colors">
                    <X className="w-4 h-4 text-bolt-elements-textSecondary" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-bolt-elements-borderColor">
                <button
                  onClick={() => setActiveTab('my-repos')}
                  className={classNames(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                    activeTab === 'my-repos'
                      ? 'text-bolt-elements-item-contentAccent border-b-2 border-bolt-elements-item-contentAccent bg-bolt-elements-item-contentAccent/5'
                      : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                >
                  <Folder className="w-4 h-4" />
                  My Repositories
                  {myRepositories.length > 0 && (
                    <span className="text-xs bg-bolt-elements-background-depth-2 px-1.5 py-0.5 rounded">
                      {myRepositories.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={classNames(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                    activeTab === 'search'
                      ? 'text-bolt-elements-item-contentAccent border-b-2 border-bolt-elements-item-contentAccent bg-bolt-elements-item-contentAccent/5'
                      : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                >
                  <Search className="w-4 h-4" />
                  Search GitHub
                </button>
                <button
                  onClick={() => setActiveTab('url')}
                  className={classNames(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                    activeTab === 'url'
                      ? 'text-bolt-elements-item-contentAccent border-b-2 border-bolt-elements-item-contentAccent bg-bolt-elements-item-contentAccent/5'
                      : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                >
                  <Link className="w-4 h-4" />
                  Custom URL
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                <div className="flex h-full">
                  {/* Repository List */}
                  <div className="flex-1 flex flex-col">
                    <div className="p-4 border-b border-bolt-elements-borderColor">
                      {activeTab === 'search' && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Search repositories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                          />
                          <Button
                            onClick={handleSearch}
                            disabled={!searchQuery.trim() || isSearching}
                            className="flex items-center gap-2"
                          >
                            <Search className="w-4 h-4" />
                            {isSearching ? 'Searching...' : 'Search'}
                          </Button>
                        </div>
                      )}

                      {activeTab === 'url' && (
                        <Input
                          placeholder="https://github.com/user/repository"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                        />
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {activeTab !== 'url' && (
                        <RepositorySelector
                          repositories={activeTab === 'my-repos' ? myRepositories : searchResults}
                          filteredRepositories={filteredRepositories}
                          isLoading={activeTab === 'my-repos' ? isLoadingRepos : isSearching}
                          onRepositorySelect={handleRepositorySelect}
                          onSearch={() => {}} // Search is handled above
                        />
                      )}

                      {activeTab === 'url' && (
                        <div className="text-center py-8">
                          <Link className="w-12 h-12 text-bolt-elements-textTertiary mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
                            Import from Custom URL
                          </h3>
                          <p className="text-sm text-bolt-elements-textSecondary">
                            Enter a GitHub repository URL to import it directly
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Repository Details */}
                  {(selectedRepository || (activeTab === 'url' && customUrl)) && (
                    <div className="w-80 border-l border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4 overflow-y-auto">
                      {selectedRepository && (
                        <>
                          <div className="flex items-center gap-2 mb-4">
                            <button
                              onClick={clearSelection}
                              className="p-1 hover:bg-bolt-elements-background-depth-2 rounded"
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Repository Details</h3>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                                {selectedRepository.name}
                              </h4>
                              <p className="text-xs text-bolt-elements-textSecondary">{selectedRepository.full_name}</p>
                              {selectedRepository.description && (
                                <p className="text-xs text-bolt-elements-textTertiary mt-1">
                                  {selectedRepository.description}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                                Branch
                              </label>
                              {isLoadingBranches ? (
                                <div className="text-xs text-bolt-elements-textSecondary">Loading branches...</div>
                              ) : (
                                <select
                                  value={selectedBranch}
                                  onChange={(e) => setSelectedBranch(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background focus:outline-none focus:ring-1 focus:ring-bolt-elements-item-contentAccent"
                                >
                                  {branches.map((branch) => (
                                    <option key={branch.name} value={branch.name}>
                                      {branch.name}
                                      {branch.name === selectedRepository.default_branch && ' (default)'}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {activeTab === 'url' && customUrl && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Custom URL Import</h3>
                          <div className="text-xs text-bolt-elements-textSecondary">
                            <p>URL: {customUrl}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-bolt-elements-textSecondary">Connected as {connection.user?.login}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleDialogClose}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmSelection}
                      disabled={!canSelectRepository}
                      className="bg-bolt-elements-item-contentAccent text-white hover:bg-bolt-elements-item-contentAccent/90"
                    >
                      Import Repository
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border-t border-red-200 dark:bg-red-900/20 dark:border-red-700">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
