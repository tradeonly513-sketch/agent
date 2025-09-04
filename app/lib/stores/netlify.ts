import { atom } from 'nanostores';
import type { NetlifyConnection, NetlifyUser } from '~/types/netlify';
import { logStore } from './logs';
import { toast } from 'react-toastify';

// Initialize with stored connection
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('netlify_connection') : null;

const initialConnection: NetlifyConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      user: null,
      token: '', // Token stored server-side only
      stats: undefined,
    };

export const netlifyConnection = atom<NetlifyConnection>(initialConnection);
export const isConnecting = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

// Function to initialize Netlify connection via server-side API
export async function initializeNetlifyConnection() {
  const currentState = netlifyConnection.get();

  // If we already have a connection, don't override it
  if (currentState.user) {
    return;
  }

  try {
    isConnecting.set(true);

    const response = await fetch('/api/netlify-user');

    if (!response.ok) {
      if (response.status === 401) {
        // No server-side token available, skip initialization
        return;
      }

      throw new Error(`Failed to connect to Netlify: ${response.statusText}`);
    }

    const userData = await response.json();

    // Update the connection state (no token stored client-side)
    const connectionData: Partial<NetlifyConnection> = {
      user: userData as NetlifyUser,
      token: '', // Token stored server-side only
    };

    // Store in localStorage for persistence
    localStorage.setItem('netlify_connection', JSON.stringify(connectionData));

    // Update the store
    updateNetlifyConnection(connectionData);

    // Fetch initial stats
    await fetchNetlifyStats();
  } catch (error) {
    console.error('Error initializing Netlify connection:', error);
    logStore.logError('Failed to initialize Netlify connection', { error });
  } finally {
    isConnecting.set(false);
  }
}

export const updateNetlifyConnection = (updates: Partial<NetlifyConnection>) => {
  const currentState = netlifyConnection.get();
  const newState = { ...currentState, ...updates };
  netlifyConnection.set(newState);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('netlify_connection', JSON.stringify(newState));
  }
};

export async function fetchNetlifyStats() {
  try {
    isFetchingStats.set(true);

    const formData = new FormData();
    formData.append('action', 'get_sites');

    const response = await fetch('/api/netlify-user', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sites: ${response.status}`);
    }

    const data = (await response.json()) as { sites: any[] };
    const sites = data.sites || [];

    const currentState = netlifyConnection.get();
    updateNetlifyConnection({
      ...currentState,
      stats: {
        sites,
        totalSites: sites.length,
      },
    });
  } catch (error) {
    console.error('Netlify API Error:', error);
    logStore.logError('Failed to fetch Netlify stats', { error });
    toast.error('Failed to fetch Netlify statistics');
  } finally {
    isFetchingStats.set(false);
  }
}
