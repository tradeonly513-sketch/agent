import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import Cookies from 'js-cookie';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '~/components/ui/Collapsible';
import { Button } from '~/components/ui/Button';
import type {
  GitHubUserResponse,
  GitHubRepoInfo,
  GitHubOrganization,
  GitHubBranch,
  GitHubEvent,
  GitHubLanguageStats,
  GitHubStats,
  GitHubConnection,
} from '~/types/GitHub';

interface ConnectionTestResult {
  status: 'success' | 'error' | 'testing';
  message: string;
  timestamp?: number;
}

// GitHub logo SVG component
const GithubLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
    />
  </svg>
);

export default function GitHubTab() {
  const [connection, setConnection] = useState<GitHubConnection>({
    user: null,
    token: '',
    tokenType: 'classic',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isReposExpanded, setIsReposExpanded] = useState(false);
  const [connectionTest, setConnectionTest] = useState<ConnectionTestResult | null>(null);
  const tokenTypeRef = React.useRef<'classic' | 'fine-grained'>('classic');

  // Connection testing function
  const testConnection = async () => {
    if (!connection.user) {
      setConnectionTest({
        status: 'error',
        message: 'No connection established',
        timestamp: Date.now(),
      });
      return;
    }

    setConnectionTest({
      status: 'testing',
      message: 'Testing connection...',
    });

    try {
      // Test connection via server-side API
      const response = await fetch('/api/github-user');

      if (response.ok) {
        const data = (await response.json()) as GitHubUserResponse;
        setConnectionTest({
          status: 'success',
          message: `Connected successfully as ${data.login}`,
          timestamp: Date.now(),
        });
      } else {
        setConnectionTest({
          status: 'error',
          message: `Connection failed: ${response.status} ${response.statusText}`,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      setConnectionTest({
        status: 'error',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
    }
  };

  const fetchGitHubStats = async (token: string) => {
    setIsFetchingStats(true);

    try {
      // Get the current user first to ensure we have the latest value
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${token}`,
        },
      });

      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          toast.error('Your GitHub token has expired. Please reconnect your account.');
          handleDisconnect();

          return;
        }

        throw new Error(`Failed to fetch user data: ${userResponse.statusText}`);
      }

      const userData = (await userResponse.json()) as any;

      // Fetch repositories with pagination
      let allRepos: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const reposResponse = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}`, {
          headers: {
            Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${token}`,
          },
        });

        if (!reposResponse.ok) {
          throw new Error(`Failed to fetch repositories: ${reposResponse.statusText}`);
        }

        const repos = (await reposResponse.json()) as any[];
        allRepos = [...allRepos, ...repos];

        // Check if there are more pages
        const linkHeader = reposResponse.headers.get('Link');
        hasMore = linkHeader?.includes('rel="next"') ?? false;
        page++;
      }

      /*
       * Fetch detailed information for each repository
       * Process repositories in batches to avoid overwhelming the API
       */
      const batchSize = 5;
      const detailedRepos: any[] = [];

      for (let i = 0; i < allRepos.length; i += batchSize) {
        const batch = allRepos.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((repo: any) => fetchDetailedRepoInfo(repo, token)));
        detailedRepos.push(...batchResults);

        // Small delay between batches to be respectful to the API
        if (i + batchSize < allRepos.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Merge detailed info back into allRepos
      const enrichedRepos = allRepos.map((repo: any) => {
        const detailed = detailedRepos.find((d: any) => d.full_name === repo.full_name);
        return detailed || repo;
      });

      // Calculate stats
      const repoStats = calculateRepoStats(enrichedRepos);

      // Fetch recent activity
      const eventsResponse = await fetch(`https://api.github.com/users/${userData.login}/events?per_page=10`, {
        headers: {
          Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${token}`,
        },
      });

      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch events: ${eventsResponse.statusText}`);
      }

      const events = (await eventsResponse.json()) as any[];
      const recentActivity = events.slice(0, 10).map((event: any) => ({
        id: event.id,
        type: event.type,
        repo: event.repo.name,
        created_at: event.created_at,
      }));

      // Calculate total stars and forks
      const totalStars = allRepos.reduce((sum: number, repo: any) => sum + repo.stargazers_count, 0);
      const totalForks = allRepos.reduce((sum: number, repo: any) => sum + repo.forks_count, 0);
      const privateRepos = allRepos.filter((repo: any) => repo.private).length;

      // Fetch organizations
      const organizations = await fetchOrganizations(token);

      // Calculate account age in days
      const accountAge = Math.floor((Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24));

      // Update the stats in the store
      const stats: GitHubStats = {
        repos: repoStats.repos,
        recentActivity,
        languages: repoStats.languages || {},
        totalGists: repoStats.totalGists || 0,
        publicRepos: userData.public_repos || 0,
        privateRepos: privateRepos || 0,
        stars: totalStars || 0,
        forks: totalForks || 0,
        followers: userData.followers || 0,
        publicGists: userData.public_gists || 0,
        privateGists: userData.private_gists || 0,
        lastUpdated: new Date().toISOString(),
        totalStars: totalStars || 0,
        totalForks: totalForks || 0,
        organizations,
        totalBranches: repoStats.totalBranches || 0,
        totalContributors: repoStats.totalContributors || 0,
        totalIssues: repoStats.totalIssues || 0,
        totalPullRequests: repoStats.totalPullRequests || 0,
        mostUsedLanguages: repoStats.mostUsedLanguages || [],
        recentCommits: 0, // We'll calculate this from events
        accountAge,
      };

      // Get the current user first to ensure we have the latest value
      const currentConnection = JSON.parse(localStorage.getItem('github_connection') || '{}');
      const currentUser = currentConnection.user || connection.user;

      // Update connection with stats
      const updatedConnection: GitHubConnection = {
        user: currentUser,
        token,
        tokenType: connection.tokenType,
        stats,
        rateLimit: connection.rateLimit,
      };

      // Update localStorage
      localStorage.setItem('github_connection', JSON.stringify(updatedConnection));

      // Update state
      setConnection(updatedConnection);

      toast.success('GitHub stats refreshed');
    } catch (error) {
      console.error('Error fetching GitHub stats:', error);
      toast.error(`Failed to fetch GitHub stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFetchingStats(false);
    }
  };

  const fetchDetailedRepoInfo = async (repo: any, token: string) => {
    const headers = {
      Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${token}`,
      'User-Agent': 'Bolt.diy',
    };

    try {
      // Fetch branches
      const branchesResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/branches`, { headers });
      const branches: GitHubBranch[] = branchesResponse.ok ? await branchesResponse.json() : [];

      // Fetch contributors count
      const contributorsResponse = await fetch(
        `https://api.github.com/repos/${repo.full_name}/contributors?per_page=1`,
        { headers },
      );
      const contributorsLink = contributorsResponse.headers.get('Link');
      const contributorsCount = contributorsLink
        ? parseInt(contributorsLink.match(/page=(\d+)>; rel="last"/)?.[1] || '0')
        : 0;

      // Fetch issues count
      const issuesResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/issues?state=all&per_page=1`, {
        headers,
      });
      const issuesLink = issuesResponse.headers.get('Link');
      const issuesCount = issuesLink ? parseInt(issuesLink.match(/page=(\d+)>; rel="last"/)?.[1] || '0') : 0;

      // Fetch pull requests count
      const prResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/pulls?state=all&per_page=1`, {
        headers,
      });
      const prLink = prResponse.headers.get('Link');
      const prCount = prLink ? parseInt(prLink.match(/page=(\d+)>; rel="last"/)?.[1] || '0') : 0;

      return {
        ...repo,
        branches_count: branches.length,
        contributors_count: contributorsCount,
        issues_count: issuesCount,
        pull_requests_count: prCount,
      };
    } catch (error) {
      console.error(`Failed to fetch detailed info for ${repo.full_name}:`, error);
      return repo;
    }
  };

  const fetchOrganizations = async (token: string) => {
    try {
      const response = await fetch('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${token}`,
          'User-Agent': 'Bolt.diy',
        },
      });

      if (!response.ok) {
        return [];
      }

      const orgs: any[] = await response.json();

      return orgs.map((org: any) => ({
        login: org.login,
        avatar_url: org.avatar_url,
        html_url: org.html_url,
        name: org.name,
        description: org.description,
        public_repos: org.public_repos,
        followers: org.followers,
        created_at: org.created_at,
      }));
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      return [];
    }
  };

  const calculateRepoStats = (repos: any[]) => {
    const repoStats = {
      repos: repos.map((repo: any) => ({
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at,
        languages_url: repo.languages_url,
        branches_count: repo.branches_count || 0,
        contributors_count: repo.contributors_count || 0,
        issues_count: repo.issues_count || 0,
        pull_requests_count: repo.pull_requests_count || 0,
        size: repo.size,
        topics: repo.topics,
        license: repo.license,
        archived: repo.archived,
        fork: repo.fork,
      })),
      languages: {} as Record<string, number>,
      totalGists: 0,
      totalBranches: 0,
      totalContributors: 0,
      totalIssues: 0,
      totalPullRequests: 0,
      mostUsedLanguages: [] as Array<{ language: string; bytes: number; repos: number }>,
    };

    // Calculate language statistics with actual bytes
    const languageBytes: Record<string, number> = {};
    const languageRepos: Record<string, number> = {};

    repos.forEach((repo: any) => {
      repoStats.totalBranches += repo.branches_count || 0;
      repoStats.totalContributors += repo.contributors_count || 0;
      repoStats.totalIssues += repo.issues_count || 0;
      repoStats.totalPullRequests += repo.pull_requests_count || 0;

      // Count repos per language (old way)
      if (!repoStats.languages[repo.language]) {
        repoStats.languages[repo.language] = 0;
      }

      repoStats.languages[repo.language] += 1;

      // Track bytes and repo count per language
      if (repo.language) {
        if (!languageBytes[repo.language]) {
          languageBytes[repo.language] = 0;
          languageRepos[repo.language] = 0;
        }

        languageBytes[repo.language] += repo.size || 0;
        languageRepos[repo.language] += 1;
      }
    });

    // Create most used languages array
    repoStats.mostUsedLanguages = Object.entries(languageBytes)
      .map(([language, bytes]) => ({
        language,
        bytes,
        repos: languageRepos[language] || 0,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 20);

    return repoStats;
  };

  const handleDisconnect = () => {
    localStorage.removeItem('github_connection');

    // Remove all GitHub-related cookies
    Cookies.remove('githubToken');
    Cookies.remove('githubUsername');
    Cookies.remove('git:github.com');

    // Reset the token type ref
    tokenTypeRef.current = 'classic';
    setConnection({ user: null, token: '', tokenType: 'classic' });
    setConnectionTest(null);
    toast.success('Disconnected from GitHub');
  };

  useEffect(() => {
    const loadSavedConnection = async () => {
      setIsLoading(true);

      const savedConnection = localStorage.getItem('github_connection');

      if (savedConnection) {
        try {
          const parsed = JSON.parse(savedConnection);

          if (!parsed.tokenType) {
            parsed.tokenType = 'classic';
          }

          // Update the ref with the parsed token type
          tokenTypeRef.current = parsed.tokenType;

          // Set the connection
          setConnection(parsed);

          // If we have a token but no stats or incomplete stats, fetch them
          if (
            parsed.user &&
            parsed.token &&
            (!parsed.stats || !parsed.stats.repos || parsed.stats.repos.length === 0)
          ) {
            console.log('Fetching missing GitHub stats for saved connection');
            await fetchGitHubStats(parsed.token);
          }
        } catch (error) {
          console.error('Error parsing saved GitHub connection:', error);
          localStorage.removeItem('github_connection');
        }
      } else {
        // Check for server-side GitHub connection via API
        try {
          const response = await fetch('/api/github-user');

          if (response.ok) {
            const userData = (await response.json()) as GitHubUserResponse;

            // Create connection object for the UI
            const connectionData = {
              user: userData,
              token: '', // Token is stored server-side only
              tokenType: 'classic' as const,
            };

            // Update the UI state
            setConnection(connectionData);

            // Store minimal connection info (no token)
            localStorage.setItem(
              'github_connection',
              JSON.stringify({
                user: userData,
                tokenType: 'classic',
              }),
            );

            // Fetch stats (which includes repositories) via server-side API
            await fetchGitHubStatsViaAPI();

            return;
          }
        } catch (error) {
          console.warn('Failed to connect to GitHub via API:', error);
        }
      }

      setIsLoading(false);
    };

    loadSavedConnection();
  }, []);

  // Function to fetch GitHub stats via server-side API
  const fetchGitHubStatsViaAPI = async () => {
    try {
      setIsFetchingStats(true);

      // Get repositories via server-side API
      const reposResponse = await fetch('/api/github-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_repos' }),
      });

      if (reposResponse.ok) {
        const reposData = (await reposResponse.json()) as { repos: GitHubRepoInfo[] };

        // Update connection with repositories data
        setConnection((prev) => ({
          ...prev,
          stats: {
            repos: reposData.repos || [],
            recentActivity: [],
            languages: {},
            totalGists: 0,
            publicRepos: 0,
            privateRepos: 0,
            stars: 0,
            forks: 0,
            followers: 0,
            publicGists: 0,
            privateGists: 0,
            lastUpdated: new Date().toISOString(),
            organizations: [],
            totalBranches: 0,
            totalContributors: 0,
            totalIssues: 0,
            totalPullRequests: 0,
            mostUsedLanguages: [],
            recentCommits: 0,
            accountAge: 0,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to fetch GitHub stats via API:', error);
    } finally {
      setIsFetchingStats(false);
    }
  };

  // Ensure cookies are updated when connection changes
  useEffect(() => {
    if (!connection) {
      return;
    }

    const token = connection.token;
    const data = connection.user;

    if (token) {
      Cookies.set('githubToken', token);
      Cookies.set('git:github.com', JSON.stringify({ username: token, password: 'x-oauth-basic' }));
    }

    if (data) {
      Cookies.set('githubUsername', data.login);
    }
  }, [connection]);

  // Add function to update rate limits via server-side API
  const updateRateLimits = async () => {
    try {
      /*
       * For now, we'll skip rate limit checking since it's handled server-side
       * This can be implemented later if needed by adding rate limit endpoint
       */
      console.log('Rate limit checking is handled server-side');
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
    }
  };

  // Add effect to update rate limits periodically
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (connection.user) {
      updateRateLimits();
      interval = setInterval(() => updateRateLimits(), 60000); // Update every minute
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [connection.user]);

  if (isLoading || isConnecting || isFetchingStats) {
    return <LoadingSpinner />;
  }

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsConnecting(true);

    try {
      // Try to connect via server-side API
      const response = await fetch('/api/github-user');

      if (response.ok) {
        const userData = (await response.json()) as GitHubUserResponse;

        // Update connection state with server-side user data
        setConnection({
          user: userData,
          token: '', // Token is stored server-side only
          tokenType: 'classic',
        });

        // Save connection to localStorage
        localStorage.setItem(
          'github_connection',
          JSON.stringify({
            user: userData,
            tokenType: 'classic',
          }),
        );

        // Fetch repositories/stats
        await fetchGitHubStatsViaAPI();

        toast.success('Connected to GitHub successfully');
      } else {
        throw new Error('Failed to connect to GitHub via server');
      }
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);

      // Reset connection state on failure
      setConnection({ user: null, token: '', tokenType: 'classic' });

      toast.error(`Failed to connect to GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

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
          <GithubLogo />
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
            GitHub Integration
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {connection.user && connection.rateLimit && (
            <div className="flex items-center gap-2 px-3 py-1 bg-bolt-elements-background-depth-1 rounded-lg text-xs">
              <div className="i-ph:cloud w-4 h-4 text-bolt-elements-textSecondary" />
              <span className="text-bolt-elements-textSecondary">
                API: {connection.rateLimit.remaining}/{connection.rateLimit.limit}
              </span>
            </div>
          )}
          {connection.user && (
            <Button
              onClick={testConnection}
              disabled={connectionTest?.status === 'testing'}
              variant="outline"
              className="flex items-center gap-2 hover:bg-bolt-elements-item-backgroundActive/10 hover:text-bolt-elements-textPrimary dark:hover:bg-bolt-elements-item-backgroundActive/10 dark:hover:text-bolt-elements-textPrimary transition-colors"
            >
              {connectionTest?.status === 'testing' ? (
                <>
                  <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <div className="i-ph:plug-charging w-4 h-4" />
                  Test Connection
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
        Connect and manage your GitHub integration with advanced repository management features
      </p>

      {/* Connection Test Results */}
      {connectionTest && (
        <motion.div
          className={classNames('p-4 rounded-lg border', {
            'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700':
              connectionTest.status === 'success',
            'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700': connectionTest.status === 'error',
            'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700': connectionTest.status === 'testing',
          })}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2">
            {connectionTest.status === 'success' && (
              <div className="i-ph:check-circle w-5 h-5 text-green-600 dark:text-green-400" />
            )}
            {connectionTest.status === 'error' && (
              <div className="i-ph:warning-circle w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            {connectionTest.status === 'testing' && (
              <div className="i-ph:spinner-gap w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
            )}
            <span
              className={classNames('text-sm font-medium', {
                'text-green-800 dark:text-green-200': connectionTest.status === 'success',
                'text-red-800 dark:text-red-200': connectionTest.status === 'error',
                'text-blue-800 dark:text-blue-200': connectionTest.status === 'testing',
              })}
            >
              {connectionTest.message}
            </span>
          </div>
          {connectionTest.timestamp && (
            <p className="text-xs text-gray-500 mt-1">{new Date(connectionTest.timestamp).toLocaleString()}</p>
          )}
        </motion.div>
      )}

      {/* Main Connection Component */}
      <motion.div
        className="bg-bolt-elements-background dark:bg-bolt-elements-background border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor rounded-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="p-6 space-y-6">
          {!connection.user && (
            <div className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 p-3 rounded-lg mb-4">
              <p className="flex items-center gap-1 mb-1">
                <span className="i-ph:lightbulb w-3.5 h-3.5 text-bolt-elements-icon-success dark:text-bolt-elements-icon-success" />
                <span className="font-medium">Tip:</span> You can also set the{' '}
                <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded">
                  VITE_GITHUB_ACCESS_TOKEN
                </code>{' '}
                environment variable to connect automatically.
              </p>
              <p>
                For fine-grained tokens, also set{' '}
                <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded">
                  VITE_GITHUB_TOKEN_TYPE=fine-grained
                </code>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary mb-2">
                Token Type
              </label>
              <select
                value={connection.tokenType}
                onChange={(e) => {
                  const newTokenType = e.target.value as 'classic' | 'fine-grained';
                  tokenTypeRef.current = newTokenType;
                  setConnection((prev) => ({ ...prev, tokenType: newTokenType }));
                }}
                disabled={isConnecting || !!connection.user}
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1',
                  'border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary',
                  'focus:outline-none focus:ring-1 focus:ring-bolt-elements-item-contentAccent dark:focus:ring-bolt-elements-item-contentAccent',
                  'disabled:opacity-50',
                )}
              >
                <option value="classic">Personal Access Token (Classic)</option>
                <option value="fine-grained">Fine-grained Token</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary mb-2">
                {connection.tokenType === 'classic' ? 'Personal Access Token' : 'Fine-grained Token'}
              </label>
              <input
                type="password"
                value={connection.token}
                onChange={(e) => setConnection((prev) => ({ ...prev, token: e.target.value }))}
                disabled={isConnecting || !!connection.user}
                placeholder={`Enter your GitHub ${
                  connection.tokenType === 'classic' ? 'personal access token' : 'fine-grained token'
                }`}
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                  'border border-[#E5E5E5] dark:border-[#333333]',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                  'disabled:opacity-50',
                )}
              />
              <div className="mt-2 text-sm text-bolt-elements-textSecondary">
                <a
                  href={`https://github.com/settings/tokens${connection.tokenType === 'fine-grained' ? '/beta' : '/new'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bolt-elements-borderColorActive hover:underline inline-flex items-center gap-1"
                >
                  Get your token
                  <div className="i-ph:arrow-square-out w-4 h-4" />
                </a>
                <span className="mx-2">•</span>
                <span>
                  Required scopes:{' '}
                  {connection.tokenType === 'classic'
                    ? 'repo, read:org, read:user'
                    : 'Repository access, Organization access'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {!connection.user ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting || !connection.token}
                className={classNames(
                  'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                  'bg-[#303030] text-white',
                  'hover:bg-[#5E41D0] hover:text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
                  'transform active:scale-95',
                )}
              >
                {isConnecting ? (
                  <>
                    <div className="i-ph:spinner-gap animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <div className="i-ph:plug-charging w-4 h-4" />
                    Connect
                  </>
                )}
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleDisconnect}
                      className={classNames(
                        'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                        'bg-red-500 text-white',
                        'hover:bg-red-600',
                      )}
                    >
                      <div className="i-ph:plug w-4 h-4" />
                      Disconnect
                    </button>
                    <span className="text-sm text-bolt-elements-textSecondary flex items-center gap-1">
                      <div className="i-ph:check-circle w-4 h-4 text-green-500" />
                      Connected to GitHub
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open('https://github.com/dashboard', '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-2 hover:bg-bolt-elements-item-backgroundActive/10 hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      <div className="i-ph:layout w-4 h-4" />
                      Dashboard
                    </Button>
                    <Button
                      onClick={() => {
                        fetchGitHubStats(connection.token);
                        updateRateLimits();
                      }}
                      disabled={isFetchingStats}
                      variant="outline"
                      className="flex items-center gap-2 hover:bg-bolt-elements-item-backgroundActive/10 hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      {isFetchingStats ? (
                        <>
                          <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <div className="i-ph:arrows-clockwise w-4 h-4" />
                          Refresh Stats
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {connection.user && connection.stats && (
            <div className="mt-6 border-t border-bolt-elements-borderColor dark:border-bolt-elements-borderColor pt-6">
              <div className="flex items-center gap-4 p-4 bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 rounded-lg mb-4">
                <img
                  src={connection.user.avatar_url}
                  alt={connection.user.login}
                  className="w-12 h-12 rounded-full border-2 border-bolt-elements-item-contentAccent dark:border-bolt-elements-item-contentAccent"
                />
                <div>
                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                    {connection.user.name || connection.user.login}
                  </h4>
                  <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
                    {connection.user.login}
                  </p>
                </div>
              </div>

              <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-bolt-elements-background dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70 dark:hover:border-bolt-elements-borderColorActive/70 transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <div className="i-ph:chart-bar w-4 h-4 text-bolt-elements-item-contentAccent" />
                      <span className="text-sm font-medium text-bolt-elements-textPrimary">GitHub Stats</span>
                    </div>
                    <div
                      className={classNames(
                        'i-ph:caret-down w-4 h-4 transform transition-transform duration-200 text-bolt-elements-textSecondary',
                        isStatsExpanded ? 'rotate-180' : '',
                      )}
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden">
                  <div className="space-y-4 mt-4">
                    {/* Languages Section */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-3">Top Languages</h4>
                      {connection.stats.mostUsedLanguages && connection.stats.mostUsedLanguages.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {connection.stats.mostUsedLanguages.slice(0, 15).map(({ language, bytes, repos }) => (
                              <span
                                key={language}
                                className="px-3 py-1 text-xs rounded-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText"
                                title={`${language}: ${(bytes / 1024 / 1024).toFixed(2)}MB across ${repos} repos`}
                              >
                                {language} ({repos})
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-bolt-elements-textSecondary">
                            Based on actual codebase size across repositories
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(connection.stats.languages)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([language]) => (
                              <span
                                key={language}
                                className="px-3 py-1 text-xs rounded-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText"
                              >
                                {language}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* GitHub Overview Summary */}
                    <div className="mb-6 p-4 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor">
                      <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-3">GitHub Overview</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-bolt-elements-textPrimary">
                            {(connection.stats.publicRepos || 0) + (connection.stats.privateRepos || 0)}
                          </div>
                          <div className="text-xs text-bolt-elements-textSecondary">Total Repositories</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-bolt-elements-textPrimary">
                            {connection.stats.totalBranches || 0}
                          </div>
                          <div className="text-xs text-bolt-elements-textSecondary">Total Branches</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-bolt-elements-textPrimary">
                            {connection.stats.organizations?.length || 0}
                          </div>
                          <div className="text-xs text-bolt-elements-textSecondary">Organizations</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-bolt-elements-textPrimary">
                            {Object.keys(connection.stats.languages).length}
                          </div>
                          <div className="text-xs text-bolt-elements-textSecondary">Languages Used</div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      {[
                        {
                          label: 'Member Since',
                          value: new Date(connection.user.created_at).toLocaleDateString(),
                          sublabel: connection.stats.accountAge ? `${connection.stats.accountAge} days` : '',
                        },
                        {
                          label: 'Public Gists',
                          value: connection.stats.publicGists,
                        },
                        {
                          label: 'Organizations',
                          value: connection.stats.organizations ? connection.stats.organizations.length : 0,
                        },
                        {
                          label: 'Languages',
                          value: Object.keys(connection.stats.languages).length,
                        },
                      ].map((stat, index) => (
                        <div
                          key={index}
                          className="flex flex-col p-3 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
                        >
                          <span className="text-xs text-bolt-elements-textSecondary">{stat.label}</span>
                          <span className="text-lg font-medium text-bolt-elements-textPrimary">{stat.value}</span>
                          {stat.sublabel && (
                            <span className="text-xs text-bolt-elements-textTertiary">{stat.sublabel}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Repository Stats */}
                    <div className="mt-4">
                      <div className="space-y-4">
                        <div>
                          <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Repository Stats</h5>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              {
                                label: 'Public Repos',
                                value: connection.stats.publicRepos,
                              },
                              {
                                label: 'Private Repos',
                                value: connection.stats.privateRepos,
                              },
                            ].map((stat, index) => (
                              <div
                                key={index}
                                className="flex flex-col p-3 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
                              >
                                <span className="text-xs text-bolt-elements-textSecondary">{stat.label}</span>
                                <span className="text-lg font-medium text-bolt-elements-textPrimary">{stat.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                            Contribution Stats
                          </h5>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              {
                                label: 'Stars',
                                value: connection.stats.stars || 0,
                                icon: 'i-ph:star',
                                iconColor: 'text-bolt-elements-icon-warning',
                              },
                              {
                                label: 'Forks',
                                value: connection.stats.forks || 0,
                                icon: 'i-ph:git-fork',
                                iconColor: 'text-bolt-elements-icon-info',
                              },
                              {
                                label: 'Followers',
                                value: connection.stats.followers || 0,
                                icon: 'i-ph:users',
                                iconColor: 'text-bolt-elements-icon-success',
                              },
                            ].map((stat, index) => (
                              <div
                                key={index}
                                className="flex flex-col p-3 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
                              >
                                <span className="text-xs text-bolt-elements-textSecondary">{stat.label}</span>
                                <span className="text-lg font-medium text-bolt-elements-textPrimary flex items-center gap-1">
                                  <div className={`${stat.icon} w-4 h-4 ${stat.iconColor}`} />
                                  {stat.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Gists</h5>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              {
                                label: 'Public',
                                value: connection.stats.publicGists,
                              },
                              {
                                label: 'Private',
                                value: connection.stats.privateGists || 0,
                              },
                            ].map((stat, index) => (
                              <div
                                key={index}
                                className="flex flex-col p-3 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
                              >
                                <span className="text-xs text-bolt-elements-textSecondary">{stat.label}</span>
                                <span className="text-lg font-medium text-bolt-elements-textPrimary">{stat.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Activity Summary</h5>
                          <div className="grid grid-cols-4 gap-4">
                            {[
                              {
                                label: 'Total Branches',
                                value: connection.stats.totalBranches || 0,
                                icon: 'i-ph:git-branch',
                                iconColor: 'text-bolt-elements-icon-info',
                              },
                              {
                                label: 'Contributors',
                                value: connection.stats.totalContributors || 0,
                                icon: 'i-ph:users',
                                iconColor: 'text-bolt-elements-icon-success',
                              },
                              {
                                label: 'Issues',
                                value: connection.stats.totalIssues || 0,
                                icon: 'i-ph:circle',
                                iconColor: 'text-bolt-elements-icon-warning',
                              },
                              {
                                label: 'Pull Requests',
                                value: connection.stats.totalPullRequests || 0,
                                icon: 'i-ph:git-pull-request',
                                iconColor: 'text-bolt-elements-icon-accent',
                              },
                            ].map((stat, index) => (
                              <div
                                key={index}
                                className="flex flex-col p-3 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
                              >
                                <span className="text-xs text-bolt-elements-textSecondary">{stat.label}</span>
                                <span className="text-lg font-medium text-bolt-elements-textPrimary flex items-center gap-1">
                                  <div className={`${stat.icon} w-4 h-4 ${stat.iconColor}`} />
                                  {(stat.value || 0).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Organizations Section */}
                        {connection.stats.organizations && connection.stats.organizations.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Organizations</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {connection.stats.organizations.map((org) => (
                                <a
                                  key={org.login}
                                  href={org.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 p-3 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive dark:hover:border-bolt-elements-borderColorActive transition-all duration-200"
                                >
                                  <img
                                    src={org.avatar_url}
                                    alt={org.login}
                                    className="w-8 h-8 rounded-full border border-bolt-elements-borderColor"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <h6 className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                                      {org.name || org.login}
                                    </h6>
                                    <p className="text-xs text-bolt-elements-textSecondary truncate">{org.login}</p>
                                    {org.description && (
                                      <p className="text-xs text-bolt-elements-textTertiary truncate">
                                        {org.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                                    {org.public_repos && (
                                      <span className="flex items-center gap-1">
                                        <div className="i-ph:folder w-3 h-3" />
                                        {org.public_repos}
                                      </span>
                                    )}
                                    {org.followers && (
                                      <span className="flex items-center gap-1">
                                        <div className="i-ph:users w-3 h-3" />
                                        {org.followers}
                                      </span>
                                    )}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Repository Health Analytics */}
                        <div>
                          <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                            Repository Health Overview
                          </h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {(() => {
                              const healthyRepos = connection.stats.repos.filter((repo) => {
                                const daysSinceUpdate = Math.floor(
                                  (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24),
                                );
                                return daysSinceUpdate < 30 && !repo.archived && repo.stargazers_count > 0;
                              }).length;
                              const activeRepos = connection.stats.repos.filter((repo) => {
                                const daysSinceUpdate = Math.floor(
                                  (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24),
                                );
                                return daysSinceUpdate < 7;
                              }).length;
                              const archivedRepos = connection.stats.repos.filter((repo) => repo.archived).length;
                              const forkedRepos = connection.stats.repos.filter((repo) => repo.fork).length;

                              return [
                                {
                                  label: 'Healthy Repos',
                                  value: healthyRepos,
                                  icon: 'i-ph:heart',
                                  iconColor: 'text-green-500',
                                  description: 'Active, starred, non-archived',
                                },
                                {
                                  label: 'Recently Active',
                                  value: activeRepos,
                                  icon: 'i-ph:pulse',
                                  iconColor: 'text-blue-500',
                                  description: 'Updated within 7 days',
                                },
                                {
                                  label: 'Archived',
                                  value: archivedRepos,
                                  icon: 'i-ph:archive',
                                  iconColor: 'text-gray-500',
                                  description: 'No longer maintained',
                                },
                                {
                                  label: 'Forked',
                                  value: forkedRepos,
                                  icon: 'i-ph:git-fork',
                                  iconColor: 'text-purple-500',
                                  description: 'Forked from other repos',
                                },
                              ];
                            })().map((stat, index) => (
                              <div
                                key={index}
                                className="flex flex-col p-3 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
                                title={stat.description}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`${stat.icon} w-4 h-4 ${stat.iconColor}`} />
                                  <span className="text-xs text-bolt-elements-textSecondary">{stat.label}</span>
                                </div>
                                <span className="text-lg font-medium text-bolt-elements-textPrimary">{stat.value}</span>
                                <span className="text-xs text-bolt-elements-textTertiary">{stat.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Contribution Activity Insights */}
                        <div>
                          <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Activity Insights</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-bolt-elements-background-depth-2 p-3 rounded-lg border border-bolt-elements-borderColor">
                              <h6 className="text-xs font-medium text-bolt-elements-textPrimary flex items-center gap-2 mb-2">
                                <div className="i-ph:chart-line w-4 h-4 text-bolt-elements-item-contentAccent" />
                                Repository Activity
                              </h6>
                              <div className="space-y-1">
                                {(() => {
                                  const now = Date.now();
                                  const last30Days = connection.stats.repos.filter(
                                    (repo) => now - new Date(repo.updated_at).getTime() < 30 * 24 * 60 * 60 * 1000,
                                  ).length;
                                  const last7Days = connection.stats.repos.filter(
                                    (repo) => now - new Date(repo.updated_at).getTime() < 7 * 24 * 60 * 60 * 1000,
                                  ).length;
                                  const avgStars = Math.round(
                                    connection.stats.repos.reduce((sum, repo) => sum + repo.stargazers_count, 0) /
                                      connection.stats.repos.length,
                                  );

                                  return [
                                    { label: 'Updated last 7 days', value: last7Days },
                                    { label: 'Updated last 30 days', value: last30Days },
                                    { label: 'Avg stars per repo', value: avgStars || 0 },
                                  ];
                                })().map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-bolt-elements-textSecondary">{item.label}:</span>
                                    <span className="text-bolt-elements-textPrimary font-medium">{item.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="bg-bolt-elements-background-depth-2 p-3 rounded-lg border border-bolt-elements-borderColor">
                              <h6 className="text-xs font-medium text-bolt-elements-textPrimary flex items-center gap-2 mb-2">
                                <div className="i-ph:trophy w-4 h-4 text-bolt-elements-item-contentAccent" />
                                Top Performers
                              </h6>
                              <div className="space-y-1">
                                {connection.stats.repos
                                  .sort((a, b) => b.stargazers_count - a.stargazers_count)
                                  .slice(0, 3)
                                  .map((repo, idx) => (
                                    <div key={repo.full_name} className="flex items-center gap-2 text-xs">
                                      <span className="text-bolt-elements-textSecondary">#{idx + 1}</span>
                                      <span className="text-bolt-elements-textPrimary font-medium truncate flex-1">
                                        {repo.name}
                                      </span>
                                      <div className="flex items-center gap-1 text-bolt-elements-textSecondary">
                                        <div className="i-ph:star w-3 h-3 text-yellow-500" />
                                        <span>{repo.stargazers_count}</span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-bolt-elements-borderColor">
                          <span className="text-xs text-bolt-elements-textSecondary">
                            Last updated:{' '}
                            {connection.stats.lastUpdated
                              ? new Date(connection.stats.lastUpdated).toLocaleString()
                              : 'Never'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Repositories Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                          All Repositories ({connection.stats.repos.length})
                        </h4>
                        {connection.stats.repos.length > 12 && (
                          <button
                            onClick={() => setIsReposExpanded(!isReposExpanded)}
                            className="text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                          >
                            {isReposExpanded ? 'Show Less' : `Show All ${connection.stats.repos.length}`}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(isReposExpanded ? connection.stats.repos : connection.stats.repos.slice(0, 12)).map(
                          (repo) => (
                            <a
                              key={repo.full_name}
                              href={repo.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block p-4 rounded-lg bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive dark:hover:border-bolt-elements-borderColorActive transition-all duration-200 relative"
                            >
                              {/* Repository Health Indicator */}
                              {(() => {
                                const daysSinceUpdate = Math.floor(
                                  (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24),
                                );
                                const isHealthy = daysSinceUpdate < 30 && !repo.archived && repo.stargazers_count > 0;
                                const isActive = daysSinceUpdate < 7;
                                const healthColor = repo.archived
                                  ? 'bg-gray-500'
                                  : isActive
                                    ? 'bg-green-500'
                                    : isHealthy
                                      ? 'bg-blue-500'
                                      : 'bg-yellow-500';
                                const healthTitle = repo.archived
                                  ? 'Archived'
                                  : isActive
                                    ? 'Very Active'
                                    : isHealthy
                                      ? 'Healthy'
                                      : 'Needs Attention';

                                return (
                                  <div
                                    className={`absolute top-2 right-2 w-2 h-2 rounded-full ${healthColor}`}
                                    title={`Repository Health: ${healthTitle}`}
                                  />
                                );
                              })()}
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="i-ph:git-branch w-4 h-4 text-bolt-elements-icon-tertiary" />
                                    <h5 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-bolt-elements-item-contentAccent transition-colors">
                                      {repo.name}
                                    </h5>
                                    {repo.fork && (
                                      <div
                                        className="i-ph:git-fork w-3 h-3 text-bolt-elements-textTertiary"
                                        title="Forked repository"
                                      />
                                    )}
                                    {repo.archived && (
                                      <div
                                        className="i-ph:archive w-3 h-3 text-bolt-elements-textTertiary"
                                        title="Archived repository"
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
                                    <span className="flex items-center gap-1" title="Stars">
                                      <div className="i-ph:star w-3.5 h-3.5 text-bolt-elements-icon-warning" />
                                      {(repo.stargazers_count || 0).toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1" title="Forks">
                                      <div className="i-ph:git-fork w-3.5 h-3.5 text-bolt-elements-icon-info" />
                                      {(repo.forks_count || 0).toLocaleString()}
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
                                    <p className="text-xs text-bolt-elements-textSecondary line-clamp-2">
                                      {repo.description}
                                    </p>
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
                                      {(() => {
                                        const daysSinceUpdate = Math.floor(
                                          (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24),
                                        );

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
                                      })()}
                                    </span>
                                    {repo.topics && repo.topics.length > 0 && (
                                      <span
                                        className="flex items-center gap-1"
                                        title={`Topics: ${repo.topics.join(', ')}`}
                                      >
                                        <div className="i-ph:tag w-3.5 h-3.5" />
                                        {repo.topics.length}
                                      </span>
                                    )}
                                  </div>

                                  {/* Repository Health Score */}
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const daysSinceUpdate = Math.floor(
                                        (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24),
                                      );
                                      const hasStars = repo.stargazers_count > 0;
                                      const hasRecentActivity = daysSinceUpdate < 30;
                                      const hasContributors = (repo.contributors_count || 0) > 1;
                                      const hasDescription = !!repo.description;
                                      const hasTopics = (repo.topics || []).length > 0;
                                      const hasLicense = !!repo.license;

                                      const healthScore = [
                                        hasStars,
                                        hasRecentActivity,
                                        hasContributors,
                                        hasDescription,
                                        hasTopics,
                                        hasLicense,
                                      ].filter(Boolean).length;
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

                                      return (
                                        <div
                                          className="flex items-center gap-1"
                                          title={`Health Score: ${percentage}% (${healthScore}/${maxScore})`}
                                        >
                                          <div className={`i-ph:heart w-3.5 h-3.5 ${getScoreColor(healthScore)}`} />
                                          <span className={`text-xs font-medium ${getScoreColor(healthScore)}`}>
                                            {percentage}%
                                          </span>
                                        </div>
                                      );
                                    })()}

                                    <span className="flex items-center gap-1 ml-2 group-hover:text-bolt-elements-item-contentAccent transition-colors">
                                      <div className="i-ph:arrow-square-out w-3.5 h-3.5" />
                                      View
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </a>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="flex items-center gap-2">
        <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
        <span className="text-bolt-elements-textSecondary">Loading...</span>
      </div>
    </div>
  );
}
