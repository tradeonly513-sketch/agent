import React from 'react';
import { classNames } from '~/utils/classNames';

const examplePrompts = [
  {
    text: 'Build a modern React dashboard with charts and analytics',
    icon: 'i-ph:chart-line-duotone',
  },
  {
    text: 'Create a responsive landing page with Tailwind CSS',
    icon: 'i-ph:desktop-duotone',
  },
  {
    text: 'Develop a full-stack todo app with authentication',
    icon: 'i-ph:list-checks-duotone',
  },
  {
    text: 'Build a real-time chat application with WebSockets',
    icon: 'i-ph:chat-circle-duotone',
  },
];

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="relative w-full max-w-2xl mx-auto mt-8 flex justify-center">
      <div className="flex flex-col gap-3 w-full">
        <div className="text-center mb-4">
          <p className="text-sm text-bolt-elements-textSecondary font-medium">
            ✨ Try these prompts to get started with CodeCraft Studio
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
          {examplePrompts.map((example, index) => (
            <button
              key={index}
              className={classNames(
                'group relative flex items-center gap-3 p-4',
                'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
                'border border-bolt-elements-borderColor hover:border-accent-400',
                'rounded-xl transition-all duration-200',
                'text-left text-sm text-bolt-elements-textPrimary',
                'hover:shadow-lg hover:scale-[1.02]',
                'touch-manipulation', // Better touch response
                'focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2'
              )}
              onClick={(event) => {
                sendMessage?.(event, example.text);
              }}
            >
              <div className={classNames(
                example.icon,
                'text-lg text-accent-400 group-hover:text-accent-300 transition-colors'
              )} />
              <span className="flex-1 leading-relaxed">{example.text}</span>
              <div className="i-ph:arrow-right text-xs text-bolt-elements-textSecondary group-hover:text-accent-400 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
