import React from 'react';
import { useStore } from '@nanostores/react';
import { agentStore } from '~/lib/stores/chat';
import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

interface AgentControlsProps {
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onSkipStep?: () => void;
  className?: string;
}

export const AgentControls: React.FC<AgentControlsProps> = ({ onPause, onResume, onStop, onSkipStep, className }) => {
  const agentState = useStore(agentStore);

  if (!agentState.isActive || !agentState.currentTask) {
    return null;
  }

  const { currentTask, isPaused } = agentState;
  const isRunning = currentTask.status === 'running';
  const canPause = isRunning && !isPaused;
  const canResume = isPaused;
  const canStop = isRunning || isPaused;
  const canSkip = isRunning && currentTask.currentStepIndex < currentTask.steps.length - 1;

  const handlePause = () => {
    onPause?.();
    agentStore.setKey('isPaused', true);
    toast.info('Agent task paused');
  };

  const handleResume = () => {
    onResume?.();
    agentStore.setKey('isPaused', false);
    toast.info('Agent task resumed');
  };

  const handleStop = () => {
    onStop?.();
    agentStore.setKey('isActive', false);
    agentStore.setKey('currentTask', undefined);
    agentStore.setKey('isPaused', false);
    toast.info('Agent task stopped');
  };

  const handleSkipStep = () => {
    if (currentTask && currentTask.currentStepIndex < currentTask.steps.length - 1) {
      const currentStep = currentTask.steps[currentTask.currentStepIndex];
      currentStep.status = 'skipped';
      currentTask.currentStepIndex += 1;

      agentStore.setKey('currentTask', { ...currentTask });
      onSkipStep?.();
      toast.info('Step skipped');
    }
  };

  return (
    <div
      className={classNames(
        'flex items-center gap-2 p-2 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor',
        className,
      )}
    >
      <div className="flex items-center gap-1 text-xs text-bolt-elements-textSecondary">
        <div className="i-ph:robot text-sm" />
        <span>Agent Controls:</span>
      </div>

      <div className="flex items-center gap-1">
        {canPause && (
          <IconButton
            title="Pause Agent"
            size="sm"
            className="text-yellow-600 hover:bg-yellow-100"
            onClick={handlePause}
          >
            <div className="i-ph:pause text-sm" />
          </IconButton>
        )}

        {canResume && (
          <IconButton
            title="Resume Agent"
            size="sm"
            className="text-green-600 hover:bg-green-100"
            onClick={handleResume}
          >
            <div className="i-ph:play text-sm" />
          </IconButton>
        )}

        {canSkip && (
          <IconButton
            title="Skip Current Step"
            size="sm"
            className="text-blue-600 hover:bg-blue-100"
            onClick={handleSkipStep}
          >
            <div className="i-ph:skip-forward text-sm" />
          </IconButton>
        )}

        {canStop && (
          <IconButton title="Stop Agent" size="sm" className="text-red-600 hover:bg-red-100" onClick={handleStop}>
            <div className="i-ph:stop text-sm" />
          </IconButton>
        )}
      </div>

      <div className="ml-auto text-xs text-bolt-elements-textTertiary">
        Step {currentTask.currentStepIndex + 1} of {currentTask.steps.length}
      </div>
    </div>
  );
};

export default AgentControls;
