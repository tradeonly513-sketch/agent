// Store the original fetch function
const originalFetch = typeof window !== 'undefined' ? window.fetch : fetch;

function getTokenFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);

  return url.searchParams.get('token');
}

const authenticatedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const token = getTokenFromUrl();
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders.token = token;
  }

  if (typeof input === 'string') {
    input = new Request(input);
  }

  const updatedInit = {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init?.headers || {}),
    },
  };

  return originalFetch(input, updatedInit);
};

if (typeof window !== 'undefined') {
  window.fetch = authenticatedFetch;
}
