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
import { useRequestOptimization, shouldOptimizeRequest } from '~/lib/hooks/useRequestOptimization';
import { useProviderValidation } from '~/lib/hooks/useProviderValidation';
import { SmartDefaults } from '~/lib/utils/smart-defaults';
import type { LlmErrorAlertType, ChatMode } from '~/types/actions';
import { agentStore } from '~/lib/stores/chat';
import { ClientAgentExecutor } from '~/lib/agent/client-executor';

import { BmadExecutor } from '~/lib/agent/bmad-executor';
import { bmadStore, bmadActions } from '~/lib/stores/bmad-store';
import { getApiKeysFromCookies } from './APIKeyManager';

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

    // 验证消息数组，确保没有空的assistant消息
    const validateMessages = useCallback((messages: Message[]): Message[] => {
      return messages.filter((msg, index) => {
        // 保留所有用户消息
        if (msg.role === 'user') {
          return true;
        }

        // 对于assistant消息，确保有内容
        if (msg.role === 'assistant') {
          const hasContent = msg.content && msg.content.trim() !== '';

          if (!hasContent) {
            console.warn(`Filtering out empty assistant message at index ${index}:`, msg);
            return false;
          }

          return true;
        }

        // 保留其他类型的消息
        return true;
      });
    }, []);

    // 验证模型和提供商匹配
    const validateModelProvider = useCallback((selectedModel: string, selectedProvider: ProviderInfo): boolean => {
      const modelExists = selectedProvider.staticModels?.some((m) => m.name === selectedModel);

      if (!modelExists) {
        console.warn(`Model ${selectedModel} not found in provider ${selectedProvider.name}`);
        return false;
      }

      return true;
    }, []);

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

      if (savedModel) {
        // Check if saved model is available in configured providers
        const smartDefaults = SmartDefaults.getInstance();
        const userApiKeys = getApiKeysFromCookies();

        if (smartDefaults.isModelAvailable(savedModel, userApiKeys)) {
          return savedModel;
        }
      }

      // Use smart default selection
      const smartDefaults = SmartDefaults.getInstance();
      const userApiKeys = getApiKeysFromCookies();
      const defaults = smartDefaults.getSmartDefaults(userApiKeys);

      return defaults.model;
    });
    const [provider, setProvider] = useState(() => {
      const savedProvider = Cookies.get('selectedProvider');

      // If we have a saved provider and it exists in the list, use it
      if (savedProvider && PROVIDER_LIST.find((p) => p.name === savedProvider)) {
        const savedProviderInfo = PROVIDER_LIST.find((p) => p.name === savedProvider) as ProviderInfo;

        // Check if this provider is actually configured
        const parsedKeys = getApiKeysFromCookies();
        const apiKey = parsedKeys[savedProviderInfo.name];
        const isConfigured = apiKey && apiKey.trim() !== '';
        const isLocal = ['Ollama', 'LMStudio'].includes(savedProviderInfo.name);

        if (isConfigured || isLocal) {
          return savedProviderInfo;
        }
      }

      // Use smart default selection
      const smartDefaults = SmartDefaults.getInstance();
      const userApiKeys = getApiKeysFromCookies();
      const defaults = smartDefaults.getSmartDefaults(userApiKeys);

      return defaults.provider;
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

    // Request optimization hook
    const { optimizeRequest } = useRequestOptimization({
      maxRequestSizeKB: 300, // 300KB max request size
      preserveRecentMessages: 3,
      compressFileContent: true,
      removeRedundantArtifacts: true,
    });

    // Custom fetch function with request optimization
    const optimizedFetch = useCallback(
      async (url: string, options: RequestInit) => {
        if (url === '/api/chat' && options.method === 'POST' && options.body) {
          try {
            const requestData = JSON.parse(options.body as string);

            // Check if request needs optimization
            if (shouldOptimizeRequest(requestData.messages, requestData.files, 300)) {
              const optimizationResult = optimizeRequest(requestData.messages, requestData.files);

              // Log optimization results
              console.log(
                `Request optimized: ${(optimizationResult.originalSize / 1024).toFixed(1)}KB → ` +
                  `${(optimizationResult.optimizedSize / 1024).toFixed(1)}KB ` +
                  `(${(optimizationResult.compressionRatio * 100).toFixed(1)}%)`,
              );

              // Use optimized messages
              requestData.messages = optimizationResult.messages;
              options.body = JSON.stringify(requestData);
            }
          } catch (error) {
            console.warn('Failed to optimize request:', error);

            // Continue with original request if optimization fails
          }
        }

        // Add timeout for API requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 45000); // 45 seconds timeout

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timeout. Please check your internet connection and try again.');
          }
          throw error;
        }
      },
      [optimizeRequest],
    );

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
      fetch: optimizedFetch,
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

        // Handle API key errors specifically
        if (e.message?.includes('Missing API key')) {
          const providerMatch = e.message.match(/Missing API key for (\w+) provider/);
          const providerName = providerMatch ? providerMatch[1] : 'current';

          // Show configured alternatives if available
          const configuredProviders = validationResult.configuredProviders;
          const hasAlternatives = configuredProviders.length > 0;

          let errorMessage = `❌ Missing API key for ${providerName} provider.`;

          if (hasAlternatives) {
            const alternatives = configuredProviders
              .map((p) => p.name)
              .slice(0, 3)
              .join(', ');
            errorMessage += ` Try switching to: ${alternatives}`;
          } else {
            errorMessage += ' Please configure your API key in Settings.';
          }

          toast.error(errorMessage, {
            autoClose: 12000,
          });

          // Show additional help after a delay
          setTimeout(() => {
            showProviderConfigurationHelp();
          }, 1000);

          return;
        }

        // Handle context length errors specifically
        if (
          e.message?.includes('context length') ||
          e.message?.includes('maximum context') ||
          e.message?.includes('token')
        ) {
          toast.error('Conversation too long! Please start a new chat or enable context optimization in settings.', {
            autoClose: 8000,
          });
          return;
        }

        // Agent模式的特殊错误处理
        if (agentState.mode === 'agent') {
          console.error('Agent mode error:', e);

          // 检查是否是空消息错误
          if (e.message && e.message.includes('must not be empty')) {
            console.error('Empty message detected, cleaning up messages...');
            setMessages((prevMessages) => validateMessages(prevMessages));
            toast.error('Message validation error. Cleaned up and retrying...', {
              autoClose: 3000,
            });
          }
          // 检查是否是API密钥错误
          else if (e.message && e.message.includes('Missing API key')) {
            console.error('API key missing for provider:', provider?.name);
            toast.error(
              `Missing API key for ${provider?.name}. Please configure your API key in Settings or switch to a different provider.`,
              {
                autoClose: 8000,
              },
            );
          }
          // 检查是否是provider模型缺失错误
          else if (e.message && e.message.includes('No models found for provider')) {
            const providerMatch = e.message.match(/No models found for provider (\w+)/);
            const providerName = providerMatch ? providerMatch[1] : 'current';
            console.error(`No models found for provider: ${providerName}`);
            toast.error(
              `Provider ${providerName} is not available or not running. Please switch to a different provider.`,
              {
                autoClose: 8000,
              },
            );

            // 重置重试计数，避免无限重试
            setAgentRetryCount(0);
          } else {
            toast.error('Agent encountered an error. Please try a simpler request or switch to Chat mode.', {
              autoClose: 5000,
            });
          }
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

        // 成功完成后重置重试计数
        if (agentRetryCount > 0) {
          console.log('Resetting agent retry count after successful completion');
          setAgentRetryCount(0);
        }
      },
      initialMessages,
      initialInput: Cookies.get(PROMPT_COOKIE_KEY) || '',
    });

    // 监控聊天状态，自动恢复卡住的状态
    useEffect(() => {
      let timeoutId: NodeJS.Timeout;

      if (isLoading || fakeLoading) {
        // 捕获当前的模式状态，避免在timeout回调中读取可能已经改变的状态
        const currentMode = agentState.mode;
        const isAgentMode = currentMode === 'agent';

        // Agent模式需要更长的处理时间，但不要太长以避免用户等待
        // 普通模式30秒，Agent模式60秒（减少从90秒）
        const timeoutDuration = isAgentMode ? 60000 : 30000;

        console.log(`Setting timeout for ${currentMode} mode: ${timeoutDuration}ms`);

        timeoutId = setTimeout(() => {
          console.warn(`Chat loading timeout (${currentMode} mode), resetting state...`);
          setFakeLoading(false);

          if (isLoading) {
            stop();
          }

          // Agent模式的重试逻辑
          if (isAgentMode && agentRetryCount < 2) {
            setAgentRetryCount((prev) => prev + 1);
            toast.warning(`Agent timeout. Retrying... (${agentRetryCount + 1}/3)`, {
              autoClose: 3000,
            });

            // 延迟重试，给系统时间恢复，并实际重新发送请求
            setTimeout(() => {
              console.log('Agent retry attempt:', agentRetryCount + 1);

              // 获取最后一个用户消息并重新发送
              const lastUserMessage = messages.findLast((msg) => msg.role === 'user');
              if (lastUserMessage) {
                console.log('Retrying with last user message:', lastUserMessage.content.substring(0, 100));
                sendMessage(new Event('retry') as any, lastUserMessage.content);
              } else {
                console.warn('No user message found for retry');
                // 如果没有找到用户消息，发送一个继续请求
                sendMessage(new Event('retry') as any, '继续');
              }
            }, 2000);
          } else {
            // 重置重试计数
            setAgentRetryCount(0);

            const message = isAgentMode
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
    }, [isLoading, fakeLoading, stop, agentState.mode, agentRetryCount]);

    // 消息验证和清理
    useEffect(() => {
      if (messages.length > 0) {
        const validatedMessages = validateMessages(messages);

        if (validatedMessages.length !== messages.length) {
          console.log('Cleaned up invalid messages:', {
            original: messages.length,
            cleaned: validatedMessages.length,
          });
          setMessages(validatedMessages);
        }
      }
    }, [messages, validateMessages, setMessages]);

    // Agent模式特殊监控
    useEffect(() => {
      if (agentState.mode === 'agent' && isLoading) {
        console.log('Agent mode: Request started, monitoring for timeout...', {
          mode: agentState.mode,
          isLoading,
          fakeLoading,
          retryCount: agentRetryCount,
        });

        // 添加额外的状态检查
        const checkInterval = setInterval(() => {
          if (isLoading && !fakeLoading) {
            console.log('Agent mode: Still processing request...', {
              mode: agentState.mode,
              isLoading,
              fakeLoading,
              retryCount: agentRetryCount,
            });
          }
        }, 10000); // 每10秒检查一次

        return () => {
          clearInterval(checkInterval);
        };
      }
    }, [agentState.mode, isLoading, fakeLoading, agentRetryCount]);

    // 监控Agent模式变化
    useEffect(() => {
      console.log('Agent mode changed:', {
        mode: agentState.mode,
        isLoading,
        fakeLoading,
        retryCount: agentRetryCount,
      });
    }, [agentState.mode]);

    // 初始化检查：确保模型和提供商匹配
    useEffect(() => {
      if (!validateModelProvider(model, provider)) {
        console.warn(`Initial model/provider mismatch: ${model} not found in ${provider.name}`);

        // 尝试找到一个匹配的模型
        const firstModel = provider.staticModels?.[0];

        if (firstModel) {
          console.log(`Switching to first available model: ${firstModel.name}`);
          setModel(firstModel.name);
          Cookies.set('selectedModel', firstModel.name);
        } else {
          // 如果当前提供商没有模型，切换到默认提供商
          console.log(`No models found in ${provider.name}, switching to default provider`);
          setProvider(DEFAULT_PROVIDER as ProviderInfo);
          setModel(DEFAULT_MODEL);
          Cookies.set('selectedProvider', DEFAULT_PROVIDER.name);
          Cookies.set('selectedModel', DEFAULT_MODEL);
        }
      }
    }, [model, provider, validateModelProvider]);

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
    const { validationResult, showProviderConfigurationHelp } = useProviderValidation();

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

        // 验证模型和提供商匹配
        if (!validateModelProvider(model, provider)) {
          toast.error(
            `Model ${model} is not compatible with provider ${provider.name}. Please select a different model or provider.`,
            {
              autoClose: 5000,
            },
          );
          return;
        }

        console.log('Sending message with:', {
          model,
          provider: provider.name,
          mode: agentState.mode,
        });

        // Handle Agent mode - Enhanced Chat mode with Agent capabilities
        if (agentState.mode === 'agent') {
          console.log('Sending message in Agent mode:', {
            mode: agentState.mode,
            messageContent: messageContent.substring(0, 100) + '...',
          });

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

          // Enable template selection for both chat and agent modes
          if (autoSelectTemplate) {
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
                const { assistantMessage, userMessage, remainingFiles, totalFiles, templateName } = temResp;
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
                  } as any,
                ]);

                // Create remaining files after the initial message is processed
                if (remainingFiles && remainingFiles.length > 0) {
                  setTimeout(async () => {
                    try {
                      toast.info(`Creating ${remainingFiles.length} additional files...`, {
                        autoClose: 2000,
                      });

                      // Add a follow-up message with remaining files
                      const remainingFilesMessage = `
Let me create the remaining files to complete your ${templateName} project:

<boltArtifact id="remaining-files" title="Complete Project Structure" type="bundled">
${remainingFiles
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>

Perfect! Your ${templateName} project is now complete with all ${totalFiles} files. You can start developing right away!`;

                      setMessages((prev) => [
                        ...prev,
                        {
                          id: `${Date.now()}-remaining`,
                          role: 'assistant',
                          content: remainingFilesMessage,
                        },
                      ]);

                      toast.success(`✅ Project setup complete! Created ${totalFiles} files.`, {
                        autoClose: 3000,
                      });
                    } catch (error) {
                      console.error('Error creating remaining files:', error);
                      toast.error('Some files may not have been created. Please check the file tree.');
                    }
                  }, 1000); // Delay to ensure the first message is processed
                }

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

            // 在连续对话中，追加消息而不是替换整个数组
            setMessages((prevMessages) => {
              // 使用验证函数确保消息有效
              const validatedMessages = validateMessages(prevMessages);
              console.log('Agent mode: Adding message to conversation', {
                previousCount: prevMessages.length,
                validatedCount: validatedMessages.length,
                newTotal: validatedMessages.length + 1,
              });

              return [...validatedMessages, displayUserMessage];
            });

            toast.info('🤖 Agent analyzing your request...', {
              autoClose: 3000,
            });
          } else {
            // Chat mode - normal behavior
            setMessages((prevMessages) => {
              // 使用验证函数确保消息有效
              const validatedMessages = validateMessages(prevMessages);
              return [...validatedMessages, userMessage];
            });
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
          // 添加调试日志，确保我们发送正确的模型和provider
          console.log('Preparing message with current state:', {
            model,
            provider: provider.name,
            isModelValid: validateModelProvider(model, provider)
          });

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

      // 立即检查并更新模型，确保模型和provider匹配
      if (!validateModelProvider(model, newProvider)) {
        const firstModel = newProvider.staticModels?.[0];
        if (firstModel) {
          console.log(`Provider changed to ${newProvider.name}, switching to first available model: ${firstModel.name}`);
          setModel(firstModel.name);
          Cookies.set('selectedModel', firstModel.name, { expires: 30 });
        }
      }
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
