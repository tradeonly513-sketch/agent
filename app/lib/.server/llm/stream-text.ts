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

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Fallback to first model
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;
  const modelContextWindow = getModelContextWindow(modelDetails.name);
  logger.info(
    `Max tokens for model ${modelDetails.name} is ${dynamicMaxTokens} based on ${modelDetails.maxTokenAllowed} or ${MAX_TOKENS}`,
  );
  logger.info(`Model context window: ${modelContextWindow} tokens`);

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

    // Truncate system prompt to fit within limits
    const maxSystemPromptChars = maxSystemPromptTokens * 4;
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

    finalSystemPrompt += '\n\n[Note: System prompt was truncated to fit context window]';
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

    processedMessages = contextResult.messages;
    logger.info(`Final message count after optimization: ${processedMessages.length}`);
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
