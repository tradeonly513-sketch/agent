import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { MobileNavigation } from '~/components/ui/MobileNavigation';
import BackgroundRays from '~/components/ui/BackgroundRays';

export const meta: MetaFunction = () => {
  return [
    { title: 'CodeCraft Studio - AI-Powered Development Companion' }, 
    { name: 'description', content: 'Build, code, and deploy applications with CodeCraft Studio - your intelligent AI development assistant. Create full-stack applications effortlessly.' }
  ];
};

export const loader = () => json({});

/**
 * Landing page component for CodeCraft Studio
 * Enhanced with mobile-first responsive design and modern UX
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 relative overflow-hidden">
      <BackgroundRays />
      <Header />
      <div className="flex-1 overflow-hidden">
        <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      </div>
      <ClientOnly>{() => <MobileNavigation />}</ClientOnly>
    </div>
  );
}
