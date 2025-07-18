import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays/index';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt Chat Test' }, { name: 'description', content: 'Test chat page layout' }];
};

export const loader = () => json({ id: 'test-chat-123' });

/**
 * Test chat page to verify layout fixes
 */
export default function TestChatPage() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">Chat Page Layout Test</h2>
          <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg text-left">
            <h3 className="font-medium text-bolt-elements-textPrimary mb-2">验证项目:</h3>
            <ul className="text-sm text-bolt-elements-textSecondary space-y-1">
              <li>✅ 没有 "Welcome to Bolt.DIY" 文字</li>
              <li>✅ Header 正常显示</li>
              <li>✅ 背景动画正常</li>
              <li>✅ 聊天界面布局正确</li>
              <li>✅ 左侧对话框顶部对齐</li>
            </ul>
          </div>
          <p className="text-xs text-bolt-elements-textTertiary mt-4">访问 /chat/test 查看实际聊天页面效果</p>
        </div>
      </div>
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
