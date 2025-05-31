import { OAuthApp } from '@octokit/oauth-app';
import { createCookieSessionStorage, redirect } from '@remix-run/cloudflare';
import { v4 as uuidv4 } from 'uuid';

// Define types for GitHub user data
export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}

// GitHub API response types
interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  [key: string]: any; // For other properties we don't explicitly use
}

interface GitHubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

// Define types for session data
export interface AuthSession {
  accessToken: string;
  user: GitHubUser;
}

// Error class for authentication errors
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Get environment variables
const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;
const sessionSecret = process.env.SESSION_SECRET || 'buildify-session-secret';

// Validate required environment variables
if (!clientId || !clientSecret) {
  console.warn(
    'GitHub OAuth is not configured properly. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.'
  );
}

// Create OAuth app instance
export const oauthApp = new OAuthApp({
  clientId: clientId || '',
  clientSecret: clientSecret || '',
  defaultScopes: ['read:user', 'user:email'],
});

// Create session storage
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'buildify_auth_session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === 'production',
  },
});

// Get session from request
export async function getSession(request: Request) {
  const cookie = request.headers.get('Cookie');
  return sessionStorage.getSession(cookie);
}

// Generate state parameter for OAuth flow to prevent CSRF attacks
export function generateState() {
  return uuidv4();
}

// Store state in session
export async function storeState(request: Request, state: string) {
  const session = await getSession(request);
  session.set('oauth:state', state);
  return sessionStorage.commitSession(session);
}

// Verify state from session
export async function verifyState(request: Request, state: string) {
  const session = await getSession(request);
  const storedState = session.get('oauth:state');
  
  if (!storedState || storedState !== state) {
    throw new AuthError('Invalid state parameter. Possible CSRF attack.');
  }
  
  // Clear the state after verification
  session.unset('oauth:state');
  return sessionStorage.commitSession(session);
}

// Generate authorization URL
export function getAuthorizationUrl(state: string, redirectUri?: string) {
  return oauthApp.getWebFlowAuthorizationUrl({
    state,
    redirectUrl: redirectUri,
  });
}

// Exchange code for token
export async function exchangeCodeForToken(code: string, state: string) {
  try {
    const { authentication } = await oauthApp.createToken({
      code,
      state,
    });
    
    return {
      accessToken: authentication.token,
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw new AuthError('Failed to exchange code for token');
  }
}

// Fetch user data from GitHub API
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const userData = await response.json() as GitHubUserResponse;
    
    // If email is not public, try to get primary email
    let email = userData.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${accessToken}`,
        },
      });
      
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json() as GitHubEmailResponse[];
        const primaryEmail = emails.find((e) => e.primary);
        email = primaryEmail?.email || null;
      }
    }

    return {
      id: userData.id,
      login: userData.login,
      name: userData.name,
      email: email,
      avatar_url: userData.avatar_url,
      html_url: userData.html_url,
    };
  } catch (error) {
    console.error('Error fetching GitHub user:', error);
    throw new AuthError('Failed to fetch user data from GitHub');
  }
}

// Create user session
export async function createUserSession(request: Request, authSession: AuthSession, redirectTo: string) {
  const session = await getSession(request);
  
  // Store user data in session
  session.set('auth:user', authSession.user);
  session.set('auth:accessToken', authSession.accessToken);
  
  // Commit session and redirect
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session, {
        maxAge: 60 * 60 * 24 * 7, // 1 week
      }),
    },
  });
}

// Get user from session
export async function getUserFromSession(request: Request): Promise<GitHubUser | null> {
  const session = await getSession(request);
  const user = session.get('auth:user');
  return user || null;
}

// Get access token from session
export async function getAccessToken(request: Request): Promise<string | null> {
  const session = await getSession(request);
  const accessToken = session.get('auth:accessToken');
  return accessToken || null;
}

// Check if user is authenticated
export async function isAuthenticated(request: Request): Promise<boolean> {
  const user = await getUserFromSession(request);
  return user !== null;
}

// Require authentication
export async function requireAuthentication(request: Request, redirectTo: string = '/login') {
  const authenticated = await isAuthenticated(request);
  
  if (!authenticated) {
    const searchParams = new URLSearchParams([['redirectTo', request.url]]);
    throw redirect(`${redirectTo}?${searchParams}`);
  }
  
  return await getUserFromSession(request);
}

// Logout - destroy session
export async function logout(request: Request, redirectTo: string = '/') {
  const session = await getSession(request);
  
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session),
    },
  });
}
