import { redirect } from '@remix-run/cloudflare';
import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare';

const BASE_URL = 'https://test.dev.rapidcanvas.net/';
const AUTH_PATH = 'auth/sign-in';

function createAuthRedirectUrl(currentUrl: string): string {
  return `${BASE_URL}${AUTH_PATH}?redirectUrl=${encodeURIComponent(currentUrl)}`;
}

export async function authenticate(request: Request) {
  const token = request.headers.get('token');
  const currentUrl = request.url;
  const redirectUrl = createAuthRedirectUrl(currentUrl);

  if (!token) {
    return {
      authenticated: false,
      response: redirect(redirectUrl),
    };
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
      return {
        authenticated: false,
        response: redirect(redirectUrl),
      };
    }

    return { authenticated: true };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      authenticated: false,
      response: redirect(redirectUrl),
    };
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
      return authResult.response;
    }

    return handler(args);
  };
}
