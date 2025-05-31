import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from '@remix-run/react';
import { 
  profileStore, 
  setAuthenticatedUser, 
  clearAuthState, 
  isAuthenticated as getIsAuthenticated,
  getGitHubUser
} from '~/lib/stores/profile';
import { useStore } from '@nanostores/react';
import type { GitHubUser } from '~/lib/auth/github-oauth.server';

// Define the API response type for auth status
interface AuthStatusResponse {
  isAuthenticated: boolean;
  user?: GitHubUser;
  tokenStatus?: {
    hasToken: boolean;
  };
  error?: string;
}

/**
 * Hook to manage authentication state and sync between server and client
 */
export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useStore(profileStore);
  const [isLoading, setIsLoading] = useState(true);
  const [serverChecked, setServerChecked] = useState(false);

  // Sync server authentication state with client on initial load
  useEffect(() => {
    const checkServerAuth = async () => {
      try {
        setIsLoading(true);
        // Fetch authentication status from server
        const response = await fetch('/api/auth/status');
        
        if (response.ok) {
          const data = await response.json() as AuthStatusResponse;
          
          if (data.isAuthenticated && data.user) {
            // Update client state with server auth data
            setAuthenticatedUser(data.user);
          } else if (profile.isAuthenticated) {
            // Clear client state if server says not authenticated
            clearAuthState();
          }
        } else {
          // Handle error - assume not authenticated
          if (profile.isAuthenticated) {
            clearAuthState();
          }
        }
      } catch (error) {
        console.error('Error checking authentication status:', error);
      } finally {
        setIsLoading(false);
        setServerChecked(true);
      }
    };

    // Only check server auth once
    if (!serverChecked) {
      checkServerAuth();
    }
  }, [serverChecked, profile.isAuthenticated]);

  /**
   * Navigate to login page
   */
  const login = (redirectTo?: string) => {
    const searchParams = new URLSearchParams();
    
    if (redirectTo || location.pathname !== '/login') {
      searchParams.set('redirectTo', redirectTo || location.pathname);
    }
    
    const searchParamsString = searchParams.toString();
    navigate(`/auth/login${searchParamsString ? `?${searchParamsString}` : ''}`);
  };

  /**
   * Navigate to logout page
   */
  const logout = (redirectTo?: string) => {
    const searchParams = new URLSearchParams();
    
    if (redirectTo) {
      searchParams.set('redirectTo', redirectTo);
    }
    
    const searchParamsString = searchParams.toString();
    navigate(`/auth/logout${searchParamsString ? `?${searchParamsString}` : ''}`);
  };

  /**
   * Check if user needs to authenticate for a protected resource
   * and redirect to login if needed
   */
  const requireAuth = (redirectIfNotAuth: boolean = true) => {
    if (!isLoading && !profile.isAuthenticated && redirectIfNotAuth) {
      login();
      return false;
    }
    
    return profile.isAuthenticated;
  };

  return {
    // Authentication state
    isAuthenticated: profile.isAuthenticated,
    isLoading,
    
    // User data
    user: profile.isAuthenticated ? {
      username: profile.username,
      avatar: profile.avatar,
      bio: profile.bio,
      githubUser: profile.github,
      lastLogin: profile.lastLogin
    } : null,
    
    // GitHub specific data
    githubUser: getGitHubUser(),
    
    // Actions
    login,
    logout,
    requireAuth,
  };
}
