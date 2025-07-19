export type ContextAnnotation =
  | {
      type: 'codeContext';
      files: string[];
    }
  | {
      type: 'chatSummary';
      summary: string;
      chatId: string;
    }
  | {
      type: 'contextEngine';
      strategy: 'none' | 'semantic-retrieval' | 'compression' | 'hybrid';
      originalTokens: number;
      optimizedTokens: number;
      compressionRatio: number;
      metadata: {
        intent: any;
        nodesRetrieved: number;
        indexedFiles: number;
        processingTime: number;
      };
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
};
