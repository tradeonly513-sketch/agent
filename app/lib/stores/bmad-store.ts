import { map } from 'nanostores';
import type { BmadState, BmadAgentConfig, BmadExecutionContext } from '~/types/bmad';

// BMad Store for managing agent state
export const bmadStore = map<BmadState>({
  isActive: false,
  currentAgent: undefined,
  availableAgents: [],
  executionContext: undefined,
  commandHistory: [],
  mode: 'interactive',
});

// Helper functions for BMad store
export const bmadActions = {
  /**
   * Activate BMad system
   */
  activate() {
    bmadStore.setKey('isActive', true);
  },

  /**
   * Deactivate BMad system
   */
  deactivate() {
    bmadStore.setKey('isActive', false);
    bmadStore.setKey('currentAgent', undefined);
    bmadStore.setKey('executionContext', undefined);
  },

  /**
   * Set current agent
   */
  setCurrentAgent(agent: BmadAgentConfig) {
    bmadStore.setKey('currentAgent', agent);
  },

  /**
   * Clear current agent
   */
  clearCurrentAgent() {
    bmadStore.setKey('currentAgent', undefined);
    bmadStore.setKey('executionContext', undefined);
  },

  /**
   * Set available agents
   */
  setAvailableAgents(agents: BmadAgentConfig[]) {
    bmadStore.setKey('availableAgents', agents);
  },

  /**
   * Set execution context
   */
  setExecutionContext(context: BmadExecutionContext) {
    bmadStore.setKey('executionContext', context);
  },

  /**
   * Update execution context
   */
  updateExecutionContext(updates: Partial<BmadExecutionContext>) {
    const current = bmadStore.get().executionContext;

    if (current) {
      bmadStore.setKey('executionContext', { ...current, ...updates });
    }
  },

  /**
   * Add command to history
   */
  addCommandToHistory(command: string) {
    const current = bmadStore.get().commandHistory;
    bmadStore.setKey('commandHistory', [...current, command]);
  },

  /**
   * Clear command history
   */
  clearCommandHistory() {
    bmadStore.setKey('commandHistory', []);
  },

  /**
   * Toggle mode between interactive and yolo
   */
  toggleMode() {
    const current = bmadStore.get().mode;
    bmadStore.setKey('mode', current === 'interactive' ? 'yolo' : 'interactive');
  },

  /**
   * Set mode
   */
  setMode(mode: 'interactive' | 'yolo') {
    bmadStore.setKey('mode', mode);
  },

  /**
   * Get current agent
   */
  getCurrentAgent(): BmadAgentConfig | undefined {
    return bmadStore.get().currentAgent;
  },

  /**
   * Get execution context
   */
  getExecutionContext(): BmadExecutionContext | undefined {
    return bmadStore.get().executionContext;
  },

  /**
   * Check if BMad is active
   */
  isActive(): boolean {
    return bmadStore.get().isActive;
  },

  /**
   * Check if agent is currently active
   */
  hasActiveAgent(): boolean {
    return !!bmadStore.get().currentAgent;
  },

  /**
   * Get available agents
   */
  getAvailableAgents(): BmadAgentConfig[] {
    return bmadStore.get().availableAgents;
  },

  /**
   * Find agent by ID
   */
  findAgentById(id: string): BmadAgentConfig | undefined {
    return bmadStore.get().availableAgents.find((agent) => agent.agent.id === id);
  },

  /**
   * Get command history
   */
  getCommandHistory(): string[] {
    return bmadStore.get().commandHistory;
  },

  /**
   * Get current mode
   */
  getMode(): 'interactive' | 'yolo' {
    return bmadStore.get().mode;
  },
};
