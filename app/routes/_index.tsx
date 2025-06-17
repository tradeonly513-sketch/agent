import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { isAuthenticated } from '~/lib/auth/github-oauth.server';

export const meta: MetaFunction = () => {
  return [{ title: 'Buildify' }, { name: 'description', content: 'AI-assisted development environment powered by Buildify' }];
};

/**
 * Root loader that checks authentication status
 * If user is not authenticated, redirect to the login page
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  // Check if user is authenticated
  const authenticated = await isAuthenticated(request, context);
  
  // If not authenticated, redirect to login page
  if (!authenticated) {
    // Redirect to the auth login page which serves as our landing page
    return redirect('/auth/login');
  }
  
  // User is authenticated, continue to the app
  return json({});
}

/**
 * Main app page component
 * This is protected and only accessible for authenticated users
 * Unauthenticated users will be redirected to the login page
 */
export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
