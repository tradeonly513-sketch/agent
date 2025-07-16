import type { Change } from 'diff';

export type ActionType = 'file' | 'shell' | 'supabase';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export interface StartAction extends BaseAction {
  type: 'start';
}

export interface BuildAction extends BaseAction {
  type: 'build';
}

export interface SupabaseAction extends BaseAction {
  type: 'supabase';
  operation: 'migration' | 'query';
  filePath?: string;
  projectId?: string;
}

export type BoltAction = FileAction | ShellAction | StartAction | BuildAction | SupabaseAction;

export type BoltActionData = BoltAction | BaseAction;

export interface ActionAlert {
  type: string;
  title: string;
  description: string;
  content: string;
  source?: 'terminal' | 'preview'; // Add source to differentiate between terminal and preview errors
}

export interface SupabaseAlert {
  type: string;
  title: string;
  description: string;
  content: string;
  source?: 'supabase';
}

export interface DeployAlert {
  type: 'success' | 'error' | 'info';
  title: string;
  description: string;
  content?: string;
  url?: string;
  stage?: 'building' | 'deploying' | 'complete';
  buildStatus?: 'pending' | 'running' | 'complete' | 'failed';
  deployStatus?: 'pending' | 'running' | 'complete' | 'failed';
  source?: 'vercel' | 'netlify' | 'github';
}

export interface LlmErrorAlertType {
  type: 'error' | 'warning';
  title: string;
  description: string;
  content?: string;
  provider?: string;
  errorType?: 'authentication' | 'rate_limit' | 'quota' | 'network' | 'unknown';
}

export interface FileHistory {
  originalContent: string;
  lastModified: number;
  changes: Change[];
  versions: {
    timestamp: number;
    content: string;
  }[];

  // Novo campo para rastrear a origem das mudanças
  changeSource?: 'user' | 'auto-save' | 'external';
}

// Agent mode types
export type ChatMode = 'chat' | 'agent';

export interface AgentStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  timestamp: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  steps: AgentStep[];
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
  context?: Record<string, any>;
}

export interface AgentState {
  isActive: boolean;
  currentTask?: AgentTask;
  taskHistory: AgentTask[];
  isPaused: boolean;
  awaitingUserInput: boolean;
  userInputPrompt?: string;
  mode: ChatMode;
}
