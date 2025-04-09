import { json, redirect } from '@remix-run/cloudflare';
import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare';

const BASE_URL = 'https://test.dev.rapidcanvas.net/';

export async function authenticate(request: Request) {
  const url = new URL(request.url);
  const token = request.headers.get('token');
  const path = url.pathname;

  // Skip authentication for non-API routes
  if (!path.startsWith('/code-editor/api/')) {
    return { authenticated: true };
  }

  if (!token) {
    return { authenticated: false, response: json({ error: 'No token provided', status: 401 }) };
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
    console.log('authResult', authResult);

    if (!authResult.authenticated) {
      const currentUrl = new URL(args.request.url);
      const redirectUrlInPath = currentUrl.pathname + currentUrl.search;
      const redirectUrl = `https://test.dev.rapidcanvas.net/auth/sign-in?redirectUrl=${redirectUrlInPath}`;

      return redirect(redirectUrl);
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
      const redirectUrl = `https://test.dev.rapidcanvas.net/auth/sign-in?redirectUrl=${encodeURIComponent(redirectUrlInPath)}`;

      return redirect(redirectUrl);
    }

    return handler(args);
  };
}
