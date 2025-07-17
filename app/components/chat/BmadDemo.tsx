import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { bmadStore, bmadActions } from '~/lib/stores/bmad-store';
import { BmadExecutor } from '~/lib/agent/bmad-executor';
import { toast } from 'react-toastify';


interface BmadDemoProps {
  className?: string;
}

export const BmadDemo: React.FC<BmadDemoProps> = ({ className }) => {
  const bmadState = useStore(bmadStore);
  const [executor, setExecutor] = useState<BmadExecutor | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const bmadExecutor = new BmadExecutor({
      onAgentActivated: (agent) => {
        addOutput(`🎭 Agent activated: ${agent.agent.name} (${agent.agent.title})`);
        toast.success(`Agent ${agent.agent.name} activated`);
      },
      onTaskStarted: (task) => {
        addOutput(`📋 Task started: ${task.title}`);
      },
      onTaskCompleted: (task) => {
        addOutput(`✅ Task completed: ${task.title}`);
      },
      onUserInputRequired: async (prompt) => {
        const userInput = window.prompt(prompt);
        return userInput || '';
      },
      onOutput: (message) => {
        addOutput(message);
      },
      onError: (error) => {
        addOutput(`❌ Error: ${error.message}`);
        toast.error(`BMad error: ${error.message}`);
      },
    });

    setExecutor(bmadExecutor);
    bmadExecutor.initialize().catch(console.error);
  }, []);

  const addOutput = (message: string) => {
    setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !executor) {
      return;
    }

    addOutput(`> ${input}`);

    try {
      await executor.executeCommand(input);
    } catch (error) {
      addOutput(`❌ Error: ${error}`);
    }

    setInput('');
  };

  const handleActivateBmad = () => {
    bmadActions.activate();
    addOutput('🎭 BMad system activated');
    toast.success('BMad system activated');
  };

  const handleDeactivateBmad = () => {
    bmadActions.deactivate();
    addOutput('🔴 BMad system deactivated');
    toast.info('BMad system deactivated');
  };

  const quickCommands = [
    { label: 'Help', command: '*help' },
    { label: 'List Agents', command: '*agent' },
    { label: 'Status', command: '*status' },
    { label: 'Activate Orchestrator', command: '*agent bmad-orchestrator' },
    { label: 'Activate Dev', command: '*agent dev' },
    { label: 'Exit Agent', command: '*exit' },
    { label: 'Toggle YOLO', command: '*yolo' },
  ];

  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🎭 BMad System Demo</h3>
        <div className="flex gap-2">
          {!bmadState.isActive ? (
            <button
              onClick={handleActivateBmad}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Activate BMad
            </button>
          ) : (
            <button
              onClick={handleDeactivateBmad}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            >
              Deactivate BMad
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded">
        <div className="text-sm">
          <div>
            <strong>Status:</strong> {bmadState.isActive ? '🟢 Active' : '🔴 Inactive'}
          </div>
          <div>
            <strong>Mode:</strong> {bmadState.mode.toUpperCase()}
          </div>
          {bmadState.currentAgent && (
            <div>
              <strong>Current Agent:</strong> {bmadState.currentAgent.agent.icon} {bmadState.currentAgent.agent.name}
            </div>
          )}
          <div>
            <strong>Available Agents:</strong> {bmadState.availableAgents.length}
          </div>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">Quick Commands:</div>
        <div className="flex flex-wrap gap-2">
          {quickCommands.map((cmd, index) => (
            <button
              key={index}
              onClick={() => setInput(cmd.command)}
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600"
              disabled={!bmadState.isActive}
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Output */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">Output:</div>
        <div className="h-64 overflow-y-auto bg-black text-green-400 p-3 rounded font-mono text-xs">
          {output.length === 0 ? (
            <div className="text-gray-500">No output yet. Try activating BMad and running some commands.</div>
          ) : (
            output.map((line, index) => (
              <div key={index} className="mb-1">
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter BMad command (e.g., *help, *agent, *status)..."
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          disabled={!bmadState.isActive}
        />
        <button
          type="submit"
          disabled={!input.trim() || !bmadState.isActive}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
        >
          Send
        </button>
      </form>

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <div>
          <strong>BMad Commands:</strong>
        </div>
        <div>• Commands start with * (asterisk)</div>
        <div>• *help - Show available commands</div>
        <div>• *agent [name] - Activate an agent</div>
        <div>• *status - Show current status</div>
        <div>• *exit - Exit current agent</div>
        <div>• *yolo - Toggle YOLO mode</div>
      </div>
    </div>
  );
};

export default BmadDemo;
