import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGitHubConnection, useGitHubStats } from '~/lib/hooks';
import { GitHubConnection } from './components/GitHubConnection';
import { GitHubUserProfile } from './components/GitHubUserProfile';
import { GitHubStats } from './components/GitHubStats';
import { GitHubRepositories } from './components/GitHubRepositories';

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
  const { connection, isConnected, testConnection } = useGitHubConnection();
  const { stats } = useGitHubStats(connection, { autoFetch: true });

  const [connectionTest, setConnectionTest] = useState<ConnectionTestResult | null>(null);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isReposExpanded, setIsReposExpanded] = useState(false);

  const handleTestConnection = async () => {
    if (!connection?.user) {
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
      const isValid = await testConnection();

      if (isValid) {
        setConnectionTest({
          status: 'success',
          message: `Connected successfully as ${connection.user.login}`,
          timestamp: Date.now(),
        });
      } else {
        setConnectionTest({
          status: 'error',
          message: 'Connection test failed',
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
          {connection?.rateLimit && (
            <div className="flex items-center gap-2 px-3 py-1 bg-bolt-elements-background-depth-1 rounded-lg text-xs">
              <div className="i-ph:cloud w-4 h-4 text-bolt-elements-textSecondary" />
              <span className="text-bolt-elements-textSecondary">
                API: {connection.rateLimit.remaining}/{connection.rateLimit.limit}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
        Connect and manage your GitHub integration with advanced repository management features
      </p>

      {/* Connection Test Results */}
      {connectionTest && (
        <motion.div
          className={`p-4 rounded-lg border ${
            connectionTest.status === 'success'
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
              : connectionTest.status === 'error'
                ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
                : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
          }`}
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
              className={`text-sm font-medium ${
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
          {connectionTest.timestamp && (
            <p className="text-xs text-gray-500 mt-1">{new Date(connectionTest.timestamp).toLocaleString()}</p>
          )}
        </motion.div>
      )}

      {/* Connection Component */}
      <GitHubConnection connectionTest={connectionTest} onTestConnection={handleTestConnection} />

      {/* User Profile & Stats */}
      {isConnected && connection?.user && (
        <>
          <GitHubUserProfile user={connection.user} />

          <GitHubStats connection={connection} isExpanded={isStatsExpanded} onToggleExpanded={setIsStatsExpanded} />

          {/* Repositories Section */}
          {stats?.repos && stats.repos.length > 0 && (
            <GitHubRepositories
              repositories={stats.repos}
              isExpanded={isReposExpanded}
              onToggleExpanded={setIsReposExpanded}
            />
          )}
        </>
      )}
    </div>
  );
}
