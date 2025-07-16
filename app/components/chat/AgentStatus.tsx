import React from 'react';
import { useStore } from '@nanostores/react';
import { agentStore } from '~/lib/stores/chat';
import type { AgentStep } from '~/types/actions';
import { classNames } from '~/utils/classNames';

interface AgentStatusProps {
  className?: string;
}

export const AgentStatus: React.FC<AgentStatusProps> = ({ className }) => {
  const agentState = useStore(agentStore);

  if (!agentState.isActive || !agentState.currentTask) {
    return null;
  }

  const { currentTask, isPaused } = agentState;
  const completedSteps = currentTask.steps.filter(s => s.status === 'completed').length;
  const failedSteps = currentTask.steps.filter(s => s.status === 'failed').length;
  const totalSteps = currentTask.steps.length;

  return (
    <div
      className={classNames(
        'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-4 mb-4',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={classNames(
              'w-2 h-2 rounded-full',
              currentTask.status === 'running'
                ? 'bg-blue-500 animate-pulse'
                : currentTask.status === 'completed'
                  ? 'bg-green-500'
                  : currentTask.status === 'failed'
                    ? 'bg-red-500'
                    : currentTask.status === 'paused'
                      ? 'bg-yellow-500'
                      : 'bg-gray-500',
            )}
          />
          <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Agent Task: {currentTask.title}</h3>
          {isPaused && (
            <div className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
              <div className="i-ph:pause text-xs" />
              <span>Paused</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={classNames(
              'px-2 py-1 text-xs rounded-full',
              currentTask.status === 'running'
                ? 'bg-blue-100 text-blue-800'
                : currentTask.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : currentTask.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : currentTask.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800',
            )}
          >
            {currentTask.status.charAt(0).toUpperCase() + currentTask.status.slice(1)}
          </span>
          <span className="text-xs text-bolt-elements-textTertiary">
            {completedSteps}/{totalSteps} steps
            {failedSteps > 0 && <span className="text-red-600 ml-1">({failedSteps} failed)</span>}
          </span>
        </div>
      </div>

      <div className="text-xs text-bolt-elements-textSecondary mb-3">{currentTask.description}</div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-bolt-elements-textTertiary mb-1">
          <span>Progress</span>
          <span>{totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0}%</span>
        </div>
        <div className="w-full bg-bolt-elements-background-depth-1 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {currentTask.steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            isActive={index === currentTask.currentStepIndex}
            stepNumber={index + 1}
          />
        ))}
      </div>

      {agentState.awaitingUserInput && agentState.userInputPrompt && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:question text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">User Input Required</span>
          </div>
          <p className="text-sm text-yellow-700">{agentState.userInputPrompt}</p>
        </div>
      )}
    </div>
  );
};

interface StepItemProps {
  step: AgentStep;
  isActive: boolean;
  stepNumber: number;
}

const StepItem: React.FC<StepItemProps> = ({ step, isActive, stepNumber }) => {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <div className="i-ph:check-circle text-green-500" />;
      case 'running':
        return <div className="i-svg-spinners:90-ring-with-bg text-blue-500 animate-spin" />;
      case 'failed':
        return <div className="i-ph:x-circle text-red-500" />;
      case 'skipped':
        return <div className="i-ph:arrow-right text-gray-400" />;
      default:
        return <div className="i-ph:circle text-gray-400" />;
    }
  };

  return (
    <div
      className={classNames(
        'flex items-start gap-3 p-2 rounded-lg transition-colors',
        isActive
          ? 'bg-bolt-elements-background-depth-3 border border-bolt-elements-focus'
          : 'hover:bg-bolt-elements-background-depth-1',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-bolt-elements-textTertiary font-mono">
          {stepNumber.toString().padStart(2, '0')}
        </span>
        {getStatusIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4
            className={classNames(
              'text-sm font-medium truncate',
              step.status === 'completed'
                ? 'text-bolt-elements-textPrimary'
                : step.status === 'running'
                  ? 'text-blue-600'
                  : step.status === 'failed'
                    ? 'text-red-600'
                    : 'text-bolt-elements-textSecondary',
            )}
          >
            {step.title}
          </h4>
        </div>

        <p className="text-xs text-bolt-elements-textTertiary mt-1">{step.description}</p>

        {step.output && (
          <div className="mt-2 p-2 bg-bolt-elements-background-depth-1 rounded text-xs text-bolt-elements-textSecondary">
            {step.output}
          </div>
        )}

        {step.error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            Error: {step.error}
          </div>
        )}

        {step.toolCalls && step.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {step.toolCalls.map((toolCall) => (
              <div key={toolCall.id} className="flex items-center gap-2 text-xs">
                <div className="i-ph:wrench text-bolt-elements-textTertiary" />
                <span className="text-bolt-elements-textTertiary">{toolCall.name}</span>
                {toolCall.error ? (
                  <span className="text-red-600">Failed</span>
                ) : toolCall.result ? (
                  <span className="text-green-600">Success</span>
                ) : (
                  <span className="text-yellow-600">Running</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentStatus;
