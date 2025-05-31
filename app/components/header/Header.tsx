import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { Link } from '@remix-run/react';
import { Suspense, lazy, useState, useEffect } from 'react';

// Lazy load the AuthControls component to avoid initialization issues
const LazyAuthControls = lazy(() => 
  import('./HeaderAuthControls.client').catch(() => ({
    default: () => <FallbackAuthUI />
  }))
);

// Simple fallback component when auth fails to load
function FallbackAuthUI() {
  return (
    <div className="flex items-center">
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bolt-elements-background-depth-2 text-bolt-content-secondary hover:bg-bolt-elements-background-depth-3 transition-colors text-sm font-medium"
        onClick={() => {}}
      >
        <div className="i-ph:user-circle w-4 h-4" />
        Sign in
      </button>
    </div>
  );
}

// Error boundary for auth controls
function SafeAuthControls() {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error state if component remounts
    return () => setHasError(false);
  }, []);

  if (hasError) {
    return <FallbackAuthUI />;
  }

  return (
    <Suspense fallback={<div className="flex items-center h-8 px-2 text-bolt-elements-textTertiary">
      <div className="i-svg-spinners:270-ring-with-bg w-5 h-5" />
    </div>}>
      <ErrorCatcher onError={() => setHasError(true)}>
        <LazyAuthControls />
      </ErrorCatcher>
    </Suspense>
  );
}

// Simple error boundary wrapper
function ErrorCatcher({ children, onError }: { children: React.ReactNode; onError: () => void }) {
  try {
    return children;
  } catch (error) {
    console.error("Error rendering auth controls:", error);
    onError();
    return <FallbackAuthUI />;
  }
}

export function Header() {
  const chat = useStore(chatStore);
  
  return (
    <header
      className={classNames('flex items-center p-5 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <a href="/" className="text-2xl font-semibold text-accent flex items-center">
          {/* <span className="i-bolt:logo-text?mask w-[46px] inline-block" /> */}
          <img src="/logo-light-styled.png" alt="logo" className="w-[90px] inline-block dark:hidden" />
          <img src="/logo-dark-styled.png" alt="logo" className="w-[90px] inline-block hidden dark:block" />
        </a>
      </div>
      
      {chat.started && (
        <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
          <ClientOnly>{() => <ChatDescription />}</ClientOnly>
        </span>
      )}
      
      <div className="flex items-center ml-auto">
        {/* Authentication Controls - Always visible with error handling */}
        <ClientOnly fallback={<FallbackAuthUI />}>
          {() => <SafeAuthControls />}
        </ClientOnly>
        
        {/* Existing Action Buttons - Only when chat has started */}
        {chat.started && (
          <ClientOnly>
            {() => (
              <div className="ml-2">
                <HeaderActionButtons />
              </div>
            )}
          </ClientOnly>
        )}
      </div>
    </header>
  );
}
