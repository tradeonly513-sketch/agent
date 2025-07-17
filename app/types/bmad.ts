// BMad Agent System Types
export interface BmadAgent {
  name: string;
  id: string;
  title: string;
  icon: string;
  whenToUse: string;
  customization?: string;
}

export interface BmadPersona {
  role: string;
  style: string;
  identity: string;
  focus: string;
}

export interface BmadCommand {
  [key: string]: string;
}

export interface BmadDependency {
  tasks?: string[];
  templates?: string[];
  checklists?: string[];
  data?: string[];
  utils?: string[];
}

export interface BmadAgentConfig {
  'IDE-FILE-RESOLUTION'?: string[];
  'REQUEST-RESOLUTION'?: string;
  'activation-instructions'?: string[];
  agent: BmadAgent;
  persona: BmadPersona;
  core_principles?: string[];
  commands: BmadCommand;
  dependencies?: BmadDependency;
  [key: string]: any;
}

export interface BmadTask {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  elicit?: boolean;
  dependencies?: string[];
  outputs?: string[];
}

export interface BmadTemplate {
  id: string;
  name: string;
  description: string;
  sections: BmadTemplateSection[];
}

export interface BmadTemplateSection {
  name: string;
  instruction: string;
  elicit?: boolean;
  owner?: string;
  editors?: string[];
  readonly?: boolean;
}

export interface BmadExecutionContext {
  currentAgent?: BmadAgentConfig;
  activeTask?: BmadTask;
  userInputRequired?: boolean;
  stepIndex: number;
  variables: Record<string, any>;
}

export interface BmadState {
  isActive: boolean;
  currentAgent?: BmadAgentConfig;
  availableAgents: BmadAgentConfig[];
  executionContext?: BmadExecutionContext;
  commandHistory: string[];
  mode: 'interactive' | 'yolo';
}

export type BmadCommandType =
  | 'help'
  | 'agent'
  | 'task'
  | 'workflow'
  | 'status'
  | 'exit'
  | 'chat-mode'
  | 'kb-mode'
  | 'yolo'
  | 'party-mode';

export interface BmadElicitationMethod {
  id: string;
  name: string;
  description: string;
  instructions: string[];
}

export interface BmadWorkflow {
  id: string;
  name: string;
  description: string;
  steps: BmadWorkflowStep[];
  agents: string[];
}

export interface BmadWorkflowStep {
  id: string;
  title: string;
  agent: string;
  task?: string;
  dependencies?: string[];
  outputs: string[];
}
