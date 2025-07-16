import { map } from 'nanostores';
import type { AgentState, ChatMode } from '~/types/actions';

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
});

export const agentStore = map<AgentState>({
  isActive: false,
  currentTask: undefined,
  taskHistory: [],
  isPaused: false,
  awaitingUserInput: false,
  userInputPrompt: undefined,
  mode: 'chat' as ChatMode,
});
