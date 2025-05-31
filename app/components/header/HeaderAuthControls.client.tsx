import { Link } from '@remix-run/react';
import { useAuth } from '~/lib/hooks/useAuth';
import { useState, useEffect } from 'react';

/**
 * Authentication controls component for the header
 * Separated into a client component to prevent module loading issues
 */
export default function HeaderAuthControls() {
  // Error state for component-level error handling
  const [renderError, setRenderError] = useState<Error | null>(null);

  // Call useAuth at the top level of the component as required by React hooks rules
  let authState;
  try {
    // Properly use the hook at component top level
    authState = useAuth();
  } catch (error) {
    console.error('Error initializing auth hook:', error);
    // Return fallback UI immediately if hook initialization fails
    return (
      <div className="flex items-center">
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bolt-elements-background-depth-2 text-bolt-content-secondary hover:bg-bolt-elements-background-depth-3 transition-colors text-sm font-medium"
          onClick={() => window.location.href = '/auth/login'}
        >
          <div className="i-ph:user-circle w-4 h-4" />
          Sign in
        </button>
      </div>
    );
  }

  // Safely extract values from auth state
  const { isAuthenticated, isLoading, user, login, logout } = authState || {};

  // Reset render error when dependencies change
  useEffect(() => {
    if (renderError) {
      setRenderError(null);
    }
  }, [isAuthenticated, isLoading, user]);

  // Safely handle login with fallback
  const handleLogin = () => {
    try {
      if (typeof login === 'function') {
        login();
      } else {
        // Fallback if login function is unavailable
        window.location.href = '/auth/login';
      }
    } catch (error) {
      console.error('Error during login:', error);
      // Fallback to direct navigation on error
      window.location.href = '/auth/login';
    }
  };

  // Safely handle logout with fallback
  const handleLogout = () => {
    try {
      if (typeof logout === 'function') {
        logout();
      } else {
        // Fallback if logout function is unavailable
        window.location.href = '/auth/logout';
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Fallback to direct navigation on error
      window.location.href = '/auth/logout';
    }
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center h-8 px-2 text-bolt-elements-textTertiary">
        <div className="i-svg-spinners:270-ring-with-bg w-5 h-5" />
      </div>
    );
  }

  // Handle render errors
  if (renderError) {
    return (
      <div className="flex items-center">
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bolt-elements-background-depth-2 text-bolt-content-secondary hover:bg-bolt-elements-background-depth-3 transition-colors text-sm font-medium"
          onClick={() => window.location.href = '/auth/login'}
        >
          <div className="i-ph:user-circle w-4 h-4" />
          Sign in
        </button>
      </div>
    );
  }

  try {
    // Handle authenticated state
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
                onError={(e) => {
                  // Fallback for broken image links
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3Cpath d="M12 8v8"/%3E%3Cpath d="M8 12h8"/%3E%3C/svg%3E';
                }}
              />
              <span className="text-sm font-medium text-bolt-elements-textPrimary hidden sm:block">
                {user.username || 'User'}
              </span>
              <div className="i-ph:caret-down w-4 h-4 text-bolt-elements-textTertiary" />
            </button>
            
            <div className="absolute right-0 mt-1 w-48 py-1 bg-bolt-elements-background-depth-2 rounded-md shadow-lg border border-bolt-elements-borderColor hidden group-hover:block z-50">
              <div className="px-4 py-2 text-sm text-bolt-elements-textSecondary border-b border-bolt-elements-borderColor">
                Signed in as <span className="font-semibold text-bolt-elements-textPrimary">{user.username || 'User'}</span>
              </div>
              
              <Link 
                to="/profile" 
                className="block px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive"
              >
                Your profile
              </Link>
              
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // Handle unauthenticated state (default)
    return (
      <button
        onClick={handleLogin}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundAccentHover transition-colors text-sm font-medium"
      >
        <div className="i-ph:sign-in w-4 h-4" />
        Sign in
      </button>
    );
  } catch (error) {
    // Catch any rendering errors
    console.error('Error rendering auth controls:', error);
    setRenderError(error instanceof Error ? error : new Error(String(error)));
    
    // Return fallback UI
    return (
      <button
        onClick={() => window.location.href = '/auth/login'}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bolt-elements-background-depth-2 text-bolt-content-secondary hover:bg-bolt-elements-background-depth-3 transition-colors text-sm font-medium"
      >
        <div className="i-ph:user-circle w-4 h-4" />
        Sign in
      </button>
    );
  }
}
