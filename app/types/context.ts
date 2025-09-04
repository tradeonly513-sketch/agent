export type ContextAnnotation =
  | {
      type: 'codeContext';
      files: string[];
    }
  | {
      type: 'chatSummary';
      summary: string;
      chatId: string;
    };

export type ProgressAnnotation = {
  type: 'progress';
  label: string;
  status: 'in-progress' | 'complete';
  order: number;
  message: string;
};

export type ToolCallAnnotation = {
  type: 'toolCall';
  toolCallId: string;
  serverName: string;
  toolName: string;
  toolDescription: string;
  serverStatus: 'available' | 'unavailable';
  serverType: 'stdio' | 'sse' | 'streamable-http';
  toolSchema?: {
    parameters?: Record<string, string | number | boolean | null>;
    required?: string[];
  };
  serverError?: string;
  serverCapabilities: string[];

  // Model context for debugging and optimization
  modelContext?: {
    currentModel: {
      provider: string;
      model: string;
    };
    recommendedModel?: {
      provider: string;
      model: string;
      reasoning: string;
    };
    compatibilityScore: 'excellent' | 'good' | 'limited' | 'poor' | 'unknown';
    serverPreference?: {
      provider: string;
      model: string;
      isUserConfigured: boolean;
    };
  };
};
