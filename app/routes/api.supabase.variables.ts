import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    // Add proper type assertion for the request body
    const body = (await request.json()) as { projectId?: string; token?: string };
    const { projectId, token } = body;

    if (!projectId || !token) {
      return json({ error: 'Project ID and token are required' }, { status: 400 });
    }

    // Handle server-side token (from environment variables)
    let actualToken: string | undefined = token;

    if (token === 'SERVER_SIDE_TOKEN') {
      // Try to get token from environment variables
      actualToken = context?.cloudflare?.env?.VITE_SUPABASE_ACCESS_TOKEN || process.env.VITE_SUPABASE_ACCESS_TOKEN;

      if (!actualToken) {
        return json({ error: 'Supabase access token not configured in environment variables' }, { status: 401 });
      }
    }

    if (!actualToken) {
      return json({ error: 'Valid token is required' }, { status: 400 });
    }

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${actualToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return json({ error: `Failed to fetch API keys: ${response.statusText}` }, { status: response.status });
    }

    const apiKeys = await response.json();

    return json({ apiKeys });
  } catch (error) {
    console.error('Error fetching project API keys:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 });
  }
}
