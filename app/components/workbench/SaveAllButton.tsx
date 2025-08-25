import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import * as Tooltip from '@radix-ui/react-tooltip';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { motion } from 'framer-motion';

interface SaveAllButtonProps {
  className?: string;
  variant?: 'icon' | 'button' | 'both';
  showCount?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
}

export const SaveAllButton = memo(
  ({
    className = '',
    variant = 'both',
    showCount = true,
    autoSave = false,
    autoSaveInterval = 30000, // 30 seconds default
  }: SaveAllButtonProps) => {
    const unsavedFiles = useStore(workbenchStore.unsavedFiles);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(autoSave);
    const [timeUntilAutoSave, setTimeUntilAutoSave] = useState<number | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

    const unsavedCount = unsavedFiles.size;
    const hasUnsavedFiles = unsavedCount > 0;

    // Auto-save logic
    useEffect(() => {
      if (!autoSaveEnabled || !hasUnsavedFiles) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }

        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }

        setTimeUntilAutoSave(null);

        return undefined;
      }

      // Set up auto-save timer
      autoSaveTimerRef.current = setTimeout(async () => {
        // Call handleSaveAll directly in setTimeout to avoid dependency issues
        if (hasUnsavedFiles && !isSaving) {
          setIsSaving(true);

          const startTime = performance.now();

          try {
            await workbenchStore.saveAllFiles();

            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);

            setLastSaved(new Date());

            // Success feedback for auto-save
            const message = `Auto-saved ${unsavedCount} file${unsavedCount > 1 ? 's' : ''} (${duration}ms)`;

            toast.success(message, {
              position: 'bottom-right',
              autoClose: 2000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
          } catch (error) {
            console.error('Failed to auto-save files:', error);
            toast.error(`Failed to auto-save files: ${error instanceof Error ? error.message : 'Unknown error'}`, {
              position: 'bottom-right',
              autoClose: 5000,
            });
          } finally {
            setIsSaving(false);
          }
        }
      }, autoSaveInterval);

      // Set up countdown timer
      const startTime = Date.now();
      setTimeUntilAutoSave(Math.ceil(autoSaveInterval / 1000));

      countdownTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, autoSaveInterval - elapsed);
        setTimeUntilAutoSave(Math.ceil(remaining / 1000));

        if (remaining <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
        }
      }, 1000);

      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }

        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
      };
    }, [autoSaveEnabled, hasUnsavedFiles, unsavedFiles, autoSaveInterval, isSaving, unsavedCount]);

    const handleSaveAll = useCallback(
      async (isAutoSave = false) => {
        if (!hasUnsavedFiles || isSaving) {
          return;
        }

        setIsSaving(true);

        const startTime = performance.now();

        try {
          await workbenchStore.saveAllFiles();

          const endTime = performance.now();
          const duration = Math.round(endTime - startTime);

          setLastSaved(new Date());

          // Success feedback
          const message = isAutoSave
            ? `Auto-saved ${unsavedCount} file${unsavedCount > 1 ? 's' : ''} (${duration}ms)`
            : `Saved ${unsavedCount} file${unsavedCount > 1 ? 's' : ''} successfully (${duration}ms)`;

          toast.success(message, {
            position: 'bottom-right',
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });

          // Haptic feedback effect (visual pulse)
          const button = document.getElementById('save-all-button');

          if (button) {
            button.classList.add('save-success-pulse');
            setTimeout(() => button.classList.remove('save-success-pulse'), 600);
          }
        } catch (error) {
          console.error('Failed to save files:', error);
          toast.error(`Failed to save files: ${error instanceof Error ? error.message : 'Unknown error'}`, {
            position: 'bottom-right',
            autoClose: 5000,
          });
        } finally {
          setIsSaving(false);
        }
      },
      [hasUnsavedFiles, isSaving, unsavedCount],
    );

    const handleKeyPress = useCallback(
      (e: KeyboardEvent) => {
        /*
         * Ctrl+S or Cmd+S for save current
         * Ctrl+Shift+S or Cmd+Shift+S for save all
         */
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
          e.preventDefault();
          handleSaveAll();
        }
      },
      [handleSaveAll],
    );

    useEffect(() => {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);

    const formatLastSaved = () => {
      if (!lastSaved) {
        return null;
      }

      const now = new Date();
      const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

      if (diff < 60) {
        return `${diff}s ago`;
      }

      if (diff < 3600) {
        return `${Math.floor(diff / 60)}m ago`;
      }

      return `${Math.floor(diff / 3600)}h ago`;
    };

    const buttonContent = (
      <>
        <div className="relative">
          <div
            className={classNames(
              'transition-all duration-200',
              isSaving ? 'animate-spin' : '',
              hasUnsavedFiles ? 'text-white' : 'text-bolt-elements-textTertiary',
            )}
          >
            <div className="i-ph:floppy-disk-duotone text-xl" />
          </div>

          {/* Unsaved indicator with count */}
          {hasUnsavedFiles && !isSaving && showCount && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold px-1"
            >
              {unsavedCount}
            </motion.div>
          )}
        </div>

        {(variant === 'button' || variant === 'both') && (
          <span className="ml-2 font-medium">{isSaving ? 'Saving...' : 'Save All'}</span>
        )}

        {/* Auto-save countdown badge */}
        {autoSaveEnabled && timeUntilAutoSave !== null && hasUnsavedFiles && !isSaving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="ml-2 text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium"
          >
            {timeUntilAutoSave}s
          </motion.div>
        )}
      </>
    );

    const tooltipContent = (
      <div className="text-xs space-y-1">
        <div className="font-semibold">
          {hasUnsavedFiles ? `${unsavedCount} unsaved file${unsavedCount > 1 ? 's' : ''}` : 'All files saved'}
        </div>
        {lastSaved && <div className="text-bolt-elements-textTertiary">Last saved: {formatLastSaved()}</div>}
        {autoSaveEnabled && hasUnsavedFiles && timeUntilAutoSave && (
          <div className="text-bolt-elements-textTertiary">Auto-save in: {timeUntilAutoSave}s</div>
        )}
        <div className="border-t border-bolt-elements-borderColor pt-1 mt-1">
          <kbd className="text-xs">Ctrl+Shift+S</kbd> to save all
        </div>
      </div>
    );

    return (
      <>
        <Tooltip.Provider delayDuration={300}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <motion.button
                id="save-all-button"
                onClick={() => handleSaveAll(false)}
                disabled={!hasUnsavedFiles || isSaving}
                className={classNames(
                  'relative inline-flex items-center gap-1 px-4 py-2 rounded-lg',
                  'transition-all duration-200 ease-in-out transform',
                  'font-medium text-sm',
                  hasUnsavedFiles
                    ? 'bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white shadow-lg hover:shadow-xl border border-accent-600'
                    : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary border border-bolt-elements-borderColor cursor-not-allowed opacity-60',
                  isSaving ? 'animate-pulse' : '',
                  className,
                )}
                whileHover={hasUnsavedFiles ? { scale: 1.05 } : {}}
                whileTap={hasUnsavedFiles ? { scale: 0.95 } : {}}
              >
                {/* Background animation for unsaved files */}
                {hasUnsavedFiles && !isSaving && (
                  <motion.div
                    className="absolute inset-0 bg-white/10 rounded-lg"
                    animate={{
                      opacity: [0, 0.3, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
                {buttonContent}
              </motion.button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary px-3 py-2 rounded-lg shadow-lg border border-bolt-elements-borderColor z-50"
                sideOffset={5}
              >
                {tooltipContent}
                <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>

        {/* Auto-save toggle */}
        {variant !== 'icon' && (
          <div className="ml-2 inline-flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-bolt-elements-textTertiary">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                className="w-3 h-3 rounded border-bolt-elements-borderColor"
              />
              Auto-save
            </label>
          </div>
        )}

        <style>{`
        @keyframes save-success-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
        
        .save-success-pulse {
          animation: save-success-pulse 0.6s ease-out;
        }
      `}</style>
      </>
    );
  },
);

SaveAllButton.displayName = 'SaveAllButton';
