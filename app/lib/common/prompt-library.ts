import React from 'react';
import { getCodingPrompt } from './prompts/coding-prompt';
import { getLightweightPrompt } from './prompts/lightweight-prompt';
import type { DesignScheme } from '~/types/design-scheme';
import { Code, Zap, Settings } from 'lucide-react';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

export interface PromptInfo {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  bestFor: string[];
  tokenUsage: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'advanced';
  recommended?: boolean;
  isCustom?: boolean;
}

export interface CustomPrompt {
  id: string;
  label: string;
  description: string;
  content: string;
  features: string[];
  bestFor: string[];
  tokenUsage: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'advanced';
  designScheme?: DesignScheme;
  createdAt: string;
  updatedAt: string;
}

export class PromptLibrary {
  static library: Record<
    string,
    {
      label: string;
      description: string;
      get: (options: PromptOptions) => string;
      info: PromptInfo;
    }
  > = {
    coding: {
      label: 'Full-Featured Coding',
      description:
        'Complete development environment with advanced AI capabilities, design systems, and mobile app support. Best for creating new projects and complex development tasks.',
      get: (options) => getCodingPrompt(options.cwd, options.supabase, options.designScheme),
      info: {
        id: 'coding',
        label: 'Full-Featured Coding',
        description:
          'Complete development environment with advanced AI capabilities, design systems, and mobile app support. Perfect for creating new projects and complex development tasks.',
        icon: Code,
        features: [
          'Advanced Token Management',
          'Mobile App Development',
          'Production-Ready Designs',
          'Database Integration',
          'Component Architecture',
          'Accessibility Support',
          'Real-time Optimization',
          'Multi-framework Support',
        ],
        bestFor: [
          'New Projects',
          'Complex Applications',
          'Mobile Apps',
          'Full-Stack Development',
          'Design Systems',
          'Production Apps',
        ],
        tokenUsage: 'high',
        complexity: 'advanced',
        recommended: true,
      },
    },
    lightweight: {
      label: 'Lightweight & Fast',
      description:
        'Streamlined prompt for quick tasks, simple fixes, and when response speed matters most. Lower token usage with essential features only.',
      get: (options) => getLightweightPrompt(options),
      info: {
        id: 'lightweight',
        label: 'Lightweight & Fast',
        description:
          'Streamlined prompt for quick tasks, simple fixes, and when response speed matters most. Optimized for speed with essential features only.',
        icon: Zap,
        features: [
          'Fast Responses',
          'Low Token Usage',
          'Essential Features',
          'Quick Fixes',
          'Basic Artifacts',
          'Simple Projects',
          'Performance Optimized',
          'Minimal Dependencies',
        ],
        bestFor: [
          'Quick Fixes',
          'Simple Tasks',
          'Prototyping',
          'Learning',
          'Speed-Critical Work',
          'Resource-Limited Usage',
        ],
        tokenUsage: 'low',
        complexity: 'simple',
      },
    },
  };

  // Custom prompts storage
  private static _customPrompts: Map<string, CustomPrompt> = new Map();

  // Initialize custom prompts from localStorage
  static initializeCustomPrompts(): void {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bolt_custom_prompts');

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          this._customPrompts = new Map(Object.entries(parsed));
        } catch (error) {
          console.error('Error loading custom prompts:', error);
        }
      }
    }
  }

  // Save custom prompts to localStorage
  private static _saveCustomPrompts(): void {
    if (typeof window !== 'undefined') {
      const data = Object.fromEntries(this._customPrompts);
      localStorage.setItem('bolt_custom_prompts', JSON.stringify(data));
    }
  }

  static getInfoList(): PromptInfo[] {
    const builtInPrompts = Object.entries(this.library).map(([key, value]) => ({
      ...value.info,
      id: key,
    }));

    const customPrompts = Array.from(this._customPrompts.values()).map((prompt) => ({
      id: prompt.id,
      label: prompt.label,
      description: prompt.description,
      icon: Settings,
      features: prompt.features,
      bestFor: prompt.bestFor,
      tokenUsage: prompt.tokenUsage,
      complexity: prompt.complexity,
      isCustom: true,
    }));

    return [...builtInPrompts, ...customPrompts];
  }

  static getPromptInfo(promptId: string): PromptInfo | null {
    // Check built-in prompts first
    const builtInPrompt = this.library[promptId];

    if (builtInPrompt) {
      return { ...builtInPrompt.info, id: promptId };
    }

    // Check custom prompts
    const customPrompt = this._customPrompts.get(promptId);

    if (customPrompt) {
      return {
        id: customPrompt.id,
        label: customPrompt.label,
        description: customPrompt.description,
        icon: Settings,
        features: customPrompt.features,
        bestFor: customPrompt.bestFor,
        tokenUsage: customPrompt.tokenUsage,
        complexity: customPrompt.complexity,
        isCustom: true,
      };
    }

    return null;
  }

  static getPropmtFromLibrary(promptId: string, options: PromptOptions) {
    // Check built-in prompts first
    const builtInPrompt = this.library[promptId];

    if (builtInPrompt) {
      return builtInPrompt.get(options);
    }

    // Check custom prompts
    const customPrompt = this._customPrompts.get(promptId);

    if (customPrompt) {
      return this._generateCustomPrompt(customPrompt, options);
    }

    throw new Error('Prompt Not Found');
  }

  // Custom prompt management methods
  static getCustomPrompts(): CustomPrompt[] {
    return Array.from(this._customPrompts.values());
  }

  static getCustomPrompt(id: string): CustomPrompt | null {
    return this._customPrompts.get(id) || null;
  }

  static createCustomPrompt(promptData: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>): CustomPrompt {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const customPrompt: CustomPrompt = {
      ...promptData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this._customPrompts.set(id, customPrompt);
    this._saveCustomPrompts();

    return customPrompt;
  }

  static updateCustomPrompt(id: string, updates: Partial<Omit<CustomPrompt, 'id' | 'createdAt'>>): CustomPrompt | null {
    const existingPrompt = this._customPrompts.get(id);

    if (!existingPrompt) {
      return null;
    }

    const updatedPrompt: CustomPrompt = {
      ...existingPrompt,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this._customPrompts.set(id, updatedPrompt);
    this._saveCustomPrompts();

    return updatedPrompt;
  }

  static deleteCustomPrompt(id: string): boolean {
    const deleted = this._customPrompts.delete(id);

    if (deleted) {
      this._saveCustomPrompts();
    }

    return deleted;
  }

  // Generate prompt content for custom prompts
  private static _generateCustomPrompt(customPrompt: CustomPrompt, options: PromptOptions): string {
    let promptContent = customPrompt.content;

    // Replace placeholders with actual values
    promptContent = promptContent.replace(/\{\{cwd\}\}/g, options.cwd);
    promptContent = promptContent.replace(/\{\{allowedHtmlElements\}\}/g, options.allowedHtmlElements.join(', '));
    promptContent = promptContent.replace(/\{\{modificationTagName\}\}/g, options.modificationTagName);

    // Handle design scheme integration
    if (customPrompt.designScheme && options.designScheme) {
      const designScheme = options.designScheme;
      promptContent = promptContent.replace(
        /\{\{designScheme\}\}/g,
        `FONT: ${JSON.stringify(designScheme.font)}\nPALETTE: ${JSON.stringify(designScheme.palette)}\nFEATURES: ${JSON.stringify(designScheme.features)}`,
      );
    }

    // Handle Supabase integration
    if (options.supabase) {
      const { isConnected, hasSelectedProject, credentials } = options.supabase;
      let supabaseInfo = '';

      if (!isConnected) {
        supabaseInfo =
          'You are not connected to Supabase. Remind user to "connect to Supabase in chat box before proceeding".';
      } else if (!hasSelectedProject) {
        supabaseInfo = 'Connected to Supabase but no project selected. Remind user to select project in chat box.';
      } else if (credentials?.supabaseUrl && credentials?.anonKey) {
        supabaseInfo = `
        Create .env file if it doesn't exist with:
        VITE_SUPABASE_URL=${credentials.supabaseUrl}
        VITE_SUPABASE_ANON_KEY=${credentials.anonKey}
        `;
      }

      promptContent = promptContent.replace(/\{\{supabase\}\}/g, supabaseInfo);
    }

    return promptContent;
  }
}

// Initialize custom prompts on module load
PromptLibrary.initializeCustomPrompts();
