import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@remix-run/cloudflare';
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { generateState, getAuthorizationUrl, isAuthenticated, storeState } from '~/lib/auth/github-oauth.server';
import BackgroundRays from '~/components/ui/BackgroundRays';

export const meta: MetaFunction = () => {
  return [
    { title: 'Welcome to Buildify' },
    { name: 'description', content: 'AI-assisted development environment powered by Buildify' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if user is already authenticated
  const authenticated = await isAuthenticated(request);
  if (authenticated) {
    // Redirect to home page if already logged in
    return redirect('/');
  }

  // Get redirect URL from query params (if any)
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo') || '/';

  // Check if GitHub OAuth is configured
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const isConfigured = Boolean(clientId && clientSecret);

  return json({
    redirectTo,
    isConfigured,
    error: isConfigured
      ? null
      : 'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.',
  });
}

export async function action({ request }: ActionFunctionArgs) {
  // Check if GitHub OAuth is configured
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return json(
      {
        error:
          'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.',
      },
      { status: 400 },
    );
  }

  // Get form data
  const formData = await request.formData();
  const redirectTo = formData.get('redirectTo')?.toString() || '/';

  try {
    // Generate state for CSRF protection
    const state = generateState();

    // Get the callback URL
    const url = new URL(request.url);
    const callbackUrl = `${url.origin}/auth/callback`;

    // Generate authorization URL
    const { url: authorizationUrl } = getAuthorizationUrl(state, callbackUrl);

    // Store state in session
    const cookie = await storeState(request, state);

    // Redirect to GitHub authorization URL
    return redirect(authorizationUrl, {
      headers: {
        'Set-Cookie': cookie,
      },
    });
  } catch (error) {
    console.error('Error initiating GitHub OAuth flow:', error);
    return json({ error: 'Failed to initiate login. Please try again later.' }, { status: 500 });
  }
}

export default function Login() {
  const { redirectTo, isConfigured, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set error message from loader or action data
  useEffect(() => {
    setErrorMessage(error || actionData?.error || null);
  }, [error, actionData]);

  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bolt-elements-background-depth-1">
      <BackgroundRays />

      <div className="w-full max-w-4xl p-8 space-y-12">
        <div className="flex flex-col items-center justify-center text-center">
          {/* Buildify Logo */}
          <div className="w-64 h-auto mb-8">
            <img src="/logo-light-styled.png" alt="Buildify Logo" className="w-full h-auto dark:hidden" />
            <img src="/logo-dark-styled.png" alt="Buildify Logo" className="w-full h-auto hidden dark:block" />
          </div>

          <h1 className="text-4xl font-bold text-bolt-content-primary mb-4">Welcome to Buildify</h1>

          <p className="text-xl text-bolt-content-secondary max-w-2xl">
            Your AI-assisted development environment for building, modifying, and deploying web applications
          </p>
        </div>

        <div className="w-full max-w-md mx-auto p-8 space-y-8 bg-bolt-elements-background-depth-2 rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-bolt-content-primary">Sign In to Get Started</h2>
            <p className="mt-2 text-bolt-content-secondary">Connect with your GitHub account to access Buildify</p>
          </div>

          {errorMessage && <div className="p-4 text-sm text-red-500 bg-red-100 rounded-md">{errorMessage}</div>}

          <Form method="post" className="space-y-6">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <button
              type="submit"
              disabled={!isConfigured || isSubmitting}
              aria-label="Sign in with GitHub"
              className={`
                w-full flex items-center justify-center py-3 px-4 rounded-md
                ${
                  isConfigured
                    ? 'bg-[#2da44e] hover:bg-[#2c974b] text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
                transition-colors duration-200 font-medium shadow-md
              `}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385c.6.105.825-.255.825-.57c0-.285-.015-1.23-.015-2.235c-3.015.555-3.795-.735-4.035-1.41c-.135-.345-.72-1.41-1.23-1.695c-.42-.225-1.02-.78-.015-.795c.945-.015 1.62.87 1.845 1.23c1.08 1.815 2.805 1.305 3.495.99c.105-.78.42-1.305.765-1.605c-2.67-.3-5.46-1.335-5.46-5.925c0-1.305.465-2.385 1.23-3.225c-.12-.3-.54-1.53.12-3.18c0 0 1.005-.315 3.3 1.23c.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23c.66 1.65.24 2.88.12 3.18c.765.84 1.23 1.905 1.23 3.225c0 4.605-2.805 5.625-5.475 5.925c.435.375.81 1.095.81 2.22c0 1.605-.015 2.895-.015 3.3c0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                    />
                  </svg>
                  Continue with GitHub
                </span>
              )}
            </button>
          </Form>

          <div className="text-center text-sm text-bolt-content-tertiary">
            <p>
              By logging in, you agree to the{' '}
              <a href="#" className="text-bolt-content-accent hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-bolt-content-accent hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
