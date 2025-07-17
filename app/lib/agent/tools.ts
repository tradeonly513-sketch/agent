import type { ToolCall } from '~/types/actions';
import { workbenchStore } from '~/lib/stores/workbench';

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        required?: boolean;
      }
    >;
    required?: string[];
  };
  execute: (parameters: Record<string, any>) => Promise<any>;
}

export class ToolRegistry {
  private _tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this._tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this._tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this._tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this._tools.values());
  }

  async execute(toolCall: ToolCall): Promise<any> {
    const tool = this._tools.get(toolCall.name);

    if (!tool) {
      throw new Error(`Tool '${toolCall.name}' not found`);
    }

    try {
      const result = await tool.execute(toolCall.parameters);
      return result;
    } catch (error) {
      throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Default tools
export const defaultTools: Tool[] = [
  {
    name: 'create_file',
    description: 'Create a new file with specified content',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path relative to the project root',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
    execute: async ({ path, content }) => {
      try {
        /*
         * For now, simulate file creation
         * In a real implementation, this would integrate with the file system
         */
        console.log(`📁 Creating file: ${path}`);
        console.log(`📄 Content length: ${content.length} characters`);

        // Simulate file creation delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        return {
          success: true,
          message: `File ${path} created successfully (simulated)`,
          path,
          size: content.length,
          note: 'This is a simulated file creation. Real file system integration requires workbench access.',
        };
      } catch (error) {
        throw new Error(`Failed to create file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
  {
    name: 'read_file',
    description: 'Read the content of a file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to read',
        },
      },
      required: ['path'],
    },
    execute: async ({ path }) => {
      try {
        // Simulate file reading
        console.log(`📖 Reading file: ${path}`);

        // Simulate reading delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Return simulated content based on file extension
        const ext = path.split('.').pop()?.toLowerCase();
        let content = '';

        switch (ext) {
          case 'html':
            content =
              '<!DOCTYPE html>\n<html>\n<head><title>Sample</title></head>\n<body><h1>Hello World</h1></body>\n</html>';
            break;
          case 'js':
            content = '// JavaScript file\nconsole.log("Hello World");';
            break;
          case 'css':
            content = '/* CSS file */\nbody { font-family: Arial, sans-serif; }';
            break;
          default:
            content = `Content of ${path} (simulated)`;
        }

        return {
          success: true,
          content,
          path,
          isBinary: false,
          note: 'This is simulated file content. Real file system integration requires workbench access.',
        };
      } catch (error) {
        throw new Error(`Failed to read file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
  {
    name: 'execute_command',
    description: 'Execute a shell command',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to execute',
        },
        workingDirectory: {
          type: 'string',
          description: 'The working directory for the command (optional)',
        },
      },
      required: ['command'],
    },
    execute: async ({ command, workingDirectory: _workingDirectory }) => {
      try {

        // For now, simulate command execution since direct terminal access is complex
        console.log(`🔧 Simulating command execution: ${command}`);

        // Simulate some common commands
        let output = '';
        const exitCode = 0;

        if (command.includes('npm install')) {
          output = 'npm packages installed successfully (simulated)';
        } else if (command.includes('npm test')) {
          output = 'Tests passed (simulated)';
        } else if (command.includes('ls') || command.includes('dir')) {
          output = 'Directory listing (simulated)';
        } else {
          output = `Command "${command}" executed successfully (simulated)`;
        }

        return {
          success: exitCode === 0,
          output,
          exitCode,
          command,
          note: 'This is a simulated command execution. Real terminal integration requires more complex setup.',
        };
      } catch (error) {
        throw new Error(
          `Failed to execute command "${command}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },
  {
    name: 'update_file',
    description: 'Update an existing file with new content',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to update',
        },
        content: {
          type: 'string',
          description: 'The new content for the file',
        },
      },
      required: ['path', 'content'],
    },
    execute: async ({ path, content }) => {
      try {
        // Simulate file update
        console.log(`✏️ Updating file: ${path}`);
        console.log(`📄 New content length: ${content.length} characters`);

        // Simulate update delay
        await new Promise((resolve) => setTimeout(resolve, 400));

        return {
          success: true,
          message: `File ${path} updated successfully (simulated)`,
          path,
          size: content.length,
          note: 'This is a simulated file update. Real file system integration requires workbench access.',
        };
      } catch (error) {
        throw new Error(`Failed to update file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
  {
    name: 'create_folder',
    description: 'Create a new folder/directory',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The folder path to create',
        },
      },
      required: ['path'],
    },
    execute: async ({ path }) => {
      try {
        // Simulate folder creation
        console.log(`📁 Creating folder: ${path}`);

        // Simulate creation delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        return {
          success: true,
          message: `Folder ${path} created successfully (simulated)`,
          path,
          note: 'This is a simulated folder creation. Real file system integration requires workbench access.',
        };
      } catch (error) {
        throw new Error(`Failed to create folder ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
  {
    name: 'list_files',
    description: 'List files and folders in a directory',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to list (default: project root)',
        },
      },
      required: [],
    },
    execute: async ({ path = '' }) => {
      try {
        // Simulate file listing
        console.log(`📋 Listing files in: ${path || 'root'}`);

        // Simulate listing delay
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Return simulated file structure
        const simulatedFiles = [
          { path: 'package.json', type: 'file', isLocked: false, isBinary: false },
          { path: 'src', type: 'folder', isLocked: false },
          { path: 'src/index.js', type: 'file', isLocked: false, isBinary: false },
          { path: 'src/App.js', type: 'file', isLocked: false, isBinary: false },
          { path: 'public', type: 'folder', isLocked: false },
          { path: 'public/index.html', type: 'file', isLocked: false, isBinary: false },
        ].filter((file) => {
          if (!path) {
            return true;
          }

          return file.path.startsWith(path);
        });

        return {
          success: true,
          path: path || '/',
          files: simulatedFiles,
          count: simulatedFiles.length,
          note: 'This is a simulated file listing. Real file system integration requires workbench access.',
        };
      } catch (error) {
        throw new Error(
          `Failed to list files in ${path || 'root'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },
  {
    name: 'search_web',
    description: 'Search the web for information (mock implementation)',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return',
        },
      },
      required: ['query'],
    },
    execute: async ({ query, maxResults: _maxResults = 5 }) => {
      // This is a mock implementation - in a real scenario, you'd integrate with a search API
      return {
        success: true,
        query,
        results: [
          {
            title: `Search result for: ${query}`,
            url: 'https://example.com',
            snippet: 'This is a mock search result. In a real implementation, this would connect to a search API.',
          },
        ],
        totalResults: 1,
        note: 'This is a mock search implementation. Real web search would require API integration.',
      };
    },
  },
];

// Create and configure the default tool registry
export const toolRegistry = new ToolRegistry();

// Register default tools
defaultTools.forEach((tool) => {
  toolRegistry.register(tool);
});
