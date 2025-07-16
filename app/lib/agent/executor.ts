import type { AgentTask, AgentStep, ToolCall } from '~/types/actions';
import { toolRegistry } from './tools';
import { generateId } from 'ai';

export interface AgentExecutorOptions {
  maxSteps?: number;
  stepTimeout?: number;
  onStepStart?: (step: AgentStep) => void;
  onStepComplete?: (step: AgentStep) => void;
  onStepError?: (step: AgentStep, error: Error) => void;
  onTaskComplete?: (task: AgentTask) => void;
  onTaskError?: (task: AgentTask, error: Error) => void;
  onUserInputRequired?: (prompt: string) => Promise<string>;
}

export class AgentExecutor {
  private _options: AgentExecutorOptions;
  private _currentTask?: AgentTask;
  private _isRunning = false;
  private _isPaused = false;
  private _abortController?: AbortController;

  constructor(options: AgentExecutorOptions = {}) {
    this._options = {
      maxSteps: 10,
      stepTimeout: 30000, // 30 seconds
      ...options,
    };
  }

  async executeTask(description: string, context?: Record<string, any>): Promise<AgentTask> {
    if (this._isRunning) {
      throw new Error('Agent is already running a task');
    }

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
      // Parse the task into steps
      const steps = await this._parseTaskIntoSteps(description);
      task.steps = steps;
      task.status = 'running';
      task.updatedAt = Date.now();

      // Execute steps sequentially
      for (let i = 0; i < steps.length; i++) {
        if (this._abortController?.signal.aborted) {
          task.status = 'cancelled';
          break;
        }

        if (this._isPaused) {
          task.status = 'paused';
          break;
        }

        task.currentStepIndex = i;

        const step = steps[i];

        try {
          await this._executeStep(step);

          if (step.status === 'failed') {
            task.status = 'failed';
            break;
          }
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Unknown error';
          this._options.onStepError?.(step, error instanceof Error ? error : new Error('Unknown error'));
          task.status = 'failed';
          break;
        }
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
    }

    return task;
  }

  private async _parseTaskIntoSteps(description: string): Promise<AgentStep[]> {
    /*
     * This is a simplified implementation
     * In a real implementation, this would use LLM to break down the task
     */
    const steps: AgentStep[] = [];

    // Example step parsing logic
    if (description.toLowerCase().includes('create') && description.toLowerCase().includes('file')) {
      steps.push({
        id: generateId(),
        title: 'Analyze Requirements',
        description: 'Analyze the file creation requirements',
        status: 'pending',
        timestamp: Date.now(),
      });

      steps.push({
        id: generateId(),
        title: 'Create File',
        description: 'Create the requested file with appropriate content',
        status: 'pending',
        timestamp: Date.now(),
      });

      steps.push({
        id: generateId(),
        title: 'Verify Creation',
        description: 'Verify that the file was created successfully',
        status: 'pending',
        timestamp: Date.now(),
      });
    } else {
      // Default generic steps
      steps.push({
        id: generateId(),
        title: 'Analyze Task',
        description: 'Analyze the task requirements and plan execution',
        status: 'pending',
        timestamp: Date.now(),
      });

      steps.push({
        id: generateId(),
        title: 'Execute Task',
        description: 'Execute the main task logic',
        status: 'pending',
        timestamp: Date.now(),
      });

      steps.push({
        id: generateId(),
        title: 'Finalize',
        description: 'Complete the task and provide results',
        status: 'pending',
        timestamp: Date.now(),
      });
    }

    return steps;
  }

  private async _executeStep(step: AgentStep): Promise<void> {
    step.status = 'running';
    step.timestamp = Date.now();
    this._options.onStepStart?.(step);

    try {
      // Simulate step execution with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Step timeout')), this._options.stepTimeout);
      });

      const executionPromise = this._performStepExecution(step);

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

  private async _performStepExecution(step: AgentStep): Promise<void> {
    /*
     * This is where the actual step logic would be implemented
     * For now, we'll simulate execution
     */

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate work

    step.output = `Completed: ${step.description}`;

    // Example of tool usage
    if (step.title.toLowerCase().includes('create file')) {
      const toolCall: ToolCall = {
        id: generateId(),
        name: 'create_file',
        parameters: {
          path: 'example.txt',
          content: 'Hello, World!',
        },
        timestamp: Date.now(),
      };

      try {
        const result = await toolRegistry.execute(toolCall);
        toolCall.result = result;
        step.toolCalls = [toolCall];
        step.output = `File created successfully: ${result.message}`;
      } catch (error) {
        toolCall.error = error instanceof Error ? error.message : 'Unknown error';
        step.toolCalls = [toolCall];
        throw error;
      }
    }
  }

  private _extractTitle(description: string): string {
    // Extract a title from the description
    const words = description.split(' ').slice(0, 6);
    return words.join(' ') + (description.split(' ').length > 6 ? '...' : '');
  }

  pause(): void {
    this._isPaused = true;
  }

  resume(): void {
    this._isPaused = false;
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
