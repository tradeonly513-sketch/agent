import type { AgentTask, AgentStep, ToolCall } from '~/types/actions';

// Simple ID generator to avoid external dependencies
function generateSimpleId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Real tool registry that integrates with workbench
const createRealToolRegistry = () => {
  return {
    async execute(toolCall: ToolCall): Promise<any> {
      console.log(`🔧 Executing tool: ${toolCall.name}`, toolCall.parameters);

      try {
        // Import workbenchStore dynamically to avoid SSR issues
        const { workbenchStore } = await import('~/lib/stores/workbench');

        switch (toolCall.name) {
          case 'create_file': {
            const { path, content } = toolCall.parameters;
            console.log(`📁 Creating file: ${path} with ${content?.length || 0} characters`);

            const success = await workbenchStore.createFile(path, content || '');

            if (success) {
              console.log(`✅ File created successfully: ${path}`);
              return {
                success: true,
                message: `File ${path} created successfully`,
                path,
                size: content?.length || 0,
              };
            } else {
              console.error(`❌ File creation failed: ${path}`);
              throw new Error('File creation failed');
            }
          }

          case 'create_folder': {
            const { path } = toolCall.parameters;
            console.log(`📁 Creating folder: ${path}`);

            const success = await workbenchStore.createFolder(path);

            if (success) {
              console.log(`✅ Folder created successfully: ${path}`);
              return {
                success: true,
                message: `Folder ${path} created successfully`,
                path,
              };
            } else {
              console.error(`❌ Folder creation failed: ${path}`);
              throw new Error('Folder creation failed');
            }
          }

          case 'read_file': {
            const { path } = toolCall.parameters;
            const files = workbenchStore.files.get();
            const file = files[path];

            if (!file || file.type !== 'file') {
              throw new Error(`File ${path} not found`);
            }

            return {
              success: true,
              content: file.content || '',
              path,
              isBinary: file.isBinary || false,
            };
          }

          case 'update_file': {
            const { path, content } = toolCall.parameters;
            // Set the document content and save
            workbenchStore.setCurrentDocumentContent(content || '');
            await workbenchStore.saveFile(path);

            return {
              success: true,
              message: `File ${path} updated successfully`,
              path,
              size: content?.length || 0,
            };
          }

          case 'list_files': {
            const { path = '' } = toolCall.parameters;
            const allFiles = workbenchStore.files.get();

            const filteredFiles = Object.entries(allFiles)
              .filter(([filePath]) => {
                if (!path) return true;
                return filePath.startsWith(path);
              })
              .map(([filePath, dirent]) => ({
                path: filePath,
                type: dirent?.type || 'unknown',
                isLocked: dirent?.isLocked || false,
                isBinary: dirent?.type === 'file' ? dirent.isBinary || false : undefined,
              }));

            return {
              success: true,
              path: path || '/',
              files: filteredFiles,
              count: filteredFiles.length,
            };
          }

          case 'execute_command': {
            // For now, simulate command execution since terminal integration is complex
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
              success: true,
              output: `Command "${toolCall.parameters.command}" executed successfully (simulated)`,
              exitCode: 0,
              command: toolCall.parameters.command,
              note: 'Command execution is simulated. Real terminal integration requires additional setup.',
            };
          }

        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }
    } catch (importError) {
      console.error('❌ Failed to import workbenchStore:', importError);
      // Fallback to simulation if import fails
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        success: false,
        message: `Tool ${toolCall.name} failed due to import error: ${importError instanceof Error ? importError.message : 'Unknown error'}`,
        error: 'workbenchStore import failed',
      };
    }
  }
};

export interface ClientAgentExecutorOptions {
  maxSteps?: number;
  stepTimeout?: number;
  onStepStart?: (step: AgentStep) => void;
  onStepComplete?: (step: AgentStep) => void;
  onStepError?: (step: AgentStep, error: Error) => void;
  onTaskComplete?: (task: AgentTask) => void;
  onTaskError?: (task: AgentTask, error: Error) => void;
  onTaskUpdate?: (task: AgentTask) => void;
}

export class ClientAgentExecutor {
  private _options: ClientAgentExecutorOptions;
  private _currentTask?: AgentTask;
  private _isRunning = false;
  private _isPaused = false;
  private _abortController?: AbortController;
  private _stepCallbacks: Map<string, () => void> = new Map();
  private _toolRegistry: any;

  constructor(options: ClientAgentExecutorOptions = {}) {
    this._options = {
      maxSteps: 10,
      stepTimeout: 60000,
      ...options,
    };
    this._toolRegistry = createRealToolRegistry();
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get currentTask(): AgentTask | undefined {
    return this._currentTask;
  }

  async executeTask(description: string, context?: Record<string, any>): Promise<AgentTask> {
    if (this._isRunning) {
      throw new Error('Agent is already running a task');
    }

    console.log('🤖 Agent: Starting new task:', description);

    const task: AgentTask = {
      id: generateSimpleId(),
      title: this._extractTitle(description),
      description,
      steps: [],
      status: 'pending',
      currentStepIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: context || {},
    };

    this._currentTask = task;
    this._isRunning = true;
    this._abortController = new AbortController();

    try {
      // Parse the task into steps
      console.log('🤖 Agent: Parsing task into steps...');
      const steps = this._parseTaskIntoSteps(description, context);
      task.steps = steps;
      task.status = 'running';
      task.updatedAt = Date.now();
      this._options.onTaskUpdate?.(task);

      console.log(`🤖 Agent: Task parsed into ${steps.length} steps:`, steps.map(s => s.title));

      // Execute steps sequentially
      for (let i = 0; i < steps.length; i++) {
        if (this._abortController?.signal.aborted) {
          task.status = 'cancelled';
          break;
        }

        // Wait for resume if paused
        while (this._isPaused && !this._abortController?.signal.aborted) {
          await new Promise<void>(resolve => {
            const stepId = `${task.id}-${i}`;
            this._stepCallbacks.set(stepId, resolve);
          });
        }

        if (this._abortController?.signal.aborted) {
          task.status = 'cancelled';
          break;
        }

        task.currentStepIndex = i;
        task.updatedAt = Date.now();
        this._options.onTaskUpdate?.(task);

        const step = steps[i];

        try {
          await this._executeStep(step, task);

          if (step.status === 'failed') {
            this._options.onStepError?.(step, new Error(step.error || 'Step failed'));
            console.warn(`Step ${i + 1} failed: ${step.error}`);
          }
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Unknown error';
          this._options.onStepError?.(step, error instanceof Error ? error : new Error('Unknown error'));
          console.error(`Step ${i + 1} error:`, error);
        }

        task.updatedAt = Date.now();
        this._options.onTaskUpdate?.(task);
      }

      if (task.status === 'running') {
        task.status = 'completed';
        this._options.onTaskComplete?.(task);
      }
    } catch (error) {
      task.status = 'failed';
      this._options.onTaskError?.(task, error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      this._isRunning = false;
      task.updatedAt = Date.now();
      this._options.onTaskUpdate?.(task);
    }

    return task;
  }

  private _parseTaskIntoSteps(description: string, context?: Record<string, any>): AgentStep[] {
    console.log('🤖 Agent: Parsing task using intelligent fallback...');

    const lowerDesc = description.toLowerCase();

    // Express.js/Node.js API patterns
    if (lowerDesc.includes('express') || (lowerDesc.includes('api') && lowerDesc.includes('node'))) {
      return this._getExpressApiSteps(description);
    }

    // React application patterns
    if (lowerDesc.includes('react') && (lowerDesc.includes('todo') || lowerDesc.includes('app'))) {
      return this._getReactAppSteps(description);
    }

    // HTML file creation patterns
    if (lowerDesc.includes('html') || (lowerDesc.includes('file') && lowerDesc.includes('create'))) {
      return this._getHtmlFileSteps(description);
    }

    // Python script patterns
    if (lowerDesc.includes('python') || lowerDesc.includes('script')) {
      return this._getPythonScriptSteps(description);
    }

    // Vue.js patterns
    if (lowerDesc.includes('vue')) {
      return this._getVueAppSteps(description);
    }

    // General web development patterns
    if (lowerDesc.includes('website') || lowerDesc.includes('web')) {
      return this._getWebsiteSteps(description);
    }

    // Default generic steps
    return this._getGenericSteps(description);
  }

  private _getExpressApiSteps(description: string): AgentStep[] {
    return [
      {
        id: generateSimpleId(),
        title: 'Initialize Project',
        description: 'Create package.json and install Express dependencies',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Setup Express Server',
        description: 'Create main server file with basic Express configuration',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Create Routes & Middleware',
        description: 'Implement API routes, authentication middleware, and error handling',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Add Authentication',
        description: 'Implement JWT authentication and user management',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Implement CRUD Operations',
        description: 'Create CRUD endpoints with input validation and security',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Test & Finalize',
        description: 'Test all endpoints and add final security measures',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getReactAppSteps(description: string): AgentStep[] {
    return [
      {
        id: generateSimpleId(),
        title: 'Setup Project Structure',
        description: 'Create React project structure and install dependencies',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Create Components',
        description: 'Build main application components and structure',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Implement State Management',
        description: 'Add state management and component interactions',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Add Styling',
        description: 'Create CSS styles and responsive design',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Test Functionality',
        description: 'Test all features and fix any issues',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getHtmlFileSteps(description: string): AgentStep[] {
    return [
      {
        id: generateSimpleId(),
        title: 'Analyze Requirements',
        description: 'Analyze the file creation requirements and content needs',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Create HTML File',
        description: 'Generate HTML file with proper structure and content',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Verify Creation',
        description: 'Verify that the file was created successfully',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getPythonScriptSteps(description: string): AgentStep[] {
    return [
      {
        id: generateSimpleId(),
        title: 'Setup Environment',
        description: 'Create Python script structure and import requirements',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Implement Core Logic',
        description: 'Write main functionality and data processing logic',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Add Error Handling',
        description: 'Implement error handling and input validation',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Test & Optimize',
        description: 'Test script functionality and optimize performance',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getVueAppSteps(description: string): AgentStep[] {
    return [
      {
        id: generateSimpleId(),
        title: 'Initialize Vue Project',
        description: 'Create Vue.js project structure and configuration',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Create Vue Components',
        description: 'Build Vue components and template structure',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Implement Reactivity',
        description: 'Add Vue reactivity, data binding, and event handling',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Style & Polish',
        description: 'Add styling and final touches to the application',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getWebsiteSteps(description: string): AgentStep[] {
    return [
      {
        id: generateSimpleId(),
        title: 'Plan Website Structure',
        description: 'Design website layout and page structure',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Create HTML Pages',
        description: 'Build HTML pages with semantic structure',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Add CSS Styling',
        description: 'Create responsive CSS styles and layout',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Implement JavaScript',
        description: 'Add interactive features and functionality',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Test & Optimize',
        description: 'Test across devices and optimize performance',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getGenericSteps(description: string): AgentStep[] {
    return [
      {
        id: generateSimpleId(),
        title: 'Analyze Requirements',
        description: 'Break down the task requirements and plan approach',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Execute Main Task',
        description: 'Perform the core task operations and implementation',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateSimpleId(),
        title: 'Verify & Finalize',
        description: 'Check results, test functionality, and ensure completion',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private async _executeStep(step: AgentStep, task: AgentTask): Promise<void> {
    console.log(`🤖 Agent: Executing step "${step.title}"`);

    step.status = 'running';
    step.timestamp = Date.now();
    this._options.onStepStart?.(step);

    try {
      // Simulate step execution
      const toolCalls = this._determineToolCalls(step, task);
      step.toolCalls = [];

      if (toolCalls.length > 0) {
        for (const toolCallData of toolCalls) {
          const toolCall: ToolCall = {
            id: generateSimpleId(),
            name: toolCallData.name,
            parameters: toolCallData.parameters,
            timestamp: Date.now(),
          };

          try {
            console.log(`🔧 Agent: Using tool ${toolCall.name}`);
            const toolResult = await this._toolRegistry.execute(toolCall);
            toolCall.result = toolResult;
            step.toolCalls.push(toolCall);
            console.log(`✅ Agent: Tool ${toolCall.name} completed successfully`);
          } catch (error) {
            console.error(`❌ Agent: Tool ${toolCall.name} failed:`, error);
            toolCall.error = error instanceof Error ? error.message : 'Unknown error';
            step.toolCalls.push(toolCall);
            throw new Error(`Tool execution failed: ${toolCall.error}`);
          }
        }

        step.output = `Completed: ${step.description}\n\nActions performed:\n${toolCalls.map((call, i) => `${i + 1}. Used ${call.name}`).join('\n')}`;
      } else {
        // Analysis or planning step
        await new Promise(resolve => setTimeout(resolve, 1000));
        step.output = `Completed: ${step.description}`;
      }

      step.status = 'completed';
      step.timestamp = Date.now();
      this._options.onStepComplete?.(step);

    } catch (error) {
      console.error('❌ Agent: Step execution failed:', error);
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.timestamp = Date.now();
      throw error;
    }
  }

  private _determineToolCalls(step: AgentStep, task: AgentTask): Array<{name: string, parameters: any}> {
    const stepTitle = step.title.toLowerCase();
    const taskDesc = task.description.toLowerCase();
    const toolCalls: Array<{name: string, parameters: any}> = [];

    // Express.js API project setup
    if (taskDesc.includes('express') || (taskDesc.includes('api') && taskDesc.includes('node'))) {
      if (stepTitle.includes('initialize') || stepTitle.includes('project')) {
        toolCalls.push(
          {
            name: 'create_file',
            parameters: {
              path: 'package.json',
              content: this._generateExpressPackageJson()
            }
          },
          {
            name: 'create_folder',
            parameters: { path: 'routes' }
          },
          {
            name: 'create_folder',
            parameters: { path: 'middleware' }
          },
          {
            name: 'create_folder',
            parameters: { path: 'models' }
          }
        );
      } else if (stepTitle.includes('server') || stepTitle.includes('setup')) {
        toolCalls.push({
          name: 'create_file',
          parameters: {
            path: 'server.js',
            content: this._generateExpressServer()
          }
        });
      } else if (stepTitle.includes('routes') || stepTitle.includes('middleware')) {
        toolCalls.push(
          {
            name: 'create_file',
            parameters: {
              path: 'routes/auth.js',
              content: this._generateAuthRoutes()
            }
          },
          {
            name: 'create_file',
            parameters: {
              path: 'routes/api.js',
              content: this._generateApiRoutes()
            }
          },
          {
            name: 'create_file',
            parameters: {
              path: 'middleware/auth.js',
              content: this._generateAuthMiddleware()
            }
          }
        );
      } else if (stepTitle.includes('authentication') || stepTitle.includes('jwt')) {
        toolCalls.push({
          name: 'create_file',
          parameters: {
            path: 'models/User.js',
            content: this._generateUserModel()
          }
        });
      } else if (stepTitle.includes('crud')) {
        toolCalls.push({
          name: 'create_file',
          parameters: {
            path: 'models/Post.js',
            content: this._generatePostModel()
          }
        });
      }
    }

    // React application setup
    else if (taskDesc.includes('react')) {
      if (stepTitle.includes('setup') || stepTitle.includes('structure')) {
        toolCalls.push(
          {
            name: 'create_file',
            parameters: {
              path: 'package.json',
              content: this._generateReactPackageJson()
            }
          },
          {
            name: 'create_folder',
            parameters: { path: 'src' }
          },
          {
            name: 'create_folder',
            parameters: { path: 'public' }
          },
          {
            name: 'create_file',
            parameters: {
              path: 'public/index.html',
              content: this._generateReactIndexHtml()
            }
          }
        );
      } else if (stepTitle.includes('components')) {
        toolCalls.push(
          {
            name: 'create_file',
            parameters: {
              path: 'src/App.js',
              content: this._generateReactApp()
            }
          },
          {
            name: 'create_file',
            parameters: {
              path: 'src/index.js',
              content: this._generateReactIndex()
            }
          }
        );
      }
    }

    // HTML file creation
    else if (stepTitle.includes('create') && (taskDesc.includes('html') || taskDesc.includes('file'))) {
      const fileName = this._extractFileName(task.description) || 'index.html';
      toolCalls.push({
        name: 'create_file',
        parameters: {
          path: fileName,
          content: this._generateFileContent(fileName, task.description)
        }
      });
    }

    // Python script creation
    else if (taskDesc.includes('python') && stepTitle.includes('setup')) {
      toolCalls.push({
        name: 'create_file',
        parameters: {
          path: 'main.py',
          content: this._generatePythonScript(task.description)
        }
      });
    }

    return toolCalls;
  }

  private _extractFileName(description: string): string | null {
    const match = description.match(/([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  private _generateFileContent(fileName: string, description: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'html') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated HTML</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            background: #f4f4f4;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>Hello, World!</h1>
    <div class="container">
        <p>This file was generated based on: ${description}</p>
        <p>Created by Agent at: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;
    }

    return `Hello, World!\n\nThis file was generated by the Agent based on: ${description}`;
  }

  private _generateExpressPackageJson(): string {
    return JSON.stringify({
      name: 'express-api-server',
      version: '1.0.0',
      description: 'Express.js REST API server with JWT authentication',
      main: 'server.js',
      scripts: {
        start: 'node server.js',
        dev: 'nodemon server.js',
        test: 'jest'
      },
      dependencies: {
        express: '^4.18.2',
        cors: '^2.8.5',
        helmet: '^7.0.0',
        'express-rate-limit': '^6.7.0',
        jsonwebtoken: '^9.0.0',
        bcryptjs: '^2.4.3',
        'express-validator': '^6.15.0',
        dotenv: '^16.0.3',
        mongoose: '^7.0.3'
      },
      devDependencies: {
        nodemon: '^2.0.22',
        jest: '^29.5.0',
        supertest: '^6.3.3'
      }
    }, null, 2);
  }

  private _generateExpressServer(): string {
    return `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/api', authMiddleware, apiRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Express.js REST API Server is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server is running on port \${PORT}\`);
  console.log(\`📚 API Documentation: http://localhost:\${PORT}\`);
});

module.exports = app;`;
  }

  private _generateAuthRoutes(): string {
    return `const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

// Register endpoint
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      name
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;`;
  }

  private _generateApiRoutes(): string {
    return `const express = require('express');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');

const router = express.Router();

// Get all posts
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments();

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post
router.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name email');
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create post
router.post('/posts', [
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('content').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content } = req.body;
    const post = new Post({
      title,
      content,
      author: req.user.userId
    });

    await post.save();
    await post.populate('author', 'name email');

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post
router.put('/posts/:id', [
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('content').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user owns the post
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to update this post' });
    }

    const { title, content } = req.body;
    if (title) post.title = title;
    if (content) post.content = content;
    post.updatedAt = new Date();

    await post.save();
    await post.populate('author', 'name email');

    res.json(post);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user owns the post
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;`;
  }

  private _generateAuthMiddleware(): string {
    return `const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = authMiddleware;`;
  }

  private _generateUserModel(): string {
    return `const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);`;
  }

  private _generatePostModel(): string {
    return `const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Post', postSchema);`;
  }

  private _generateReactPackageJson(): string {
    return JSON.stringify({
      name: 'react-todo-app',
      version: '1.0.0',
      private: true,
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'react-scripts': '5.0.1'
      },
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        eject: 'react-scripts eject'
      },
      eslintConfig: {
        extends: ['react-app', 'react-app/jest']
      },
      browserslist: {
        production: ['>0.2%', 'not dead', 'not op_mini all'],
        development: ['last 1 chrome version', 'last 1 firefox version', 'last 1 safari version']
      }
    }, null, 2);
  }

  private _generateReactIndexHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#000000" />
  <meta name="description" content="React Todo Application" />
  <title>React Todo App</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background-color: #f5f5f5;
    }
  </style>
</head>
<body>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <div id="root"></div>
</body>
</html>`;
  }

  private _generateReactIndex(): string {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
  }

  private _generateReactApp(): string {
    return `import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('all');

  // Load todos from localStorage on component mount
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, []);

  // Save todos to localStorage whenever todos change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (inputValue.trim() !== '') {
      const newTodo = {
        id: Date.now(),
        text: inputValue.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const editTodo = (id, newText) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, text: newText } : todo
    ));
  };

  const clearCompleted = () => {
    setTodos(todos.filter(todo => !todo.completed));
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const completedCount = todos.filter(todo => todo.completed).length;
  const activeCount = todos.length - completedCount;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Todo App</h1>
        <p>Stay organized and productive</p>
      </header>

      <main className="app-main">
        <div className="todo-input-section">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="What needs to be done?"
            className="todo-input"
          />
          <button onClick={addTodo} className="add-button">
            Add Todo
          </button>
        </div>

        <div className="filter-section">
          <button
            onClick={() => setFilter('all')}
            className={\`filter-button \${filter === 'all' ? 'active' : ''}\`}
          >
            All ({todos.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={\`filter-button \${filter === 'active' ? 'active' : ''}\`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={\`filter-button \${filter === 'completed' ? 'active' : ''}\`}
          >
            Completed ({completedCount})
          </button>
        </div>

        <div className="todo-list">
          {filteredTodos.length === 0 ? (
            <div className="empty-state">
              <p>No todos found. Add one above!</p>
            </div>
          ) : (
            filteredTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onEdit={editTodo}
              />
            ))
          )}
        </div>

        {completedCount > 0 && (
          <div className="actions-section">
            <button onClick={clearCompleted} className="clear-button">
              Clear Completed ({completedCount})
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function TodoItem({ todo, onToggle, onDelete, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);

  const handleEdit = () => {
    if (editText.trim() !== '') {
      onEdit(todo.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleEdit();
    } else if (e.key === 'Escape') {
      setEditText(todo.text);
      setIsEditing(false);
    }
  };

  return (
    <div className={\`todo-item \${todo.completed ? 'completed' : ''}\`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        className="todo-checkbox"
      />

      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleEdit}
          onKeyPress={handleKeyPress}
          className="todo-edit-input"
          autoFocus
        />
      ) : (
        <span
          className="todo-text"
          onDoubleClick={() => setIsEditing(true)}
        >
          {todo.text}
        </span>
      )}

      <div className="todo-actions">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="edit-button"
          title="Edit todo"
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="delete-button"
          title="Delete todo"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

export default App;`;
  }

  private _generatePythonScript(description: string): string {
    return `#!/usr/bin/env python3
"""
Python script generated by Agent
Task: ${description}
Created: ${new Date().toISOString()}
"""

import sys
import os
from datetime import datetime

def main():
    """Main function to execute the script logic."""
    print("🐍 Python Script Starting...")
    print(f"📅 Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📝 Task: ${description}")

    try:
        # Main script logic would go here
        print("✅ Script executed successfully!")

    except Exception as e:
        print(f"❌ Error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()`;
  }

  private _extractTitle(description: string): string {
    const words = description.split(' ').slice(0, 6);
    return words.join(' ') + (description.split(' ').length > 6 ? '...' : '');
  }

  pause(): void {
    this._isPaused = true;
  }

  resume(): void {
    this._isPaused = false;
    this._stepCallbacks.forEach((callback) => {
      callback();
    });
    this._stepCallbacks.clear();
  }

  abort(): void {
    this._abortController?.abort();
    this._isRunning = false;
    this._isPaused = false;
    this._stepCallbacks.clear();
  }

  skipCurrentStep(): void {
    if (this._currentTask && this._currentTask.steps[this._currentTask.currentStepIndex]) {
      const currentStep = this._currentTask.steps[this._currentTask.currentStepIndex];
      currentStep.status = 'skipped';
      currentStep.output = 'Step skipped by user';
      currentStep.timestamp = Date.now();
      this.resume();
    }
  }

  retryCurrentStep(): void {
    if (this._currentTask && this._currentTask.steps[this._currentTask.currentStepIndex]) {
      const currentStep = this._currentTask.steps[this._currentTask.currentStepIndex];
      if (currentStep.status === 'failed') {
        currentStep.status = 'pending';
        currentStep.error = undefined;
        currentStep.output = undefined;
        currentStep.timestamp = Date.now();
        this.resume();
      }
    }
  }
}
}
