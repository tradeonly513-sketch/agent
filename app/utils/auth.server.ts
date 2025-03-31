// app/utils/withAuth.server.ts
import type { LoaderFunction, ActionFunction } from '@remix-run/cloudflare';
import { requireUserToken } from './session.server';

const BASE_URL = 'https://test.dev.rapidcanvas.net/';

export function getToken(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get('token');
}

export function withAuth(fn: LoaderFunction | ActionFunction): LoaderFunction | ActionFunction {
  return async (args) => {
    const token = await requireUserToken(args.request);

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const dataAppResponse = await fetch(`${BASE_URL}api/token/validation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token }),
    });

    if (dataAppResponse.status === 401) {
      throw new Response('User authentication failed', { status: 401 });
    }

    if (dataAppResponse.status !== 200) {
      throw new Response('Something went wrong', {
        status: 500,
        statusText: dataAppResponse.statusText,
      });
    }

    return fn(args);
  };
}
