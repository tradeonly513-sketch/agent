import { useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';
import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getTokenFromParams } from '~/utils/auth.client';

// Server-side loader to handle initial request
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const token = getTokenFromParams(searchParams);

  if (!token) {
    return json({ error: 'No token provided' }, { status: 401 });
  }

  // Add token to headers for subsequent requests
  const headers = new Headers(request.headers);
  headers.set('X-AUTH-TOKEN', token);

  return json(
    { success: true },
    {
      headers: {
        'X-AUTH-TOKEN': token,
      },
    },
  );
}

function getUrlFromInput(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof Request) {
      return new URL(input.url);
    } else if (input instanceof URL) {
      return input;
    } else if (typeof input === 'string') {
      const baseUrl = window.location.origin;
      return new URL(input, baseUrl);
    }

    return null;
  } catch (error) {
    console.error('Error constructing URL:', error);
    return null;
  }
}

function setupAuthenticatedFetch() {
  if (typeof window === 'undefined') {
    return;
  }

  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = getUrlFromInput(input);

      if (!url) {
        return originalFetch(input, init);
      }

      const searchParams = url.searchParams;
      const token = getTokenFromParams(searchParams);

      if (token) {
        init = init || {};
        init.headers = new Headers(init.headers);
        init.headers.set('X-AUTH-TOKEN', token);
      }

      return originalFetch(input, init);
    } catch (error) {
      console.error('Error in authenticated fetch:', error);
      return originalFetch(input, init);
    }
  };
}

function handleClientNavigation() {
  const [searchParams] = useSearchParams();
  const token = getTokenFromParams(searchParams);

  if (token) {
    const originalPushState = window.history.pushState;

    window.history.pushState = function (state, title, url) {
      if (url) {
        try {
          const headers = new Headers();
          headers.set('X-AUTH-TOKEN', token);

          const urlString = url.toString();
          const absoluteUrl = urlString.startsWith('http') ? urlString : `${window.location.origin}${urlString}`;

          fetch(absoluteUrl, {
            headers,
            method: 'HEAD',
          }).catch(console.error);
        } catch (error) {
          console.error('Error in navigation:', error);
        }
      }

      return originalPushState.call(this, state, title, url);
    };
  }
}

useEffect(() => {
  setupAuthenticatedFetch();
  handleClientNavigation();
}, []);
