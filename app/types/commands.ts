/**
 * 聊天指令系统类型定义
 */

export interface CommandContext {
  input: string;
  files: Record<string, any>;
  selectedFile?: string;
  workingDirectory: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  shouldContinue?: boolean; // 是否继续正常的聊天流程
  modifiedInput?: string; // 修改后的输入内容
}

export interface FileReference {
  path: string;
  content: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: Date;
}

export interface CommandHandler {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  handler: (args: string[], context: CommandContext) => Promise<CommandResult>;
}

export interface CommandRegistry {
  [key: string]: CommandHandler;
}

// @ 命令类型
export interface AtCommandType {
  type: 'file' | 'folder' | 'search' | 'help';
  target?: string;
  query?: string;
}

// # 命令类型
export interface HashCommandType {
  type: 'file' | 'folder' | 'context' | 'help';
  target?: string;
  action?: 'add' | 'remove' | 'list';
}

// help 命令类型
export interface HelpCommandType {
  category?: 'all' | 'at' | 'hash' | 'general';
  command?: string;
}

export interface ParsedCommand {
  type: 'at' | 'hash' | 'help' | 'unknown';
  command: string;
  args: string[];
  originalInput: string;
  data?: AtCommandType | HashCommandType | HelpCommandType;
}

export interface CommandSuggestion {
  command: string;
  description: string;
  example: string;
}

export interface FileSearchResult {
  path: string;
  content: string;
  matches: Array<{
    line: number;
    text: string;
    start: number;
    end: number;
  }>;
}

export interface CommandAutoComplete {
  suggestions: CommandSuggestion[];
  files: string[];
  folders: string[];
}
