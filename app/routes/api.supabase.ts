import { json, type ActionFunction } from '@remix-run/cloudflare';
import type { SupabaseProject, ProjectStats } from '~/types/supabase';

// Helper function to execute database queries via Supabase Management API
async function executeDatabaseQuery(projectId: string, token: string, query: string): Promise<any> {
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (response.ok) {
      const result = await response.json();
      return result;
    } else {
      console.warn(`Database query failed for project ${projectId}:`, response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.warn(`Database query error for project ${projectId}:`, error);
    return null;
  }
}

// Helper function to fetch database statistics
async function fetchDatabaseStats(
  projectId: string,
  token: string,
): Promise<{
  tables: number;
  views: number;
  functions: number;
  size_mb: number;
}> {
  const stats = {
    tables: 0,
    views: 0,
    functions: 0,
    size_mb: 0,
  };

  try {
    // Fetch table count
    const tableQuery = `
      SELECT count(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `;

    const tableResult = await executeDatabaseQuery(projectId, token, tableQuery);

    if (tableResult && tableResult.length > 0) {
      stats.tables = parseInt(tableResult[0].count) || 0;
    }

    // Fetch view count
    const viewQuery = `
      SELECT count(*) as count
      FROM information_schema.views
      WHERE table_schema = 'public'
    `;

    const viewResult = await executeDatabaseQuery(projectId, token, viewQuery);

    if (viewResult && viewResult.length > 0) {
      stats.views = parseInt(viewResult[0].count) || 0;
    }

    // Fetch function count
    const functionQuery = `
      SELECT count(*) as count
      FROM information_schema.routines
      WHERE routine_schema = 'public'
    `;

    const functionResult = await executeDatabaseQuery(projectId, token, functionQuery);

    if (functionResult && functionResult.length > 0) {
      stats.functions = parseInt(functionResult[0].count) || 0;
    }

    // Fetch database size in MB
    const sizeQuery = `
      SELECT (pg_database_size(current_database()) / 1024 / 1024) as size_mb
    `;

    const sizeResult = await executeDatabaseQuery(projectId, token, sizeQuery);

    if (sizeResult && sizeResult.length > 0) {
      stats.size_mb = parseInt(sizeResult[0].size_mb) || 0;
    }
  } catch (error) {
    console.warn(`Failed to fetch database stats for project ${projectId}:`, error);
  }

  return stats;
}

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

    // Fetch database statistics using Management API database query endpoint
    try {
      const dbStats = await fetchDatabaseStats(projectId, token);
      stats.database.tables = dbStats.tables;
      stats.database.views = dbStats.views;
      stats.database.functions = dbStats.functions;
      stats.database.size_mb = dbStats.size_mb;
      stats.database.size_bytes = dbStats.size_mb * 1024 * 1024; // Convert MB to bytes
    } catch (error) {
      console.warn(`Failed to fetch database stats for project ${projectId}:`, error);
    }

    return stats;
  } catch (error) {
    console.error(`Failed to fetch stats for project ${projectId}:`, error);
    return null;
  }
}

export const action: ActionFunction = async ({ request, context }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { token } = (await request.json()) as any;

    // Handle server-side token (from environment variables)
    let actualToken = token;

    if (token === 'SERVER_SIDE_TOKEN') {
      // Try to get token from environment variables
      actualToken = context?.cloudflare?.env?.VITE_SUPABASE_ACCESS_TOKEN || process.env.VITE_SUPABASE_ACCESS_TOKEN;

      if (!actualToken) {
        return json({ error: 'Supabase access token not configured in environment variables' }, { status: 401 });
      }
    }

    const projectsResponse = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        Authorization: `Bearer ${actualToken}`,
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

    // Fetch detailed stats for each project (only for active projects)
    const projectsWithStats = await Promise.all(
      uniqueProjects.map(async (project) => {
        // Only fetch stats for active/healthy projects to avoid 544 errors on inactive ones
        const isActive = project.status === 'ACTIVE_HEALTHY' || project.status === 'ACTIVE';
        const stats = isActive ? await fetchProjectStats(project.id, actualToken) : null;

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
