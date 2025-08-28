import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { AuthenticatedChat } from '~/components/chat/AuthenticatedChat';

export const meta: MetaFunction = () => {
  return [
    { title: 'bolt.diy - Multi-User Edition' },
    { name: 'description', content: 'Build web applications with AI assistance - Multi-User Edition by Keoma Wright' },
  ];
};

export const loader = () => json({});

/**
 * Landing page component for Bolt Multi-User Edition
 * This page now requires authentication before accessing the chat interface
 * Developed by Keoma Wright
 */
export default function Index() {
  return (
    <ClientOnly
      fallback={
        <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 items-center justify-center">
          <div className="text-center">
            <div className="i-svg-spinners:3-dots-scale text-4xl text-bolt-elements-textPrimary mb-4" />
            <p className="text-bolt-elements-textSecondary">Loading bolt.diy...</p>
          </div>
        </div>
      }
    >
      {() => <AuthenticatedChat />}
    </ClientOnly>
  );
}
