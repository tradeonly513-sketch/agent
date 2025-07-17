// Route to handle .well-known requests (like Chrome DevTools)
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle Chrome DevTools requests
  if (path.includes('com.chrome.devtools.json')) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Default 404 for other .well-known requests
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
