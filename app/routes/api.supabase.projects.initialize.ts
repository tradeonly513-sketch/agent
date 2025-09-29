import { json, type ActionFunction } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.supabase.projects.initialize');

export interface InitializeProjectRequest {
  token: string;
  projectId: string;
  setupOptions?: {
    generateEnvFile?: boolean;
    enableRLS?: boolean;
    createExampleTable?: boolean;
  };
}

export interface InitializeProjectResponse {
  success: boolean;
  project?: {
    id: string;
    name: string;
    supabaseUrl: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  envContent?: string;
  setupActions?: string[];
  error?: string;
  stage?: 'validating' | 'fetching-keys' | 'generating-config' | 'complete';
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const {
      token,
      projectId,
      setupOptions = {
        generateEnvFile: true,
        enableRLS: true,
        createExampleTable: false,
      },
    } = (await request.json()) as InitializeProjectRequest;

    logger.debug('Initializing project:', { projectId, setupOptions });

    if (!token || !projectId) {
      return json(
        {
          success: false,
          error: 'Missing required fields: token and projectId are required',
        },
        { status: 400 },
      );
    }

    // First, verify project is ready
    const projectResponse = await fetch(`https://api.supabase.com/v1/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!projectResponse.ok) {
      return json(
        {
          success: false,
          error: 'Project not found or not accessible',
          stage: 'validating',
        },
        { status: 404 },
      );
    }

    const project = (await projectResponse.json()) as {
      status?: string;
      name?: string;
    };

    if (project.status !== 'ACTIVE_HEALTHY') {
      return json(
        {
          success: false,
          error: `Project is not ready yet. Current status: ${project.status}. Please wait for the project to become active.`,
          stage: 'validating',
        },
        { status: 425 },
      ); // Too Early
    }

    // Fetch API keys
    const apiKeysResponse = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!apiKeysResponse.ok) {
      return json(
        {
          success: false,
          error: 'Failed to fetch API keys',
          stage: 'fetching-keys',
        },
        { status: 500 },
      );
    }

    const apiKeys = (await apiKeysResponse.json()) as Array<{ name: string; api_key: string }>;
    logger.debug('API keys retrieved');

    // Find the required keys
    const anonKey = apiKeys.find((key) => key.name === 'anon' || key.name === 'public');
    const serviceRoleKey = apiKeys.find((key) => key.name === 'service_role');

    if (!anonKey) {
      return json(
        {
          success: false,
          error: 'Anonymous API key not found',
          stage: 'fetching-keys',
        },
        { status: 500 },
      );
    }

    const supabaseUrl = `https://${projectId}.supabase.co`;

    // Generate environment configuration
    let envContent = '';
    const setupActions: string[] = [];

    if (setupOptions.generateEnvFile) {
      envContent = generateEnvFileContent(supabaseUrl, anonKey.api_key, serviceRoleKey?.api_key);
      setupActions.push('Generated .env file with Supabase configuration');
    }

    if (setupOptions.enableRLS) {
      setupActions.push('Row Level Security (RLS) will be enabled on new tables');
    }

    if (setupOptions.createExampleTable) {
      setupActions.push('Example table structure will be created');
    }

    logger.debug('Project initialization completed:', { projectId, setupActions });

    return json({
      success: true,
      project: {
        id: projectId,
        name: project.name ?? 'Supabase Project',
        supabaseUrl,
        anonKey: anonKey.api_key,
        serviceRoleKey: serviceRoleKey?.api_key,
      },
      envContent,
      setupActions,
      stage: 'complete',
    });
  } catch (error) {
    logger.error('Project initialization error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize project',
        stage: 'validating',
      },
      { status: 500 },
    );
  }
};

function generateEnvFileContent(supabaseUrl: string, anonKey: string, serviceRoleKey?: string): string {
  return `# Supabase Configuration
# Copy these to your .env file

VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${anonKey}

# Optional: Service Role Key (keep this secret!)
# Only use this for server-side operations
${serviceRoleKey ? `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}` : '# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here'}

# Database URL (for direct database access if needed)
# DATABASE_URL=postgresql://postgres:[password]@db.${supabaseUrl.split('//')[1]}.co:5432/postgres
`;
}
