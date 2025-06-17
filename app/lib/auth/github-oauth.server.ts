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

// Global environment variable cache to ensure consistency across context availability
let globalEnvCache: { [key: string]: string } = {};

// Helper function to get environment variables from context or process.env
function getEnvVar(context: any, key: string, defaultValue: string = ''): string {
  // Use cached global value if available
  if (globalEnvCache[key]) {
    return globalEnvCache[key];
  }
  
  let value = '';
  
  // Try context.cloudflare.env first (Cloudflare Workers with wrangler bindings)
  if (context?.cloudflare?.env?.[key]) {
    value = context.cloudflare.env[key];
  }
  // Try context.env (other Cloudflare Workers setups)
  else if (context?.env?.[key]) {
    value = context.env[key];
  }
  // Fallback to process.env (Node.js)
  else {
    value = process.env[key] || defaultValue;
  }
  
  // Cache environment variables globally for consistency
  if (value && !globalEnvCache[key]) {
    globalEnvCache[key] = value;
  }
  
  return value;
}

// Create OAuth app instance with environment variables
function createOAuthApp(context?: any) {
  const clientId = getEnvVar(context, 'GITHUB_CLIENT_ID');
  const clientSecret = getEnvVar(context, 'GITHUB_CLIENT_SECRET');
  
  
  if (!clientId || !clientSecret) {
    console.warn(
      'GitHub OAuth is not configured properly. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.'
    );
  }

  return new OAuthApp({
    clientId: clientId || '',
    clientSecret: clientSecret || '',
    defaultScopes: ['read:user', 'user:email'],
  });
}

// Create session storage with context-aware secrets
function createSessionStorage(context?: any, request?: Request) {
  const sessionSecret = getEnvVar(context, 'SESSION_SECRET', 'buildify-session-secret');
  
  // Determine if we should use secure cookies based on environment and protocol
  let secure = false;
  
  // Check if we're in production environment
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // In production, check for HTTPS indicators
    if (request) {
      const proto = request.headers.get('x-forwarded-proto');
      const host = request.headers.get('host');
      // Use secure cookies if we have HTTPS indicators or production domain
      secure = proto === 'https' || host?.includes('phexhub-np.int.bayer.com') || false;
    } else {
      // Default to secure in production if no request context
      secure = true;
    }
  }
  
  
  return createCookieSessionStorage({
    cookie: {
      name: 'buildify_auth_session',
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secrets: [sessionSecret],
      secure,
    },
  });
}

// Get session from request
export async function getSession(request: Request, context?: any) {
  const cookie = request.headers.get('Cookie');
  const storage = createSessionStorage(context, request);
  return storage.getSession(cookie);
}

// Generate state parameter for OAuth flow to prevent CSRF attacks
export function generateState() {
  return uuidv4();
}

// Store state in session
export async function storeState(request: Request, state: string, context?: any) {
  const session = await getSession(request, context);
  session.set('oauth:state', state);
  
  
  const storage = createSessionStorage(context, request);
  return storage.commitSession(session);
}

// Verify state from session
export async function verifyState(request: Request, state: string, context?: any) {
  const session = await getSession(request, context);
  const storedState = session.get('oauth:state');
  
  
  if (!storedState || storedState !== state) {
    throw new AuthError(`Invalid state parameter. Expected: ${storedState}, Got: ${state}`);
  }
  
  // Clear the state after verification
  session.unset('oauth:state');
  const storage = createSessionStorage(context, request);
  return storage.commitSession(session);
}

// Generate authorization URL
export function getAuthorizationUrl(state: string, redirectUri?: string, context?: any) {
  const oauthApp = createOAuthApp(context);
  return oauthApp.getWebFlowAuthorizationUrl({
    state,
    redirectUrl: redirectUri,
  });
}

// Exchange code for token
export async function exchangeCodeForToken(code: string, state: string, context?: any) {
  try {
    console.log('🔑 Token exchange: Starting with code length:', code?.length);
    const oauthApp = createOAuthApp(context);
    console.log('🔑 Token exchange: OAuth app created');
    
    const { authentication } = await oauthApp.createToken({
      code,
      state,
    });
    console.log('🔑 Token exchange: GitHub responded successfully');
    
    return {
      accessToken: authentication.token,
    };
  } catch (error) {
    console.error('🔑 Token exchange: Failed -', error);
    throw new AuthError('Failed to exchange code for token');
  }
}

// Fetch user data from GitHub API
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  try {
    console.log('👤 User fetch: Starting with token length:', accessToken?.length);
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Buildify-App/1.0',
      },
    });
    console.log('👤 User fetch: GitHub API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('👤 User fetch: GitHub API error response:', errorText);
      throw new Error(`GitHub API responded with ${response.status}: ${errorText}`);
    }

    const userData = await response.json() as GitHubUserResponse;
    console.log('👤 User fetch: User data received for:', userData.login);
    
    // If email is not public, try to get primary email
    let email = userData.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Buildify-App/1.0',
        },
      });
      
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json() as GitHubEmailResponse[];
        const primaryEmail = emails.find((e) => e.primary);
        email = primaryEmail?.email || null;
      }
    }

    const user = {
      id: userData.id,
      login: userData.login,
      name: userData.name,
      email: email,
      avatar_url: userData.avatar_url,
      html_url: userData.html_url,
    };
    console.log('👤 User fetch: Successfully processed user data');
    return user;
  } catch (error) {
    console.error('👤 User fetch: Failed -', error);
    throw new AuthError('Failed to fetch user data from GitHub');
  }
}

// Create user session
export async function createUserSession(request: Request, authSession: AuthSession, redirectTo: string, context?: any) {
  try {
    console.log('💾 Session create: Starting for user:', authSession.user.login);
    const session = await getSession(request, context);
    console.log('💾 Session create: Session retrieved');
    
    // Store user data in session
    session.set('auth:user', authSession.user);
    session.set('auth:accessToken', authSession.accessToken);
    console.log('💾 Session create: User data stored in session');
    
    // Commit session and redirect
    const storage = createSessionStorage(context, request);
    console.log('💾 Session create: Session storage created');
    
    const result = redirect(redirectTo, {
      headers: {
        'Set-Cookie': await storage.commitSession(session, {
          maxAge: 60 * 60 * 24 * 7, // 1 week
        }),
      },
    });
    console.log('💾 Session create: Redirect prepared to:', redirectTo);
    return result;
  } catch (error) {
    console.error('💾 Session create: Failed -', error);
    throw new AuthError('Failed to create user session');
  }
}

// Get user from session
export async function getUserFromSession(request: Request, context?: any): Promise<GitHubUser | null> {
  const session = await getSession(request, context);
  const user = session.get('auth:user');
  return user || null;
}

// Get access token from session
export async function getAccessToken(request: Request, context?: any): Promise<string | null> {
  const session = await getSession(request, context);
  const accessToken = session.get('auth:accessToken');
  return accessToken || null;
}

// Check if user is authenticated
export async function isAuthenticated(request: Request, context?: any): Promise<boolean> {
  const user = await getUserFromSession(request, context);
  const result = user !== null;
  
  
  return result;
}

// Require authentication
export async function requireAuthentication(request: Request, redirectTo: string = '/login', context?: any) {
  const authenticated = await isAuthenticated(request, context);
  
  if (!authenticated) {
    const searchParams = new URLSearchParams([['redirectTo', request.url]]);
    throw redirect(`${redirectTo}?${searchParams}`);
  }
  
  return await getUserFromSession(request, context);
}

// Logout - destroy session
export async function logout(request: Request, redirectTo: string = '/', context?: any) {
  const session = await getSession(request, context);
  
  const storage = createSessionStorage(context, request);
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await storage.destroySession(session),
    },
  });
}
