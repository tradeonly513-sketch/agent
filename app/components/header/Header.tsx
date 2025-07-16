import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { isMobile } from '~/utils/mobile';
import { useState, useEffect } from 'react';

export function Header() {
  const chat = useStore(chatStore);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobileDevice(isMobile());
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <header
      className={classNames(
        'flex items-center px-3 md:px-4 border-b h-[var(--header-height)] bg-bolt-elements-background-depth-1 backdrop-blur-sm relative z-50',
        {
          'border-transparent': !chat.started,
          'border-bolt-elements-borderColor': chat.started,
        }
      )}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer min-w-0">
        <div className="i-ph:sidebar-simple-duotone text-xl hover:text-accent transition-colors duration-200" />
        <a href="/" className="text-lg md:text-2xl font-semibold text-accent flex items-center min-w-0 truncate">
          <span className="hidden md:inline">CodeCraft Studio</span>
          <span className="md:hidden">CodeCraft</span>
        </a>
      </div>
      
      {chat.started && (
        <>
          <span className="flex-1 px-2 md:px-4 truncate text-center text-bolt-elements-textPrimary min-w-0">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="flex items-center gap-1 md:gap-2">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </>
      )}
    </header>
  );
}
