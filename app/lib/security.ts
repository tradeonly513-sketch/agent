// Simple security helpers for API endpoints

export function validateToken(token: string): boolean {
  return typeof token === 'string' && token.length > 0;
}

export function sanitizeInput(input: string): string {
  return input.trim();
}