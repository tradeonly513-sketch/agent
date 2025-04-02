import { createCookieSessionStorage } from '@remix-run/cloudflare';

const sessionSecret = process.env.SESSION_SECRET || 'default-secret-key';

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'token_session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 1, // 1 day
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function getSession(request: Request) {
  const cookie = request.headers.get('Cookie');
  return sessionStorage.getSession(cookie);
}

export async function createUserSession(token: string, _redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set('token', token);

  return sessionStorage.commitSession(session);
}

export async function getUserToken(request: Request) {
  const session = await getSession(request);
  return session.get('token');
}

export async function requireUserToken(request: Request, _redirectTo: string = new URL(request.url).pathname) {
  const token = await getUserToken(request);

  if (!token) {
    throw new Response('Unauthorized', { status: 401 });
  }

  return token;
}
