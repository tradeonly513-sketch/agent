import { json } from '@remix-run/cloudflare';
import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare';

const BASE_URL = 'https://test.dev.rapidcanvas.net/';

export async function authenticate(request: Request) {
  const token = request.headers.get('token');

  if (!token) {
    return { authenticated: false, response: json({ error: 'No token provided', status: 401 }) };
  }

  if (!request.url.includes('code-editor/api/')) {
    return { authenticated: true };
  }

  try {
    const dataAppResponse = await fetch(`${BASE_URL}api/token/validation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-TOKEN': token,
      },
      body: JSON.stringify({ token }),
    });

    if (dataAppResponse.status !== 200) {
      return { authenticated: false, response: json({ error: 'User authentication failed', status: 401 }) };
    }

    return { authenticated: true };
  } catch (error) {
    console.error('Authentication error:', error);
    return { authenticated: false, response: json({ error: 'Authentication failed', status: 401 }) };
  }
}

/**
 * Higher-order function to wrap API routes with authentication
 *
 * @param handler The original API route handler
 * @returns A new handler that first authenticates the request
 */
export function withAuth(handler: ActionFunction): ActionFunction {
  return async (args) => {
    const authResult = await authenticate(args.request);

    if (!authResult.authenticated) {
      return authResult.response;
    }

    return handler(args);
  };
}

/**
 * Higher-order function to wrap API loader routes with authentication
 *
 * @param handler The original API loader route handler
 * @returns A new handler that first authenticates the request
 */
export function withAuthLoader(handler: LoaderFunction): LoaderFunction {
  return async (args) => {
    const authResult = await authenticate(args.request);

    if (!authResult.authenticated) {
      const currentUrl = new URL(args.request.url);
      const redirectUrlInPath = currentUrl.pathname + currentUrl.search;
      const redirectUrl = `https://test.dev.rapidcanvas.net/auth/sign-in?redirectUrl=${redirectUrlInPath}`;

      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      });
    }

    return handler(args);
  };
}
