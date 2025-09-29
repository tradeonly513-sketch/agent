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
  operation: 'migration' | 'query' | 'project-create' | 'setup' | 'validate' | 'seed';
  filePath?: string;
  projectId?: string;
  organizationId?: string;
  name?: string;
  region?: string;
  plan?: string;
  dbPassword?: string;
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
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description: string;
  content?: string;
  source?: 'supabase';
  stage?: 'connecting' | 'creating' | 'initializing' | 'executing' | 'validating' | 'complete';
  queryStatus?: 'pending' | 'running' | 'complete' | 'failed';
  projectStatus?: 'creating' | 'initializing' | 'ready' | 'failed';
  operation?: 'migration' | 'query' | 'project-create' | 'setup' | 'validate' | 'seed';
  projectId?: string;
  projectUrl?: string;
  estimatedTime?: number; // in seconds
  progress?: number; // 0-100
  rollbackAvailable?: boolean;
  nextSteps?: string[];
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
  source?: 'vercel' | 'netlify' | 'github' | 'gitlab';
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
