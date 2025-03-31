import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  // Skip auth for public routes
  if (url.pathname.startsWith('/public') || url.pathname.startsWith('/api/public')) {
    return json({});
  }

  return json({ token });
}
