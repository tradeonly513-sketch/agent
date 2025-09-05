import React from 'react';
import type { GitHubRepoInfo } from '~/types/GitHub';

interface GitHubRepositoriesProps {
  repositories: GitHubRepoInfo[];
  isExpanded: boolean;
  onToggleExpanded: (expanded: boolean) => void;
}

export function GitHubRepositories({ repositories, isExpanded, onToggleExpanded }: GitHubRepositoriesProps) {
  if (!repositories || repositories.length === 0) {
    return null;
  }

  const displayedRepos = isExpanded ? repositories : repositories.slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary">All Repositories ({repositories.length})</h4>
        {repositories.length > 12 && (
          <button
            onClick={() => onToggleExpanded(!isExpanded)}
            className="text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            {isExpanded ? 'Show Less' : `Show All ${repositories.length}`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedRepos.map((repo) => (
          <RepositoryCard key={repo.full_name} repo={repo} />
        ))}
      </div>
    </div>
  );
}

interface RepositoryCardProps {
  repo: GitHubRepoInfo;
}

function RepositoryCard({ repo }: RepositoryCardProps) {
  const daysSinceUpdate = Math.floor((Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24));

  const isHealthy = daysSinceUpdate < 30 && !repo.archived && repo.stargazers_count > 0;
  const isActive = daysSinceUpdate < 7;
  const healthColor = repo.archived
    ? 'bg-gray-500'
    : isActive
      ? 'bg-green-500'
      : isHealthy
        ? 'bg-blue-500'
        : 'bg-yellow-500';
  const healthTitle = repo.archived ? 'Archived' : isActive ? 'Very Active' : isHealthy ? 'Healthy' : 'Needs Attention';

  const formatTimeAgo = () => {
    if (daysSinceUpdate === 0) {
      return 'Today';
    }

    if (daysSinceUpdate === 1) {
      return '1 day ago';
    }

    if (daysSinceUpdate < 7) {
      return `${daysSinceUpdate} days ago`;
    }

    if (daysSinceUpdate < 30) {
      return `${Math.floor(daysSinceUpdate / 7)} weeks ago`;
    }

    return new Date(repo.updated_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateHealthScore = () => {
    const hasStars = repo.stargazers_count > 0;
    const hasRecentActivity = daysSinceUpdate < 30;
    const hasContributors = (repo.contributors_count || 0) > 1;
    const hasDescription = !!repo.description;
    const hasTopics = (repo.topics || []).length > 0;
    const hasLicense = !!repo.license;

    const healthScore = [hasStars, hasRecentActivity, hasContributors, hasDescription, hasTopics, hasLicense].filter(
      Boolean,
    ).length;

    const maxScore = 6;
    const percentage = Math.round((healthScore / maxScore) * 100);

    const getScoreColor = (score: number) => {
      if (score >= 5) {
        return 'text-green-500';
      }

      if (score >= 3) {
        return 'text-yellow-500';
      }

      return 'text-red-500';
    };

    return {
      percentage,
      color: getScoreColor(healthScore),
      score: healthScore,
      maxScore,
    };
  };

  const health = calculateHealthScore();

  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-4 rounded-lg bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive dark:hover:border-bolt-elements-borderColorActive transition-all duration-200 relative"
    >
      {/* Repository Health Indicator */}
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${healthColor}`}
        title={`Repository Health: ${healthTitle}`}
      />

      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="i-ph:git-branch w-4 h-4 text-bolt-elements-icon-tertiary" />
            <h5 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-bolt-elements-item-contentAccent transition-colors">
              {repo.name}
            </h5>
            {repo.fork && (
              <div className="i-ph:git-fork w-3 h-3 text-bolt-elements-textTertiary" title="Forked repository" />
            )}
            {repo.archived && (
              <div className="i-ph:archive w-3 h-3 text-bolt-elements-textTertiary" title="Archived repository" />
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
            {repo.issues_count !== undefined && (
              <span className="flex items-center gap-1" title="Open Issues">
                <div className="i-ph:circle w-3.5 h-3.5 text-bolt-elements-icon-error" />
                {repo.issues_count}
              </span>
            )}
            {repo.pull_requests_count !== undefined && (
              <span className="flex items-center gap-1" title="Pull Requests">
                <div className="i-ph:git-pull-request w-3.5 h-3.5 text-bolt-elements-icon-success" />
                {repo.pull_requests_count}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {repo.description && (
            <p className="text-xs text-bolt-elements-textSecondary line-clamp-2">{repo.description}</p>
          )}

          {/* Repository metrics bar */}
          <div className="flex items-center gap-2 text-xs">
            {repo.license && (
              <span className="px-2 py-0.5 rounded-full bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary">
                {repo.license.spdx_id || repo.license.name}
              </span>
            )}
            {repo.topics &&
              repo.topics.slice(0, 2).map((topic) => (
                <span
                  key={topic}
                  className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                >
                  {topic}
                </span>
              ))}
            {repo.archived && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                Archived
              </span>
            )}
            {repo.fork && (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                Fork
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
            <span className="flex items-center gap-1" title="Default Branch">
              <div className="i-ph:git-branch w-3.5 h-3.5" />
              {repo.default_branch}
            </span>
            {repo.branches_count && (
              <span className="flex items-center gap-1" title="Total Branches">
                <div className="i-ph:git-fork w-3.5 h-3.5" />
                {repo.branches_count}
              </span>
            )}
            {repo.contributors_count && (
              <span className="flex items-center gap-1" title="Contributors">
                <div className="i-ph:users w-3.5 h-3.5" />
                {repo.contributors_count}
              </span>
            )}
            {repo.size && (
              <span className="flex items-center gap-1" title="Size">
                <div className="i-ph:database w-3.5 h-3.5" />
                {(repo.size / 1024).toFixed(1)}MB
              </span>
            )}
            <span className="flex items-center gap-1" title="Last Updated">
              <div className="i-ph:clock w-3.5 h-3.5" />
              {formatTimeAgo()}
            </span>
            {repo.topics && repo.topics.length > 0 && (
              <span className="flex items-center gap-1" title={`Topics: ${repo.topics.join(', ')}`}>
                <div className="i-ph:tag w-3.5 h-3.5" />
                {repo.topics.length}
              </span>
            )}
          </div>

          {/* Repository Health Score */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1"
              title={`Health Score: ${health.percentage}% (${health.score}/${health.maxScore})`}
            >
              <div className={`i-ph:heart w-3.5 h-3.5 ${health.color}`} />
              <span className={`text-xs font-medium ${health.color}`}>{health.percentage}%</span>
            </div>

            <span className="flex items-center gap-1 ml-2 group-hover:text-bolt-elements-item-contentAccent transition-colors">
              <div className="i-ph:arrow-square-out w-3.5 h-3.5" />
              View
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
