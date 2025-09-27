import { AnimatePresence, motion } from 'framer-motion';
import type { SupabaseAlert } from '~/types/actions';
import { classNames } from '~/utils/classNames';
import { supabaseConnection } from '~/lib/stores/supabase';
import { useStore } from '@nanostores/react';
import { useState } from 'react';

interface Props {
  alert: SupabaseAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

export function SupabaseChatAlert({ alert, clearAlert, postMessage }: Props) {
  const { content, type, title, description, stage, queryStatus, operation } = alert;
  const connection = useStore(supabaseConnection);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Determine connection state
  const isConnected = !!(connection.token && connection.selectedProjectId && connection.credentials?.anonKey);
  const hasToken = !!connection.token;
  const hasProjects = !!(connection.stats?.projects && connection.stats.projects.length > 0);
  const hasSelectedProject = !!connection.selectedProjectId;
  const hasCredentials = !!connection.credentials?.anonKey;

  // Use alert data if available, otherwise fall back to connection-based logic
  const displayTitle = title || (isConnected ? 'Supabase Query' : 'Supabase Setup Required');
  const displayDescription = description || getDescriptionForState();
  const message = getMessageForState();

  function getDescriptionForState() {
    if (isConnected) {
      return 'Execute database query';
    }

    if (!hasToken) {
      return 'Connect your Supabase account';
    }

    if (!hasProjects) {
      return 'Create your first Supabase project';
    }

    if (!hasSelectedProject) {
      return 'Select a Supabase project';
    }

    if (!hasCredentials) {
      return 'Configure API keys';
    }

    return 'Supabase connection required';
  }

  function getMessageForState() {
    if (isConnected) {
      return 'Please review the proposed changes and apply them to your database.';
    }

    if (!hasToken) {
      return 'To execute database queries, you need to connect your Supabase account. This will allow Bolt to create projects, set up databases, and run queries automatically.';
    }

    if (!hasProjects) {
      return 'You have a Supabase account connected, but no projects exist yet. Create a new project to set up your database and start building with Supabase features.';
    }

    if (!hasSelectedProject) {
      const projectCount = connection.stats?.projects?.length || 0;
      return `You have ${projectCount} Supabase project${projectCount > 1 ? 's' : ''} available. Select a project to set up the database connection and execute queries.`;
    }

    if (!hasCredentials) {
      return "Your Supabase project is selected, but the database connection isn't configured yet. Set up the API keys to enable query execution.";
    }

    return 'Please connect to Supabase to continue with this operation.';
  }

  const handleConnectClick = () => {
    // Dispatch an event to open the Supabase connection dialog
    document.dispatchEvent(new CustomEvent('open-supabase-connection'));
  };

  // State-based button logic is handled inline below

  const executeSupabaseAction = async (sql: string) => {
    if (!connection.token || !connection.selectedProjectId) {
      console.error('No Supabase token or project selected');
      return;
    }

    setIsExecuting(true);

    try {
      const response = await fetch('/api/supabase/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.token}`,
        },
        body: JSON.stringify({
          projectId: connection.selectedProjectId,
          query: sql,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(`Supabase query failed: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('Supabase query executed successfully:', result);
      clearAlert();
    } catch (error) {
      console.error('Failed to execute Supabase action:', error);
      postMessage(
        `*Error executing Supabase query please fix and return the query again*\n\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\`\n`,
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const cleanSqlContent = (content: string) => {
    if (!content) {
      return '';
    }

    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');

    cleaned = cleaned.replace(/(--).*$/gm, '').replace(/(#).*$/gm, '');

    const statements = cleaned
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)
      .join(';\n\n');

    return statements;
  };

  // Determine if we should show the query progress
  const showProgress = stage && queryStatus && operation === 'query';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`max-w-chat rounded-lg border-l-2 border-l-[#098F5F] border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2`}
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <motion.div
              className="flex-shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <img height="16" width="16" crossOrigin="anonymous" src="https://cdn.simpleicons.org/supabase" />
            </motion.div>
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`text-sm font-medium ${
                type === 'success'
                  ? 'text-bolt-elements-icon-success'
                  : type === 'error'
                    ? 'text-bolt-elements-button-danger-text'
                    : 'text-[#3DCB8F]'
              }`}
            >
              {displayTitle}
            </motion.h3>
          </div>
        </div>

        {/* SQL Content */}
        <div className="px-4">
          {!isConnected && operation === 'query' ? (
            <div className="p-3 rounded-md bg-bolt-elements-background-depth-3">
              <span className="text-sm text-bolt-elements-textPrimary">
                You must first connect to Supabase and select a project.
              </span>
            </div>
          ) : (
            <>
              <div
                className="flex items-center p-2 rounded-md bg-bolt-elements-background-depth-3 cursor-pointer"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                <div className="i-ph:database text-bolt-elements-textPrimary mr-2"></div>
                <span className="text-sm text-bolt-elements-textPrimary flex-grow">{displayDescription}</span>
                <div
                  className={`i-ph:caret-up text-bolt-elements-textPrimary transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                ></div>
              </div>

              {!isCollapsed && content && (
                <div className="mt-2 p-3 bg-bolt-elements-background-depth-4 rounded-md overflow-auto max-h-60 font-mono text-xs text-bolt-elements-textSecondary">
                  <pre>{cleanSqlContent(content)}</pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Query Progress Visualization */}
        {showProgress && (
          <div className="px-4">
            <div className="mt-4 mb-2">
              <div className="flex items-center space-x-2 mb-3">
                {/* Execute Step */}
                <div className="flex items-center">
                  <div
                    className={classNames(
                      'w-6 h-6 rounded-full flex items-center justify-center',
                      queryStatus === 'running'
                        ? 'bg-bolt-elements-loader-progress'
                        : queryStatus === 'complete'
                          ? 'bg-bolt-elements-icon-success'
                          : queryStatus === 'failed'
                            ? 'bg-bolt-elements-button-danger-background'
                            : 'bg-bolt-elements-textTertiary',
                    )}
                  >
                    {queryStatus === 'running' ? (
                      <div className="i-svg-spinners:90-ring-with-bg text-white text-xs"></div>
                    ) : queryStatus === 'complete' ? (
                      <div className="i-ph:check text-white text-xs"></div>
                    ) : queryStatus === 'failed' ? (
                      <div className="i-ph:x text-white text-xs"></div>
                    ) : (
                      <span className="text-white text-xs">1</span>
                    )}
                  </div>
                  <span className="ml-2">Execute Query</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message and Actions */}
        <div className="p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`text-sm text-bolt-elements-textSecondary mb-4`}
          >
            <p>{message}</p>

            {content && type === 'error' && (
              <div className="text-xs text-bolt-elements-textSecondary p-2 bg-bolt-elements-background-depth-3 rounded mt-4 mb-4">
                {content}
              </div>
            )}
          </motion.div>

          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {!hasToken ? (
              <button
                onClick={handleConnectClick}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#098F5F]',
                  'hover:bg-[#0aa06c]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-white',
                  'flex items-center gap-1.5',
                )}
              >
                Connect to Supabase
              </button>
            ) : !hasProjects ? (
              <button
                onClick={() => {
                  document.dispatchEvent(new CustomEvent('open-supabase-connection'));
                }}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#098F5F]',
                  'hover:bg-[#0aa06c]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-white',
                  'flex items-center gap-1.5',
                )}
              >
                Create Project
              </button>
            ) : !hasSelectedProject ? (
              <button
                onClick={() => {
                  document.dispatchEvent(new CustomEvent('open-supabase-connection'));
                }}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#098F5F]',
                  'hover:bg-[#0aa06c]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-white',
                  'flex items-center gap-1.5',
                )}
              >
                Select Project
              </button>
            ) : !hasCredentials ? (
              <button
                onClick={() => {
                  document.dispatchEvent(new CustomEvent('open-supabase-connection'));
                }}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#098F5F]',
                  'hover:bg-[#0aa06c]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-white',
                  'flex items-center gap-1.5',
                )}
              >
                Setup Connection
              </button>
            ) : operation === 'query' && type === 'error' ? (
              <button
                onClick={() =>
                  postMessage(`*Fix this Supabase query error*\n\`\`\`\n${content || description}\n\`\`\`\n`)
                }
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-bolt-elements-button-primary-background',
                  'hover:bg-bolt-elements-button-primary-backgroundHover',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-danger-background',
                  'text-bolt-elements-button-primary-text',
                  'flex items-center gap-1.5',
                )}
              >
                <div className="i-ph:chat-circle-duotone"></div>
                Ask Bolt
              </button>
            ) : operation === 'migration' || (operation === 'query' && !stage) ? (
              <button
                onClick={() => content && executeSupabaseAction(content)}
                disabled={isExecuting || !content}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#098F5F]',
                  'hover:bg-[#0aa06c]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-white',
                  'flex items-center gap-1.5',
                  isExecuting || !content ? 'opacity-70 cursor-not-allowed' : '',
                )}
              >
                {isExecuting ? 'Applying...' : 'Apply Changes'}
              </button>
            ) : null}
            <button
              onClick={clearAlert}
              disabled={isExecuting}
              className={classNames(
                `px-3 py-2 rounded-md text-sm font-medium`,
                'bg-[#503B26]',
                'hover:bg-[#774f28]',
                'focus:outline-none',
                'text-[#F79007]',
                isExecuting ? 'opacity-70 cursor-not-allowed' : '',
              )}
            >
              Dismiss
            </button>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
