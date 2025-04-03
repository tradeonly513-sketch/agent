/* eslint-disable multiline-comment-style */
import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays/BackgroundRaysV2';
import { ErrorBoundary } from '~/components/ui/ErrorBoundary/ErrorBoundary';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = async () => {
  /* const hideBaseChat = process.env.HIDE_BASE_CHAT?.toLowerCase() === 'true';
  const canImportChat = process.env.CAN_IMPORT_CHAT?.toLowerCase() === 'true'; */
  return json({ hideBaseChat: true, canImportChat: false });
};

/**
 * Landing page component for Bolt
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  const { shouldHideHeader } = useLoaderData<{ shouldHideHeader: boolean }>();

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      {!shouldHideHeader && <Header />}
      <ClientOnly>{() => <Chat />}</ClientOnly>
    </div>
  );
}

export { ErrorBoundary };
