import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts } from '~/lib/hooks';
import { description, useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROMPT_COOKIE_KEY, PROVIDER_LIST } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import Cookies from 'js-cookie';
import { debounce } from '~/utils/debounce';
import { useSettings } from '~/lib/hooks/useSettings';
import type { ProviderInfo } from '~/types/model';
import { useSearchParams } from '@remix-run/react';
import { createSampler } from '~/utils/sampler';
import { getTemplates, selectStarterTemplate } from '~/utils/selectStarterTemplate';
import { logStore } from '~/lib/stores/logs';
import { streamingState } from '~/lib/stores/streaming';
import { filesToArtifacts } from '~/utils/fileUtils';
import { ChatErrorBoundary } from './ErrorBoundary';
import { supabaseConnection } from '~/lib/stores/supabase';
import { defaultDesignScheme, type DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import type { Attachment, FileUIPart, TextUIPart } from '@ai-sdk/ui-utils';
import { useMCPStore } from '~/lib/stores/mcp';
import type { LlmErrorAlertType, ChatMode } from '~/types/actions';
import { agentStore } from '~/lib/stores/chat';
import { ClientAgentExecutor } from '~/lib/agent/client-executor';

import { BmadExecutor } from '~/lib/agent/bmad-executor';
import { bmadStore, bmadActions } from '~/lib/stores/bmad-store';

/*
 * import { CommandAutoComplete } from './CommandAutoComplete';
 * import { useCommandProcessor, hasCommands } from '~/lib/hooks/useCommandProcessor';
 * import { ContextDisplay, ContextIndicator } from './ContextDisplay';
 */

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory, importChat, exportChat } = useChatHistory();
  const title = useStore(description);
  useEffect(() => {
    workbenchStore.setReloadedMessages(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  return (
    <>
      {ready && (
        <ChatErrorBoundary>
          <ChatImpl
            description={title}
            initialMessages={initialMessages}
            exportChat={exportChat}
            storeMessageHistory={storeMessageHistory}
            importChat={importChat}
          />
        </ChatErrorBoundary>
      )}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
        autoClose={3000}
      />
    </>
  );
}

const processSampledMessages = createSampler(
  (options: {
    messages: Message[];
    initialMessages: Message[];
    isLoading: boolean;
    parseMessages: (messages: Message[], isLoading: boolean) => void;
    storeMessageHistory: (messages: Message[]) => Promise<void>;
  }) => {
    const { messages, initialMessages, isLoading, parseMessages, storeMessageHistory } = options;
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  },
  50,
);

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
  importChat: (description: string, messages: Message[]) => Promise<void>;
  exportChat: () => void;
  description?: string;
}

export const ChatImpl = memo(
  ({ description, initialMessages, storeMessageHistory, importChat, exportChat }: ChatProps) => {
    useShortcuts();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [imageDataList, setImageDataList] = useState<string[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();

    const [fakeLoading, setFakeLoading] = useState(false);
    const [lastMessageTime, setLastMessageTime] = useState<number>(0);
    const [agentRetryCount, setAgentRetryCount] = useState(0);

    /*
     * const [showCommandAutoComplete, setShowCommandAutoComplete] = useState(false);
     * const [showContextDisplay, setShowContextDisplay] = useState(false);
     */
    const files = useStore(workbenchStore.files);

    /*
     * 指令处理器
     * const commandProcessor = useCommandProcessor({
     *   workingDirectory: '/home/project',
     *   onCommandExecuted: (result) => {
     *     console.log('Command executed:', result);
     *   },
     *   onInputModified: (newInput) => {
     *     setInput(newInput);
     *   }
     * });
     */
    const [designScheme, setDesignScheme] = useState<DesignScheme>(defaultDesignScheme);
    const actionAlert = useStore(workbenchStore.alert);
    const deployAlert = useStore(workbenchStore.deployAlert);
    const supabaseConn = useStore(supabaseConnection);
    const selectedProject = supabaseConn.stats?.projects?.find(
      (project) => project.id === supabaseConn.selectedProjectId,
    );
    const supabaseAlert = useStore(workbenchStore.supabaseAlert);
    const { activeProviders, promptId, autoSelectTemplate, contextOptimizationEnabled } = useSettings();
    const [llmErrorAlert, setLlmErrorAlert] = useState<LlmErrorAlertType | undefined>(undefined);
    const [model, setModel] = useState(() => {
      const savedModel = Cookies.get('selectedModel');
      return savedModel || DEFAULT_MODEL;
    });
    const [provider, setProvider] = useState(() => {
      const savedProvider = Cookies.get('selectedProvider');
      return (PROVIDER_LIST.find((p) => p.name === savedProvider) || DEFAULT_PROVIDER) as ProviderInfo;
    });
    const { showChat } = useStore(chatStore);
    const [animationScope, animate] = useAnimate();
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');
    const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
    const mcpSettings = useMCPStore((state) => state.settings);
    const agentState = useStore(agentStore);
    const [agentExecutor] = useState(
      () =>
        new ClientAgentExecutor({
          onStepStart: (step) => {
            console.log('Agent step started:', step);
          },
          onStepComplete: (step) => {
            console.log('Agent step completed:', step);
          },
          onStepError: (step, error) => {
            console.error('Agent step error:', step, error);
            toast.error(`Step "${step.title}" failed: ${error.message}`);
          },
          onTaskComplete: (task) => {
            console.log('Agent task completed:', task);
            toast.success(`Task "${task.title}" completed successfully!`);

            /*
             * Don't immediately set isActive to false - let user see the results
             * agentStore.setKey('isActive', false);
             */
          },
          onTaskError: (task, error) => {
            console.error('Agent task error:', task, error);
            toast.error(`Task "${task.title}" failed: ${error.message}`);
            agentStore.setKey('isActive', false);
          },
          onTaskUpdate: (task) => {
            agentStore.setKey('currentTask', task);
          },
        }),
    );

    // BMad system state and executor
    const bmadState = useStore(bmadStore);
    const [bmadExecutor] = useState(
      () =>
        new BmadExecutor({
          onAgentActivated: (agent) => {
            console.log('BMad agent activated:', agent);
            toast.success(`Agent ${agent.agent.name} activated`);
          },
          onTaskStarted: (task) => {
            console.log('BMad task started:', task);
            toast.info(`Task started: ${task.title}`);
          },
          onTaskCompleted: (task) => {
            console.log('BMad task completed:', task);
            toast.success(`Task completed: ${task.title}`);
          },
          onUserInputRequired: async (prompt) => {
            // This would integrate with a modal or input system
            return new Promise((resolve) => {
              const userInput = window.prompt(prompt);
              resolve(userInput || '');
            });
          },
          onOutput: (message) => {
            // Add BMad output to chat messages only if BMad is active
            if (bmadState.isActive) {
              const bmadMessage: Message = {
                id: `bmad-${Date.now()}`,
                role: 'assistant',
                content: `[BMad] ${message}`,
                createdAt: new Date(),
              };
              setMessages((prev) => [...prev, bmadMessage]);
            }
          },
          onError: (error) => {
            console.error('BMad error:', error);
            toast.error(`BMad error: ${error.message}`);
          },
        }),
    );

    // Initialize BMad system only when needed
    useEffect(() => {
      if (bmadState.isActive) {
        bmadExecutor.initialize().catch((error) => {
          console.error('BMad initialization failed:', error);

          // Don't show error toast to avoid disrupting normal chat flow
        });
      }
    }, [bmadExecutor, bmadState.isActive]);

    const {
      messages,
      isLoading,
      input,
      handleInputChange,
      setInput,
      stop,
      append,
      setMessages,
      reload,
      error,
      data: chatData,
      setData,
      addToolResult,
    } = useChat({
      api: '/api/chat',
      body: {
        apiKeys,
        files,
        promptId,
        contextOptimization: contextOptimizationEnabled,
        chatMode,
        agentMode: agentState.mode,
        designScheme,
        supabase: {
          isConnected: supabaseConn.isConnected,
          hasSelectedProject: !!selectedProject,
          credentials: {
            supabaseUrl: supabaseConn?.credentials?.supabaseUrl,
            anonKey: supabaseConn?.credentials?.anonKey,
          },
        },
        maxLLMSteps: mcpSettings.maxLLMSteps,
      },
      sendExtraMessageFields: true,
      onError: (e) => {
        console.error('Chat error:', e);
        setFakeLoading(false);

        // Agent模式的特殊错误处理
        if (agentState.mode === 'agent') {
          console.error('Agent mode error:', e);
          toast.error('Agent encountered an error. Please try a simpler request or switch to Chat mode.', {
            autoClose: 5000,
          });
        }

        // 确保状态正确重置
        setTimeout(() => {
          if (isLoading) {
            console.log('Force stopping loading state after error');
            stop();
          }
        }, 1000);

        handleError(e, 'chat');
      },
      onFinish: (message, response) => {
        const usage = response.usage;
        setData(undefined);

        if (usage) {
          console.log('Token usage:', usage);
          logStore.logProvider('Chat response completed', {
            component: 'Chat',
            action: 'response',
            model,
            provider: provider.name,
            usage,
            messageLength: message.content.length,
          });
        }

        logger.debug('Finished streaming');
      },
      initialMessages,
      initialInput: Cookies.get(PROMPT_COOKIE_KEY) || '',
    });

    // 监控聊天状态，自动恢复卡住的状态
    useEffect(() => {
      let timeoutId: NodeJS.Timeout;

      if (isLoading || fakeLoading) {
        // Agent模式需要更长的处理时间，普通模式30秒，Agent模式90秒
        const timeoutDuration = agentState.mode === 'agent' ? 90000 : 30000;

        timeoutId = setTimeout(() => {
          console.warn(`Chat loading timeout (${agentState.mode} mode), resetting state...`);
          setFakeLoading(false);

          if (isLoading) {
            stop();
          }

          // Agent模式的重试逻辑
          if (agentState.mode === 'agent' && agentRetryCount < 2) {
            setAgentRetryCount(prev => prev + 1);
            toast.warning(`Agent timeout. Retrying... (${agentRetryCount + 1}/3)`, {
              autoClose: 3000,
            });

            // 延迟重试，给系统时间恢复
            setTimeout(() => {
              console.log('Agent retry attempt:', agentRetryCount + 1);
            }, 2000);
          } else {
            // 重置重试计数
            setAgentRetryCount(0);

            const message = agentState.mode === 'agent'
              ? 'Agent request failed after retries. Please try a simpler request or switch to Chat mode.'
              : 'Request timeout. Please try again.';

            toast.error(message, {
              autoClose: 5000,
            });
          }
        }, timeoutDuration);
      }

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }, [isLoading, fakeLoading, stop, agentState.mode]);

    // Agent模式特殊监控
    useEffect(() => {
      if (agentState.mode === 'agent' && isLoading) {
        console.log('Agent mode: Request started, monitoring for timeout...');

        // 添加额外的状态检查
        const checkInterval = setInterval(() => {
          if (isLoading && !fakeLoading) {
            console.log('Agent mode: Still processing request...');
          }
        }, 10000); // 每10秒检查一次

        return () => {
          clearInterval(checkInterval);
        };
      }
    }, [agentState.mode, isLoading, fakeLoading]);

    useEffect(() => {
      const prompt = searchParams.get('prompt');

      // console.log(prompt, searchParams, model, provider);

      if (prompt) {
        setSearchParams({});
        runAnimation();
        append({
          role: 'user',
          content: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${prompt}`,
        });
      }
    }, [model, provider, searchParams]);

    const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
    const { parsedMessages, parseMessages } = useMessageParser();

    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    useEffect(() => {
      const shouldStart =
        initialMessages.length > 0 || (typeof window !== 'undefined' && window.location.pathname.startsWith('/chat/'));

      chatStore.setKey('started', shouldStart);
      setChatStarted(shouldStart);
    }, [initialMessages]);

    const storeMessageHistoryRef = useRef(storeMessageHistory);
    storeMessageHistoryRef.current = storeMessageHistory;

    useEffect(() => {
      processSampledMessages({
        messages,
        initialMessages,
        isLoading,
        parseMessages,
        storeMessageHistory: storeMessageHistoryRef.current,
      });
    }, [messages, isLoading, parseMessages, initialMessages]);

    const scrollTextArea = () => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    };

    const abort = () => {
      stop();
      chatStore.setKey('aborted', true);
      workbenchStore.abortAllActions();

      logStore.logProvider('Chat response aborted', {
        component: 'Chat',
        action: 'abort',
        model,
        provider: provider.name,
      });
    };

    const handleError = useCallback(
      (error: any, context: 'chat' | 'template' | 'llmcall' = 'chat') => {
        logger.error(`${context} request failed`, error);

        stop();
        setFakeLoading(false);

        let errorInfo = {
          message: 'An unexpected error occurred',
          isRetryable: true,
          statusCode: 500,
          provider: provider.name,
          type: 'unknown' as const,
          retryDelay: 0,
        };

        if (error.message) {
          try {
            const parsed = JSON.parse(error.message);

            if (parsed.error || parsed.message) {
              errorInfo = { ...errorInfo, ...parsed };
            } else {
              errorInfo.message = error.message;
            }
          } catch {
            errorInfo.message = error.message;
          }
        }

        let errorType: LlmErrorAlertType['errorType'] = 'unknown';
        let title = 'Request Failed';

        if (errorInfo.statusCode === 401 || errorInfo.message.toLowerCase().includes('api key')) {
          errorType = 'authentication';
          title = 'Authentication Error';
        } else if (errorInfo.statusCode === 429 || errorInfo.message.toLowerCase().includes('rate limit')) {
          errorType = 'rate_limit';
          title = 'Rate Limit Exceeded';
        } else if (errorInfo.message.toLowerCase().includes('quota')) {
          errorType = 'quota';
          title = 'Quota Exceeded';
        } else if (errorInfo.statusCode >= 500) {
          errorType = 'network';
          title = 'Server Error';
        }

        logStore.logError(`${context} request failed`, error, {
          component: 'Chat',
          action: 'request',
          error: errorInfo.message,
          context,
          retryable: errorInfo.isRetryable,
          errorType,
          provider: provider.name,
        });

        // Create API error alert
        setLlmErrorAlert({
          type: 'error',
          title,
          description: errorInfo.message,
          provider: provider.name,
          errorType,
        });
        setData([]);
      },
      [provider.name, stop],
    );

    const clearApiErrorAlert = useCallback(() => {
      setLlmErrorAlert(undefined);
    }, []);

    useEffect(() => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.style.height = 'auto';

        const scrollHeight = textarea.scrollHeight;

        textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
        textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
      }
    }, [input, textareaRef]);

    const runAnimation = async () => {
      if (chatStarted) {
        return;
      }

      await Promise.all([
        animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
        animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
      ]);

      chatStore.setKey('started', true);

      setChatStarted(true);
    };

    // Helper function to create message parts array from text and images
    const createMessageParts = (text: string, images: string[] = []): Array<TextUIPart | FileUIPart> => {
      // Create an array of properly typed message parts
      const parts: Array<TextUIPart | FileUIPart> = [
        {
          type: 'text',
          text,
        },
      ];

      // Add image parts if any
      images.forEach((imageData) => {
        // Extract correct MIME type from the data URL
        const mimeType = imageData.split(';')[0].split(':')[1] || 'image/jpeg';

        // Create file part according to AI SDK format
        parts.push({
          type: 'file',
          mimeType,
          data: imageData.replace(/^data:image\/[^;]+;base64,/, ''),
        });
      });

      return parts;
    };

    // Helper function to convert File[] to Attachment[] for AI SDK
    const filesToAttachments = async (files: File[]): Promise<Attachment[] | undefined> => {
      if (files.length === 0) {
        return undefined;
      }

      const attachments = await Promise.all(
        files.map(
          (file) =>
            new Promise<Attachment>((resolve) => {
              const reader = new FileReader();

              reader.onloadend = () => {
                resolve({
                  name: file.name,
                  contentType: file.type,
                  url: reader.result as string,
                });
              };
              reader.readAsDataURL(file);
            }),
        ),
      );

      return attachments;
    };

    const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
      const messageContent = messageInput || input;

      if (!messageContent?.trim()) {
        return;
      }

      // 防止重复发送 - 添加发送状态锁
      if (isLoading) {
        console.log('Message sending in progress, aborting current request...');
        abort();

        return;
      }

      // 防止快速重复点击
      const now = Date.now();

      if (now - lastMessageTime < 1000) {
        console.log('Message sent too quickly, ignoring...');
        return;
      }

      setLastMessageTime(now);

      // 添加发送前的状态检查
      try {
        /*
         * 首先处理聊天指令 (@, #, help)
         * if (hasCommands(messageContent)) {
         *   const commandResult = await commandProcessor.processInput(messageContent);
         *
         *   if (!commandResult.shouldContinue) {
         *     // 指令执行完成，不继续聊天流程
         *     setInput('');
         *     return;
         *   }
         *
         *   // 如果指令修改了输入内容，使用修改后的内容
         *   if (commandResult.modifiedInput) {
         *     messageContent = commandResult.modifiedInput;
         *   }
         * }
         */

        /*
         * 添加上下文文件到消息中
         * const contextFiles = commandProcessor.getContextFiles();
         * if (contextFiles.length > 0) {
         *   let contextContent = '\n\n**Context Files:**\n';
         *   for (const file of contextFiles) {
         *     const ext = file.path.split('.').pop()?.toLowerCase() || '';
         *     contextContent += `\n**${file.path}**\n\`\`\`${ext}\n${file.content}\n\`\`\`\n`;
         *   }
         *   messageContent = messageContent + contextContent;
         * }
         */

        // Handle BMad commands (starting with *) - only if BMad is active
        if (messageContent.startsWith('*') && bmadState.isActive) {
          try {
            await bmadExecutor.executeCommand(messageContent);
            setInput('');

            return;
          } catch (error) {
            console.error('BMad command error:', error);
            toast.error(`BMad command failed: ${error}`);
            setInput('');

            return;
          }
        }

        // Handle quick commands
        if (messageContent.startsWith('/')) {
          const command = messageContent.toLowerCase();

          if (command === '/agent') {
            handleAgentModeChange('agent');
            toast.success('Switched to Agent mode');
            setInput('');

            return;
          } else if (command === '/chat') {
            handleAgentModeChange('chat');
            toast.success('Switched to Chat mode');
            setInput('');

            return;
          } else if (command === '/bmad') {
            // Toggle BMad system
            if (bmadState.isActive) {
              bmadActions.deactivate();
              toast.info('BMad system deactivated');
            } else {
              bmadActions.activate();
              toast.success('BMad system activated. Type *help for commands.');
            }

            setInput('');

            return;
          } else if (command === '/status' && agentState.currentTask) {
            const task = agentState.currentTask;
            const statusMessage = `Current task: ${task.title}\nStatus: ${task.status}\nStep: ${task.currentStepIndex + 1}/${task.steps.length}`;
            toast.info(statusMessage);
            setInput('');

            return;
          } else if (command === '/stop' && agentState.isActive) {
            agentExecutor.abort();
            agentStore.setKey('isActive', false);
            agentStore.setKey('currentTask', undefined);
            toast.info('Agent task stopped');
            setInput('');

            return;
          }
        }

        // Initialize finalMessageContent first
        let finalMessageContent = messageContent;

        if (selectedElement) {
          console.log('Selected Element:', selectedElement);

          const elementInfo = `<div class=\"__boltSelectedElement__\" data-element='${JSON.stringify(selectedElement)}'>${JSON.stringify(`${selectedElement.displayText}`)}</div>`;
          finalMessageContent = messageContent + elementInfo;
        }

        /*
         * Handle navigation and workbench display for all modes
         * Force navigation to chat page if on homepage
         */
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
          // Generate a new chat ID
          const chatId = `chat-${Date.now()}`;
          const url = new URL(window.location.href);
          url.pathname = `/chat/${chatId}`;
          window.history.replaceState({}, '', url);

          // Force update chatStarted state after URL change
          setTimeout(() => {
            setChatStarted(true);
            chatStore.setKey('started', true);

            // Show workbench for all modes when starting a new chat
            workbenchStore.setShowWorkbench(true);
          }, 0);
        }

        // Handle Agent mode - Enhanced Chat mode with Agent capabilities
        if (agentState.mode === 'agent') {
          // Ensure workbench is shown for Agent mode
          workbenchStore.setShowWorkbench(true);

          // Create optimized agent prompt for LLM - shorter but effective
          const agentPrompt = `[AGENT MODE] Create a complete, working project for: ${messageContent}

Requirements:
- Generate all necessary files with proper structure
- Include dependencies and setup instructions
- Write clean, documented, production-ready code
- Ensure project runs without errors

Start creating the project now.`;

          // Use the full prompt for LLM processing
          finalMessageContent = agentPrompt;
        } else {
          // For chat mode, also show workbench when starting a new conversation
          if (!chatStarted) {
            workbenchStore.setShowWorkbench(true);
          }
        }

        // Only run animation if not already run by Agent mode
        if (agentState.mode !== 'agent') {
          await runAnimation();
        }

        if (!chatStarted) {
          setFakeLoading(true);

          // Ensure workbench is shown when starting a new chat
          workbenchStore.setShowWorkbench(true);

          // Skip template selection for Agent mode
          if (autoSelectTemplate && agentState.mode !== 'agent') {
            const { template, title } = await selectStarterTemplate({
              message: finalMessageContent,
              model,
              provider,
            });

            if (template !== 'blank') {
              const temResp = await getTemplates(template, title).catch((e) => {
                if (e.message.includes('rate limit')) {
                  toast.warning('Rate limit exceeded. Skipping starter template\n Continuing with blank template');
                } else {
                  toast.warning('Failed to import starter template\n Continuing with blank template');
                }

                return null;
              });

              if (temResp) {
                const { assistantMessage, userMessage } = temResp;
                const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

                setMessages([
                  {
                    id: `1-${new Date().getTime()}`,
                    role: 'user',
                    content: userMessageText,
                    parts: createMessageParts(userMessageText, imageDataList),
                  },
                  {
                    id: `2-${new Date().getTime()}`,
                    role: 'assistant',
                    content: assistantMessage,
                  },
                  {
                    id: `3-${new Date().getTime()}`,
                    role: 'user',
                    content: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage}`,
                    annotations: ['hidden'],
                  },
                ]);

                const reloadOptions =
                  uploadedFiles.length > 0
                    ? { experimental_attachments: await filesToAttachments(uploadedFiles) }
                    : undefined;

                reload(reloadOptions);
                setInput('');
                Cookies.remove(PROMPT_COOKIE_KEY);

                setUploadedFiles([]);
                setImageDataList([]);

                resetEnhancer();

                textareaRef.current?.blur();
                setFakeLoading(false);

                return;
              }
            }
          }

          // If autoSelectTemplate is disabled or template selection failed, proceed with normal message
          const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;
          const attachments = uploadedFiles.length > 0 ? await filesToAttachments(uploadedFiles) : undefined;

          const userMessage = {
            id: `${new Date().getTime()}`,
            role: 'user' as const,
            content: userMessageText,
            parts: createMessageParts(userMessageText, imageDataList),
            experimental_attachments: attachments,
          };

          // Handle Agent mode message setup
          if (agentState.mode === 'agent') {
            // Create a display message that matches our optimized prompt
            const displayUserMessage: Message = {
              id: userMessage.id,
              role: 'user',
              content: `[AGENT MODE] Create a complete, working project for: ${messageContent}

Requirements:
- Generate all necessary files with proper structure
- Include dependencies and setup instructions
- Write clean, documented, production-ready code
- Ensure project runs without errors

Start creating the project now.`,
              parts: userMessage.parts,
              experimental_attachments: userMessage.experimental_attachments,
            };

            setMessages([displayUserMessage]);

            toast.info('🤖 Agent analyzing your request...', {
              autoClose: 3000,
            });
          } else {
            // Chat mode - normal behavior
            setMessages([userMessage]);
          }

          reload(attachments ? { experimental_attachments: attachments } : undefined);
          setFakeLoading(false);
          setInput('');
          Cookies.remove(PROMPT_COOKIE_KEY);

          setUploadedFiles([]);
          setImageDataList([]);

          resetEnhancer();

          textareaRef.current?.blur();

          return;
        }

        if (error != null) {
          setMessages(messages.slice(0, -1));
        }

        const modifiedFiles = workbenchStore.getModifiedFiles();

        chatStore.setKey('aborted', false);

        if (modifiedFiles !== undefined) {
          const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
          const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userUpdateArtifact}${finalMessageContent}`;

          const attachmentOptions =
            uploadedFiles.length > 0
              ? { experimental_attachments: await filesToAttachments(uploadedFiles) }
              : undefined;

          append(
            {
              role: 'user',
              content: messageText,
              parts: createMessageParts(messageText, imageDataList),
            },
            attachmentOptions,
          );

          workbenchStore.resetAllFileModifications();
        } else {
          const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

          const attachmentOptions =
            uploadedFiles.length > 0
              ? { experimental_attachments: await filesToAttachments(uploadedFiles) }
              : undefined;

          append(
            {
              role: 'user',
              content: messageText,
              parts: createMessageParts(messageText, imageDataList),
            },
            attachmentOptions,
          );
        }

        setInput('');
        Cookies.remove(PROMPT_COOKIE_KEY);

        setUploadedFiles([]);
        setImageDataList([]);

        resetEnhancer();

        textareaRef.current?.blur();
      } catch (error) {
        // 确保在任何错误情况下都能重置状态
        console.error('Error in sendMessage:', error);
        setFakeLoading(false);
        setInput('');
        toast.error('Failed to send message. Please try again.');

        // 重置聊天状态
        if (isLoading) {
          abort();
        }
      }
    };

    /**
     * Handles the change event for the textarea and updates the input state.
     * @param event - The change event from the textarea.
     */
    const onTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange(event);

      /*
       * 检查是否显示指令自动完成
       * const value = event.target.value;
       * const shouldShow = hasCommands(value) && value.trim().length > 0;
       * setShowCommandAutoComplete(shouldShow);
       */
    };

    /**
     * Debounced function to cache the prompt in cookies.
     * Caches the trimmed value of the textarea input after a delay to optimize performance.
     */
    const debouncedCachePrompt = useCallback(
      debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const trimmedValue = event.target.value.trim();
        Cookies.set(PROMPT_COOKIE_KEY, trimmedValue, { expires: 30 });
      }, 1000),
      [],
    );

    useEffect(() => {
      const storedApiKeys = Cookies.get('apiKeys');
      const storedAgentMode = Cookies.get('agentMode') as ChatMode;

      if (storedApiKeys) {
        setApiKeys(JSON.parse(storedApiKeys));
      }

      if (storedAgentMode && (storedAgentMode === 'chat' || storedAgentMode === 'agent')) {
        agentStore.setKey('mode', storedAgentMode);
      }
    }, []);

    const handleModelChange = (newModel: string) => {
      setModel(newModel);
      Cookies.set('selectedModel', newModel, { expires: 30 });
    };

    const handleProviderChange = (newProvider: ProviderInfo) => {
      setProvider(newProvider);
      Cookies.set('selectedProvider', newProvider.name, { expires: 30 });
    };

    const handleAgentModeChange = (newMode: ChatMode) => {
      agentStore.setKey('mode', newMode);
      Cookies.set('agentMode', newMode, { expires: 30 });

      if (newMode === 'chat') {
        // Stop any running agent tasks
        agentExecutor.abort();
        agentStore.setKey('isActive', false);
        agentStore.setKey('currentTask', undefined);
        agentStore.setKey('isPaused', false);
        agentStore.setKey('awaitingUserInput', false);
      }
    };

    const handleTemplateSelect = (template: any) => {
      // Switch to agent mode if not already
      if (agentState.mode !== 'agent') {
        handleAgentModeChange('agent');
      }

      // Set the template prompt as input
      setInput(template.prompt);

      // Focus the textarea
      textareaRef.current?.focus();

      toast.success(`Template "${template.title}" loaded`);
    };

    return (
      <BaseChat
        ref={animationScope}
        textareaRef={textareaRef}
        input={input}
        showChat={showChat}
        chatStarted={chatStarted}
        isStreaming={isLoading || fakeLoading}
        onStreamingChange={(streaming) => {
          streamingState.set(streaming);
        }}
        enhancingPrompt={enhancingPrompt}
        promptEnhanced={promptEnhanced}
        sendMessage={sendMessage}
        model={model}
        setModel={handleModelChange}
        provider={provider}
        setProvider={handleProviderChange}
        providerList={activeProviders}
        handleInputChange={(e) => {
          onTextareaChange(e);
          debouncedCachePrompt(e);
        }}
        handleStop={abort}
        description={description}
        importChat={importChat}
        exportChat={exportChat}
        messages={messages.map((message, i) => {
          if (message.role === 'user') {
            return message;
          }

          return {
            ...message,
            content: parsedMessages[i] || '',
          };
        })}
        enhancePrompt={() => {
          enhancePrompt(
            input,
            (input) => {
              setInput(input);
              scrollTextArea();
            },
            model,
            provider,
            apiKeys,
          );
        }}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        actionAlert={actionAlert}
        clearAlert={() => workbenchStore.clearAlert()}
        supabaseAlert={supabaseAlert}
        clearSupabaseAlert={() => workbenchStore.clearSupabaseAlert()}
        deployAlert={deployAlert}
        clearDeployAlert={() => workbenchStore.clearDeployAlert()}
        llmErrorAlert={llmErrorAlert}
        clearLlmErrorAlert={clearApiErrorAlert}
        data={chatData}
        chatMode={chatMode}
        setChatMode={setChatMode}
        append={append}
        designScheme={designScheme}
        setDesignScheme={setDesignScheme}
        selectedElement={selectedElement}
        setSelectedElement={setSelectedElement}
        addToolResult={addToolResult}
        agentMode={agentState.mode}
        setAgentMode={handleAgentModeChange}
        agentExecutor={agentExecutor}
        onTemplateSelect={handleTemplateSelect}
        bmadState={bmadState}
        bmadExecutor={bmadExecutor}

        /*
         * showCommandAutoComplete={showCommandAutoComplete}
         * onCommandSelect={(command) => {
         *   setInput(command);
         *   setShowCommandAutoComplete(false);
         *   textareaRef.current?.focus();
         * }}
         * onCommandAutoCompleteClose={() => {
         *   setShowCommandAutoComplete(false);
         * }}
         * contextFiles={commandProcessor.getContextFiles()}
         * onRemoveContextFile={(path) => {
         *   // 通过执行 #context remove 命令来移除文件
         *   commandProcessor.processInput(`#context remove ${path}`);
         * }}
         * onClearContext={() => {
         *   commandProcessor.clearContext();
         * }}
         * showContextDisplay={showContextDisplay}
         * onToggleContextDisplay={() => {
         *   setShowContextDisplay(!showContextDisplay);
         * }}
         */
      />
    );
  },
);
