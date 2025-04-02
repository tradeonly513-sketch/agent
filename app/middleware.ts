const BASE_URL = 'https://test.dev.rapidcanvas.net/';

export async function authenticate(request: Request) {
  const url = new URL(request.url);
  const token = request.headers.get('token');
  const path = url.pathname;

  // Skip authentication for non-API routes
  if (!path.startsWith('/code-editor/api/')) {
    return true;
  }

  if (!token) {
    return new Response('No token provided', { status: 401 });
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
      return new Response('User authentication failed', { status: 401 });
    }

    return true;
  } catch (error) {
    console.error('Authentication error:', error);
    return new Response('Authentication failed', { status: 401 });
  }
}
