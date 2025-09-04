import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X, Github } from 'lucide-react';
import { classNames } from '~/utils/classNames';

interface GitHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  preventClose?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export function GitHubDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
  preventClose = false,
  className = '',
}: GitHubDialogProps) {
  const handleClose = () => {
    if (!preventClose) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={classNames('w-full max-h-[90vh] overflow-hidden', sizeClasses[size])}
          >
            <Dialog.Content
              className={classNames(
                'bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg shadow-xl border border-bolt-elements-borderColor flex flex-col max-h-full',
                className,
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Github className="w-6 h-6 text-bolt-elements-item-contentAccent" />
                  <div>
                    <Dialog.Title className="text-lg font-medium text-bolt-elements-textPrimary">{title}</Dialog.Title>
                    {description && (
                      <Dialog.Description className="text-sm text-bolt-elements-textSecondary">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                </div>
                {!preventClose && (
                  <Dialog.Close asChild>
                    <button className="p-2 rounded-lg hover:bg-bolt-elements-background-depth-2 transition-colors">
                      <X className="w-4 h-4 text-bolt-elements-textSecondary" />
                    </button>
                  </Dialog.Close>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">{children}</div>

              {/* Footer */}
              {footer && (
                <div className="border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 flex-shrink-0">
                  {footer}
                </div>
              )}
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface GitHubDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function GitHubDialogContent({ children, className = '' }: GitHubDialogContentProps) {
  return <div className={classNames('p-6', className)}>{children}</div>;
}

interface GitHubDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function GitHubDialogFooter({ children, className = '' }: GitHubDialogFooterProps) {
  return <div className={classNames('p-4', className)}>{children}</div>;
}
