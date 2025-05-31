import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/cloudflare';
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { getUserFromSession, isAuthenticated, requireAuthentication } from '~/lib/auth/github-oauth.server';
import { useAuth } from '~/lib/hooks/useAuth';
import { updateProfile } from '~/lib/stores/profile';
import BackgroundRays from '~/components/ui/BackgroundRays';

export const meta: MetaFunction = () => {
  return [
    { title: 'Your Profile - Buildify' },
    { name: 'description', content: 'Manage your Buildify profile and preferences' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if user is authenticated on the server side
  const authenticated = await isAuthenticated(request);
  
  if (!authenticated) {
    // Redirect to login if not authenticated
    return redirect('/auth/login?redirectTo=/profile');
  }
  
  // Get user data from session
  const user = await getUserFromSession(request);
  
  return json({ user });
}

export async function action({ request }: ActionFunctionArgs) {
  // Require authentication for this action
  const user = await requireAuthentication(request, '/auth/login?redirectTo=/profile');
  
  // Get form data
  const formData = await request.formData();
  const bio = formData.get('bio')?.toString() || '';
  // Fix TypeScript error by adding null check for user
  const displayName = formData.get('displayName')?.toString() || (user ? user.login : '');
  const theme = formData.get('theme')?.toString() || 'system';
  
  // Here you would typically update the user data in your database
  // Since we're using client-side storage, we'll just return the updated values
  // and let the client update the profile store
  
  return json({
    success: true,
    message: 'Profile updated successfully',
    updates: {
      bio,
      displayName,
      theme,
    },
  });
}

export default function Profile() {
  const { user: serverUser } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { isAuthenticated, user, githubUser } = useAuth();
  
  const [bio, setBio] = useState(user?.bio || '');
  const [displayName, setDisplayName] = useState(user?.username || serverUser?.login || '');
  
  const isSubmitting = navigation.state === 'submitting';
  const lastLogin = user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Unknown';
  
  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setDisplayName(user.username || '');
    }
  }, [user]);
  
  // Apply updates from action data
  useEffect(() => {
    if (actionData?.success && actionData.updates) {
      updateProfile({
        bio: actionData.updates.bio,
        username: actionData.updates.displayName,
      });
      
      // Show success notification
      // This could be replaced with a toast notification
      const timer = setTimeout(() => {
        const notification = document.getElementById('notification');
        if (notification) {
          notification.style.opacity = '0';
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [actionData]);
  
  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bolt-elements-background-depth-1">
        <BackgroundRays />
        <div className="w-full max-w-md p-8 bg-bolt-elements-background-depth-2 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="i-svg-spinners:270-ring-with-bg w-12 h-12 mx-auto text-bolt-content-accent" />
            <h1 className="text-2xl font-bold mt-4 text-bolt-content-primary">Loading profile...</h1>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-bolt-content-primary">Your Profile</h1>
          <p className="text-bolt-content-secondary">
            Manage your profile information and preferences
          </p>
        </div>
        
        {actionData?.success && (
          <div 
            id="notification"
            className="mb-6 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-md transition-opacity duration-500"
          >
            {actionData.message}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* GitHub Profile Information */}
          <div className="col-span-1">
            <div className="bg-bolt-elements-background-depth-2 rounded-lg shadow-md p-6 border border-bolt-elements-borderColor">
              <div className="flex flex-col items-center">
                <img 
                  src={user.avatar || githubUser?.avatar_url} 
                  alt={`${displayName}'s avatar`}
                  className="w-24 h-24 rounded-full border-2 border-bolt-elements-borderColor"
                />
                
                <h2 className="mt-4 text-xl font-semibold text-bolt-content-primary">
                  {displayName}
                </h2>
                
                <p className="text-sm text-bolt-content-secondary">
                  @{githubUser?.login || serverUser?.login}
                </p>
                
                {githubUser?.html_url && (
                  <a 
                    href={githubUser.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-sm text-bolt-content-accent hover:underline flex items-center"
                  >
                    <span className="i-ph:github-logo mr-1" />
                    GitHub Profile
                  </a>
                )}
                
                <div className="mt-6 w-full">
                  <div className="py-2 border-t border-bolt-elements-borderColor">
                    <h3 className="text-sm font-medium text-bolt-content-secondary">Email</h3>
                    <p className="text-bolt-content-primary">
                      {githubUser?.email || serverUser?.email || 'Not available'}
                    </p>
                  </div>
                  
                  <div className="py-2 border-t border-bolt-elements-borderColor">
                    <h3 className="text-sm font-medium text-bolt-content-secondary">Authentication Status</h3>
                    <div className="flex items-center mt-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                      <span className="text-bolt-content-primary">Authenticated with GitHub</span>
                    </div>
                  </div>
                  
                  <div className="py-2 border-t border-bolt-elements-borderColor">
                    <h3 className="text-sm font-medium text-bolt-content-secondary">Last Login</h3>
                    <p className="text-bolt-content-primary">{lastLogin}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Profile Edit Form */}
          <div className="col-span-1 md:col-span-2">
            <div className="bg-bolt-elements-background-depth-2 rounded-lg shadow-md p-6 border border-bolt-elements-borderColor">
              <h2 className="text-xl font-semibold text-bolt-content-primary mb-4">
                Edit Profile
              </h2>
              
              <Form method="post" className="space-y-6">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-bolt-content-secondary mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md text-bolt-content-primary focus:outline-none focus:ring-2 focus:ring-bolt-content-accent"
                  />
                </div>
                
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-bolt-content-secondary mb-1">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md text-bolt-content-primary focus:outline-none focus:ring-2 focus:ring-bolt-content-accent"
                    placeholder="Tell us about yourself..."
                  />
                </div>
                
                <div>
                  <label htmlFor="theme" className="block text-sm font-medium text-bolt-content-secondary mb-1">
                    Theme Preference
                  </label>
                  <select
                    id="theme"
                    name="theme"
                    className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md text-bolt-content-primary focus:outline-none focus:ring-2 focus:ring-bolt-content-accent"
                    defaultValue="system"
                  >
                    <option value="system">System Default</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                  <p className="mt-1 text-xs text-bolt-content-tertiary">
                    Theme preferences will be applied across all your sessions
                  </p>
                </div>
                
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`
                      w-full sm:w-auto px-4 py-2 rounded-md font-medium
                      ${isSubmitting 
                        ? 'bg-bolt-elements-background-depth-3 text-bolt-content-tertiary cursor-not-allowed' 
                        : 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundAccentHover'}
                      transition-colors duration-200
                    `}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </Form>
            </div>
            
            {/* Account Management */}
            <div className="mt-6 bg-bolt-elements-background-depth-2 rounded-lg shadow-md p-6 border border-bolt-elements-borderColor">
              <h2 className="text-xl font-semibold text-bolt-content-primary mb-4">
                Account Management
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-bolt-elements-borderColor">
                  <div>
                    <h3 className="font-medium text-bolt-content-primary">Sign Out</h3>
                    <p className="text-sm text-bolt-content-secondary">
                      Sign out from your current session
                    </p>
                  </div>
                  <a
                    href="/auth/logout"
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200 text-sm font-medium"
                  >
                    Sign Out
                  </a>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <div>
                    <h3 className="font-medium text-bolt-content-primary">GitHub Connection</h3>
                    <p className="text-sm text-bolt-content-secondary">
                      Manage your GitHub connection settings
                    </p>
                  </div>
                  <a
                    href="/settings"
                    className="px-4 py-2 bg-transparent border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 text-bolt-content-primary rounded-md transition-colors duration-200 text-sm font-medium"
                  >
                    Manage
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
