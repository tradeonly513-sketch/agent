// Model capabilities detection and validation service
export interface ModelCapabilities {
  id: string;
  provider: string;
  baseUrl: string;
  
  // Core capabilities
  supportsChat: boolean;
  supportsCompletion: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
  
  // Model metadata
  modelSize?: string; // e.g., "7B", "13B", "70B"
  quantization?: string; // e.g., "Q4_K_M", "Q8_0"
  architecture?: string; // e.g., "llama", "mistral", "phi"
  contextWindow?: number;
  
  // Performance characteristics
  isVerified: boolean;
  lastTested?: Date;
  averageResponseTime?: number;
  memoryRequirements?: string;
  
  // Configuration
  recommendedSettings?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  };
  
  // Validation results
  validationErrors?: string[];
  validationWarnings?: string[];
}

export interface ModelValidationResult {
  isValid: boolean;
  capabilities: Partial<ModelCapabilities>;
  errors: string[];
  warnings: string[];
  responseTime: number;
}

export class ModelCapabilitiesDetector {
  private cache = new Map<string, ModelCapabilities>();
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes

  /**
   * Detect capabilities for a model
   */
  async detectCapabilities(
    provider: string,
    modelId: string,
    baseUrl: string,
    apiKey?: string
  ): Promise<ModelCapabilities> {
    const cacheKey = `${provider}:${modelId}:${baseUrl}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    const capabilities: ModelCapabilities = {
      id: modelId,
      provider,
      baseUrl,
      supportsChat: false,
      supportsCompletion: false,
      supportsStreaming: false,
      supportsFunctionCalling: false,
      supportsVision: false,
      supportsEmbeddings: false,
      isVerified: false,
      lastTested: new Date(),
    };

    try {
      // Test basic chat capability
      const chatResult = await this.testChatCapability(baseUrl, modelId, apiKey);
      capabilities.supportsChat = chatResult.isValid;
      capabilities.averageResponseTime = chatResult.responseTime;
      
      if (chatResult.errors.length > 0) {
        capabilities.validationErrors = chatResult.errors;
      }
      
      if (chatResult.warnings.length > 0) {
        capabilities.validationWarnings = chatResult.warnings;
      }

      // Test streaming capability
      if (capabilities.supportsChat) {
        capabilities.supportsStreaming = await this.testStreamingCapability(baseUrl, modelId, apiKey);
      }

      // Test function calling capability
      if (capabilities.supportsChat) {
        capabilities.supportsFunctionCalling = await this.testFunctionCallingCapability(baseUrl, modelId, apiKey);
      }

      // Detect model metadata from name
      this.enrichModelMetadata(capabilities);

      // Set verification status
      capabilities.isVerified = capabilities.supportsChat && chatResult.errors.length === 0;

      // Cache the result
      this.cache.set(cacheKey, capabilities);
      
      return capabilities;
    } catch (error) {
      console.error(`Error detecting capabilities for ${modelId}:`, error);
      capabilities.validationErrors = [error instanceof Error ? error.message : 'Unknown error'];
      return capabilities;
    }
  }

  /**
   * Test basic chat capability
   */
  private async testChatCapability(
    baseUrl: string,
    modelId: string,
    apiKey?: string
  ): Promise<ModelValidationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const normalizedUrl = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'bolt.diy/1.0',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${normalizedUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        if (response.status === 404) {
          errors.push('Chat completions endpoint not found');
        } else if (response.status === 401) {
          errors.push('Authentication failed');
        } else if (response.status === 400) {
          warnings.push('Model may not support chat format');
        } else {
          errors.push(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return {
          isValid: false,
          capabilities: {},
          errors,
          warnings,
          responseTime,
        };
      }

      const data = await response.json();
      
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        errors.push('Invalid response format');
        return {
          isValid: false,
          capabilities: {},
          errors,
          warnings,
          responseTime,
        };
      }

      return {
        isValid: true,
        capabilities: {
          supportsChat: true,
          averageResponseTime: responseTime,
        },
        errors,
        warnings,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        isValid: false,
        capabilities: {},
        errors,
        warnings,
        responseTime,
      };
    }
  }

  /**
   * Test streaming capability
   */
  private async testStreamingCapability(
    baseUrl: string,
    modelId: string,
    apiKey?: string
  ): Promise<boolean> {
    try {
      const normalizedUrl = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'bolt.diy/1.0',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${normalizedUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
          stream: true,
        }),
        signal: AbortSignal.timeout(15000), // Increased timeout for streaming test
      });

      if (!response.ok) {
        return false;
      }

      // Check if response is actually streaming
      const contentType = response.headers.get('content-type');
      const isStreaming = contentType?.includes('text/event-stream') ||
                         contentType?.includes('application/x-ndjson') ||
                         contentType?.includes('text/plain');

      if (isStreaming) {
        // Try to read a small chunk to verify it's actually streaming
        const reader = response.body?.getReader();
        if (reader) {
          try {
            const { value, done } = await reader.read();
            reader.cancel(); // Cancel the stream after first chunk
            if (!done && value) {
              return true;
            }
          } catch {
            // If we can't read the stream, it's not working properly
            return false;
          }
        }
      }

      return isStreaming;
    } catch {
      return false;
    }
  }

  /**
   * Test function calling capability
   */
  private async testFunctionCallingCapability(
    baseUrl: string,
    modelId: string,
    apiKey?: string
  ): Promise<boolean> {
    try {
      const normalizedUrl = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'bolt.diy/1.0',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${normalizedUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'What time is it?' }],
          max_tokens: 10,
          tools: [{
            type: 'function',
            function: {
              name: 'get_time',
              description: 'Get current time',
              parameters: { type: 'object', properties: {} }
            }
          }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      // If the request succeeds without error, the model likely supports function calling
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Enrich model metadata based on model name patterns
   */
  private enrichModelMetadata(capabilities: ModelCapabilities): void {
    const modelId = capabilities.id.toLowerCase();

    // Detect model size
    const sizePatterns = [
      { pattern: /(\d+)b/i, extract: (match: RegExpMatchArray) => `${match[1]}B` },
      { pattern: /(\d+)m/i, extract: (match: RegExpMatchArray) => `${match[1]}M` },
    ];

    for (const { pattern, extract } of sizePatterns) {
      const match = modelId.match(pattern);
      if (match) {
        capabilities.modelSize = extract(match);
        break;
      }
    }

    // Detect quantization
    const quantPatterns = [
      /q(\d+)_k_m/i,
      /q(\d+)_k_s/i,
      /q(\d+)_k_l/i,
      /q(\d+)_0/i,
      /q(\d+)/i,
    ];

    for (const pattern of quantPatterns) {
      const match = modelId.match(pattern);
      if (match) {
        capabilities.quantization = match[0].toUpperCase();
        break;
      }
    }

    // Detect architecture
    const archPatterns = [
      { pattern: /llama/i, arch: 'LLaMA' },
      { pattern: /mistral/i, arch: 'Mistral' },
      { pattern: /mixtral/i, arch: 'Mixtral' },
      { pattern: /phi/i, arch: 'Phi' },
      { pattern: /gemma/i, arch: 'Gemma' },
      { pattern: /qwen/i, arch: 'Qwen' },
      { pattern: /codellama/i, arch: 'Code Llama' },
      { pattern: /gpt/i, arch: 'GPT' },
      { pattern: /claude/i, arch: 'Claude' },
      { pattern: /deepseek/i, arch: 'DeepSeek' },
      { pattern: /solar/i, arch: 'Solar' },
      { pattern: /openchat/i, arch: 'OpenChat' },
      { pattern: /neural-chat/i, arch: 'Neural Chat' },
      { pattern: /stable-code/i, arch: 'Stable Code' },
      { pattern: /dolphin/i, arch: 'Dolphin' },
      { pattern: /falcon/i, arch: 'Falcon' },
      { pattern: /orca/i, arch: 'Orca' },
      { pattern: /vicuna/i, arch: 'Vicuna' },
    ];

    for (const { pattern, arch } of archPatterns) {
      if (pattern.test(modelId)) {
        capabilities.architecture = arch;
        break;
      }
    }

    // Set recommended settings based on model type
    if (capabilities.architecture) {
      capabilities.recommendedSettings = this.getRecommendedSettings(capabilities.architecture, capabilities.modelSize);
    }

    // Estimate memory requirements
    if (capabilities.modelSize) {
      capabilities.memoryRequirements = this.estimateMemoryRequirements(capabilities.modelSize, capabilities.quantization);
    }
  }

  /**
   * Get recommended settings for a model
   */
  private getRecommendedSettings(architecture: string, modelSize?: string): ModelCapabilities['recommendedSettings'] {
    const settings: ModelCapabilities['recommendedSettings'] = {};

    // Base settings by architecture
    switch (architecture.toLowerCase()) {
      case 'llama':
      case 'code llama':
        settings.temperature = 0.7;
        settings.topP = 0.9;
        break;
      case 'mistral':
      case 'mixtral':
        settings.temperature = 0.6;
        settings.topP = 0.95;
        break;
      case 'phi':
        settings.temperature = 0.8;
        settings.topP = 0.9;
        break;
      case 'gpt':
        settings.temperature = 0.7;
        settings.topP = 1.0;
        break;
      default:
        settings.temperature = 0.7;
        settings.topP = 0.9;
    }

    // Adjust max tokens based on model size
    if (modelSize) {
      const size = parseInt(modelSize.replace(/[^\d]/g, ''));
      if (size >= 70) {
        settings.maxTokens = 4096;
      } else if (size >= 13) {
        settings.maxTokens = 2048;
      } else {
        settings.maxTokens = 1024;
      }
    }

    return settings;
  }

  /**
   * Estimate memory requirements
   */
  private estimateMemoryRequirements(modelSize: string, quantization?: string): string {
    const size = parseInt(modelSize.replace(/[^\d]/g, ''));
    const unit = modelSize.replace(/[\d]/g, '').toUpperCase();

    if (unit === 'B') {
      // Billion parameters
      let baseMemory = size * 2; // Rough estimate: 2GB per billion parameters for FP16
      
      if (quantization) {
        const quantLevel = parseInt(quantization.replace(/[^\d]/g, ''));
        if (quantLevel <= 4) {
          baseMemory *= 0.5; // Q4 uses about half the memory
        } else if (quantLevel <= 8) {
          baseMemory *= 0.75; // Q8 uses about 3/4 the memory
        }
      }

      return `~${Math.round(baseMemory)}GB`;
    } else if (unit === 'M') {
      // Million parameters
      return `~${Math.round(size * 0.002)}GB`;
    }

    return 'Unknown';
  }

  /**
   * Check if cached capabilities are still valid
   */
  private isCacheValid(capabilities: ModelCapabilities): boolean {
    if (!capabilities.lastTested) return false;
    return Date.now() - capabilities.lastTested.getTime() < this.cacheTimeout;
  }

  /**
   * Clear cache for a specific model
   */
  clearCache(provider: string, modelId: string, baseUrl: string): void {
    const cacheKey = `${provider}:${modelId}:${baseUrl}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const modelCapabilitiesDetector = new ModelCapabilitiesDetector();
