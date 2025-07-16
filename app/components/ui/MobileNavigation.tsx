import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { mobileStore } from '~/lib/stores/mobile';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { useEffect } from 'react';

export function MobileNavigation() {
  const isMobileDevice = useStore(mobileStore.isMobileDevice);
  const showMobileMenu = useStore(mobileStore.showMobileMenu);
  const chat = useStore(chatStore);
  const showWorkbench = useStore(workbenchStore.showWorkbench);

  useEffect(() => {
    // Initialize mobile detection on mount
    const cleanup = mobileStore.initMobileDetection();
    return cleanup;
  }, []);

  if (!isMobileDevice || !chat.started) {
    return null;
  }

  return (
    <>
      {/* Mobile Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bolt-elements-background-depth-1 border-t border-bolt-elements-borderColor safe-area-bottom">
        <div className="flex items-center justify-around px-4 py-2">
          {/* Chat Toggle */}
          <button
            onClick={mobileStore.toggleChatFullscreen}
            className={classNames(
              'flex flex-col items-center gap-1 p-2 rounded-lg transition-all touch-target',
              'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-2'
            )}
          >
            <div className="i-ph:chat-circle-duotone text-xl" />
            <span className="text-xs">Chat</span>
          </button>

          {/* Workbench Toggle */}
          <button
            onClick={() => workbenchStore.showWorkbench.set(!showWorkbench)}
            className={classNames(
              'flex flex-col items-center gap-1 p-2 rounded-lg transition-all touch-target',
              'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-2',
              {
                'text-accent-400': showWorkbench,
              }
            )}
          >
            <div className="i-ph:code-duotone text-xl" />
            <span className="text-xs">Code</span>
          </button>

          {/* Menu Toggle */}
          <button
            onClick={mobileStore.toggleMobileMenu}
            className={classNames(
              'flex flex-col items-center gap-1 p-2 rounded-lg transition-all touch-target',
              'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-2'
            )}
          >
            <div className="i-ph:list-duotone text-xl" />
            <span className="text-xs">Menu</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              // Add settings toggle logic
            }}
            className={classNames(
              'flex flex-col items-center gap-1 p-2 rounded-lg transition-all touch-target',
              'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-2'
            )}
          >
            <div className="i-ph:gear-duotone text-xl" />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={mobileStore.toggleMobileMenu}
            />
            
            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-bolt-elements-background-depth-1 border-l border-bolt-elements-borderColor z-50 safe-area-top"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor">
                  <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">
                    CodeCraft Studio
                  </h2>
                  <button
                    onClick={mobileStore.toggleMobileMenu}
                    className="p-2 hover:bg-bolt-elements-background-depth-2 rounded-lg touch-target"
                  >
                    <div className="i-ph:x text-xl" />
                  </button>
                </div>

                {/* Menu Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {/* Quick Actions */}
                    <div>
                      <h3 className="text-sm font-medium text-bolt-elements-textSecondary mb-2">
                        Quick Actions
                      </h3>
                      <div className="space-y-2">
                        <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-bolt-elements-background-depth-2 rounded-lg transition-colors">
                          <div className="i-ph:download-duotone text-lg text-accent-400" />
                          <span className="text-bolt-elements-textPrimary">Export Project</span>
                        </button>
                        <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-bolt-elements-background-depth-2 rounded-lg transition-colors">
                          <div className="i-ph:upload-duotone text-lg text-accent-400" />
                          <span className="text-bolt-elements-textPrimary">Import Project</span>
                        </button>
                        <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-bolt-elements-background-depth-2 rounded-lg transition-colors">
                          <div className="i-ph:share-duotone text-lg text-accent-400" />
                          <span className="text-bolt-elements-textPrimary">Share Project</span>
                        </button>
                      </div>
                    </div>

                    {/* Chat History */}
                    <div>
                      <h3 className="text-sm font-medium text-bolt-elements-textSecondary mb-2">
                        Recent Chats
                      </h3>
                      <div className="text-sm text-bolt-elements-textSecondary">
                        Chat history will appear here
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}