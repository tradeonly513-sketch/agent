import React from 'react';
import { ChatMode } from '~/lib/replay/ChatManager';
import { type AppSummary } from '~/lib/persistence/messageAppSummary';
import Pages from './components/Pages';
import Features from './components/Features/Features';

interface PlanViewProps {
  appSummary: AppSummary | null;
  handleSendMessage?: (event: React.UIEvent, messageInput: string, startPlanning: boolean, chatMode?: ChatMode) => void;
  setActiveTab?: (tab: 'planning' | 'preview') => void;
}

const PlanView = ({ appSummary, handleSendMessage, setActiveTab }: PlanViewProps) => {
  return (
    <div className="relative h-full w-full">
      <div className="h-full overflow-auto bg-transparent p-6">
        <div className="max-w-4xl mx-auto min-h-full flex flex-col">
          <div className="flex-1">
            <div className="text-2xl font-bold mb-6 text-bolt-elements-textPrimary">App Build Plan</div>

            <div className="mb-8">
              <div className="text-lg font-semibold mb-3 text-bolt-elements-textPrimary">Project Description</div>
              <div className="text-bolt-elements-textSecondary leading-relaxed">{appSummary?.description}</div>
            </div>
            {appSummary?.pages && (
              <Pages appSummary={appSummary} />
            )}
          </div>
          {appSummary?.features && (
            <div className="mt-auto">
              <Features appSummary={appSummary} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanView;
