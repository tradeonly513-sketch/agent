import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { ChevronDown, Code, MessageCircle, Download } from 'lucide-react';

export const ExportChatButton = ({ exportChat }: { exportChat?: () => void }) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={classNames(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
          'bg-bolt-elements-button-primary-background',
          'text-bolt-elements-button-primary-text',
          'border border-bolt-elements-borderColor',
          'transition-theme duration-150',
          'hover:bg-bolt-elements-button-primary-backgroundHover',
          'hover:text-bolt-elements-item-contentAccent',
          'focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColorActive focus:ring-offset-1',
          'shrink-0',
        )}
      >
        <Download className="w-4 h-4 text-bolt-elements-icon-primary" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="w-3 h-3 text-bolt-elements-icon-tertiary transition-transform duration-200" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Content
        className={classNames(
          'min-w-[200px] z-50',
          'bg-bolt-elements-background-depth-2',
          'border border-bolt-elements-borderColor',
          'rounded-xl shadow-xl',
          'p-1',
          'animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        sideOffset={8}
        align="end"
        alignOffset={-4}
      >
        <DropdownMenu.Item
          className={classNames(
            'flex items-center w-full px-3 py-2 text-sm rounded-lg',
            'text-bolt-elements-textPrimary',
            'hover:bg-bolt-elements-item-backgroundActive',
            'hover:text-bolt-elements-item-contentActive',
            'focus:bg-bolt-elements-item-backgroundActive',
            'focus:text-bolt-elements-item-contentActive',
            'cursor-pointer select-none outline-none',
            'transition-theme duration-150',
            'gap-2',
          )}
          onClick={() => {
            workbenchStore.downloadZip();
          }}
        >
          <Code className="w-4 h-4 text-bolt-elements-icon-secondary" />
          <span>Download Code</span>
        </DropdownMenu.Item>

        <DropdownMenu.Item
          className={classNames(
            'flex items-center w-full px-3 py-2 text-sm rounded-lg',
            'text-bolt-elements-textPrimary',
            'hover:bg-bolt-elements-item-backgroundActive',
            'hover:text-bolt-elements-item-contentActive',
            'focus:bg-bolt-elements-item-backgroundActive',
            'focus:text-bolt-elements-item-contentActive',
            'cursor-pointer select-none outline-none',
            'transition-theme duration-150',
            'gap-2',
          )}
          onClick={() => exportChat?.()}
        >
          <MessageCircle className="w-4 h-4 text-bolt-elements-icon-secondary" />
          <span>Export Chat</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
