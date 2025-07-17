import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { CommandParser } from '~/lib/commands/parser';
import { CommandExecutor } from '~/lib/commands/executor';
import type { CommandContext, CommandResult, ParsedCommand } from '~/types/commands';
import { workbenchStore } from '~/lib/stores/workbench';

export interface UseCommandProcessorOptions {
  workingDirectory?: string;
  onCommandExecuted?: (result: CommandResult) => void;
  onInputModified?: (newInput: string) => void;
}

export interface UseCommandProcessorReturn {
  processInput: (input: string) => Promise<{
    shouldContinue: boolean;
    modifiedInput?: string;
    commands: ParsedCommand[];
  }>;
  isProcessing: boolean;
  lastResult: CommandResult | null;
  getContextFiles: () => Array<{ path: string; content: string }>;
  clearContext: () => void;
}

/**
 * 处理聊天指令的钩子
 */
export function useCommandProcessor(options: UseCommandProcessorOptions = {}): UseCommandProcessorReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  const {
    workingDirectory = '/home/project',
    onCommandExecuted,
    onInputModified
  } = options;

  /**
   * 处理输入文本中的指令
   */
  const processInput = useCallback(async (input: string): Promise<{
    shouldContinue: boolean;
    modifiedInput?: string;
    commands: ParsedCommand[];
  }> => {
    if (!input.trim()) {
      return { shouldContinue: true, commands: [] };
    }

    setIsProcessing(true);

    try {
      // 提取指令和普通文本
      const { commands, text } = CommandParser.extractCommands(input);

      if (commands.length === 0) {
        return { shouldContinue: true, commands: [] };
      }

      // 构建命令执行上下文
      const context: CommandContext = {
        input: input,
        files: workbenchStore.files.get(),
        selectedFile: workbenchStore.selectedFile.get(),
        workingDirectory
      };

      let modifiedInput = text;
      let shouldContinueChat = true;
      const results: CommandResult[] = [];

      // 执行所有指令
      for (const command of commands) {
        try {
          const result = await CommandExecutor.execute(command, context);
          results.push(result);
          setLastResult(result);

          // 处理执行结果
          if (!result.success) {
            toast.error(result.message || 'Command execution failed');
            continue;
          }

          // 如果指令修改了输入内容，添加到修改后的输入中
          if (result.modifiedInput) {
            modifiedInput = modifiedInput ? 
              `${modifiedInput}\n${result.modifiedInput}` : 
              result.modifiedInput;
          }

          // 如果指令要求不继续聊天流程
          if (result.shouldContinue === false) {
            shouldContinueChat = false;
          }

          // 显示成功消息（如果有）
          if (result.message && result.shouldContinue !== false) {
            // 对于引用类命令，不显示toast，因为内容已经添加到输入中
            if (!result.modifiedInput) {
              toast.success(result.message);
            }
          }

          // 调用回调
          onCommandExecuted?.(result);

        } catch (error) {
          console.error('Command execution error:', error);
          toast.error(`Command execution failed: ${error}`);
        }
      }

      // 如果输入被修改，通知调用者
      if (modifiedInput !== text) {
        onInputModified?.(modifiedInput);
      }

      return {
        shouldContinue: shouldContinueChat,
        modifiedInput: modifiedInput !== text ? modifiedInput : undefined,
        commands
      };

    } catch (error) {
      console.error('Command processing error:', error);
      toast.error('Failed to process commands');
      return { shouldContinue: true, commands: [] };
    } finally {
      setIsProcessing(false);
    }
  }, [workingDirectory, onCommandExecuted, onInputModified]);

  /**
   * 获取当前上下文文件
   */
  const getContextFiles = useCallback(() => {
    return CommandExecutor.getContextFiles().map(file => ({
      path: file.path,
      content: file.content
    }));
  }, []);

  /**
   * 清空上下文
   */
  const clearContext = useCallback(() => {
    const context: CommandContext = {
      input: '',
      files: workbenchStore.files.get(),
      workingDirectory
    };

    CommandExecutor.execute({
      type: 'hash',
      command: 'context',
      args: ['clear'],
      originalInput: '#context clear',
      data: { type: 'context', action: 'remove' }
    }, context);
  }, [workingDirectory]);

  return {
    processInput,
    isProcessing,
    lastResult,
    getContextFiles,
    clearContext
  };
}

/**
 * 检查输入是否包含指令
 */
export function hasCommands(input: string): boolean {
  return CommandParser.hasCommand(input);
}

/**
 * 解析单个指令
 */
export function parseCommand(input: string): ParsedCommand | null {
  return CommandParser.parse(input);
}

/**
 * 获取指令建议
 */
export function getCommandSuggestions(input: string): Array<{
  command: string;
  description: string;
  example: string;
}> {
  const suggestions = [];

  if (input.startsWith('@')) {
    suggestions.push(
      {
        command: '@file <path>',
        description: 'Reference a specific file',
        example: '@file src/App.tsx'
      },
      {
        command: '@folder <path>',
        description: 'Reference all files in a folder',
        example: '@folder src/components'
      },
      {
        command: '@search <query>',
        description: 'Search for text in files',
        example: '@search "useState"'
      },
      {
        command: '@help',
        description: 'Show @ command help',
        example: '@help'
      }
    );
  } else if (input.startsWith('#')) {
    suggestions.push(
      {
        command: '#file <path>',
        description: 'Add file to conversation context',
        example: '#file src/utils.ts'
      },
      {
        command: '#folder <path>',
        description: 'Add folder to conversation context',
        example: '#folder src/hooks'
      },
      {
        command: '#context list',
        description: 'List current context files',
        example: '#context list'
      },
      {
        command: '#context clear',
        description: 'Clear all context files',
        example: '#context clear'
      },
      {
        command: '#help',
        description: 'Show # command help',
        example: '#help'
      }
    );
  } else if (input.toLowerCase().startsWith('help')) {
    suggestions.push(
      {
        command: 'help',
        description: 'Show all available commands',
        example: 'help'
      },
      {
        command: 'help @',
        description: 'Show @ command help',
        example: 'help @'
      },
      {
        command: 'help #',
        description: 'Show # command help',
        example: 'help #'
      }
    );
  }

  return suggestions;
}
