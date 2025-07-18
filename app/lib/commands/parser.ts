import type { ParsedCommand, AtCommandType, HashCommandType, HelpCommandType } from '~/types/commands';

/**
 * 聊天指令解析器
 */
export class CommandParser {
  /**
   * 解析输入的指令
   */
  static parse(input: string): ParsedCommand | null {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return null;
    }

    // @ 命令解析
    if (trimmedInput.startsWith('@')) {
      return this.parseAtCommand(trimmedInput);
    }

    // # 命令解析
    if (trimmedInput.startsWith('#')) {
      return this.parseHashCommand(trimmedInput);
    }

    // help 命令解析
    if (trimmedInput.toLowerCase().startsWith('help')) {
      return this.parseHelpCommand(trimmedInput);
    }

    return null;
  }

  /**
   * 解析 @ 命令
   * 格式：
   * @file <path> - 引用文件
   * @folder <path> - 引用文件夹
   * @search <query> - 搜索文件内容
   * @help - 显示帮助
   */
  private static parseAtCommand(input: string): ParsedCommand {
    const parts = input.slice(1).trim().split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    let data: AtCommandType;

    switch (command) {
      case 'file':
        data = {
          type: 'file',
          target: args.join(' '),
        };
        break;

      case 'folder':
        data = {
          type: 'folder',
          target: args.join(' '),
        };
        break;

      case 'search':
        data = {
          type: 'search',
          query: args.join(' '),
        };
        break;

      case 'help':
      case '':
        data = {
          type: 'help',
        };
        break;

      default:
        // 如果没有明确的子命令，尝试作为文件路径
        data = {
          type: 'file',
          target: input.slice(1).trim(),
        };
    }

    return {
      type: 'at',
      command,
      args,
      originalInput: input,
      data,
    };
  }

  /**
   * 解析 # 命令
   * 格式：
   * #file <path> - 添加文件到上下文
   * #folder <path> - 添加文件夹到上下文
   * #context list - 列出当前上下文
   * #context clear - 清空上下文
   * #help - 显示帮助
   */
  private static parseHashCommand(input: string): ParsedCommand {
    const parts = input.slice(1).trim().split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    let data: HashCommandType;

    switch (command) {
      case 'file':
        data = {
          type: 'file',
          target: args.join(' '),
          action: 'add',
        };
        break;

      case 'folder':
        data = {
          type: 'folder',
          target: args.join(' '),
          action: 'add',
        };
        break;

      case 'context': {
        const action = args[0]?.toLowerCase();

        if (action === 'clear') {
          data = {
            type: 'context',
            action: 'remove',
          };
        } else if (action === 'remove' && args[1]) {
          data = {
            type: 'context',
            action: 'remove',
            target: args.slice(1).join(' '),
          };
        } else {
          data = {
            type: 'context',
            action: 'list',
          };
        }

        break;
      }

      case 'help':
      case '':
        data = {
          type: 'help',
        };
        break;

      default:
        // 如果没有明确的子命令，尝试作为文件路径添加到上下文
        data = {
          type: 'file',
          target: input.slice(1).trim(),
          action: 'add',
        };
    }

    return {
      type: 'hash',
      command,
      args,
      originalInput: input,
      data,
    };
  }

  /**
   * 解析 help 命令
   * 格式：
   * help - 显示所有帮助
   * help @ - 显示 @ 命令帮助
   * help # - 显示 # 命令帮助
   * help <command> - 显示特定命令帮助
   */
  private static parseHelpCommand(input: string): ParsedCommand {
    const parts = input.trim().split(/\s+/);
    const args = parts.slice(1);

    let data: HelpCommandType;

    if (args.length === 0) {
      data = { category: 'all' };
    } else {
      const target = args[0];

      if (target === '@') {
        data = { category: 'at' };
      } else if (target === '#') {
        data = { category: 'hash' };
      } else {
        data = {
          category: 'general',
          command: target,
        };
      }
    }

    return {
      type: 'help',
      command: 'help',
      args,
      originalInput: input,
      data,
    };
  }

  /**
   * 检查输入是否包含指令
   */
  static hasCommand(input: string): boolean {
    const trimmed = input.trim();
    return trimmed.startsWith('@') || trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('help');
  }

  /**
   * 提取指令和普通文本
   */
  static extractCommands(input: string): { commands: ParsedCommand[]; text: string } {
    const lines = input.split('\n');
    const commands: ParsedCommand[] = [];
    const textLines: string[] = [];

    for (const line of lines) {
      const command = this.parse(line);

      if (command) {
        commands.push(command);
      } else {
        textLines.push(line);
      }
    }

    return {
      commands,
      text: textLines.join('\n').trim(),
    };
  }
}
