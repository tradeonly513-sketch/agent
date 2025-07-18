// see https://docs.anthropic.com/en/docs/about-claude/models
export const MAX_TOKENS = 8000;

// limits the number of model responses that can be returned in a single request
export const MAX_RESPONSE_SEGMENTS = 2;

// Context window management constants
export const DEFAULT_MAX_CONTEXT_TOKENS = 65536; // Default context window size
export const CONTEXT_BUFFER_TOKENS = 2000; // Buffer to ensure we don't exceed limits
export const MIN_COMPLETION_TOKENS = 4000; // Minimum tokens reserved for completion
export const SYSTEM_PROMPT_BUFFER = 2000; // Buffer for system prompt tokens

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  isLocked?: boolean;
  lockedByFolder?: string;
}

export interface Folder {
  type: 'folder';
  isLocked?: boolean;
  lockedByFolder?: string;
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

export const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
  '**/*lock.json',
  '**/*lock.yml',
];
