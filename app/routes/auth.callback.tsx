import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  AuthError,
  createUserSession,
  exchangeCodeForToken,
  fetchGitHubUser,
  verifyState,
} from '~/lib/auth/github-oauth.server';
import BackgroundRays from '~/components/ui/BackgroundRays';

export const meta: MetaFunction = () => {
  return [
    { title: 'Authenticating...' },
    { name: 'description', content: 'Completing GitHub authentication' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Get URL parameters
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  
  // Get the redirect URL from state or default to home
  const redirectTo = url.searchParams.get('redirectTo') || '/';

  // Handle GitHub OAuth errors
  if (error) {
    return json({
      success: false,
      error: error,
      errorDescription: errorDescription || 'An error occurred during authentication',
      redirectTo: '/',
    });
  }

  // Validate required parameters
  if (!code || !state) {
    return json({
      success: false,
      error: 'invalid_request',
      errorDescription: 'Missing required parameters',
      redirectTo: '/login',
    });
  }

  try {
    // Verify state parameter to prevent CSRF attacks
    const cookieHeader = await verifyState(request, state);

    // Exchange authorization code for access token
    const { accessToken } = await exchangeCodeForToken(code, state);

    // Fetch user data from GitHub API
    const user = await fetchGitHubUser(accessToken);

    // Create user session and redirect
    return createUserSession(
      request,
      {
        accessToken,
        user,
      },
      redirectTo
    );
  } catch (error) {
    console.error('Authentication error:', error);
    
    let errorMessage = 'An unexpected error occurred during authentication';
    let errorCode = 'server_error';
    
    if (error instanceof AuthError) {
      errorMessage = error.message;
      errorCode = 'auth_error';
    }
    
    return json({
      success: false,
      error: errorCode,
      errorDescription: errorMessage,
      redirectTo: '/login',
    });
  }
}

export default function AuthCallback() {
  const data = useLoaderData<typeof loader>();
  
  // Only render the component if we have error data
  // On successful auth, the server will redirect immediately
  if (data && 'success' in data && !data.success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bolt-elements-background-depth-1">
        <BackgroundRays />
        
        <div className="w-full max-w-md p-8 space-y-8 bg-bolt-elements-background-depth-2 rounded-lg shadow-lg text-center">
          <div className="text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-2xl font-bold mt-4">Authentication Failed</h1>
            <p className="mt-2 text-bolt-content-secondary">{data.errorDescription}</p>
          </div>
          
          <p className="text-sm text-bolt-content-tertiary">
            Redirecting you back in a moment...
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      
      <div className="w-full max-w-md p-8 space-y-8 bg-bolt-elements-background-depth-2 rounded-lg shadow-lg text-center">
        <div className="text-bolt-content-primary">
          <svg className="animate-spin h-16 w-16 mx-auto text-bolt-content-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h1 className="text-2xl font-bold mt-4">Authenticating...</h1>
          <p className="mt-2 text-bolt-content-secondary">
            Completing your sign-in with GitHub
          </p>
        </div>
      </div>
    </div>
  );
}
