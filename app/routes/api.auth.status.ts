import { json, type LoaderFunctionArgs } from '@remix-run/node';
import {
  getUserFromSession,
  isAuthenticated,
  getAccessToken,
} from '~/lib/auth/github-oauth.server';

/**
 * API route to check authentication status
 * Used by the client to sync authentication state between server and client
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return json(
      { error: 'Method not allowed' },
      { status: 405, headers: { 'Allow': 'GET' } }
    );
  }

  try {
    // Check if user is authenticated
    const authenticated = await isAuthenticated(request);
    
    if (!authenticated) {
      // Return unauthenticated status
      return json({ isAuthenticated: false });
    }
    
    // Get user data from session
    const user = await getUserFromSession(request);
    
    // Get current access token
    const accessToken = await getAccessToken(request);
    
    // Build response
    return json({
      isAuthenticated: true,
      user,
      // Don't expose the actual token to the client
      tokenStatus: {
        hasToken: Boolean(accessToken),
      },
    });
  } catch (error) {
    console.error('Error checking authentication status:', error);
    
    // Return error response
    return json(
      { 
        isAuthenticated: false, 
        error: 'Failed to check authentication status' 
      },
      { status: 500 }
    );
  }
}
