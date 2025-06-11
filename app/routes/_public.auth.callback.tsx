// @ts-nocheck
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createUserSession, exchangeCodeForToken, fetchGitHubUser, verifyState } from '~/lib/auth/github-oauth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Check if code and state are present
  if (!code || !state) {
    return json({ error: 'Missing required OAuth parameters' }, { status: 400 });
  }

  try {
    // Verify state parameter to prevent CSRF attacks
    const cookie = await verifyState(request, state);

    // Exchange code for access token
    const { accessToken } = await exchangeCodeForToken(code, state);

    // Fetch user data from GitHub API
    const user = await fetchGitHubUser(accessToken);

    // Create user session and redirect to home
    return createUserSession(
      request,
      { user, accessToken },
      '/', // Redirect to home page after successful login
    );
  } catch (error) {
    console.error('Authentication error:', error);

    return redirect('/login?error=authentication_failed');
  }
}
