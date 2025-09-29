import { json, type ActionFunction } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.supabase.projects.create');

export interface CreateProjectRequest {
  token: string;
  name: string;
  organizationId: string;
  region?: string;
  plan?: string;
  dbPassword: string;
}

export interface CreateProjectResponse {
  success: boolean;
  project?: {
    id: string;
    name: string;
    region: string;
    organization_id: string;
    status: string;
    database: {
      host: string;
      version: string;
    };
    created_at: string;
  };
  error?: string;
  stage?: 'creating' | 'initializing' | 'ready';
  estimatedTime?: number;
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const {
      token,
      name,
      organizationId,
      region = 'us-east-1',
      plan = 'free',
      dbPassword,
    } = (await request.json()) as CreateProjectRequest;

    logger.debug('Creating Supabase project:', { name, organizationId, region, plan });

    // Validate required fields
    if (!token || !name || !organizationId || !dbPassword) {
      return json(
        {
          success: false,
          error: 'Missing required fields: token, name, organizationId, and dbPassword are required',
        },
        { status: 400 },
      );
    }

    // Validate project name (Supabase requirements)
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) || name.length < 2 || name.length > 63) {
      return json(
        {
          success: false,
          error:
            'Project name must be 2-63 characters, lowercase letters, numbers, and hyphens only, starting and ending with alphanumeric characters',
        },
        { status: 400 },
      );
    }

    // Create project via Supabase Management API
    const createResponse = await fetch('https://api.supabase.com/v1/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        organization_id: organizationId,
        region,
        plan,
        db_pass: dbPassword,
      }),
    });

    if (!createResponse.ok) {
      const errorData = (await createResponse.json()) as { message?: string } | null;
      logger.error('Project creation failed:', errorData);

      // Provide specific error handling
      let errorMessage = 'Failed to create project';

      if (createResponse.status === 402) {
        errorMessage = 'Subscription required: You need an active Supabase subscription to create new projects';
      } else if (createResponse.status === 409) {
        errorMessage = 'Project name already exists in this organization';
      } else if (createResponse.status === 422) {
        errorMessage = 'Invalid project configuration. Check name format, region, and organization permissions';
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }

      return json(
        {
          success: false,
          error: errorMessage,
          stage: 'creating',
        },
        { status: createResponse.status },
      );
    }

    const project = (await createResponse.json()) as {
      id: string;
      name: string;
      region: string;
      organization_id: string;
      status?: string;
      database?: { host: string; version: string };
      created_at?: string;
    };
    logger.debug('Project created successfully:', project);

    // Project creation initiated - will take time to initialize
    return json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        region: project.region,
        organization_id: project.organization_id,
        status: project.status || 'initializing',
        database: project.database || { host: '', version: '' },
        created_at: project.created_at || new Date().toISOString(),
      },
      stage: 'creating',
      estimatedTime: 120, // 2 minutes typical initialization time
    });
  } catch (error) {
    logger.error('Project creation error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
        stage: 'creating',
      },
      { status: 500 },
    );
  }
};
