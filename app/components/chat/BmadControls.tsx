import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { bmadStore, bmadActions } from '~/lib/stores/bmad-store';
import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import type { BmadAgentConfig } from '~/types/bmad';

interface BmadControlsProps {
  onOutput?: (message: string) => void;
  onAgentChange?: (agent: BmadAgentConfig | null) => void;
  className?: string;
}

export const BmadControls: React.FC<BmadControlsProps> = ({ onOutput, onAgentChange, className }) => {
  const bmadState = useStore(bmadStore);
  const [showAgentSelector, setShowAgentSelector] = useState(false);

  const handleActivateBmad = () => {
    bmadActions.activate();
    onOutput?.('BMad system activated. Type *help for available commands.');
    toast.success('BMad system activated');
  };

  const handleDeactivateBmad = () => {
    bmadActions.deactivate();
    onOutput?.('BMad system deactivated.');
    onAgentChange?.(null);
    toast.info('BMad system deactivated');
  };

  const handleAgentSelect = (agent: BmadAgentConfig) => {
    bmadActions.setCurrentAgent(agent);
    onAgentChange?.(agent);
    setShowAgentSelector(false);

    const greeting = `${agent.agent.icon} ${agent.agent.name} activated!\n\nRole: ${agent.persona.role}\nFocus: ${agent.persona.focus}\n\nType *help for available commands.`;
    onOutput?.(greeting);
    toast.success(`Agent ${agent.agent.name} activated`);
  };

  const handleClearAgent = () => {
    const currentAgent = bmadState.currentAgent;
    bmadActions.clearCurrentAgent();
    onAgentChange?.(null);

    if (currentAgent) {
      onOutput?.(` Goodbye from ${currentAgent.agent.name}! Agent deactivated.`);
      toast.info(`Agent ${currentAgent.agent.name} deactivated`);
    }
  };

  const handleToggleMode = () => {
    bmadActions.toggleMode();

    const newMode = bmadActions.getMode();
    onOutput?.(` Mode switched to: ${newMode.toUpperCase()}`);
    toast.info(`Mode: ${newMode}`);
  };

  if (!bmadState.isActive) {
    return (
      <div className={classNames('flex items-center gap-2', className)}>
        <IconButton
          onClick={handleActivateBmad}
          title="Activate BMad System"
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          🎭
        </IconButton>
        <span className="text-sm text-gray-500">BMad System (Inactive)</span>
      </div>
    );
  }

  return (
    <div className={classNames('flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg', className)}>
      {/* BMad Status */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">🎭 BMad Active</span>

        {bmadState.currentAgent && (
          <div className="flex items-center gap-1">
            <span className="text-lg">{bmadState.currentAgent.agent.icon}</span>
            <span className="text-sm font-medium">{bmadState.currentAgent.agent.name}</span>
          </div>
        )}
      </div>

      {/* Mode Indicator */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Mode:</span>
        <button
          onClick={handleToggleMode}
          className={classNames(
            'px-2 py-1 text-xs rounded',
            bmadState.mode === 'yolo' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white',
          )}
        >
          {bmadState.mode.toUpperCase()}
        </button>
      </div>

      {/* Agent Controls */}
      <div className="flex items-center gap-1">
        {!bmadState.currentAgent ? (
          <div className="relative">
            <IconButton
              onClick={() => setShowAgentSelector(!showAgentSelector)}
              title="Select Agent"
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              👤
            </IconButton>

            {showAgentSelector && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-64">
                <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-medium">Select Agent</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {bmadState.availableAgents.map((agent) => (
                    <button
                      key={agent.agent.id}
                      onClick={() => handleAgentSelect(agent)}
                      className="w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{agent.agent.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{agent.agent.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{agent.agent.whenToUse}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <IconButton onClick={handleClearAgent} title="Clear Agent" className="bg-red-500 hover:bg-red-600 text-white">
            ❌
          </IconButton>
        )}
      </div>

      {/* System Controls */}
      <div className="flex items-center gap-1 ml-auto">
        <IconButton
          onClick={() =>
            onOutput?.(
              '=== BMad Status ===\n' +
                `Mode: ${bmadState.mode}\n` +
                `Agent: ${bmadState.currentAgent?.agent.name || 'None'}\n` +
                `Commands: Type *help for available commands`,
            )
          }
          title="Show Status"
          className="bg-gray-500 hover:bg-gray-600 text-white"
        >
          ℹ️
        </IconButton>

        <IconButton
          onClick={handleDeactivateBmad}
          title="Deactivate BMad"
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          🔴
        </IconButton>
      </div>
    </div>
  );
};

export default BmadControls;
