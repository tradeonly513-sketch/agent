import yaml from 'js-yaml';
import type { BmadAgentConfig, BmadTask, BmadTemplate } from '~/types/bmad';

export class BmadParser {
  /**
   * Parse BMad agent configuration from markdown content
   */
  static parseAgentFromMarkdown(content: string): BmadAgentConfig | null {
    try {
      // Extract YAML block from markdown
      const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);

      if (!yamlMatch) {
        console.warn('No YAML block found in agent markdown');
        return null;
      }

      const yamlContent = yamlMatch[1];
      const parsed = yaml.load(yamlContent) as any;

      // Validate required fields
      if (!parsed.agent || !parsed.persona || !parsed.commands) {
        console.error('Invalid agent configuration: missing required fields');
        return null;
      }

      return parsed as BmadAgentConfig;
    } catch (error) {
      console.error('Error parsing agent configuration:', error);
      return null;
    }
  }

  /**
   * Parse BMad task from markdown content
   */
  static parseTaskFromMarkdown(content: string): BmadTask | null {
    try {
      const lines = content.split('\n');
      let title = '';
      const description = '';
      const instructions: string[] = [];
      let elicit = false;

      // Extract title from first heading
      const titleMatch = lines.find((line) => line.startsWith('# '));

      if (titleMatch) {
        title = titleMatch.replace('# ', '').trim();
      }

      // Look for elicit indicators
      if (content.includes('elicit: true') || content.includes('MANDATORY ELICITATION')) {
        elicit = true;
      }

      // Extract instructions from content
      let inInstructionsSection = false;

      for (const line of lines) {
        if (line.includes('## Instructions') || line.includes('## Processing Flow')) {
          inInstructionsSection = true;
          continue;
        }

        if (inInstructionsSection && line.startsWith('## ')) {
          inInstructionsSection = false;
        }

        if (inInstructionsSection && line.trim()) {
          instructions.push(line.trim());
        }
      }

      // Generate ID from title
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');

      return {
        id,
        title,
        description: description || title,
        instructions,
        elicit,
        dependencies: [],
        outputs: [],
      };
    } catch (error) {
      console.error('Error parsing task:', error);
      return null;
    }
  }

  /**
   * Parse command from user input
   */
  static parseCommand(input: string): { command: string; args: string[] } | null {
    const trimmed = input.trim();

    // Check if it starts with *
    if (!trimmed.startsWith('*')) {
      return null;
    }

    // Remove * and split by spaces
    const parts = trimmed.substring(1).split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    return { command, args };
  }

  /**
   * Extract activation instructions from agent config
   */
  static extractActivationInstructions(config: BmadAgentConfig): string[] {
    return config['activation-instructions'] || [];
  }

  /**
   * Extract dependencies from agent config
   */
  static extractDependencies(config: BmadAgentConfig): string[] {
    const deps: string[] = [];

    if (config.dependencies) {
      if (config.dependencies.tasks) {
        deps.push(...config.dependencies.tasks);
      }

      if (config.dependencies.templates) {
        deps.push(...config.dependencies.templates);
      }

      if (config.dependencies.checklists) {
        deps.push(...config.dependencies.checklists);
      }

      if (config.dependencies.data) {
        deps.push(...config.dependencies.data);
      }

      if (config.dependencies.utils) {
        deps.push(...config.dependencies.utils);
      }
    }

    return deps;
  }

  /**
   * Validate agent configuration
   */
  static validateAgentConfig(config: any): boolean {
    const required = ['agent', 'persona', 'commands'];
    return required.every((field) => config[field]);
  }

  /**
   * Format help display for agent
   */
  static formatHelpDisplay(config: BmadAgentConfig): string {
    const { agent, commands } = config;

    let help = `=== ${agent.title} (${agent.name}) ===\n`;
    help += `${agent.icon} ${agent.whenToUse}\n\n`;
    help += `Available Commands:\n`;

    Object.entries(commands).forEach(([cmd, desc]) => {
      help += `*${cmd} ............... ${desc}\n`;
    });

    return help;
  }
}
