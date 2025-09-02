import React, { memo } from 'react';
import { classNames } from '~/utils/classNames';
import { Switch } from '~/components/ui/Switch';
import { Code, MessageCircle } from 'lucide-react';

interface ChatModeToggleProps {
  chatMode: 'discuss' | 'build';
  onModeChange: (mode: 'discuss' | 'build') => void;
  disabled?: boolean;
  className?: string;
}

export const ChatModeToggle = memo(({ chatMode, onModeChange, disabled = false, className }: ChatModeToggleProps) => {
  const handleToggleChange = (isDiscuss: boolean) => {
    if (!disabled) {
      onModeChange(isDiscuss ? 'discuss' : 'build');
    }
  };

  const isDiscussMode = chatMode === 'discuss';

  return (
    <div className={classNames('flex items-center gap-3', className)}>
      {/* Build Mode Indicator */}
      <div
        className={classNames(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
          !isDiscussMode
            ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
            : 'text-bolt-elements-textSecondary',
        )}
      >
        <Code className="w-4 h-4" />
        <span className="text-sm font-medium">Build</span>
      </div>

      {/* Toggle Switch */}
      <div className="flex items-center gap-2">
        <span
          className={classNames(
            'text-xs transition-colors',
            !isDiscussMode ? 'text-bolt-elements-textPrimary' : 'text-bolt-elements-textSecondary',
          )}
        >
          Build
        </span>
        <Switch
          checked={isDiscussMode}
          onCheckedChange={handleToggleChange}
          className={classNames(disabled ? 'opacity-50 cursor-not-allowed' : '')}
        />
        <span
          className={classNames(
            'text-xs transition-colors',
            isDiscussMode ? 'text-bolt-elements-textPrimary' : 'text-bolt-elements-textSecondary',
          )}
        >
          Discuss
        </span>
      </div>

      {/* Discuss Mode Indicator */}
      <div
        className={classNames(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
          isDiscussMode
            ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
            : 'text-bolt-elements-textSecondary',
        )}
      >
        <MessageCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Discuss</span>
      </div>
    </div>
  );
});

ChatModeToggle.displayName = 'ChatModeToggle';
