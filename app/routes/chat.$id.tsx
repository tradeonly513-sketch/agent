import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays/index';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt Chat' }, { name: 'description', content: 'Chat with Bolt AI Assistant' }];
};

export async function loader(args: LoaderFunctionArgs) {
  return json({ id: args.params.id });
}

/**
 * Chat page component for /chat/:id routes
 * This is a clean chat interface without the landing page welcome message
 */
export default function ChatPage() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
