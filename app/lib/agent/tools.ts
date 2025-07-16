import type { ToolCall } from '~/types/actions';

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
      /*
       * This would integrate with the existing file system
       * For now, return a mock response
       */
      return {
        success: true,
        message: `File ${path} created successfully`,
        path,
        size: content.length,
      };
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
      // This would integrate with the existing file system
      return {
        success: true,
        content: `// Content of ${path}`,
        path,
      };
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
          description: 'The working directory for the command',
        },
      },
      required: ['command'],
    },
    execute: async ({ command, workingDirectory }) => {
      // This would integrate with the existing terminal system
      return {
        success: true,
        output: `Executed: ${command}`,
        exitCode: 0,
        workingDirectory: workingDirectory || '/project',
      };
    },
  },
  {
    name: 'search_web',
    description: 'Search the web for information',
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
      // This would integrate with a web search API
      return {
        success: true,
        query,
        results: [
          {
            title: `Search result for: ${query}`,
            url: 'https://example.com',
            snippet: 'This is a mock search result',
          },
        ],
        totalResults: 1,
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
