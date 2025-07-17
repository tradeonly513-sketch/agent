import type { BmadAgentConfig, BmadTask, BmadExecutionContext, BmadCommandType } from '~/types/bmad';
import { BmadParser } from './bmad-parser';
import { bmadActions } from '~/lib/stores/bmad-store';

export interface BmadExecutorOptions {
  onAgentActivated?: (agent: BmadAgentConfig) => void;
  onTaskStarted?: (task: BmadTask) => void;
  onTaskCompleted?: (task: BmadTask) => void;
  onUserInputRequired?: (prompt: string) => Promise<string>;
  onOutput?: (message: string) => void;
  onError?: (error: Error) => void;
}

export class BmadExecutor {
  private _options: BmadExecutorOptions;
  private _availableAgents: Map<string, BmadAgentConfig> = new Map();
  private _availableTasks: Map<string, BmadTask> = new Map();

  constructor(options: BmadExecutorOptions = {}) {
    this._options = options;
  }

  /**
   * Initialize BMad system with agents and tasks
   */
  async initialize() {
    try {
      // Load built-in agents
      await this.loadBuiltInAgents();

      // Load built-in tasks
      await this.loadBuiltInTasks();

      // Update store with available agents
      bmadActions.setAvailableAgents(Array.from(this._availableAgents.values()));

      /*
       * Don't auto-activate - let user activate manually
       * bmadActions.activate();
       */

      console.log('BMad system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BMad system:', error);
      this.handleError(new Error(`Failed to initialize BMad system: ${error}`));
    }
  }

  /**
   * Execute a command
   */
  async executeCommand(input: string): Promise<void> {
    try {
      const parsed = BmadParser.parseCommand(input);

      if (!parsed) {
        // Not a BMad command, handle as regular input
        await this.handleRegularInput(input);
        return;
      }

      const { command, args } = parsed;
      bmadActions.addCommandToHistory(input);

      // Add timeout to prevent hanging
      const commandPromise = this._executeCommandInternal(command as BmadCommandType, args);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Command timeout')), 10000); // 10 second timeout
      });

      await Promise.race([commandPromise, timeoutPromise]);
    } catch (error) {
      console.error('BMad command execution error:', error);
      this.handleError(new Error(`Command execution failed: ${error}`));
    }
  }

  /**
   * Internal command execution
   */
  private async _executeCommandInternal(command: BmadCommandType, args: string[]): Promise<void> {
    switch (command) {
      case 'help':
        await this.handleHelpCommand(args);
        break;
      case 'agent':
        await this.handleAgentCommand(args);
        break;
      case 'task':
        await this.handleTaskCommand(args);
        break;
      case 'status':
        await this.handleStatusCommand();
        break;
      case 'exit':
        await this.handleExitCommand();
        break;
      case 'yolo':
        await this.handleYoloCommand();
        break;
      default:
        this.output(`Unknown command: ${command}. Type *help for available commands.`);
    }
  }

  /**
   * Handle help command
   */
  private async handleHelpCommand(args: string[]): Promise<void> {
    const currentAgent = bmadActions.getCurrentAgent();

    if (currentAgent) {
      // Show agent-specific help
      const helpText = BmadParser.formatHelpDisplay(currentAgent);
      this.output(helpText);
    } else {
      // Show general BMad help
      let helpText = '=== BMad System Help ===\n\n';
      helpText += 'Available Commands:\n';
      helpText += '*help ............... Show this help\n';
      helpText += '*agent [name] ....... Activate an agent\n';
      helpText += '*task [name] ........ Execute a task\n';
      helpText += '*status ............. Show current status\n';
      helpText += '*yolo ............... Toggle YOLO mode\n';
      helpText += '*exit ............... Exit BMad system\n\n';

      helpText += 'Available Agents:\n';
      this._availableAgents.forEach((agent) => {
        helpText += `*agent ${agent.agent.id}: ${agent.agent.title}\n`;
        helpText += `  ${agent.agent.whenToUse}\n\n`;
      });

      this.output(helpText);
    }
  }

  /**
   * Handle agent command
   */
  private async handleAgentCommand(args: string[]): Promise<void> {
    if (args.length === 0) {
      // List available agents
      let output = 'Available Agents:\n';
      this._availableAgents.forEach((agent, id) => {
        output += `${id}: ${agent.agent.title} - ${agent.agent.whenToUse}\n`;
      });
      this.output(output);

      return;
    }

    const agentId = args[0];
    const agent = this._availableAgents.get(agentId);

    if (!agent) {
      this.output(`Agent '${agentId}' not found. Use *agent to list available agents.`);
      return;
    }

    // Activate agent
    bmadActions.setCurrentAgent(agent);
    this._options.onAgentActivated?.(agent);

    // Execute activation instructions
    const activationInstructions = BmadParser.extractActivationInstructions(agent);

    let greeting = `${agent.agent.icon} ${agent.agent.name} activated!\n\n`;
    greeting += `Role: ${agent.persona.role}\n`;
    greeting += `Focus: ${agent.persona.focus}\n\n`;
    greeting += `Type *help for available commands.\n`;

    this.output(greeting);
  }

  /**
   * Handle task command
   */
  private async handleTaskCommand(args: string[]): Promise<void> {
    const currentAgent = bmadActions.getCurrentAgent();

    if (!currentAgent) {
      this.output('No agent is currently active. Use *agent [name] to activate an agent first.');
      return;
    }

    if (args.length === 0) {
      // List available tasks for current agent
      const agentTasks = this.getTasksForAgent(currentAgent);
      let output = `Available tasks for ${currentAgent.agent.name}:\n`;
      agentTasks.forEach((task) => {
        output += `${task.id}: ${task.title}\n`;
      });
      this.output(output);

      return;
    }

    const taskId = args[0];
    const task = this._availableTasks.get(taskId);

    if (!task) {
      this.output(`Task '${taskId}' not found.`);
      return;
    }

    // Execute task
    await this.executeTask(task);
  }

  /**
   * Handle status command
   */
  private async handleStatusCommand(): Promise<void> {
    const currentAgent = bmadActions.getCurrentAgent();
    const context = bmadActions.getExecutionContext();
    const mode = bmadActions.getMode();

    let status = '=== BMad Status ===\n';
    status += `Mode: ${mode}\n`;
    status += `Active: ${bmadActions.isActive() ? 'Yes' : 'No'}\n`;

    if (currentAgent) {
      status += `Current Agent: ${currentAgent.agent.name} (${currentAgent.agent.title})\n`;
    } else {
      status += 'Current Agent: None\n';
    }

    if (context?.activeTask) {
      status += `Active Task: ${context.activeTask.title}\n`;
      status += `Step: ${context.stepIndex + 1}\n`;
    } else {
      status += 'Active Task: None\n';
    }

    this.output(status);
  }

  /**
   * Handle exit command
   */
  private async handleExitCommand(): Promise<void> {
    const currentAgent = bmadActions.getCurrentAgent();

    if (currentAgent) {
      this.output(`Goodbye from ${currentAgent.agent.name}! Exiting agent mode.`);
      bmadActions.clearCurrentAgent();
    } else {
      this.output('Exiting BMad system.');
      bmadActions.deactivate();
    }
  }

  /**
   * Handle yolo command
   */
  private async handleYoloCommand(): Promise<void> {
    bmadActions.toggleMode();

    const mode = bmadActions.getMode();
    this.output(`YOLO mode ${mode === 'yolo' ? 'enabled' : 'disabled'}.`);
  }

  /**
   * Handle regular input (non-command)
   */
  private async handleRegularInput(input: string): Promise<void> {
    const currentAgent = bmadActions.getCurrentAgent();

    if (currentAgent) {
      // Process input in context of current agent
      this.output(`${currentAgent.agent.name}: Processing your request...`);

      /*
       * Here you would integrate with the main chat/LLM system
       * passing the agent context and persona
       */
    } else {
      this.output('No agent is active. Use *agent [name] to activate an agent, or *help for commands.');
    }
  }

  /**
   * Execute a task
   */
  private async executeTask(task: BmadTask): Promise<void> {
    const currentAgent = bmadActions.getCurrentAgent();

    if (!currentAgent) {
      return;
    }

    this._options.onTaskStarted?.(task);

    const context: BmadExecutionContext = {
      currentAgent,
      activeTask: task,
      userInputRequired: false,
      stepIndex: 0,
      variables: {},
    };

    bmadActions.setExecutionContext(context);

    this.output(`Starting task: ${task.title}`);

    // Execute task instructions
    for (let i = 0; i < task.instructions.length; i++) {
      const instruction = task.instructions[i];

      bmadActions.updateExecutionContext({ stepIndex: i });

      this.output(`Step ${i + 1}: ${instruction}`);

      // If task requires elicitation, wait for user input
      if (task.elicit && this._options.onUserInputRequired) {
        const userInput = await this._options.onUserInputRequired('Please provide your input for this step:');
        this.output(`User input: ${userInput}`);
      }

      // Simulate step execution delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.output(`Task completed: ${task.title}`);
    this._options.onTaskCompleted?.(task);

    bmadActions.updateExecutionContext({ activeTask: undefined });
  }

  /**
   * Get tasks available for an agent
   */
  private getTasksForAgent(agent: BmadAgentConfig): BmadTask[] {
    const agentTasks = agent.dependencies?.tasks || [];
    return agentTasks
      .map((taskId) => this._availableTasks.get(taskId))
      .filter((task) => task !== undefined) as BmadTask[];
  }

  /**
   * Load built-in agents
   */
  private async loadBuiltInAgents(): Promise<void> {
    try {
      // Load orchestrator agent from YAML
      const orchestratorYaml = await this.loadAgentYaml('orchestrator');

      if (orchestratorYaml) {
        this._availableAgents.set('bmad-orchestrator', orchestratorYaml);
      }

      // Load dev agent from YAML
      const devYaml = await this.loadAgentYaml('dev');

      if (devYaml) {
        this._availableAgents.set('dev', devYaml);
      }

      // Fallback to hardcoded agents if YAML loading fails
      if (this._availableAgents.size === 0) {
        this.loadFallbackAgents();
      }
    } catch (error) {
      console.warn('Failed to load YAML agents, using fallback:', error);
      this.loadFallbackAgents();
    }
  }

  /**
   * Load agent configuration from YAML file
   */
  private async loadAgentYaml(agentName: string): Promise<BmadAgentConfig | null> {
    try {
      /*
       * In a real implementation, you would fetch the YAML file
       * For now, we'll simulate loading from the YAML files we created
       */
      const yamlContent = await this.getAgentYamlContent(agentName);

      if (!yamlContent) {
        return null;
      }

      return BmadParser.parseAgentFromMarkdown(`\`\`\`yaml\n${yamlContent}\n\`\`\``);
    } catch (error) {
      console.error(`Failed to load agent ${agentName}:`, error);
      return null;
    }
  }

  /**
   * Get YAML content for an agent (simulated)
   */
  private async getAgentYamlContent(agentName: string): Promise<string | null> {
    /*
     * In a real implementation, this would fetch from the file system or API
     * For now, we'll return the YAML content directly
     */

    const agentConfigs: Record<string, string> = {
      orchestrator: `
IDE-FILE-RESOLUTION:
  - FOR LATER USE ONLY - NOT FOR ACTIVATION, when executing commands that reference dependencies

agent:
  name: BMad Orchestrator
  id: bmad-orchestrator
  title: BMad Master Orchestrator
  icon: 🎭
  whenToUse: Use for workflow coordination, multi-agent tasks, role switching guidance, and when unsure which specialist to consult

persona:
  role: Master Orchestrator & BMad Method Expert
  style: Knowledgeable, guiding, adaptable, efficient, encouraging, technically brilliant yet approachable
  identity: Unified interface to all BMad-Method capabilities, dynamically transforms into any specialized agent
  focus: Orchestrating the right agent/capability for each need, loading resources only when needed

commands:
  help: Show this guide with available agents and workflows
  agent: Transform into a specialized agent (list if name not specified)
  task: Run a specific task (list if name not specified)
  status: Show current context, active agent, and progress
  exit: Return to BMad or exit session
  yolo: Toggle skip confirmations mode

dependencies:
  tasks:
    - create-doc
    - execute-checklist
      `,
      dev: `
agent:
  name: James
  id: dev
  title: Full Stack Developer
  icon: 💻
  whenToUse: Use for code implementation, debugging, refactoring, and development best practices

persona:
  role: Expert Senior Software Engineer & Implementation Specialist
  style: Extremely concise, pragmatic, detail-oriented, solution-focused
  identity: Expert who implements stories by reading requirements and executing tasks sequentially with comprehensive testing
  focus: Executing story tasks with precision, updating Dev Agent Record sections only, maintaining minimal context overhead

commands:
  help: Show numbered list of the following commands to allow selection
  run-tests: Execute linting and tests
  explain: Teach me what and why you did whatever you just did in detail so I can learn
  exit: Say goodbye as the Developer, and then abandon inhabiting this persona

dependencies:
  tasks:
    - execute-checklist
    - validate-next-story
  checklists:
    - story-dod-checklist
      `,
    };

    return agentConfigs[agentName] || null;
  }

  /**
   * Load fallback agents if YAML loading fails
   */
  private loadFallbackAgents(): void {
    const orchestratorAgent: BmadAgentConfig = {
      agent: {
        name: 'BMad Orchestrator',
        id: 'bmad-orchestrator',
        title: 'BMad Master Orchestrator',
        icon: '🎭',
        whenToUse: 'Use for workflow coordination, multi-agent tasks, role switching guidance',
      },
      persona: {
        role: 'Master Orchestrator & BMad Method Expert',
        style: 'Knowledgeable, guiding, adaptable, efficient',
        identity: 'Unified interface to all BMad-Method capabilities',
        focus: 'Orchestrating the right agent/capability for each need',
      },
      commands: {
        help: 'Show available commands and agents',
        agent: 'Transform into a specialized agent',
        task: 'Run a specific task',
        status: 'Show current context and progress',
      },
      dependencies: {
        tasks: ['create-doc', 'execute-checklist'],
      },
    };

    const devAgent: BmadAgentConfig = {
      agent: {
        name: 'James',
        id: 'dev',
        title: 'Full Stack Developer',
        icon: '💻',
        whenToUse: 'Use for code implementation, debugging, refactoring, and development best practices',
      },
      persona: {
        role: 'Expert Senior Software Engineer & Implementation Specialist',
        style: 'Extremely concise, pragmatic, detail-oriented, solution-focused',
        identity: 'Expert who implements stories by reading requirements and executing tasks sequentially',
        focus: 'Executing story tasks with precision, maintaining minimal context overhead',
      },
      commands: {
        help: 'Show available commands',
        'run-tests': 'Execute linting and tests',
        explain: 'Explain what and why you did in detail',
        exit: 'Exit developer mode',
      },
      dependencies: {
        tasks: ['execute-checklist', 'validate-next-story'],
      },
    };

    this._availableAgents.set('bmad-orchestrator', orchestratorAgent);
    this._availableAgents.set('dev', devAgent);
  }

  /**
   * Load built-in tasks
   */
  private async loadBuiltInTasks(): Promise<void> {
    const createDocTask: BmadTask = {
      id: 'create-doc',
      title: 'Create Document from Template',
      description: 'Create a document using a template with user interaction',
      instructions: [
        'Discover available templates',
        'Parse template structure',
        'Process each section with user input',
        'Generate final document',
      ],
      elicit: true,
      dependencies: [],
      outputs: ['Generated document'],
    };

    const executeChecklistTask: BmadTask = {
      id: 'execute-checklist',
      title: 'Execute Checklist Validation',
      description: 'Validate documentation against checklists',
      instructions: [
        'Load specified checklist',
        'Gather required documents',
        'Process checklist items',
        'Generate validation report',
      ],
      elicit: false,
      dependencies: [],
      outputs: ['Validation report'],
    };

    this._availableTasks.set('create-doc', createDocTask);
    this._availableTasks.set('execute-checklist', executeChecklistTask);
  }

  /**
   * Output message
   */
  private output(message: string): void {
    this._options.onOutput?.(message);
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    this._options.onError?.(error);
  }
}
