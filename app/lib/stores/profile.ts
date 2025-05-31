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

// Initialize with stored profile or defaults
const storedProfile = typeof window !== 'undefined' ? localStorage.getItem('bolt_profile') : null;
const initialProfile: Profile = storedProfile
  ? {
      // Ensure backward compatibility with existing profile data
      ...{
        username: '',
        bio: '',
        avatar: '',
        isAuthenticated: false,
      },
      ...JSON.parse(storedProfile),
    }
  : {
      username: '',
      bio: '',
      avatar: '',
      isAuthenticated: false,
    };

export const profileStore = atom<Profile>(initialProfile);

/**
 * Update profile with partial data
 */
export const updateProfile = (updates: Partial<Profile>) => {
  profileStore.set({ ...profileStore.get(), ...updates });

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('bolt_profile', JSON.stringify(profileStore.get()));
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
  const now = Date.now();
  
  updateProfile({
    username: githubUser.login,
    avatar: githubUser.avatar_url,
    // Keep existing bio if available
    bio: profileStore.get().bio || githubUser.name || '',
    isAuthenticated: true,
    lastLogin: now,
    github: githubUser,
  });
};

/**
 * Check if the user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return profileStore.get().isAuthenticated;
};

/**
 * Clear authentication state
 */
export const clearAuthState = () => {
  const currentProfile = profileStore.get();
  
  updateProfile({
    // Keep username/bio/avatar if user wants to
    // but clear authentication state
    isAuthenticated: false,
    github: undefined,
    lastLogin: undefined,
  });
};

/**
 * Get GitHub user data if authenticated
 */
export const getGitHubUser = () => {
  const profile = profileStore.get();
  return profile.isAuthenticated ? profile.github : null;
};
