import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { useAuth } from '~/lib/hooks/useAuth';
import { Link } from '@remix-run/react';

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
        {/* Authentication Controls - Always visible */}
        <ClientOnly>
          {() => <AuthControls />}
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

function AuthControls() {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center h-8 px-2 text-bolt-elements-textTertiary">
        <div className="i-svg-spinners:270-ring-with-bg w-5 h-5" />
      </div>
    );
  }
  
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center">
        <div className="relative group">
          <button
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bolt-elements-item-backgroundActive transition-colors"
            aria-label="User menu"
          >
            <img 
              src={user.avatar} 
              alt={`${user.username}'s avatar`}
              className="w-8 h-8 rounded-full border border-bolt-elements-borderColor"
            />
            <span className="text-sm font-medium text-bolt-elements-textPrimary hidden sm:block">
              {user.username}
            </span>
            <div className="i-ph:caret-down w-4 h-4 text-bolt-elements-textTertiary" />
          </button>
          
          <div className="absolute right-0 mt-1 w-48 py-1 bg-bolt-elements-background-depth-2 rounded-md shadow-lg border border-bolt-elements-borderColor hidden group-hover:block z-50">
            <div className="px-4 py-2 text-sm text-bolt-elements-textSecondary border-b border-bolt-elements-borderColor">
              Signed in as <span className="font-semibold text-bolt-elements-textPrimary">{user.username}</span>
            </div>
            
            <Link 
              to="/profile" 
              className="block px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive"
            >
              Your profile
            </Link>
            
            <button
              onClick={() => logout()}
              className="block w-full text-left px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <button
      onClick={() => login()}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundAccentHover transition-colors text-sm font-medium"
    >
      <div className="i-ph:sign-in w-4 h-4" />
      Sign in
    </button>
  );
}
