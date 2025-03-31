import { useSearchParams } from '@remix-run/react';

export function getTokenFromParams(searchParams: URLSearchParams): string | null {
  return searchParams.get('token');
}

export function useToken(): string | null {
  const [searchParams] = useSearchParams();
  return getTokenFromParams(searchParams);
}

export function getAuthHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
