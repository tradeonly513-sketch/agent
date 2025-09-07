import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGitLabConnection } from '~/lib/stores/gitlabConnection';
import GitLabConnection from '~/components/@settings/tabs/connections/gitlab/GitLabConnection';
import { Button } from '~/components/ui/Button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '~/components/ui/Collapsible';
import { classNames } from '~/utils/classNames';
import { ChevronDown } from 'lucide-react';

// GitLab logo SVG component
const GitLabLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
    />
  </svg>
);

export default function GitLabTab() {
  const { connection, isConnected, stats } = useGitLabConnection();
  const [isReposExpanded, setIsReposExpanded] = useState(false);

  // Loading state for initial connection check
  if (!connection && !isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <GitLabLogo />
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">GitLab Integration</h2>
        </div>
        <div className="flex items-center justify-center p-4">
          <div className="flex items-center gap-2">
            <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
            <span className="text-bolt-elements-textSecondary">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <GitLabLogo />
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
            GitLab Integration
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {connection.get()?.rateLimit && (
            <div className="flex items-center gap-2 px-3 py-1 bg-bolt-elements-background-depth-1 rounded-lg text-xs">
              <div className="i-ph:cloud w-4 h-4 text-bolt-elements-textSecondary" />
              <span className="text-bolt-elements-textSecondary">
                API: {connection.get()?.rateLimit?.remaining}/{connection.get()?.rateLimit?.limit}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
        Manage your GitLab integration with advanced repository features and comprehensive statistics
      </p>

      {/* Connection Test Results */}
      {/* connectionTest && (
        <div
          className={`p-3 rounded-lg border ${
            connectionTest.status === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : connectionTest.status === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 ${
                connectionTest.status === 'success'
                  ? 'text-green-600'
                  : connectionTest.status === 'error'
                    ? 'text-red-600'
                    : 'text-blue-600'
              }`}
            >
              {connectionTest.status === 'success' ? (
                <div className="i-ph:check-circle" />
              ) : connectionTest.status === 'error' ? (
                <div className="i-ph:x-circle" />
              ) : (
                <div className="i-ph:spinner animate-spin" />
              )}
            </div>
            <span
              className={`text-sm ${
                connectionTest.status === 'success'
                  ? 'text-green-800 dark:text-green-200'
                  : connectionTest.status === 'error'
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-blue-800 dark:text-blue-200'
              }`}
            >
              {connectionTest.message}
            </span>
          </div>
        </div>
      ) */}

      {/* GitLab Connection Component */}
      <GitLabConnection />

      {/* Repositories Section */}
      {isConnected && stats.get() && stats.get()?.projects && stats.get()!.projects!.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="border-t border-bolt-elements-borderColor pt-6"
        >
          <Collapsible open={isReposExpanded} onOpenChange={setIsReposExpanded}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 rounded-lg bg-bolt-elements-background dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70 dark:hover:border-bolt-elements-borderColorActive/70 transition-all duration-200">
                <div className="flex items-center gap-2">
                  <div className="i-ph:folder w-4 h-4 text-bolt-elements-item-contentAccent" />
                  <span className="text-sm font-medium text-bolt-elements-textPrimary">
                    All Repositories ({stats.get()?.projects?.length})
                  </span>
                </div>
                <ChevronDown
                  className={classNames(
                    'w-4 h-4 transform transition-transform duration-200 text-bolt-elements-textSecondary',
                    isReposExpanded ? 'rotate-180' : '',
                  )}
                />
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="overflow-hidden">
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(isReposExpanded ? stats.get()?.projects : stats.get()?.projects?.slice(0, 12))?.map((repo: any) => (
                    <div
                      key={repo.id}
                      className="p-4 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-bolt-elements-textPrimary truncate">{repo.name}</h4>
                          <p className="text-xs text-bolt-elements-textSecondary mt-1">{repo.path_with_namespace}</p>
                          {repo.description && (
                            <p className="text-xs text-bolt-elements-textSecondary mt-2 line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-4 text-xs text-bolt-elements-textSecondary">
                          <span className="flex items-center gap-1">
                            <div className="i-ph:star w-3 h-3" />
                            {repo.star_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="i-ph:git-fork w-3 h-3" />
                            {repo.forks_count}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(repo.http_url_to_repo, '_blank', 'noopener,noreferrer')}
                          className="text-xs"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {stats.get()?.projects && stats.get()!.projects!.length > 12 && !isReposExpanded && (
                  <div className="text-center">
                    <Button
                      variant="outline"
                      onClick={() => setIsReposExpanded(true)}
                      className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                    >
                      Show {(stats.get()?.projects?.length || 0) - 12} more repositories
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}
    </div>
  );
}
