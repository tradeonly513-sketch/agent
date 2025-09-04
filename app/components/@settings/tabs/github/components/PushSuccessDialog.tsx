import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { Button } from '~/components/ui/Button';
import { formatSize } from '~/utils/formatSize';
import { CheckCircle, ExternalLink, Copy, Files } from 'lucide-react';
import { toast } from 'react-toastify';

interface PushedFile {
  path: string;
  size: number;
}

interface PushSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  repositoryUrl: string;
  repositoryName?: string;
  pushedFiles: PushedFile[];
}

export function PushSuccessDialog({
  isOpen,
  onClose,
  repositoryUrl,
  repositoryName,
  pushedFiles,
}: PushSuccessDialogProps) {
  const totalFiles = pushedFiles.length;
  const totalSize = pushedFiles.reduce((sum, file) => sum + file.size, 0);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(repositoryUrl);
      toast.success('Repository URL copied to clipboard');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy URL');
    }
  };

  const handleOpenRepository = () => {
    window.open(repositoryUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md"
          >
            <Dialog.Content className="bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg shadow-xl border border-bolt-elements-borderColor overflow-hidden">
              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-medium text-bolt-elements-textPrimary">
                      Successfully Pushed to GitHub!
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-bolt-elements-textSecondary">
                      Your project has been pushed to{' '}
                      {repositoryName && <span className="font-medium">{repositoryName}</span>}
                    </Dialog.Description>
                  </div>
                </div>
              </div>

              {/* Repository URL */}
              <div className="px-6 pb-4">
                <div className="flex items-center gap-2 p-3 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
                  <ExternalLink className="w-4 h-4 text-bolt-elements-textSecondary flex-shrink-0" />
                  <span className="text-sm text-bolt-elements-textPrimary font-mono truncate">{repositoryUrl}</span>
                  <Button variant="outline" size="sm" onClick={handleCopyUrl} className="ml-auto flex-shrink-0">
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Statistics */}
              <div className="px-6 pb-4">
                <div className="bg-bolt-elements-background-depth-1 rounded-lg p-4 border border-bolt-elements-borderColor">
                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2">
                    <Files className="w-4 h-4" />
                    Push Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-bolt-elements-textPrimary">{totalFiles}</div>
                      <div className="text-xs text-bolt-elements-textSecondary">Files Pushed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-bolt-elements-textPrimary">{formatSize(totalSize)}</div>
                      <div className="text-xs text-bolt-elements-textSecondary">Total Size</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* File List */}
              {pushedFiles.length > 0 && (
                <div className="px-6 pb-4">
                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                    Pushed Files ({pushedFiles.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
                    {pushedFiles.slice(0, 10).map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-2 border-b border-bolt-elements-borderColor last:border-b-0"
                      >
                        <span className="text-xs font-mono text-bolt-elements-textPrimary truncate flex-1">
                          {file.path}
                        </span>
                        <span className="text-xs text-bolt-elements-textSecondary ml-2 flex-shrink-0">
                          {formatSize(file.size)}
                        </span>
                      </div>
                    ))}
                    {pushedFiles.length > 10 && (
                      <div className="px-3 py-2 text-xs text-bolt-elements-textTertiary text-center">
                        ... and {pushedFiles.length - 10} more files
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-6 py-4 bg-bolt-elements-background-depth-1 border-t border-bolt-elements-borderColor">
                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1">
                    Close
                  </Button>
                  <Button
                    onClick={handleOpenRepository}
                    className="flex-1 bg-bolt-elements-item-contentAccent text-white hover:bg-bolt-elements-item-contentAccent/90"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Repository
                  </Button>
                </div>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
