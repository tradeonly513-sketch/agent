import { json, type ActionFunction } from '@remix-run/cloudflare';
import type { SupabaseProject, ProjectStats } from '~/types/supabase';

// Helper function to fetch detailed project stats
async function fetchProjectStats(projectId: string, token: string): Promise<ProjectStats | null> {
  try {
    const stats: ProjectStats = {
      database: {
        tables: 0,
        views: 0,
        functions: 0,
        size_bytes: 0,
        size_mb: 0,
      },
      storage: {
        buckets: 0,
        files: 0,
        used_bytes: 0,
        used_gb: 0,
        available_bytes: 0,
        available_gb: 0,
      },
      functions: {
        deployed: 0,
        invocations: 0,
      },
    };

    // Fetch storage buckets
    try {
      const storageResponse = await fetch(`https://api.supabase.com/v1/projects/${projectId}/storage/buckets`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (storageResponse.ok) {
        const buckets = await storageResponse.json();
        stats.storage.buckets = Array.isArray(buckets) ? buckets.length : 0;
      }
    } catch (error) {
      console.warn(`Failed to fetch storage stats for project ${projectId}:`, error);
    }

    // Fetch edge functions
    try {
      const functionsResponse = await fetch(`https://api.supabase.com/v1/projects/${projectId}/functions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (functionsResponse.ok) {
        const functions = await functionsResponse.json();
        stats.functions.deployed = Array.isArray(functions) ? functions.length : 0;
      }
    } catch (error) {
      console.warn(`Failed to fetch functions stats for project ${projectId}:`, error);
    }

    /*
     * Note: Database stats (tables, views, functions, size) would require direct database access
     * For now, we'll leave these as 0 and could be enhanced later with database queries
     * or when Supabase provides these stats via their Management API
     */

    return stats;
  } catch (error) {
    console.error(`Failed to fetch stats for project ${projectId}:`, error);
    return null;
  }
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { token } = (await request.json()) as any;

    const projectsResponse = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      console.error('Projects fetch failed:', errorText);

      return json({ error: 'Failed to fetch projects' }, { status: 401 });
    }

    const projects = (await projectsResponse.json()) as SupabaseProject[];

    const uniqueProjectsMap = new Map<string, SupabaseProject>();

    for (const project of projects) {
      if (!uniqueProjectsMap.has(project.id)) {
        uniqueProjectsMap.set(project.id, project);
      }
    }

    const uniqueProjects = Array.from(uniqueProjectsMap.values());

    // Fetch detailed stats for each project
    const projectsWithStats = await Promise.all(
      uniqueProjects.map(async (project) => {
        const stats = await fetchProjectStats(project.id, token);
        return {
          ...project,
          stats: stats || undefined,
        };
      }),
    );

    projectsWithStats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return json({
      user: { email: 'Connected', role: 'Admin' },
      stats: {
        projects: projectsWithStats,
        totalProjects: projectsWithStats.length,
      },
    });
  } catch (error) {
    console.error('Supabase API error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Authentication failed',
      },
      { status: 401 },
    );
  }
};
