import type {
  ParsedCommand,
  CommandResult,
  CommandContext,
  FileReference,
  AtCommandType,
  HashCommandType,
  HelpCommandType
} from '~/types/commands';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';

/**
 * 指令执行器
 */
export class CommandExecutor {
  private static contextFiles: Map<string, FileReference> = new Map();

  /**
   * 执行解析后的指令
   */
  static async execute(command: ParsedCommand, context: CommandContext): Promise<CommandResult> {
    try {
      switch (command.type) {
        case 'at':
          return await this.executeAtCommand(command.data as AtCommandType, context);

        case 'hash':
          return await this.executeHashCommand(command.data as HashCommandType, context);

        case 'help':
          return await this.executeHelpCommand(command.data as HelpCommandType, context);

        default:
          return {
            success: false,
            message: `Unknown command type: ${command.type}`
          };
      }
    } catch (error) {
      console.error('Command execution error:', error);
      return {
        success: false,
        message: `Command execution failed: ${error}`
      };
    }
  }

  /**
   * 执行 @ 命令
   */
  private static async executeAtCommand(data: AtCommandType, context: CommandContext): Promise<CommandResult> {
    switch (data.type) {
      case 'file':
        return await this.handleFileReference(data.target!, context);

      case 'folder':
        return await this.handleFolderReference(data.target!, context);

      case 'search':
        return await this.handleFileSearch(data.query!, context);

      case 'help':
        return this.showAtCommandHelp();

      default:
        return {
          success: false,
          message: 'Invalid @ command'
        };
    }
  }

  /**
   * 执行 # 命令
   */
  private static async executeHashCommand(data: HashCommandType, context: CommandContext): Promise<CommandResult> {
    switch (data.type) {
      case 'file':
        return await this.addFileToContext(data.target!, context);

      case 'folder':
        return await this.addFolderToContext(data.target!, context);

      case 'context':
        if (data.action === 'remove') {
          if (data.target) {
            return this.removeFileFromContext(data.target);
          } else {
            return this.clearContext();
          }
        } else {
          return this.listContext();
        }

      case 'help':
        return this.showHashCommandHelp();

      default:
        return {
          success: false,
          message: 'Invalid # command'
        };
    }
  }

  /**
   * 执行 help 命令
   */
  private static async executeHelpCommand(data: HelpCommandType, context: CommandContext): Promise<CommandResult> {
    switch (data.category) {
      case 'at':
        return this.showAtCommandHelp();

      case 'hash':
        return this.showHashCommandHelp();

      case 'all':
      default:
        return this.showGeneralHelp();
    }
  }

  /**
   * 处理文件引用
   */
  private static async handleFileReference(filePath: string, context: CommandContext): Promise<CommandResult> {
    try {
      // 规范化文件路径
      const normalizedPath = this.normalizePath(filePath, context.workingDirectory);

      // 从工作区获取文件
      const file = workbenchStore.files.get()[normalizedPath];

      if (!file || file.type !== 'file') {
        return {
          success: false,
          message: `File not found: ${filePath}`
        };
      }

      // 选择文件在编辑器中显示
      workbenchStore.setSelectedFile(normalizedPath);

      // 构建文件内容引用
      const fileContent = `\n\n**File: ${filePath}**\n\`\`\`${this.getFileExtension(filePath)}\n${file.content}\n\`\`\`\n\n`;

      toast.success(`Referenced file: ${filePath}`);

      return {
        success: true,
        message: `File referenced: ${filePath}`,
        data: { filePath: normalizedPath, content: file.content },
        shouldContinue: true,
        modifiedInput: fileContent
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reference file: ${error}`
      };
    }
  }

  /**
   * 处理文件夹引用
   */
  private static async handleFolderReference(folderPath: string, context: CommandContext): Promise<CommandResult> {
    try {
      const normalizedPath = this.normalizePath(folderPath, context.workingDirectory);
      const files = workbenchStore.files.get();

      // 查找文件夹下的所有文件
      const folderFiles = Object.entries(files)
        .filter(([path, file]) =>
          path.startsWith(normalizedPath) &&
          file?.type === 'file' &&
          !this.isIgnoredFile(path)
        )
        .slice(0, 20); // 限制文件数量

      if (folderFiles.length === 0) {
        return {
          success: false,
          message: `No files found in folder: ${folderPath}`
        };
      }

      // 构建文件夹内容引用
      let folderContent = `\n\n**Folder: ${folderPath}**\n`;

      for (const [path, file] of folderFiles) {
        if (file && file.type === 'file') {
          const relativePath = path.replace(normalizedPath, '').replace(/^\//, '');
          folderContent += `\n**File: ${relativePath}**\n\`\`\`${this.getFileExtension(path)}\n${file.content}\n\`\`\`\n`;
        }
      }

      folderContent += '\n';

      toast.success(`Referenced folder: ${folderPath} (${folderFiles.length} files)`);

      return {
        success: true,
        message: `Folder referenced: ${folderPath} (${folderFiles.length} files)`,
        shouldContinue: true,
        modifiedInput: folderContent
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reference folder: ${error}`
      };
    }
  }

  /**
   * 处理文件搜索
   */
  private static async handleFileSearch(query: string, context: CommandContext): Promise<CommandResult> {
    try {
      const files = workbenchStore.files.get();
      const searchResults: Array<{ path: string; content: string; matches: number }> = [];

      // 搜索文件内容
      for (const [path, file] of Object.entries(files)) {
        if (file?.type === 'file' && !this.isIgnoredFile(path)) {
          const content = file.content.toLowerCase();
          const queryLower = query.toLowerCase();

          if (content.includes(queryLower)) {
            const matches = (content.match(new RegExp(queryLower, 'g')) || []).length;
            searchResults.push({ path, content: file.content, matches });
          }
        }
      }

      if (searchResults.length === 0) {
        return {
          success: false,
          message: `No files found containing: "${query}"`
        };
      }

      // 按匹配数量排序，取前10个结果
      searchResults.sort((a, b) => b.matches - a.matches);
      const topResults = searchResults.slice(0, 10);

      // 构建搜索结果
      let searchContent = `\n\n**Search Results for: "${query}"**\n`;

      for (const result of topResults) {
        searchContent += `\n**File: ${result.path}** (${result.matches} matches)\n`;

        // 显示包含搜索词的行
        const lines = result.content.split('\n');
        const matchingLines = lines
          .map((line, index) => ({ line, number: index + 1 }))
          .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 3); // 每个文件最多显示3行

        for (const { line, number } of matchingLines) {
          searchContent += `Line ${number}: ${line.trim()}\n`;
        }
        searchContent += '\n';
      }

      toast.success(`Found ${searchResults.length} files containing "${query}"`);

      return {
        success: true,
        message: `Search completed: ${searchResults.length} files found`,
        shouldContinue: true,
        modifiedInput: searchContent
      };
    } catch (error) {
      return {
        success: false,
        message: `Search failed: ${error}`
      };
    }
  }

  /**
   * 添加文件到上下文
   */
  private static async addFileToContext(filePath: string, context: CommandContext): Promise<CommandResult> {
    try {
      const normalizedPath = this.normalizePath(filePath, context.workingDirectory);
      const file = workbenchStore.files.get()[normalizedPath];

      if (!file || file.type !== 'file') {
        return {
          success: false,
          message: `File not found: ${filePath}`
        };
      }

      const fileRef: FileReference = {
        path: normalizedPath,
        content: file.content,
        type: 'file',
        size: file.content.length,
        lastModified: new Date()
      };

      this.contextFiles.set(normalizedPath, fileRef);

      toast.success(`Added to context: ${filePath}`);

      return {
        success: true,
        message: `File added to context: ${filePath}`,
        shouldContinue: false
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add file to context: ${error}`
      };
    }
  }

  /**
   * 添加文件夹到上下文
   */
  private static async addFolderToContext(folderPath: string, context: CommandContext): Promise<CommandResult> {
    try {
      const normalizedPath = this.normalizePath(folderPath, context.workingDirectory);
      const files = workbenchStore.files.get();

      const folderFiles = Object.entries(files)
        .filter(([path, file]) =>
          path.startsWith(normalizedPath) &&
          file?.type === 'file' &&
          !this.isIgnoredFile(path)
        );

      if (folderFiles.length === 0) {
        return {
          success: false,
          message: `No files found in folder: ${folderPath}`
        };
      }

      let addedCount = 0;
      for (const [path, file] of folderFiles) {
        if (file && file.type === 'file') {
          const fileRef: FileReference = {
            path,
            content: file.content,
            type: 'file',
            size: file.content.length,
            lastModified: new Date()
          };

          this.contextFiles.set(path, fileRef);
          addedCount++;
        }
      }

      toast.success(`Added ${addedCount} files from ${folderPath} to context`);

      return {
        success: true,
        message: `Added ${addedCount} files from folder to context: ${folderPath}`,
        shouldContinue: false
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add folder to context: ${error}`
      };
    }
  }

  /**
   * 列出当前上下文
   */
  private static listContext(): CommandResult {
    if (this.contextFiles.size === 0) {
      return {
        success: true,
        message: 'Context is empty',
        shouldContinue: false
      };
    }

    const contextList = Array.from(this.contextFiles.values())
      .map(file => `- ${file.path} (${file.size} chars)`)
      .join('\n');

    const message = `Current context (${this.contextFiles.size} files):\n${contextList}`;

    toast.info(`Context contains ${this.contextFiles.size} files`);

    return {
      success: true,
      message,
      shouldContinue: false
    };
  }

  /**
   * 从上下文中移除单个文件
   */
  private static removeFileFromContext(filePath: string): CommandResult {
    const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;

    // 尝试多种路径格式
    const possiblePaths = [
      filePath,
      normalizedPath,
      filePath.replace(/^\/+/, ''),
      `/home/project/${filePath.replace(/^\/+/, '')}`
    ];

    let removed = false;
    let removedPath = '';

    for (const path of possiblePaths) {
      if (this.contextFiles.has(path)) {
        this.contextFiles.delete(path);
        removed = true;
        removedPath = path;
        break;
      }
    }

    if (!removed) {
      return {
        success: false,
        message: `File not found in context: ${filePath}`
      };
    }

    toast.success(`Removed from context: ${removedPath}`);

    return {
      success: true,
      message: `Removed from context: ${removedPath}`,
      shouldContinue: false
    };
  }

  /**
   * 清空上下文
   */
  private static clearContext(): CommandResult {
    const count = this.contextFiles.size;
    this.contextFiles.clear();

    toast.success(`Cleared ${count} files from context`);

    return {
      success: true,
      message: `Cleared ${count} files from context`,
      shouldContinue: false
    };
  }

  /**
   * 显示 @ 命令帮助
   */
  private static showAtCommandHelp(): CommandResult {
    const help = `
**@ Commands (File Reference)**

• \`@file <path>\` - Reference a specific file
• \`@folder <path>\` - Reference all files in a folder
• \`@search <query>\` - Search for text in files
• \`@help\` - Show this help

**Examples:**
• \`@file src/App.tsx\` - Reference the App.tsx file
• \`@folder src/components\` - Reference all files in components folder
• \`@search "useState"\` - Find files containing "useState"
`;

    return {
      success: true,
      message: help,
      shouldContinue: false
    };
  }

  /**
   * 显示 # 命令帮助
   */
  private static showHashCommandHelp(): CommandResult {
    const help = `
**# Commands (Context Management)**

• \`#file <path>\` - Add file to conversation context
• \`#folder <path>\` - Add folder to conversation context
• \`#context list\` - List current context files
• \`#context clear\` - Clear all context files
• \`#help\` - Show this help

**Examples:**
• \`#file src/utils.ts\` - Add utils.ts to context
• \`#folder src/hooks\` - Add all files in hooks folder to context
• \`#context list\` - Show what's in current context
`;

    return {
      success: true,
      message: help,
      shouldContinue: false
    };
  }

  /**
   * 显示通用帮助
   */
  private static showGeneralHelp(): CommandResult {
    const help = `
**Chat Commands Help**

**@ Commands (File Reference)** - Immediately reference files in your message
• \`@file <path>\` - Include file content in message
• \`@folder <path>\` - Include folder contents in message
• \`@search <query>\` - Search and include matching files

**# Commands (Context Management)** - Manage conversation context
• \`#file <path>\` - Add file to persistent context
• \`#folder <path>\` - Add folder to persistent context
• \`#context list\` - Show current context
• \`#context clear\` - Clear context

**General Commands**
• \`help\` - Show this help
• \`help @\` - Show @ command help
• \`help #\` - Show # command help

**Tips:**
- Use @ commands to reference files in your current message
- Use # commands to build a persistent context for the conversation
- Context files are remembered across messages until cleared
- File paths are relative to your project root
`;

    return {
      success: true,
      message: help,
      shouldContinue: false
    };
  }

  /**
   * 获取当前上下文文件
   */
  static getContextFiles(): FileReference[] {
    return Array.from(this.contextFiles.values());
  }

  /**
   * 规范化文件路径
   */
  private static normalizePath(filePath: string, workingDirectory: string): string {
    // 移除开头的 ./ 或 /
    let normalized = filePath.replace(/^\.?\//, '');

    // 如果不是绝对路径，添加工作目录前缀
    if (!normalized.startsWith(workingDirectory)) {
      normalized = `${workingDirectory}/${normalized}`;
    }

    return normalized;
  }

  /**
   * 获取文件扩展名用于语法高亮
   */
  private static getFileExtension(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'rb': 'ruby',
      'php': 'php',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'cfg': 'ini',
      'conf': 'ini',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'ps1': 'powershell',
      'bat': 'batch',
      'cmd': 'batch',
      'sql': 'sql',
      'md': 'markdown',
      'mdx': 'mdx',
      'tex': 'latex',
      'r': 'r',
      'R': 'r',
      'matlab': 'matlab',
      'm': 'matlab',
      'pl': 'perl',
      'pm': 'perl',
      'lua': 'lua',
      'vim': 'vim',
      'dockerfile': 'dockerfile',
      'makefile': 'makefile',
      'cmake': 'cmake',
      'gradle': 'gradle',
      'properties': 'properties',
      'env': 'bash'
    };

    return langMap[ext || ''] || ext || '';
  }

  /**
   * 检查是否为忽略的文件
   */
  private static isIgnoredFile(filePath: string): boolean {
    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /\.next/,
      /coverage/,
      /\.cache/,
      /\.vscode/,
      /\.idea/,
      /\.log$/,
      /\.DS_Store$/,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/
    ];

    return ignoredPatterns.some(pattern => pattern.test(filePath));
  }
}
