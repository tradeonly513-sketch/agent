// Store the original fetch function
const originalFetch = typeof window !== 'undefined' ? window.fetch : fetch;

function getTokenFromUrl(): string | null {
  const url = new URL(window.location.href);
  const localToken = localStorage.getItem('token');
  const urlToken = url.searchParams.get('token');

  if (!localToken && urlToken) {
    localStorage.setItem('token', urlToken);
  }

  return url.searchParams.get('token') || localToken;
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
