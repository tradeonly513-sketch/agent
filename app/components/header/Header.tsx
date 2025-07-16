import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { isMobile } from '~/utils/mobile';
import { useState, useEffect } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';

export function Header() {
  const chat = useStore(chatStore);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const showWorkbench = useStore(workbenchStore.showWorkbench);

  useEffect(() => {
    const checkMobile = () => setIsMobileDevice(isMobile());
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleWorkbench = () => {
    workbenchStore.showWorkbench.set(!showWorkbench);
  };

  return (
    <header
      className={classNames(
        'flex items-center justify-between h-[var(--header-height)] px-4 md:px-6',
        'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl',
        'border-b border-slate-200/50 dark:border-slate-700/50',
        'sticky top-0 z-40 transition-all duration-200',
        'shadow-sm hover:shadow-md'
      )}
    >
      {/* Left section - Brand and navigation */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Mobile menu button - hidden on desktop since sidebar auto-shows on hover */}
        <button
          className={classNames(
            'lg:hidden flex items-center justify-center w-10 h-10 rounded-xl',
            'bg-gradient-to-br from-primary-500 to-primary-600',
            'hover:from-primary-600 hover:to-primary-700',
            'text-white shadow-md hover:shadow-lg',
            'transition-all duration-200 hover:scale-105 active:scale-95',
            'touch-manipulation'
          )}
          aria-label="Toggle menu"
        >
          <div className="i-ph:list text-lg" />
        </button>

        {/* Brand */}
        <a 
          href="/" 
          className={classNames(
            'flex items-center gap-3 min-w-0 group',
            'hover:scale-105 transition-transform duration-200'
          )}
        >
          <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-md group-hover:shadow-lg transition-shadow duration-200">
            <div className="i-ph:code-duotone text-white text-lg md:text-xl" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gradient truncate">
              CodeCraft Studio
            </h1>
            <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              AI Development Platform
            </div>
          </div>
        </a>
      </div>

      {/* Center section - Chat description (when chat started) */}
      {chat.started && (
        <div className="hidden md:flex flex-1 justify-center px-4 min-w-0">
          <div className="max-w-md truncate">
            <ClientOnly>
              {() => (
                <div className="text-sm text-slate-600 dark:text-slate-300 text-center truncate">
                  <ChatDescription />
                </div>
              )}
            </ClientOnly>
          </div>
        </div>
      )}

      {/* Right section - Actions */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Workbench toggle for mobile */}
        {chat.started && isMobileDevice && (
          <button
            onClick={toggleWorkbench}
            className={classNames(
              'flex items-center justify-center w-10 h-10 rounded-lg',
              'transition-all duration-200 touch-manipulation',
              showWorkbench
                ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
            aria-label="Toggle code editor"
          >
            <div className="i-ph:code-simple text-lg" />
          </button>
        )}

        {/* Header action buttons */}
        {chat.started && (
          <ClientOnly>
            {() => (
              <div className="flex items-center gap-1 md:gap-2">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        )}

        {/* New chat button */}
        {chat.started && (
          <a
            href="/"
            className={classNames(
              'flex items-center gap-2 px-3 py-2 rounded-lg',
              'bg-gradient-to-r from-primary-500 to-primary-600',
              'hover:from-primary-600 hover:to-primary-700',
              'text-white font-medium text-sm',
              'shadow-md hover:shadow-lg',
              'transition-all duration-200 hover:scale-105 active:scale-95',
              'touch-manipulation',
              'hidden sm:flex'
            )}
          >
            <div className="i-ph:plus text-lg" />
            <span className="hidden md:inline">New Chat</span>
          </a>
        )}

        {/* Mobile new chat button */}
        {chat.started && (
          <a
            href="/"
            className={classNames(
              'sm:hidden flex items-center justify-center w-10 h-10 rounded-lg',
              'bg-gradient-to-r from-primary-500 to-primary-600',
              'hover:from-primary-600 hover:to-primary-700',
              'text-white shadow-md hover:shadow-lg',
              'transition-all duration-200 hover:scale-105 active:scale-95',
              'touch-manipulation'
            )}
            aria-label="New chat"
          >
            <div className="i-ph:plus text-lg" />
          </a>
        )}

        {/* Settings indicator */}
        <div className="hidden lg:flex items-center">
          <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" title="Online" />
        </div>
      </div>
    </header>
  );
}
