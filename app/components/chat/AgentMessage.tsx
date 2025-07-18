import React, { useState } from 'react';
import { classNames } from '~/utils/classNames';

interface AgentMessageProps {
  content: string;
  userRequest?: string;
}

/**
 * Component to display Agent mode messages with collapsible system prompt
 */
export const AgentMessage: React.FC<AgentMessageProps> = ({ content, userRequest }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if this is an agent mode message
  const isAgentMessage = content.includes('[AGENT MODE]');

  if (!isAgentMessage) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  // Extract user request from the content
  const userRequestMatch = content.match(/User Request: (.*?)\n\nInstructions:/s);
  const extractedUserRequest = userRequestMatch ? userRequestMatch[1].trim() : userRequest;

  return (
    <div className="space-y-3">
      {/* Compact Agent Mode Indicator */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-blue-700">🤖 Agent Mode</span>
        </div>
        <div className="flex-1 text-sm text-blue-600">
          Creating project based on your request
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={classNames(
            "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
            isExpanded
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
              : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
          )}
        >
          <span>{isExpanded ? 'Hide' : 'Show'} Details</span>
          <div className={classNames(
            "transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0"
          )}>
            ▼
          </div>
        </button>
      </div>

      {/* User Request Display */}
      {extractedUserRequest && (
        <div className="p-3 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg">
          <div className="text-sm font-medium text-bolt-elements-textPrimary mb-2">📝 Your Request:</div>
          <div className="text-sm text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 p-2 rounded border-l-3 border-blue-400">
            {extractedUserRequest}
          </div>
        </div>
      )}

      {/* Collapsible System Prompt */}
      {isExpanded && (
        <div className="p-3 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg">
          <div className="text-xs font-medium text-bolt-elements-textSecondary mb-3 flex items-center gap-2">
            <span>⚙️</span>
            <span>System Instructions:</span>
          </div>
          <div className="text-xs text-bolt-elements-textTertiary space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Create all necessary files for a complete project</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Include proper project structure and dependencies</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Write clean, well-documented code</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Ensure the project is ready to run</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Use modern best practices</span>
            </div>
          </div>
        </div>
      )}

      {/* Status Indicator */}
      <div className="flex items-center gap-2 text-xs text-bolt-elements-textTertiary">
        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
        <span>Agent is analyzing your request and will start creating files...</span>
      </div>
    </div>
  );
};

/**
 * Utility function to check if a message is an Agent mode message
 */
export const isAgentModeMessage = (content: string): boolean => {
  return content.includes('[AGENT MODE]') && content.includes('User Request:');
};

/**
 * Utility function to extract user request from Agent mode message
 */
export const extractUserRequest = (content: string): string | null => {
  const match = content.match(/User Request: (.*?)\n\nInstructions:/s);
  return match ? match[1].trim() : null;
};
