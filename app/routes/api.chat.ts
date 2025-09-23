import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createDataStream, generateId } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/constants';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import type { ContextAnnotation, ProgressAnnotation } from '~/types/context';
import { WORK_DIR } from '~/utils/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import type { DesignScheme } from '~/types/design-scheme';
import { MCPService } from '~/lib/services/mcpService';
import { StreamRecoveryManager } from '~/lib/.server/llm/stream-recovery';
import { withTimeout, TimeoutError } from '~/utils/promises';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  let progressCounter: number = 1;
  let dataStreamForRecovery: any = null;

  const streamRecovery = new StreamRecoveryManager({
    timeout: 45000,
    maxRetries: 2,
    onTimeout: () => {
      logger.warn('Stream timeout - attempting recovery');
    },
    onProgress: (message: string) => {
      // Write progress update to the stream so user sees recovery attempts
      if (dataStreamForRecovery) {
        dataStreamForRecovery.writeData({
          type: 'progress',
          label: 'stream-recovery',
          status: 'in-progress',
          order: progressCounter++,
          message,
        });
      }
    },
  });

  const { messages, files, promptId, contextOptimization, supabase, chatMode, designScheme, maxLLMSteps } =
    await request.json<{
      messages: Messages;
      files: any;
      promptId?: string;
      contextOptimization: boolean;
      chatMode: 'discuss' | 'build';
      designScheme?: DesignScheme;
      supabase?: {
        isConnected: boolean;
        hasSelectedProject: boolean;
        credentials?: {
          anonKey?: string;
          supabaseUrl?: string;
        };
      };
      maxLLMSteps: number;
    }>();

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  const stream = new SwitchableStream();

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  const encoder: TextEncoder = new TextEncoder();

  try {
    const mcpService = MCPService.getInstance();
    const totalMessageContent = messages.reduce((acc, message) => acc + message.content, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    let lastChunk: string | undefined = undefined;

    const dataStream = createDataStream({
      async execute(dataStream) {
        // Make dataStream available for recovery progress updates
        dataStreamForRecovery = dataStream;
        streamRecovery.startMonitoring();

        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;
        let messageSliceId = 0;

        let processedMessages: typeof messages;

        try {
          processedMessages = await withTimeout(
            mcpService.processToolInvocations(messages, dataStream),
            30000, // 30 second timeout for MCP processing
            'MCP tool processing timed out',
          );
        } catch (error) {
          if (error instanceof TimeoutError) {
            logger.warn('MCP tool processing timed out, proceeding with original messages');
            processedMessages = messages; // Fallback to original messages

            // Add timeout notification to user
            dataStream.writeData({
              type: 'progress',
              label: 'mcp',
              status: 'complete',
              order: progressCounter++,
              message: 'Tool Processing Timeout - Proceeding Without Tools',
            } satisfies ProgressAnnotation);
          } else {
            // Re-throw non-timeout errors
            dataStream.writeData({
              type: 'progress',
              label: 'mcp',
              status: 'complete',
              order: progressCounter++,
              message: 'Tool Processing Failed - Proceeding Without Tools',
            } satisfies ProgressAnnotation);
            processedMessages = messages; // Fallback to original messages
            // Don't re-throw, continue with fallback
          }
        }

        if (processedMessages.length > 3) {
          messageSliceId = processedMessages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'in-progress',
            order: progressCounter++,
            message: `Analysing Request (${processedMessages.length} messages, ~60s timeout)`,
          } satisfies ProgressAnnotation);

          // Create a summary of the chat
          console.log(`Messages count: ${processedMessages.length}`);

          try {
            summary = await withTimeout(
              createSummary({
                messages: [...processedMessages],
                env: context.cloudflare?.env,
                apiKeys,
                providerSettings,
                promptId,
                contextOptimization,
                onFinish(resp) {
                  if (resp.usage) {
                    logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                    cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                    cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                    cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
                  }
                },
              }),
              60000, // 60 second timeout
              'Chat summary generation timed out',
            );
          } catch (error) {
            if (error instanceof TimeoutError) {
              logger.warn('Chat summary generation timed out, proceeding without summary');
              summary = undefined;
              dataStream.writeData({
                type: 'progress',
                label: 'summary',
                status: 'complete',
                order: progressCounter++,
                message: 'Analysis Timeout - Proceeding Without Summary',
              } satisfies ProgressAnnotation);
            } else {
              // Re-throw non-timeout errors
              dataStream.writeData({
                type: 'progress',
                label: 'summary',
                status: 'complete',
                order: progressCounter++,
                message: 'Analysis Failed - Proceeding Without Summary',
              } satisfies ProgressAnnotation);
              throw error;
            }
          }

          if (!summary) {
            // Only write success message if we actually got a summary
          } else {
            dataStream.writeData({
              type: 'progress',
              label: 'summary',
              status: 'complete',
              order: progressCounter++,
              message: 'Analysis Complete',
            } satisfies ProgressAnnotation);
          }

          dataStream.writeMessageAnnotation({
            type: 'chatSummary',
            summary,
            chatId: processedMessages.slice(-1)?.[0]?.id,
          } as ContextAnnotation);

          // Update context buffer
          logger.debug('Updating Context Buffer');
          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'in-progress',
            order: progressCounter++,
            message: `Determining Files to Read (${filePaths.length} files, ~90s timeout)`,
          } satisfies ProgressAnnotation);

          // Select context files
          console.log(`Messages count: ${processedMessages.length}`);

          try {
            filteredFiles = await withTimeout(
              selectContext({
                messages: [...processedMessages],
                env: context.cloudflare?.env,
                apiKeys,
                files,
                providerSettings,
                promptId,
                contextOptimization,
                summary: summary || '',
                onFinish(resp) {
                  if (resp.usage) {
                    logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                    cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                    cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                    cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
                  }
                },
              }),
              90000, // 90 second timeout (longer for file selection)
              'Context file selection timed out',
            );
          } catch (error) {
            if (error instanceof TimeoutError) {
              logger.warn('Context file selection timed out, using all files');
              filteredFiles = files; // Fallback to using all files
              dataStream.writeData({
                type: 'progress',
                label: 'context',
                status: 'complete',
                order: progressCounter++,
                message: 'File Selection Timeout - Using All Files',
              } satisfies ProgressAnnotation);
            } else {
              // Re-throw non-timeout errors
              dataStream.writeData({
                type: 'progress',
                label: 'context',
                status: 'complete',
                order: progressCounter++,
                message: 'File Selection Failed - Using All Files',
              } satisfies ProgressAnnotation);
              filteredFiles = files; // Fallback to using all files
              // Don't re-throw, continue with fallback
            }
          }

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          if (filteredFiles) {
            dataStream.writeMessageAnnotation({
              type: 'codeContext',
              files: Object.keys(filteredFiles).map((key) => {
                let path = key;

                if (path.startsWith(WORK_DIR)) {
                  path = path.replace(WORK_DIR, '');
                }

                return path;
              }),
            } as ContextAnnotation);
          }

          // Only write success message if we successfully completed file selection
          if (filteredFiles) {
            dataStream.writeData({
              type: 'progress',
              label: 'context',
              status: 'complete',
              order: progressCounter++,
              message: `Code Files Selected (${Object.keys(filteredFiles).length} files)`,
            } satisfies ProgressAnnotation);
          }

          // logger.debug('Code Files Selected');
        }

        const options: StreamingOptions = {
          supabaseConnection: supabase,
          toolChoice: 'auto',
          tools: mcpService.toolsWithoutExecute,
          maxSteps: maxLLMSteps,
          onStepFinish: ({ toolCalls }) => {
            // add tool call annotations for frontend processing
            toolCalls.forEach((toolCall) => {
              mcpService.processToolCall(toolCall, dataStream);
            });
          },
          onFinish: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.completionTokens += usage.completionTokens || 0;
              cumulativeUsage.promptTokens += usage.promptTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            if (finishReason !== 'length') {
              dataStream.writeMessageAnnotation({
                type: 'usage',
                value: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              dataStream.writeData({
                type: 'progress',
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: 'Response Generated',
              } satisfies ProgressAnnotation);
              await new Promise((resolve) => setTimeout(resolve, 0));

              // stream.close();
              return;
            }

            if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
              throw Error('Cannot continue message: Maximum segments reached');
            }

            const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = processedMessages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            processedMessages.push({ id: generateId(), role: 'assistant', content });
            processedMessages.push({
              id: generateId(),
              role: 'user',
              content: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
            });

            const result = await streamText({
              messages: [...processedMessages],
              env: context.cloudflare?.env,
              options,
              apiKeys,
              files,
              providerSettings,
              promptId,
              contextOptimization,
              contextFiles: filteredFiles,
              chatMode,
              designScheme,
              summary,
              messageSliceId,
            });

            result.mergeIntoDataStream(dataStream);

            (async () => {
              for await (const part of result.fullStream) {
                if (part.type === 'error') {
                  const error: any = part.error;
                  logger.error(`${error}`);

                  return;
                }
              }
            })();

            return;
          },
        };

        dataStream.writeData({
          type: 'progress',
          label: 'response',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Generating Response',
        } satisfies ProgressAnnotation);

        const result = await streamText({
          messages: [...processedMessages],
          env: context.cloudflare?.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          chatMode,
          designScheme,
          summary,
          messageSliceId,
        });

        (async () => {
          for await (const part of result.fullStream) {
            streamRecovery.updateActivity();

            if (part.type === 'error') {
              const error: any = part.error;
              logger.error('Streaming error:', error);
              streamRecovery.stop();

              // Enhanced error handling for common streaming issues
              if (error.message?.includes('Invalid JSON response')) {
                logger.error('Invalid JSON response detected - likely malformed API response');
              } else if (error.message?.includes('token')) {
                logger.error('Token-related error detected - possible token limit exceeded');
              }

              return;
            }
          }
          streamRecovery.stop();
        })();
        result.mergeIntoDataStream(dataStream);
      },
      onError: (error: any) => {
        // Provide more specific error messages for common issues
        const errorMessage = error.message || 'Unknown error';

        if (errorMessage.includes('model') && errorMessage.includes('not found')) {
          return 'Custom error: Invalid model selected. Please check that the model name is correct and available.';
        }

        if (errorMessage.includes('Invalid JSON response')) {
          return 'Custom error: The AI service returned an invalid response. This may be due to an invalid model name, API rate limiting, or server issues. Try selecting a different model or check your API key.';
        }

        if (
          errorMessage.includes('API key') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('authentication')
        ) {
          return 'Custom error: Invalid or missing API key. Please check your API key configuration.';
        }

        if (errorMessage.includes('token') && errorMessage.includes('limit')) {
          return 'Custom error: Token limit exceeded. The conversation is too long for the selected model. Try using a model with larger context window or start a new conversation.';
        }

        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          return 'Custom error: API rate limit exceeded. Please wait a moment before trying again.';
        }

        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          return 'Custom error: Network error. Please check your internet connection and try again.';
        }

        return `Custom error: ${errorMessage}`;
      },
    }).pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          try {
            if (!lastChunk) {
              lastChunk = ' ';
            }

            const isCurrentChunkThought = typeof chunk === 'string' && chunk.startsWith('g');
            const wasLastChunkThought = lastChunk.startsWith('g');

            // Only process thought wrapping if chunk types changed to reduce operations
            if (isCurrentChunkThought && !wasLastChunkThought) {
              controller.enqueue(encoder.encode(`0: "<div class=\\"__boltThought__\\">"\n`));
            } else if (!isCurrentChunkThought && wasLastChunkThought) {
              controller.enqueue(encoder.encode(`0: "</div>\\n"\n`));
            }

            lastChunk = chunk;

            // Optimize string processing for thought chunks
            let processedChunk: string;

            if (isCurrentChunkThought) {
              // More efficient processing for 'g' chunks
              const colonIndex = chunk.indexOf(':');

              if (colonIndex !== -1) {
                let content = chunk.slice(colonIndex + 1);

                // Remove trailing newline more efficiently
                if (content.endsWith('\n')) {
                  content = content.slice(0, -1);
                }

                processedChunk = `0:${content}\n`;
              } else {
                processedChunk = chunk;
              }
            } else {
              processedChunk = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
            }

            // Single encode operation per chunk
            controller.enqueue(encoder.encode(processedChunk));
          } catch (error) {
            // Prevent transform stream from hanging on processing errors
            logger.error('Transform stream error:', error);

            const fallbackChunk = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
            controller.enqueue(encoder.encode(fallbackChunk));
          }
        },
      }),
    );

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'Text-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    logger.error(error);

    const errorResponse = {
      error: true,
      message: error.message || 'An unexpected error occurred',
      statusCode: error.statusCode || 500,
      isRetryable: error.isRetryable !== false, // Default to retryable unless explicitly false
      provider: error.provider || 'unknown',
    };

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          ...errorResponse,
          message: 'Invalid or missing API key',
          statusCode: 401,
          isRetryable: false,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          statusText: 'Unauthorized',
        },
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { 'Content-Type': 'application/json' },
      statusText: 'Error',
    });
  }
}
