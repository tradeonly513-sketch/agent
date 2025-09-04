import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState, useCallback } from 'react';
import { streamingState } from '~/lib/stores/streaming';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { DeployButton } from '~/components/deploy/DeployButton';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Loader2, CloudDownload, Bug } from 'lucide-react';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const isStreaming = useStore(streamingState);
  const { exportChat } = useChatHistory();
  const [isSyncing, setIsSyncing] = useState(false);

  const shouldShowButtons = !isStreaming && activePreview;

  const handleSyncFiles = useCallback(async () => {
    setIsSyncing(true);

    try {
      const directoryHandle = await window.showDirectoryPicker();
      await workbenchStore.syncFiles(directoryHandle);
      toast.success('Files synced successfully');
    } catch (error) {
      console.error('Error syncing files:', error);
      toast.error('Failed to sync files');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Export Chat Button */}
      {chatStarted && shouldShowButtons && <ExportChatButton exportChat={exportChat} />}

      {/* Sync Button */}
      {shouldShowButtons && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            disabled={isSyncing}
            className={classNames(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
              'bg-bolt-elements-button-primary-background',
              'text-bolt-elements-button-primary-text',
              'border border-bolt-elements-borderColor',
              'transition-theme duration-150',
              'hover:bg-bolt-elements-button-primary-backgroundHover',
              'hover:text-bolt-elements-item-contentAccent',
              'focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColorActive focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'shrink-0',
            )}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin text-bolt-elements-icon-primary" />
            ) : (
              <CloudDownload className="w-4 h-4 text-bolt-elements-icon-primary" />
            )}
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
            <ChevronDown className="w-3 h-3 text-bolt-elements-icon-tertiary transition-transform duration-200" />
          </DropdownMenu.Trigger>

          <DropdownMenu.Content
            className={classNames(
              'min-w-[220px] z-50',
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
              onClick={handleSyncFiles}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin text-bolt-elements-icon-primary" />
              ) : (
                <CloudDownload className="w-4 h-4 text-bolt-elements-icon-secondary" />
              )}
              <span>{isSyncing ? 'Syncing Files...' : 'Sync Files'}</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}

      {/* Deploy Button */}
      {shouldShowButtons && <DeployButton />}

      {/* Bug Report Button */}
      {shouldShowButtons && (
        <button
          onClick={() =>
            window.open('https://github.com/stackblitz-labs/bolt.diy/issues/new?template=bug_report.yml', '_blank')
          }
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
          title="Report Bug"
        >
          <Bug className="w-4 h-4" />
          <span className="hidden sm:inline">Report Bug</span>
        </button>
      )}
    </div>
  );
}
