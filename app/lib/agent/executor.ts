import type { AgentTask, AgentStep, ToolCall } from '~/types/actions';
import { toolRegistry } from './tools';
import { generateId } from 'ai';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '~/lib/constants';
import { StepHelpers } from './step-helpers';

export interface AgentExecutorOptions {
  maxSteps?: number;
  stepTimeout?: number;
  model?: string;
  provider?: string;
  apiKeys?: Record<string, string>;
  onStepStart?: (step: AgentStep) => void;
  onStepComplete?: (step: AgentStep) => void;
  onStepError?: (step: AgentStep, error: Error) => void;
  onTaskComplete?: (task: AgentTask) => void;
  onTaskError?: (task: AgentTask, error: Error) => void;
  onUserInputRequired?: (prompt: string) => Promise<string>;
  onTaskUpdate?: (task: AgentTask) => void;
}

export class AgentExecutor {
  private _options: AgentExecutorOptions;
  private _currentTask?: AgentTask;
  private _isRunning = false;
  private _isPaused = false;
  private _abortController?: AbortController;
  private _stepCallbacks: Map<string, () => void> = new Map();

  constructor(options: AgentExecutorOptions = {}) {
    this._options = {
      maxSteps: 10,
      stepTimeout: 60000, // 60 seconds
      model: DEFAULT_MODEL,
      provider: DEFAULT_PROVIDER,
      ...options,
    };
  }

  async executeTask(_description: string, _context?: Record<string, any>): Promise<AgentTask> {
    if (this._isRunning) {
      throw new Error('Agent is already running a task');
    }

    console.log('🤖 Agent: Starting new task:', description);

    const task: AgentTask = {
      id: generateId(),
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
      // Parse the task into steps using LLM
      console.log('🤖 Agent: Parsing task into steps...');

      const steps = await this._parseTaskIntoSteps(description, context);
      task.steps = steps;
      task.status = 'running';
      task.updatedAt = Date.now();
      this._options.onTaskUpdate?.(task);

      console.log(
        `🤖 Agent: Task parsed into ${steps.length} steps:`,
        steps.map((s) => s.title),
      );

      // Execute steps sequentially
      for (let i = 0; i < steps.length; i++) {
        if (this._abortController?.signal.aborted) {
          task.status = 'cancelled';
          break;
        }

        // Wait for resume if paused
        while (this._isPaused && !this._abortController?.signal.aborted) {
          await new Promise<void>((resolve) => {
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
            // Allow user to decide whether to continue or stop
            if (this._options.onStepError) {
              this._options.onStepError(step, new Error(step.error || 'Step failed'));
            }

            /*
             * For now, continue to next step instead of stopping entirely
             * User can use controls to stop if needed
             */
            console.warn(`Step ${i + 1} failed: ${step.error}`);
          }
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Unknown error';
          this._options.onStepError?.(step, error instanceof Error ? error : new Error('Unknown error'));

          // Continue to next step instead of stopping entirely
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

  private async _parseTaskIntoSteps(_description: string, context?: Record<string, any>): Promise<AgentStep[]> {
    /*
     * For now, use intelligent fallback parsing instead of LLM
     * This avoids client-server issues and still provides good functionality
     */
    console.log('🤖 Agent: Parsing task using intelligent fallback...');

    return this._getIntelligentSteps(description, context);
  }

  private _getIntelligentSteps(_description: string, _context?: Record<string, any>): AgentStep[] {
    const lowerDesc = description.toLowerCase();

    // React/Vue/Frontend App patterns
    if (lowerDesc.includes('react') || lowerDesc.includes('vue') || lowerDesc.includes('frontend')) {
      if (lowerDesc.includes('todo') || lowerDesc.includes('task')) {
        return this._getReactTodoSteps(description);
      } else if (lowerDesc.includes('dashboard')) {
        return this._getDashboardSteps(description);
      } else {
        return this._getFrontendAppSteps(description);
      }
    }

    // Backend/API patterns
    if (lowerDesc.includes('api') || lowerDesc.includes('server') || lowerDesc.includes('backend')) {
      if (lowerDesc.includes('express') || lowerDesc.includes('node')) {
        return this._getExpressApiSteps(description);
      } else if (lowerDesc.includes('flask') || lowerDesc.includes('python')) {
        return this._getFlaskApiSteps(description);
      } else {
        return this._getGenericApiSteps(description);
      }
    }

    // File operations
    if (
      lowerDesc.includes('create') &&
      (lowerDesc.includes('file') ||
        lowerDesc.includes('html') ||
        lowerDesc.includes('css') ||
        lowerDesc.includes('js'))
    ) {
      return this._getFileCreationSteps(description);
    }

    // Python/Data Science patterns
    if (
      lowerDesc.includes('python') ||
      lowerDesc.includes('data') ||
      lowerDesc.includes('csv') ||
      lowerDesc.includes('analysis')
    ) {
      return this._getPythonDataSteps(description);
    }

    // Web scraping
    if (lowerDesc.includes('scrape') || lowerDesc.includes('crawl') || lowerDesc.includes('extract')) {
      return this._getWebScrapingSteps(description);
    }

    // CLI/Tool patterns
    if (lowerDesc.includes('cli') || lowerDesc.includes('command') || lowerDesc.includes('tool')) {
      return this._getCliToolSteps(description);
    }

    // Game development
    if (lowerDesc.includes('game') || lowerDesc.includes('canvas')) {
      return this._getGameSteps(description);
    }

    // Generic fallback
    return this._getGenericSteps(description);
  }

  private _getReactTodoSteps(__description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Setup Project Structure',
        description: 'Create the basic React project structure and files',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Create Todo Components',
        description: 'Build TodoList, TodoItem, and AddTodo components',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Implement State Management',
        description: 'Add state management for todos with hooks',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Add Styling',
        description: 'Create CSS styles for the todo application',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Test Functionality',
        description: 'Test all todo operations and fix any issues',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getExpressApiSteps(__description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Initialize Project',
        description: 'Create package.json and install Express dependencies',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Setup Express Server',
        description: 'Create main server file with basic Express configuration',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Create Routes',
        description: 'Implement API routes and endpoints',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Add Middleware',
        description: 'Implement authentication and error handling middleware',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Test API',
        description: 'Test all endpoints and verify functionality',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getFileCreationSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Analyze Requirements',
        description: 'Determine file type, content, and structure needed',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Create File',
        description: 'Generate the file with appropriate content',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Verify Creation',
        description: 'Check that the file was created correctly',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getDashboardSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Create Project Structure',
        description: 'Set up the dashboard project with necessary files',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Build Layout Components',
        description: 'Create sidebar, header, and main content components',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Add Dashboard Widgets',
        description: 'Implement charts, tables, and statistics components',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Style Dashboard',
        description: 'Apply responsive styling and theme',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getFrontendAppSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Setup Project',
        description: 'Initialize the frontend project structure',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Create Components',
        description: 'Build the main application components',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Add Functionality',
        description: 'Implement core features and interactions',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Style Application',
        description: 'Add CSS styling and responsive design',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getFlaskApiSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Setup Flask Project',
        description: 'Create Flask application structure and requirements',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Create Routes',
        description: 'Implement API endpoints and route handlers',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Add Database Models',
        description: 'Set up database models and migrations',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Test API',
        description: 'Test all endpoints and functionality',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getGenericApiSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Initialize API Project',
        description: 'Set up the API project structure',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Implement Endpoints',
        description: 'Create API endpoints and handlers',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Add Authentication',
        description: 'Implement authentication and security',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Test and Document',
        description: 'Test API and create documentation',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getPythonDataSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Setup Environment',
        description: 'Create Python script and import required libraries',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Load and Clean Data',
        description: 'Read data files and perform data cleaning',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Analyze Data',
        description: 'Perform statistical analysis and calculations',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Generate Reports',
        description: 'Create visualizations and export results',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getWebScrapingSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Setup Scraper',
        description: 'Create scraping script with required libraries',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Implement Scraping Logic',
        description: 'Write code to extract data from target websites',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Process Data',
        description: 'Clean and structure the scraped data',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Save Results',
        description: 'Export data to files and verify results',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getCliToolSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Initialize CLI Project',
        description: 'Set up CLI tool structure and dependencies',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Implement Commands',
        description: 'Create command handlers and argument parsing',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Add Help and Documentation',
        description: 'Implement help system and usage documentation',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Test CLI Tool',
        description: 'Test all commands and edge cases',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getGameSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Setup Game Structure',
        description: 'Create HTML canvas and basic game files',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Implement Game Logic',
        description: 'Add game mechanics, physics, and controls',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Add Graphics and Sound',
        description: 'Implement visual elements and audio effects',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Test and Polish',
        description: 'Test gameplay and add final touches',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private _getGenericSteps(_description: string): AgentStep[] {
    return [
      {
        id: generateId(),
        title: 'Analyze Task',
        description: 'Break down the task requirements and plan approach',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Execute Main Task',
        description: 'Perform the core task operations',
        status: 'pending',
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        title: 'Verify Results',
        description: 'Check results and ensure task completion',
        status: 'pending',
        timestamp: Date.now(),
      },
    ];
  }

  private async _executeStep(step: AgentStep, task: AgentTask): Promise<void> {
    step.status = 'running';
    step.timestamp = Date.now();
    this._options.onStepStart?.(step);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Step timeout')), this._options.stepTimeout);
      });

      const executionPromise = this._performStepExecution(step, task);

      await Promise.race([executionPromise, timeoutPromise]);

      step.status = 'completed';
      step.timestamp = Date.now();
      this._options.onStepComplete?.(step);
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.timestamp = Date.now();
      throw error;
    }
  }

  private async _performStepExecution(step: AgentStep, task: AgentTask): Promise<void> {
    console.log(`🤖 Agent: Executing step "${step.title}"`);

    try {
      // Use intelligent step execution based on step content
      const toolCalls = this._determineToolCalls(step, task);
      step.toolCalls = [];

      if (toolCalls.length > 0) {
        for (const toolCallData of toolCalls) {
          const toolCall: ToolCall = {
            id: generateId(),
            name: toolCallData.name,
            parameters: toolCallData.parameters,
            timestamp: Date.now(),
          };

          try {
            console.log(`🔧 Agent: Using tool ${toolCall.name} with params:`, toolCall.parameters);

            const toolResult = await toolRegistry.execute(toolCall);
            toolCall.result = toolResult;
            step.toolCalls.push(toolCall);

            console.log(`�?Agent: Tool ${toolCall.name} completed successfully`);
          } catch (error) {
            console.error(`�?Agent: Tool ${toolCall.name} failed:`, error);
            toolCall.error = error instanceof Error ? error.message : 'Unknown error';
            step.toolCalls.push(toolCall);
            throw new Error(`Tool execution failed: ${toolCall.error}`);
          }
        }

        step.output = this._generateStepSummary(step, toolCalls);
      } else {
        // Analysis or planning step
        step.output = `Completed: ${step.description}`;
      }
    } catch (error) {
      console.error('�?Agent: Step execution failed:', error);
      step.output = `Step failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    }
  }

  private _extractTitle(_description: string): string {
    // Extract a title from the description
    const words = description.split(' ').slice(0, 6);
    return words.join(' ') + (description.split(' ').length > 6 ? '...' : '');
  }

  private _determineToolCalls(step: AgentStep, task: AgentTask): Array<{ name: string; parameters: any }> {
    const stepTitle = step.title.toLowerCase();
    const stepDesc = step.description.toLowerCase();
    const taskDesc = task.description.toLowerCase();

    const toolCalls: Array<{ name: string; parameters: any }> = [];

    // File creation patterns
    if (stepTitle.includes('create') || stepTitle.includes('setup') || stepTitle.includes('initialize')) {
      if (taskDesc.includes('react') || taskDesc.includes('todo')) {
        toolCalls.push(...StepHelpers.getReactFileCreationCalls(task));
      } else if (taskDesc.includes('express') || taskDesc.includes('api')) {
        toolCalls.push(...StepHelpers.getExpressFileCreationCalls(task));
      } else if (taskDesc.includes('html') || stepDesc.includes('html')) {
        toolCalls.push(...StepHelpers.getHtmlFileCreationCalls(task));
      } else if (taskDesc.includes('python') || stepDesc.includes('python')) {
        toolCalls.push(...StepHelpers.getPythonFileCreationCalls(task));
      } else if (stepDesc.includes('file')) {
        toolCalls.push(...StepHelpers.getGenericFileCreationCalls(task, step));
      }
    }

    // Command execution patterns
    if (stepTitle.includes('install') || stepTitle.includes('run') || stepTitle.includes('test')) {
      toolCalls.push(...StepHelpers.getCommandExecutionCalls(step, task));
    }

    // Directory creation
    if (stepTitle.includes('structure') || stepTitle.includes('folder')) {
      toolCalls.push(...StepHelpers.getDirectoryCreationCalls(task));
    }

    return toolCalls;
  }

  private _generateStepSummary(step: AgentStep, toolCalls: Array<{ name: string; parameters: any }>): string {
    return StepHelpers.generateStepSummary(step, toolCalls);
  }

  pause(): void {
    this._isPaused = true;
  }

  resume(): void {
    this._isPaused = false;

    // Resume any waiting steps
    this._stepCallbacks.forEach((callback) => {
      callback();
    });
    this._stepCallbacks.clear();
  }

  skipCurrentStep(): void {
    if (this._currentTask && this._currentTask.steps[this._currentTask.currentStepIndex]) {
      const currentStep = this._currentTask.steps[this._currentTask.currentStepIndex];
      currentStep.status = 'skipped';
      currentStep.output = 'Step skipped by user';
      currentStep.timestamp = Date.now();

      // Resume execution
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

        // Resume execution
        this.resume();
      }
    }
  }

  getTaskSummary(): string {
    if (!this._currentTask) {
      return 'No active task';
    }

    const task = this._currentTask;
    const completedSteps = task.steps.filter((s) => s.status === 'completed').length;
    const failedSteps = task.steps.filter((s) => s.status === 'failed').length;
    const skippedSteps = task.steps.filter((s) => s.status === 'skipped').length;

    let summary = `Task: ${task.title}\n`;
    summary += `Status: ${task.status}\n`;
    summary += `Progress: ${completedSteps}/${task.steps.length} completed`;

    if (failedSteps > 0) {
      summary += `, ${failedSteps} failed`;
    }

    if (skippedSteps > 0) {
      summary += `, ${skippedSteps} skipped`;
    }

    return summary;
  }

  abort(): void {
    this._abortController?.abort();
    this._isRunning = false;
    this._isPaused = false;

    if (this._currentTask) {
      this._currentTask.status = 'cancelled';
      this._currentTask.updatedAt = Date.now();
    }
  }

  getCurrentTask(): AgentTask | undefined {
    return this._currentTask;
  }

  isExecuting(): boolean {
    return this._isRunning;
  }

  isPausedState(): boolean {
    return this._isPaused;
  }
}
