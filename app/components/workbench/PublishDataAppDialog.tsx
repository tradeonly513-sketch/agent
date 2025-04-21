import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';

interface PublishDataAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPublishing: boolean;
}

export function PublishDataAppDialog({ isOpen, onClose, onConfirm, isPublishing }: PublishDataAppDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[90vw] md:w-[500px]"
          >
            <Dialog.Content className="bg-white dark:bg-[#1E1E1E] rounded-lg border border-[#E5E5E5] dark:border-[#333333] shadow-xl">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="i-ph:warning-circle-fill w-5 h-5 text-yellow-500" />
                  <Dialog.Title className="text-lg font-medium text-bolt-elements-textPrimary">
                    Publish DataApp
                  </Dialog.Title>
                </div>
                <Dialog.Description className="text-sm text-bolt-elements-textSecondary">
                  This will relaunch the DataApp to display the latest published changes. Are you sure you want to
                  proceed?
                </Dialog.Description>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={onClose}
                    className="px-4 py-1 rounded-lg bg-[#F5F5F5] dark:bg-[#333333] text-[#666666] hover:text-[#111111] dark:text-[#999999] dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    className="px-4 py-1 inline-flex items-center gap-2 rounded-lg bg-[#7645e8] text-white hover:bg-[#5431a3] transition-colors"
                    disabled={isPublishing}
                  >
                    {isPublishing ? <div className="i-ph:spinner" /> : <div className="i-ph:cloud-arrow-up" />}
                    {isPublishing ? 'Publishing...' : 'Publish'}
                  </button>
                </div>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
