import { atom } from 'nanostores';

/**
 * Enhanced Profile interface with authentication-related fields
 */
interface Profile {
  // Basic profile fields (original)
  username: string;
  bio: string;
  avatar: string;
  
  // Authentication state
  isAuthenticated: boolean;
  lastLogin?: number; // timestamp
  
  // GitHub user data
  github?: {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
    html_url: string;
  };
}

// Default profile with all required fields
const defaultProfile: Profile = {
  username: '',
  bio: '',
  avatar: '',
  isAuthenticated: false,
};

// Safely get stored profile from localStorage with error handling
function getSafeStoredProfile(): Profile | null {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    // Safely access localStorage
    const storedProfile = localStorage.getItem('bolt_profile');
    if (!storedProfile) {
      return null;
    }
    
    // Safely parse JSON with error handling
    const parsedProfile = JSON.parse(storedProfile);
    return parsedProfile;
  } catch (error) {
    // Handle any errors (localStorage not available, JSON parse error, etc.)
    console.error('Error accessing profile from localStorage:', error);
    return null;
  }
}

// Initialize with stored profile or defaults
const storedProfile = getSafeStoredProfile();
const initialProfile: Profile = storedProfile
  ? {
      // Ensure backward compatibility with existing profile data
      // Start with default values for all required fields
      ...defaultProfile,
      // Then apply stored values, ensuring type safety
      ...(storedProfile as Partial<Profile>),
    }
  : defaultProfile;

// Create the store with safe initial values
export const profileStore = atom<Profile>(initialProfile);

/**
 * Update profile with partial data
 */
export const updateProfile = (updates: Partial<Profile>) => {
  try {
    profileStore.set({ ...profileStore.get(), ...updates });

    // Safely persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bolt_profile', JSON.stringify(profileStore.get()));
      } catch (error) {
        console.error('Error saving profile to localStorage:', error);
      }
    }
  } catch (error) {
    console.error('Error updating profile:', error);
  }
};

/**
 * Set authenticated user data from GitHub
 */
export const setAuthenticatedUser = (githubUser: {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}) => {
  try {
    const now = Date.now();
    const currentProfile = profileStore.get();
    
    updateProfile({
      username: githubUser.login,
      avatar: githubUser.avatar_url,
      // Keep existing bio if available
      bio: currentProfile.bio || githubUser.name || '',
      isAuthenticated: true,
      lastLogin: now,
      github: githubUser,
    });
  } catch (error) {
    console.error('Error setting authenticated user:', error);
    // Fallback to minimal profile update on error
    updateProfile({
      username: githubUser.login || 'User',
      avatar: githubUser.avatar_url || '',
      isAuthenticated: true,
    });
  }
};

/**
 * Check if the user is authenticated
 * With safe access pattern to prevent "Cannot access before initialization" errors
 */
export const isAuthenticated = (): boolean => {
  try {
    const profile = profileStore.get();
    return Boolean(profile && profile.isAuthenticated);
  } catch (error) {
    console.error('Error checking authentication state:', error);
    return false;
  }
};

/**
 * Clear authentication state
 */
export const clearAuthState = () => {
  try {
    const currentProfile = profileStore.get();
    
    updateProfile({
      // Keep username/bio/avatar if user wants to
      // but clear authentication state
      isAuthenticated: false,
      github: undefined,
      lastLogin: undefined,
    });
  } catch (error) {
    console.error('Error clearing auth state:', error);
    // Fallback to resetting the entire profile on error
    profileStore.set(defaultProfile);
  }
};

/**
 * Get GitHub user data if authenticated
 * With safe access pattern to prevent "Cannot access before initialization" errors
 */
export const getGitHubUser = () => {
  try {
    const profile = profileStore.get();
    return (profile && profile.isAuthenticated && profile.github) ? profile.github : null;
  } catch (error) {
    console.error('Error getting GitHub user:', error);
    return null;
  }
};

/**
 * Get safe profile data that won't throw if accessed before initialization
 * Useful for components that need to access profile data safely
 */
export const getSafeProfile = (): Profile => {
  try {
    return profileStore.get();
  } catch (error) {
    console.error('Error getting profile:', error);
    return defaultProfile;
  }
};
