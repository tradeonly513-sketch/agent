import { atom } from 'nanostores';
import type { VercelConnection } from '~/types/vercel';
import { logStore } from './logs';
import { toast } from 'react-toastify';

// Initialize with stored connection or defaults
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('vercel_connection') : null;
const initialConnection: VercelConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      user: null,
      token: '',
      stats: undefined,
    };

export const vercelConnection = atom<VercelConnection>(initialConnection);
export const isConnecting = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

// Function to initialize Vercel connection via server-side API
export async function initializeVercelConnection() {
  const currentState = vercelConnection.get();

  // If we already have a connection, don't override it
  if (currentState.user) {
    return;
  }

  try {
    isConnecting.set(true);

    const response = await fetch('/api/vercel-user');

    if (!response.ok) {
      if (response.status === 401) {
        // No server-side token available, skip initialization
        return;
      }

      throw new Error(`Failed to connect to Vercel: ${response.statusText}`);
    }

    const userData = await response.json();

    // Update the connection state (no token stored client-side)
    const connectionData: Partial<VercelConnection> = {
      user: userData as any,
      token: '', // Token stored server-side only
    };

    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('vercel_connection', JSON.stringify(connectionData));
    }

    // Update the store
    updateVercelConnection(connectionData);

    // Fetch initial stats
    await fetchVercelStatsViaAPI();
  } catch (error) {
    console.error('Error initializing Vercel connection:', error);
  } finally {
    isConnecting.set(false);
  }
}

// Function to fetch Vercel stats via server-side API
export async function fetchVercelStatsViaAPI() {
  try {
    isFetchingStats.set(true);

    const formData = new FormData();
    formData.append('action', 'get_projects');

    const response = await fetch('/api/vercel-user', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    const data = (await response.json()) as { projects: any[] };
    const projects = data.projects || [];

    const currentState = vercelConnection.get();
    updateVercelConnection({
      ...currentState,
      stats: {
        projects,
        totalProjects: projects.length,
      },
    });
  } catch (error) {
    console.error('Vercel API Error:', error);
    logStore.logError('Failed to fetch Vercel stats', { error });
    toast.error('Failed to fetch Vercel statistics');
  } finally {
    isFetchingStats.set(false);
  }
}

export const updateVercelConnection = (updates: Partial<VercelConnection>) => {
  const currentState = vercelConnection.get();
  const newState = { ...currentState, ...updates };
  vercelConnection.set(newState);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('vercel_connection', JSON.stringify(newState));
  }
};

export async function fetchVercelStats(token: string) {
  try {
    isFetchingStats.set(true);

    const projectsResponse = await fetch('https://api.vercel.com/v13/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!projectsResponse.ok) {
      throw new Error(`Failed to fetch projects: ${projectsResponse.status}`);
    }

    const projectsData = (await projectsResponse.json()) as any;
    const projects = projectsData.projects || [];

    // Fetch latest deployment for each project
    const projectsWithDeployments = await Promise.all(
      projects.map(async (project: any) => {
        try {
          const deploymentsResponse = await fetch(
            `https://api.vercel.com/v13/deployments?projectId=${project.id}&limit=1`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (deploymentsResponse.ok) {
            const deploymentsData = (await deploymentsResponse.json()) as any;
            return {
              ...project,
              latestDeployments: deploymentsData.deployments || [],
            };
          }

          return project;
        } catch (error) {
          console.error(`Error fetching deployments for project ${project.id}:`, error);
          return project;
        }
      }),
    );

    const currentState = vercelConnection.get();
    updateVercelConnection({
      ...currentState,
      stats: {
        projects: projectsWithDeployments,
        totalProjects: projectsWithDeployments.length,
      },
    });
  } catch (error) {
    console.error('Vercel API Error:', error);
    logStore.logError('Failed to fetch Vercel stats', { error });
    toast.error('Failed to fetch Vercel statistics');
  } finally {
    isFetchingStats.set(false);
  }
}
