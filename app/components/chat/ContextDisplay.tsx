import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconButton } from '~/components/ui/IconButton';

interface ContextFile {
  path: string;
  content: string;
}

interface ContextDisplayProps {
  files: ContextFile[];
  onRemoveFile: (path: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function ContextDisplay({ files, onRemoveFile, onClearAll, className = '' }: ContextDisplayProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className={`bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="i-ph:files text-bolt-elements-textSecondary"></div>
          <span className="text-sm font-medium text-bolt-elements-textPrimary">
            Context ({files.length} files)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            title="Clear all context files"
            size="sm"
            onClick={onClearAll}
            className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          >
            <div className="i-ph:trash text-sm"></div>
          </IconButton>
        </div>
      </div>

      <div className="space-y-1 max-h-32 overflow-y-auto">
        <AnimatePresence>
          {files.map((file) => (
            <motion.div
              key={file.path}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between bg-bolt-elements-background-depth-3 rounded px-2 py-1 group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="i-ph:file text-xs text-bolt-elements-textSecondary"></div>
                <span className="text-xs font-mono text-bolt-elements-textSecondary truncate" title={file.path}>
                  {file.path}
                </span>
                <span className="text-xs text-bolt-elements-textTertiary">
                  ({file.content.length} chars)
                </span>
              </div>
              <IconButton
                title={`Remove ${file.path} from context`}
                size="sm"
                onClick={() => onRemoveFile(file.path)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-bolt-elements-textSecondary hover:text-red-500"
              >
                <div className="i-ph:x text-xs"></div>
              </IconButton>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-2 pt-2 border-t border-bolt-elements-borderColor">
        <div className="text-xs text-bolt-elements-textTertiary">
          These files are included in your conversation context and will be referenced in AI responses.
        </div>
      </div>
    </div>
  );
}

interface ContextIndicatorProps {
  fileCount: number;
  onClick: () => void;
  className?: string;
}

export function ContextIndicator({ fileCount, onClick, className = '' }: ContextIndicatorProps) {
  if (fileCount === 0) {
    return null;
  }

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors ${className}`}
      title={`${fileCount} files in context. Click to view.`}
    >
      <div className="i-ph:files text-sm"></div>
      <span>{fileCount}</span>
    </motion.button>
  );
}
