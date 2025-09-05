import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X, Github, Plus, Folder } from 'lucide-react';
import { useGitHubConnection, useRepositoryPush } from '~/lib/hooks';
import { RepositorySelector } from './RepositorySelector';
import { NewRepositoryForm } from './NewRepositoryForm';
import { PushSuccessDialog } from './PushSuccessDialog';
import { classNames } from '~/utils/classNames';
import type { GitHubRepoInfo } from '~/types/GitHub';

interface PushToGitHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPush?: (repoName: string, username?: string, token?: string, isPrivate?: boolean) => Promise<string>;
}

type TabType = 'existing' | 'new';

export function PushToGitHubDialogRefactored({ isOpen, onClose, onPush }: PushToGitHubDialogProps) {
  const { connection, isConnected } = useGitHubConnection();
  const {
    recentRepos,
    filteredRepos,
    isFetchingRepos,
    isLoading,
    error,
    showSuccessDialog,
    createdRepoUrl,
    pushedFiles,
    pushToRepository,
    pushToExistingRepository,
    filterRepos,
    closeSuccessDialog,
    resetState,
  } = useRepositoryPush(connection);

  const [activeTab, setActiveTab] = useState<TabType>('existing');
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setRepoName('');
      setDescription('');
      setIsPrivate(false);
      resetState();
    }
  }, [isOpen, resetState]);

  // Switch to new repo tab if no repositories available
  useEffect(() => {
    if (!isFetchingRepos && recentRepos.length === 0 && activeTab === 'existing') {
      setActiveTab('new');
    }
  }, [isFetchingRepos, recentRepos.length, activeTab]);

  const handleCreateRepository = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!repoName.trim()) {
      return;
    }

    try {
      await pushToRepository({
        repoName: repoName.trim(),
        isPrivate,
        description: description.trim() || undefined,
      });

      // Call the optional onPush callback for backward compatibility
      if (onPush) {
        await onPush(repoName, connection?.user?.login, connection?.token, isPrivate);
      }
    } catch {
      // Error handling is done in the hook
    }
  };

  const handleExistingRepoSelect = async (repo: GitHubRepoInfo) => {
    try {
      await pushToExistingRepository(repo);

      // Call the optional onPush callback for backward compatibility
      if (onPush) {
        await onPush(repo.name, connection?.user?.login, connection?.token, repo.private);
      }
    } catch {
      // Error handling is done in the hook
    }
  };

  const handleDialogClose = () => {
    if (!isLoading) {
      onClose();
    }
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
                  Please connect your GitHub account to push repositories.
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

  const repositoryName = createdRepoUrl ? createdRepoUrl.split('/').pop() : undefined;

  return (
    <>
      <Dialog.Root open={isOpen && !showSuccessDialog} onOpenChange={handleDialogClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              <Dialog.Content className="bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg shadow-xl border border-bolt-elements-borderColor flex flex-col max-h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
                  <div className="flex items-center gap-3">
                    <Github className="w-6 h-6 text-bolt-elements-item-contentAccent" />
                    <div>
                      <Dialog.Title className="text-lg font-medium text-bolt-elements-textPrimary">
                        Push to GitHub
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-bolt-elements-textSecondary">
                        Push your project to a GitHub repository
                      </Dialog.Description>
                    </div>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="p-2 rounded-lg hover:bg-bolt-elements-background-depth-2 transition-colors"
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4 text-bolt-elements-textSecondary" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-bolt-elements-borderColor">
                  <button
                    onClick={() => setActiveTab('existing')}
                    className={classNames(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                      activeTab === 'existing'
                        ? 'text-bolt-elements-item-contentAccent border-b-2 border-bolt-elements-item-contentAccent bg-bolt-elements-item-contentAccent/5'
                        : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                    )}
                    disabled={isLoading}
                  >
                    <Folder className="w-4 h-4" />
                    Existing Repository
                    {recentRepos.length > 0 && (
                      <span className="text-xs bg-bolt-elements-background-depth-2 px-1.5 py-0.5 rounded">
                        {recentRepos.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('new')}
                    className={classNames(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                      activeTab === 'new'
                        ? 'text-bolt-elements-item-contentAccent border-b-2 border-bolt-elements-item-contentAccent bg-bolt-elements-item-contentAccent/5'
                        : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                    )}
                    disabled={isLoading}
                  >
                    <Plus className="w-4 h-4" />
                    New Repository
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6">
                    {activeTab === 'existing' && (
                      <RepositorySelector
                        repositories={recentRepos}
                        filteredRepositories={filteredRepos}
                        isLoading={isFetchingRepos}
                        onRepositorySelect={handleExistingRepoSelect}
                        onSearch={filterRepos}
                      />
                    )}

                    {activeTab === 'new' && (
                      <NewRepositoryForm
                        repoName={repoName}
                        onRepoNameChange={setRepoName}
                        isPrivate={isPrivate}
                        onPrivateChange={setIsPrivate}
                        description={description}
                        onDescriptionChange={setDescription}
                        isSubmitting={isLoading}
                        onSubmit={handleCreateRepository}
                        error={error || undefined}
                      />
                    )}
                  </div>
                </div>

                {/* Footer info */}
                <div className="p-4 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
                  <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                    <Github className="w-3 h-3" />
                    <span>Connected as {connection.user?.login}</span>
                    {connection.rateLimit && (
                      <>
                        <span>•</span>
                        <span>
                          API: {connection.rateLimit.remaining}/{connection.rateLimit.limit}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Dialog.Content>
            </motion.div>
          </div>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Success Dialog */}
      <PushSuccessDialog
        isOpen={showSuccessDialog}
        onClose={closeSuccessDialog}
        repositoryUrl={createdRepoUrl}
        repositoryName={repositoryName}
        pushedFiles={pushedFiles}
      />
    </>
  );
}
