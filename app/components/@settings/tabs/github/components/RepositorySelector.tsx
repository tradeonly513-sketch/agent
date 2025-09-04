import React, { useState } from 'react';
import { SearchInput, Badge, EmptyState, StatusIndicator } from '~/components/ui';
import { Search, Folder, Star, GitFork, Clock, Lock } from 'lucide-react';
import type { GitHubRepoInfo } from '~/types/GitHub';
import { formatSize } from '~/utils/formatSize';

interface RepositorySelectorProps {
  repositories: GitHubRepoInfo[];
  filteredRepositories: GitHubRepoInfo[];
  isLoading: boolean;
  onRepositorySelect: (repo: GitHubRepoInfo) => void;
  onSearch: (query: string) => void;
  className?: string;
}

export function RepositorySelector({
  repositories,
  filteredRepositories,
  isLoading,
  onRepositorySelect,
  onSearch,
  className = '',
}: RepositorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch(value);
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <SearchInput placeholder="Search your repositories..." disabled />
        <div className="flex flex-col items-center justify-center py-8">
          <StatusIndicator status="loading" pulse size="lg" label="Loading repositories..." />
        </div>
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <EmptyState
          icon={Folder}
          title="No repositories found"
          description="You don't have any repositories yet, or they couldn't be loaded."
        />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <SearchInput placeholder="Search your repositories..." value={searchQuery} onChange={handleSearch} />

      {filteredRepositories.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No repositories match your search"
          description="Try adjusting your search terms or browse all repositories below."
        />
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredRepositories.map((repo) => (
            <RepositoryItem key={repo.full_name} repository={repo} onSelect={() => onRepositorySelect(repo)} />
          ))}
        </div>
      )}

      <div className="text-xs text-bolt-elements-textTertiary border-t border-bolt-elements-borderColor pt-2">
        Showing {filteredRepositories.length} of {repositories.length} repositories
      </div>
    </div>
  );
}

interface RepositoryItemProps {
  repository: GitHubRepoInfo;
  onSelect: () => void;
}

function RepositoryItem({ repository, onSelect }: RepositoryItemProps) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      return 'Today';
    }

    if (diffDays <= 7) {
      return `${diffDays} days ago`;
    }

    if (diffDays <= 30) {
      return `${Math.floor(diffDays / 7)} weeks ago`;
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-3 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-1 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{repository.name}</h4>
          {repository.private && <Lock className="w-3 h-3 text-bolt-elements-textTertiary" />}
          {repository.fork && <GitFork className="w-3 h-3 text-bolt-elements-textTertiary" />}
          {repository.archived && (
            <Badge variant="outline" className="text-xs">
              Archived
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3" />
            {repository.stargazers_count}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="w-3 h-3" />
            {repository.forks_count}
          </span>
        </div>
      </div>

      {repository.description && (
        <p className="text-xs text-bolt-elements-textSecondary mb-2 line-clamp-2">{repository.description}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-bolt-elements-textTertiary">
          {repository.language && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-current opacity-60" />
              {repository.language}
            </span>
          )}
          {repository.size && <span>{formatSize(repository.size * 1024)}</span>}
        </div>

        <span className="flex items-center gap-1 text-xs text-bolt-elements-textTertiary">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(repository.updated_at)}
        </span>
      </div>
    </button>
  );
}
