import React, { useState } from 'react';
import type { GitHubRepoInfo } from '~/types/GitHub';
import { BranchSelectionDialog } from './BranchSelectionDialog';

interface RepositoryCardProps {
  repo: GitHubRepoInfo;
  onClone?: (repoUrl: string, branch?: string) => void;
  showExtendedMetrics?: boolean;
  connection?: any;
}

export function RepositoryCard({ repo, onClone, showExtendedMetrics, connection }: RepositoryCardProps) {
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);

  const handleClone = (repoUrl: string, branch: string) => {
    if (onClone) {
      onClone(repoUrl, branch);
    }
  };
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate to GitHub if clicking on buttons or other interactive elements
    const target = e.target as HTMLElement;

    if (target.closest('button') || target.closest('select') || target.closest('input')) {
      return;
    }

    window.open(repo.html_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="group block p-4 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-all duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`i-ph:${repo.private ? 'lock' : 'git-repository'} w-4 h-4 text-bolt-elements-icon-info`} />
            <h5 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-bolt-elements-item-contentAccent transition-colors">
              {repo.name}
            </h5>
            {repo.private && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary border border-bolt-elements-borderColor">
                Private
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
            <span className="flex items-center gap-1" title="Stars">
              <div className="i-ph:star w-3.5 h-3.5 text-bolt-elements-icon-warning" />
              {repo.stargazers_count.toLocaleString()}
            </span>
            <span className="flex items-center gap-1" title="Forks">
              <div className="i-ph:git-fork w-3.5 h-3.5 text-bolt-elements-icon-info" />
              {repo.forks_count.toLocaleString()}
            </span>
          </div>
        </div>

        {repo.description && (
          <p className="text-xs text-bolt-elements-textSecondary line-clamp-2">{repo.description}</p>
        )}

        {repo.topics && repo.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {repo.topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary border border-bolt-elements-borderColor"
              >
                {topic}
              </span>
            ))}
            {repo.topics.length > 3 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary border border-bolt-elements-borderColor">
                +{repo.topics.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
          {repo.language && (
            <span className="flex items-center gap-1" title="Primary Language">
              <div className="i-ph:circle-fill w-2 h-2 text-bolt-elements-icon-success" />
              {repo.language}
            </span>
          )}
          <span className="flex items-center gap-1" title="Default Branch">
            <div className="i-ph:git-branch w-3.5 h-3.5" />
            {repo.default_branch}
          </span>
          {showExtendedMetrics && (repo as any).branches_count && (
            <span className="flex items-center gap-1" title="Total Branches">
              <div className="i-ph:git-fork w-3.5 h-3.5" />
              {(repo as any).branches_count}
            </span>
          )}
          {showExtendedMetrics && (repo as any).contributors_count && (
            <span className="flex items-center gap-1" title="Contributors">
              <div className="i-ph:users w-3.5 h-3.5" />
              {(repo as any).contributors_count}
            </span>
          )}
          {showExtendedMetrics && (repo as any).issues_count !== undefined && (
            <span className="flex items-center gap-1" title="Open Issues">
              <div className="i-ph:circle w-3.5 h-3.5" />
              {(repo as any).issues_count}
            </span>
          )}
          <span className="flex items-center gap-1" title="Last Updated">
            <div className="i-ph:clock w-3.5 h-3.5" />
            {new Date(repo.updated_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {onClone && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsBranchDialogOpen(true);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                title="Clone repository"
              >
                <div className="i-ph:git-branch w-3.5 h-3.5" />
                Clone
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(repo.html_url, '_blank', 'noopener,noreferrer');
              }}
              className="flex items-center gap-1 hover:text-bolt-elements-item-contentAccent transition-colors"
              title="View on GitHub"
            >
              <div className="i-ph:arrow-square-out w-3.5 h-3.5" />
              View
            </button>
          </div>
        </div>
      </div>

      {/* Branch Selection Dialog */}
      <BranchSelectionDialog
        isOpen={isBranchDialogOpen}
        onClose={() => setIsBranchDialogOpen(false)}
        repository={repo}
        onClone={handleClone}
        connection={connection}
      />
    </div>
  );
}
