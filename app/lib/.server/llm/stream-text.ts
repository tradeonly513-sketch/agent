import { convertToCoreMessages, type Message, streamText as _streamText } from 'ai';
import { type FileMap, MAX_TOKENS } from './constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { allowedHTMLElements } from '~/utils/markdown';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createScopedLogger } from '~/utils/logger';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { discussPrompt } from '~/lib/common/prompts/discuss-prompt';
import { ContextManager } from './context-manager';
import { getModelContextWindow } from './token-counter';
import type { DesignScheme } from '~/types/design-scheme';

export type Messages = Message[];

export interface StreamingOptions extends Omit<Parameters<typeof _streamText>[0], 'model'> {
  supabaseConnection?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

const logger = createScopedLogger('stream-text');

export async function streamText(props: {
  messages: Omit<Message, 'id'>[];
  env?: Env;
  options?: StreamingOptions;
  apiKeys?: Record<string, string>;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
  chatMode?: 'discuss' | 'build';
  designScheme?: DesignScheme;
}) {
  const {
    messages,
    env: serverEnv,
    options,
    apiKeys,
    files,
    providerSettings,
    promptId,
    contextOptimization,
    contextFiles,
    summary,
    chatMode,
    designScheme,
  } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;
  let processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      // Remove package-lock.json content specifically keeping token usage MUCH lower
      content = content.replace(
        /<boltAction type="file" filePath="package-lock\.json">[\s\S]*?<\/boltAction>/g,
        '[package-lock.json content removed]',
      );

      // Trim whitespace potentially left after removals
      content = content.trim();

      return { ...message, content };
    }

    return message;
  });

  // Find the correct provider for the selected model
  let provider = PROVIDER_LIST.find((p) => p.name === currentProvider);
  let modelDetails: any = null;

  // First, try to find the model in the specified provider
  if (provider) {
    const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
    modelDetails = staticModels.find((m) => m.name === currentModel);

    if (!modelDetails) {
      const modelsList = [
        ...(provider.staticModels || []),
        ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
          apiKeys,
          providerSettings,
          serverEnv: serverEnv as any,
        })),
      ];

      modelDetails = modelsList.find((m) => m.name === currentModel);
    }
  }

  // If model not found in specified provider, search across all providers
  if (!modelDetails) {
    logger.warn(`Model [${currentModel}] not found in provider [${currentProvider}]. Searching across all providers...`);

    for (const candidateProvider of PROVIDER_LIST) {
      const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(candidateProvider);
      const foundModel = staticModels.find((m) => m.name === currentModel);

      if (foundModel) {
        logger.info(`Found model [${currentModel}] in provider [${candidateProvider.name}]. Switching provider.`);
        provider = candidateProvider;
        modelDetails = foundModel;
        currentProvider = candidateProvider.name;
        break;
      }
    }
  }

  // Final fallback
  if (!provider) {
    provider = DEFAULT_PROVIDER;
  }

  if (!modelDetails) {
    const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
    if (staticModels.length > 0) {
      logger.warn(
        `MODEL [${currentModel}] not found anywhere. Falling back to first model in provider [${provider.name}]: ${staticModels[0].name}`,
      );
      modelDetails = staticModels[0];
      currentModel = staticModels[0].name;
    } else {
      throw new Error(`No models found for provider ${provider.name}`);
    }
  }

  // Get model context window first
  const modelContextWindow = getModelContextWindow(modelDetails.name);

  // Ensure completion tokens don't exceed reasonable limits
  const rawMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;
  const dynamicMaxTokens = Math.min(rawMaxTokens, MAX_TOKENS, Math.floor(modelContextWindow * 0.3)); // Max 30% of context window
  logger.info(
    `Max tokens for model ${modelDetails.name} is ${dynamicMaxTokens} (raw: ${rawMaxTokens}, limit: ${MAX_TOKENS}, 30% of context: ${Math.floor(modelContextWindow * 0.3)})`,
  );
  logger.info(`Model context window: ${modelContextWindow} tokens`);

  // Validate API key for the selected provider
  logger.info(`Validating API key for provider: ${provider.name}`);
  try {
    // Check if provider has API key configuration
    if (provider.config?.apiTokenKey) {
      const apiTokenKey = provider.config.apiTokenKey;
      const hasApiKey = !!(
        apiKeys?.[provider.name] ||
        (serverEnv as any)?.[apiTokenKey] ||
        process.env[apiTokenKey]
      );

      if (!hasApiKey) {
        logger.error(`Missing API key for provider: ${provider.name} (key: ${apiTokenKey})`);
        throw new Error(`Missing API key for ${provider.name} provider. Please configure your API key in Settings or switch to a different provider.`);
      } else {
        logger.info(`API key found for provider: ${provider.name}`);
      }
    }
  } catch (error) {
    logger.error(`API key validation failed for provider ${provider.name}:`, error);
    throw error;
  }

  let systemPrompt =
    PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
      designScheme,
      supabase: {
        isConnected: options?.supabaseConnection?.isConnected || false,
        hasSelectedProject: options?.supabaseConnection?.hasSelectedProject || false,
        credentials: options?.supabaseConnection?.credentials || undefined,
      },
    }) ?? getSystemPrompt();

  if (chatMode === 'build' && contextFiles && contextOptimization) {
    const codeContext = createFilesContext(contextFiles, true);

    systemPrompt = `${systemPrompt}

    Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.
    CONTEXT BUFFER:
    ---
    ${codeContext}
    ---
    `;

    if (summary) {
      systemPrompt = `${systemPrompt}
      below is the chat history till now
      CHAT SUMMARY:
      ---
      ${props.summary}
      ---
      `;

      if (props.messageSliceId) {
        processedMessages = processedMessages.slice(props.messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();

        if (lastMessage) {
          processedMessages = [lastMessage];
        }
      }
    }
  }

  const effectiveLockedFilePaths = new Set<string>();

  if (files) {
    for (const [filePath, fileDetails] of Object.entries(files)) {
      if (fileDetails?.isLocked) {
        effectiveLockedFilePaths.add(filePath);
      }
    }
  }

  if (effectiveLockedFilePaths.size > 0) {
    const lockedFilesListString = Array.from(effectiveLockedFilePaths)
      .map((filePath) => `- ${filePath}`)
      .join('\n');
    systemPrompt = `${systemPrompt}

    IMPORTANT: The following files are locked and MUST NOT be modified in any way. Do not suggest or make any changes to these files. You can proceed with the request but DO NOT make any changes to these files specifically:
    ${lockedFilesListString}
    ---
    `;
  } else {
    console.log('No locked files found from any source for prompt.');
  }

  // Apply context management to prevent token overflow
  logger.info(
    `Starting context management for model: ${modelDetails.name}, context window: ${modelContextWindow}, completion tokens: ${dynamicMaxTokens}`,
  );
  logger.info(`Chat mode: ${chatMode}, Provider: ${provider.name}`);

  // Force context management to be applied - this is critical for preventing overflow
  logger.warn(`CONTEXT MANAGEMENT: This is a critical step to prevent token overflow errors`);

  const contextManager = new ContextManager({
    model: modelDetails.name,
    maxContextTokens: modelContextWindow,
    completionTokens: dynamicMaxTokens,
    bufferTokens: 2000, // Add buffer for safety
  });

  let finalSystemPrompt = chatMode === 'build' ? systemPrompt : discussPrompt();
  // Note: contextFiles content is already included in systemPrompt above, don't double-count it

  // Log system prompt size for debugging
  const systemPromptLength = finalSystemPrompt.length;
  logger.info(`System prompt length: ${systemPromptLength} characters`);

  // Emergency system prompt truncation if it's too large
  const maxSystemPromptTokens = Math.floor(modelContextWindow * 0.4); // Use max 40% of context for system prompt
  const estimatedSystemTokens = Math.ceil(systemPromptLength / 4); // Rough estimate: 4 chars per token

  if (estimatedSystemTokens > maxSystemPromptTokens) {
    logger.warn(`System prompt too large: ${estimatedSystemTokens} tokens > ${maxSystemPromptTokens} limit`);

    // Reserve space for the truncation note
    const truncationNote = '\n\n[Note: System prompt was truncated to fit context window]';
    const maxSystemPromptChars = (maxSystemPromptTokens * 4) - truncationNote.length;
    const truncatedSystemPrompt = finalSystemPrompt.substring(0, maxSystemPromptChars);

    // Try to truncate at a reasonable boundary (end of a line or sentence)
    const lastNewline = truncatedSystemPrompt.lastIndexOf('\n');
    const lastPeriod = truncatedSystemPrompt.lastIndexOf('.');
    const cutPoint = Math.max(lastNewline, lastPeriod);

    if (cutPoint > maxSystemPromptChars * 0.8) {
      finalSystemPrompt = truncatedSystemPrompt.substring(0, cutPoint + 1);
    } else {
      finalSystemPrompt = truncatedSystemPrompt;
    }

    finalSystemPrompt += truncationNote;
    logger.warn(`System prompt truncated from ${systemPromptLength} to ${finalSystemPrompt.length} characters`);
  }

  // Log initial message count and estimated tokens
  const initialMessageCount = processedMessages.length;
  logger.info(`Initial message count: ${initialMessageCount}`);

  // Log a sample of message content for debugging
  if (processedMessages.length > 0) {
    const firstMessage = processedMessages[0];
    const lastMessage = processedMessages[processedMessages.length - 1];
    logger.info(
      `First message preview: ${typeof firstMessage.content === 'string' ? firstMessage.content.substring(0, 100) : '[non-string content]'}...`,
    );
    logger.info(
      `Last message preview: ${typeof lastMessage.content === 'string' ? lastMessage.content.substring(0, 100) : '[non-string content]'}...`,
    );
  }

  try {
    // Log detailed information before optimization
    const systemPromptLength = finalSystemPrompt.length;
    const systemPromptTokens = Math.ceil(systemPromptLength / 4); // Rough estimate
    const messageTokens = processedMessages.reduce((total, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return total + Math.ceil(content.length / 4);
    }, 0);
    const estimatedTotal = systemPromptTokens + messageTokens + dynamicMaxTokens + 2000;

    logger.warn(`PRE-OPTIMIZATION ANALYSIS:`);
    logger.warn(`  System prompt: ${systemPromptLength} chars (~${systemPromptTokens} tokens)`);
    logger.warn(`  Messages: ${processedMessages.length} messages (~${messageTokens} tokens)`);
    logger.warn(`  Completion: ${dynamicMaxTokens} tokens`);
    logger.warn(`  Buffer: 2000 tokens`);
    logger.warn(`  Estimated total: ${estimatedTotal} tokens`);
    logger.warn(`  Context limit: ${modelContextWindow} tokens`);
    logger.warn(`  Will overflow: ${estimatedTotal > modelContextWindow ? 'YES' : 'NO'}`);

    const contextResult = await contextManager.optimizeMessages(
      processedMessages as Message[],
      finalSystemPrompt,
      undefined, // contextFiles content is already included in finalSystemPrompt
    );

    logger.info(
      `Context optimization result: strategy=${contextResult.strategy}, removed=${contextResult.removedMessages} messages, final_tokens=${contextResult.totalTokens}, truncated=${contextResult.truncated}`,
    );

    if (contextResult.truncated) {
      logger.warn(
        `Messages were truncated to fit context window. Strategy: ${contextResult.strategy}, removed ${contextResult.removedMessages} out of ${initialMessageCount} messages`,
      );
    }

    if (contextResult.systemPromptTruncated) {
      logger.warn('System prompt was truncated to fit within 40% of context window');
      logger.warn(`  Original system prompt: ${systemPromptLength} chars`);
      logger.warn(`  Truncated system prompt: ${contextResult.systemPrompt.length} chars`);
      finalSystemPrompt = contextResult.systemPrompt; // Use the truncated system prompt
    }

    processedMessages = contextResult.messages;
    logger.info(`Final message count after optimization: ${processedMessages.length}`);

    // Log post-optimization analysis
    const finalSystemTokens = Math.ceil(finalSystemPrompt.length / 4);
    const finalMessageTokens = processedMessages.reduce((total, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return total + Math.ceil(content.length / 4);
    }, 0);
    const finalEstimatedTotal = finalSystemTokens + finalMessageTokens + dynamicMaxTokens + 2000;

    logger.warn(`POST-OPTIMIZATION ANALYSIS:`);
    logger.warn(`  Final system prompt: ${finalSystemPrompt.length} chars (~${finalSystemTokens} tokens)`);
    logger.warn(`  Final messages: ${processedMessages.length} messages (~${finalMessageTokens} tokens)`);
    logger.warn(`  Final estimated total: ${finalEstimatedTotal} tokens`);
    logger.warn(`  Still will overflow: ${finalEstimatedTotal > modelContextWindow ? 'YES' : 'NO'}`);
  } catch (error) {
    logger.error('Context optimization failed:', error);

    // Emergency fallback: if context optimization fails, apply simple truncation
    try {
      logger.warn('Applying emergency message truncation as fallback');

      const maxMessages = Math.floor(modelContextWindow / 1000); // Very rough estimate: 1000 tokens per message

      if (processedMessages.length > maxMessages) {
        const originalLength = processedMessages.length;

        // Keep the last user message and some recent context
        const keepCount = Math.max(1, Math.min(maxMessages, 10));
        processedMessages = processedMessages.slice(-keepCount);
        logger.warn(`Emergency truncation: kept ${keepCount} out of ${originalLength} messages`);
      }
    } catch (fallbackError) {
      logger.error('Emergency fallback also failed:', fallbackError);
    }

    logger.warn('Continuing with processed messages - context overflow may still occur');
  }

  // Final safety check: if we still have too many messages, apply emergency truncation
  const estimatedTokensPerMessage = 500; // Conservative estimate
  const maxSafeMessages = Math.floor((modelContextWindow - dynamicMaxTokens - 5000) / estimatedTokensPerMessage);

  if (processedMessages.length > maxSafeMessages) {
    logger.warn(`EMERGENCY TRUNCATION: ${processedMessages.length} messages exceed safe limit of ${maxSafeMessages}`);

    const originalLength = processedMessages.length;

    // Keep the last few messages including the last user message
    processedMessages = processedMessages.slice(-Math.max(1, maxSafeMessages));
    logger.warn(`Emergency truncation applied: kept ${processedMessages.length} out of ${originalLength} messages`);
  }

  logger.info(`Sending llm call to ${provider.name} with model ${modelDetails.name}`);
  logger.info(
    `Final message count: ${processedMessages.length}, estimated tokens: ${processedMessages.length * estimatedTokensPerMessage}`,
  );

  // console.log(systemPrompt, processedMessages);

  return await _streamText({
    model: provider.getModelInstance({
      model: modelDetails.name,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
    system: finalSystemPrompt,
    maxTokens: dynamicMaxTokens,
    messages: convertToCoreMessages(processedMessages as any),
    ...options,
  });
}
