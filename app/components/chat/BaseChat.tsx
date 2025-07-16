/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { Messages } from './Messages.client';
import { getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './BaseChat.module.scss';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import GitCloneButton from './GitCloneButton';
import type { ProviderInfo } from '~/types/model';
import StarterTemplates from './StarterTemplates';
import type { ActionAlert, SupabaseAlert, DeployAlert, LlmErrorAlertType } from '~/types/actions';
import DeployChatAlert from '~/components/deploy/DeployAlert';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import { SupabaseChatAlert } from '~/components/chat/SupabaseAlert';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { useStore } from '@nanostores/react';
import { StickToBottom, useStickToBottomContext } from '~/lib/hooks';
import { ChatBox } from './ChatBox';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import LlmErrorAlert from './LLMApiAlert';

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  supabaseAlert?: SupabaseAlert;
  clearSupabaseAlert?: () => void;
  deployAlert?: DeployAlert;
  clearDeployAlert?: () => void;
  llmErrorAlert?: LlmErrorAlertType;
  clearLlmErrorAlert?: () => void;
  data?: JSONValue[] | undefined;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  append?: (message: Message) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: (element: ElementInfo | null) => void;
  addToolResult?: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      deployAlert,
      clearDeployAlert,
      supabaseAlert,
      clearSupabaseAlert,
      llmErrorAlert,
      clearLlmErrorAlert,
      data,
      chatMode,
      setChatMode,
      append,
      designScheme,
      setDesignScheme,
      selectedElement,
      setSelectedElement,
      addToolResult = () => {
        throw new Error('addToolResult not implemented');
      },
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const expoUrl = useStore(expoUrlAtom);
    const [qrModalOpen, setQrModalOpen] = useState(false);

    useEffect(() => {
      if (expoUrl) {
        setQrModalOpen(true);
      }
    }, [expoUrl]);

    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
        setSelectedElement?.(null);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="flex flex-col lg:flex-row overflow-hidden w-full h-full">
            <div className={classNames(
              styles.Chat, 
              'flex flex-col flex-grow h-full',
              'w-full lg:min-w-[var(--chat-min-width)]',
              'lg:max-w-[55%] xl:max-w-[60%]',
              'relative'
            )}>
              {!chatStarted && (
                <div id="intro" className="flex-1 flex flex-col justify-center items-center px-4 lg:px-8 py-8 md:py-16">
                  <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in-up">
                    {/* Hero Section */}
                    <div className="space-y-6">
                      <div className="flex justify-center mb-8">
                        <div className="relative">
                          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <div className="i-ph:code-duotone text-white text-3xl md:text-4xl" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-success-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                        </div>
                      </div>
                      
                      <h1 className="text-3xl md:text-4xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                        Where ideas become{' '}
                        <span className="text-gradient bg-gradient-to-r from-primary-500 via-accent-500 to-primary-600 bg-clip-text text-transparent animate-gradient">
                          reality
                        </span>
                      </h1>
                      
                      <p className="text-lg md:text-xl lg:text-2xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl mx-auto">
                        Bring your ideas to life in seconds with AI-powered development. 
                        Build, code, and deploy applications directly in your browser.
                      </p>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                      <div className="group p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                          <div className="i-ph:lightning-duotone text-white text-xl" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                          Lightning Fast
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                          Build applications in seconds with AI assistance
                        </p>
                      </div>
                      
                      <div className="group p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                          <div className="i-ph:devices-duotone text-white text-xl" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                          Mobile First
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                          Perfect experience on any device, anywhere
                        </p>
                      </div>
                      
                      <div className="group p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                          <div className="i-ph:rocket-launch-duotone text-white text-xl" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                          Deploy Instantly
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                          One-click deployment to popular platforms
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className={classNames(
                'flex flex-col h-full',
                chatStarted ? 'pt-6' : ''
              )}>
                <StickToBottom
                  className={classNames('flex-1 overflow-hidden', {
                    'px-4 md:px-6 lg:px-8': chatStarted,
                  })}
                  resize="smooth"
                  initial="smooth"
                >
                  <StickToBottom.Content className="flex flex-col gap-6 h-full">
                    <ClientOnly>
                      {() => {
                        return chatStarted ? (
                          <Messages
                            className="flex flex-col w-full flex-1 max-w-4xl mx-auto space-y-6"
                            messages={messages}
                            isStreaming={isStreaming}
                            append={append}
                            chatMode={chatMode}
                            setChatMode={setChatMode}
                            provider={provider}
                            model={model}
                            addToolResult={addToolResult}
                          />
                        ) : null;
                      }}
                    </ClientOnly>
                    <ScrollToBottom />
                  </StickToBottom.Content>
                  
                  {/* Enhanced Chat Input Section */}
                  <div className={classNames(
                    'sticky bottom-0 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-slate-900 dark:via-slate-900/95 dark:to-transparent',
                    'border-t border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xl',
                    'px-4 md:px-6 lg:px-8 py-4 md:py-6',
                    'space-y-4'
                  )}>
                    {/* Alert Messages */}
                    <div className="space-y-3">
                      {deployAlert && (
                        <DeployChatAlert
                          alert={deployAlert}
                          clearAlert={() => clearDeployAlert?.()}
                          postMessage={(message: string | undefined) => {
                            sendMessage?.({} as any, message);
                            clearSupabaseAlert?.();
                          }}
                        />
                      )}
                      {supabaseAlert && (
                        <SupabaseChatAlert
                          alert={supabaseAlert}
                          clearAlert={() => clearSupabaseAlert?.()}
                          postMessage={(message) => {
                            sendMessage?.({} as any, message);
                            clearSupabaseAlert?.();
                          }}
                        />
                      )}
                      {actionAlert && (
                        <ChatAlert
                          alert={actionAlert}
                          clearAlert={() => clearAlert?.()}
                          postMessage={(message) => {
                            sendMessage?.({} as any, message);
                            clearAlert?.();
                          }}
                        />
                      )}
                      {llmErrorAlert && <LlmErrorAlert alert={llmErrorAlert} clearAlert={() => clearLlmErrorAlert?.()} />}
                    </div>
                    
                    {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                    
                    {/* Enhanced Chat Box */}
                    <ChatBox
                      isModelSettingsCollapsed={isModelSettingsCollapsed}
                      setIsModelSettingsCollapsed={setIsModelSettingsCollapsed}
                      provider={provider}
                      setProvider={setProvider}
                      providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                      model={model}
                      setModel={setModel}
                      modelList={modelList}
                      apiKeys={apiKeys}
                      isModelLoading={isModelLoading}
                      onApiKeysChange={onApiKeysChange}
                      uploadedFiles={uploadedFiles}
                      setUploadedFiles={setUploadedFiles}
                      imageDataList={imageDataList}
                      setImageDataList={setImageDataList}
                      textareaRef={textareaRef}
                      input={input}
                      handleInputChange={handleInputChange}
                      handlePaste={handlePaste}
                      TEXTAREA_MIN_HEIGHT={TEXTAREA_MIN_HEIGHT}
                      TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
                      isStreaming={isStreaming}
                      handleStop={handleStop}
                      handleSendMessage={handleSendMessage}
                      enhancingPrompt={enhancingPrompt}
                      enhancePrompt={enhancePrompt}
                      isListening={isListening}
                      startListening={startListening}
                      stopListening={stopListening}
                      chatStarted={chatStarted}
                      exportChat={exportChat}
                      qrModalOpen={qrModalOpen}
                      setQrModalOpen={setQrModalOpen}
                      handleFileUpload={handleFileUpload}
                      chatMode={chatMode}
                      setChatMode={setChatMode}
                      designScheme={designScheme}
                      setDesignScheme={setDesignScheme}
                      selectedElement={selectedElement}
                      setSelectedElement={setSelectedElement}
                    />
                  </div>
                </StickToBottom>
                
                {/* Import/Export and Examples */}
                <div className="flex flex-col items-center space-y-6 pb-6">
                  {!chatStarted && (
                    <div className="flex flex-wrap justify-center gap-3">
                      {ImportButtons(importChat)}
                      <GitCloneButton importChat={importChat} />
                    </div>
                  )}
                  
                  <div className="w-full max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
                    {!chatStarted &&
                      ExamplePrompts((event, messageInput) => {
                        if (isStreaming) {
                          handleStop?.();
                          return;
                        }
                        handleSendMessage?.(event, messageInput);
                      })}
                    {!chatStarted && <StarterTemplates />}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Enhanced Workbench */}
            <ClientOnly>
              {() => (
                <Workbench 
                  chatStarted={chatStarted} 
                  isStreaming={isStreaming} 
                  setSelectedElement={setSelectedElement} 
                />
              )}
            </ClientOnly>
          </div>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <>
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-bolt-elements-background-depth-1 to-transparent h-20 z-10" />
        <button
          className="sticky z-50 bottom-0 left-0 right-0 text-4xl rounded-lg px-1.5 py-0.5 flex items-center justify-center mx-auto gap-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
          onClick={() => scrollToBottom()}
        >
          Go to last message
          <span className="i-ph:arrow-down animate-bounce" />
        </button>
      </>
    )
  );
}
