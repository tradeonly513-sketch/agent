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
    <div className="space-y-2">
      {/* Mini Agent Mode Indicator */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-xs">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
        <span className="font-medium text-blue-700">🤖 Agent</span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={classNames(
            "ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors",
            isExpanded
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
              : "text-blue-500 hover:text-blue-700 hover:bg-blue-100"
          )}
        >
          <div className={classNames(
            "transition-transform duration-200 text-xs",
            isExpanded ? "rotate-180" : "rotate-0"
          )}>
            ▼
          </div>
        </button>
      </div>

      {/* User Request Display */}
      {extractedUserRequest && (
        <div className="p-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded">
          <div className="text-xs font-medium text-bolt-elements-textSecondary mb-1 flex items-center gap-1">
            <span>📝</span>
            <span>Request:</span>
          </div>
          <div className="text-sm text-bolt-elements-textPrimary bg-bolt-elements-background-depth-1 p-2 rounded border-l-2 border-blue-400">
            {extractedUserRequest}
          </div>
        </div>
      )}

      {/* Collapsible System Prompt */}
      {isExpanded && (
        <div className="p-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded">
          <div className="text-xs font-medium text-bolt-elements-textSecondary mb-2 flex items-center gap-1">
            <span>⚙️</span>
            <span>Instructions:</span>
          </div>
          <div className="text-xs text-bolt-elements-textTertiary space-y-1">
            <div className="flex items-start gap-1.5">
              <span className="text-green-500 mt-0.5 text-xs">•</span>
              <span>Create complete project files</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-green-500 mt-0.5 text-xs">•</span>
              <span>Include proper structure & dependencies</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-green-500 mt-0.5 text-xs">•</span>
              <span>Write clean, documented code</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-green-500 mt-0.5 text-xs">•</span>
              <span>Ensure project is ready to run</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-green-500 mt-0.5 text-xs">•</span>
              <span>Use modern best practices</span>
            </div>
          </div>
        </div>
      )}

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
