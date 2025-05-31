import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Form, useLoaderData, useNavigation } from '@remix-run/react';
import { useEffect } from 'react';
import { logout, getUserFromSession } from '~/lib/auth/github-oauth.server';
import { updateProfile } from '~/lib/stores/profile';
import BackgroundRays from '~/components/ui/BackgroundRays';

export const meta: MetaFunction = () => {
  return [
    { title: 'Logout from Buildify' },
    { name: 'description', content: 'Logout from your Buildify account' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Get URL parameters
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo') || '/';
  
  // Get user data to display in the confirmation page
  const user = await getUserFromSession(request);
  
  return json({
    redirectTo,
    user,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  // Get form data
  const formData = await request.formData();
  const redirectTo = formData.get('redirectTo')?.toString() || '/';
  
  // Perform logout and redirect
  return logout(request, redirectTo);
}

export default function Logout() {
  const { redirectTo, user } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  // Reset profile store on client side when logging out via form submission
  useEffect(() => {
    if (isSubmitting) {
      // Reset profile to empty values
      updateProfile({
        username: '',
        bio: '',
        avatar: '',
      });
    }
  }, [isSubmitting]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      
      <div className="w-full max-w-md p-8 space-y-8 bg-bolt-elements-background-depth-2 rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-bolt-content-primary">Logout</h1>
          {user ? (
            <div className="mt-4 flex flex-col items-center">
              <img 
                src={user.avatar_url} 
                alt={`${user.login}'s avatar`} 
                className="w-16 h-16 rounded-full border-2 border-bolt-elements-border-primary"
              />
              <p className="mt-2 text-bolt-content-primary font-medium">
                {user.name || user.login}
              </p>
              <p className="text-sm text-bolt-content-secondary">
                {user.login}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-bolt-content-secondary">
              You are not currently logged in.
            </p>
          )}
        </div>

        {user ? (
          <Form method="post" className="space-y-6">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            
            <p className="text-center text-bolt-content-secondary">
              Are you sure you want to log out?
            </p>
            
            <div className="flex flex-col space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200 font-medium"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Logging out...
                  </span>
                ) : (
                  "Yes, log me out"
                )}
              </button>
              
              <a
                href={redirectTo}
                className="w-full py-3 px-4 bg-transparent border border-bolt-elements-border-primary text-bolt-content-primary rounded-md transition-colors duration-200 font-medium text-center"
              >
                Cancel
              </a>
            </div>
          </Form>
        ) : (
          <div className="space-y-6">
            <a
              href="/login"
              className="block w-full py-3 px-4 bg-[#2da44e] hover:bg-[#2c974b] text-white rounded-md transition-colors duration-200 font-medium text-center"
            >
              Log in
            </a>
            
            <a
              href={redirectTo}
              className="block w-full py-3 px-4 bg-transparent border border-bolt-elements-border-primary text-bolt-content-primary rounded-md transition-colors duration-200 font-medium text-center"
            >
              Return to home
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
