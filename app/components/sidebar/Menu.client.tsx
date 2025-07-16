import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { SettingsButton } from '~/components/ui/SettingsButton';
import { Button } from '~/components/ui/Button';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { workbenchStore } from '~/lib/stores/workbench';

const menuVariants = {
  closed: {
    x: '-100%',
    opacity: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  open: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
} satisfies Variants;

const overlayVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden' as const,
    transition: {
      duration: 0.2,
    },
  },
  open: {
    opacity: 1,
    visibility: 'visible' as const,
    transition: {
      duration: 0.2,
    },
  },
} satisfies Variants;

type DialogContent =
  | { type: 'delete'; item: ChatHistoryItem }
  | { type: 'bulkDelete'; items: ChatHistoryItem[] }
  | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-xs text-bolt-elements-textTertiary">
      {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}

export function Menu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<ChatHistoryItem[]>([]);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const { filteredItems: allItems, searchFilter, setSearchFilter } = useSearchFilter(useChatHistory().list);
  
  const showWorkbench = useStore(workbenchStore.showWorkbench);

  // Enhanced hover detection for sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const isNearLeftEdge = e.clientX < 50; // 50px from left edge
      const isOverSidebar = menuRef.current?.contains(e.target as Node);
      
      if (isNearLeftEdge || isOverSidebar) {
        setHovering(true);
        if (isNearLeftEdge) {
          setOpen(true);
        }
      } else if (!isOverSidebar && e.clientX > 320) {
        setHovering(false);
        // Only close if not actively interacting
        const timer = setTimeout(() => {
          if (!hovering) {
            setOpen(false);
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [hovering]);

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setSelectionMode(false);
        setSelectedItems([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSelectionMode(false);
    setSelectedItems([]);
  }, []);

  const toggleMenu = useCallback(() => {
    setOpen(!open);
  }, [open]);

  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profile = useStore(profileStore);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      if (!db) {
        throw new Error('Database not available');
      }

      // Delete chat snapshot from localStorage
      try {
        const snapshotKey = `snapshot:${id}`;
        localStorage.removeItem(snapshotKey);
        console.log('Removed snapshot for chat:', id);
      } catch (snapshotError) {
        console.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
      }

      // Delete the chat from the database
      await deleteById(db, id);
      console.log('Successfully deleted chat:', id);
    },
    [db],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();

      // Log the delete operation to help debugging
      console.log('Attempting to delete chat:', { id: item.id, description: item.description });

      deleteChat(item.id)
        .then(() => {
          toast.success('Chat deleted successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Always refresh the list
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            console.log('Navigating away from deleted chat');
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          console.error('Failed to delete chat:', error);
          toast.error('Failed to delete conversation', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Still try to reload entries in case data has changed
          loadEntries();
        });
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (!db || itemsToDeleteIds.length === 0) {
        console.log('Bulk delete skipped: No DB or no items to delete.');
        return;
      }

      console.log(`Starting bulk delete for ${itemsToDeleteIds.length} chats`, itemsToDeleteIds);

      let deletedCount = 0;
      const errors: string[] = [];
      const currentChatId = chatId.get();
      let shouldNavigate = false;

      // Process deletions sequentially using the shared deleteChat logic
      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;

          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          console.error(`Error deleting chat ${id}:`, error);
          errors.push(id);
        }
      }

      // Show appropriate toast message
      if (errors.length === 0) {
        toast.success(`${deletedCount} chat${deletedCount === 1 ? '' : 's'} deleted successfully`);
      } else {
        toast.warning(`Deleted ${deletedCount} of ${itemsToDeleteIds.length} chats. ${errors.length} failed.`, {
          autoClose: 5000,
        });
      }

      // Reload the list after all deletions
      await loadEntries();

      // Clear selection state
      setSelectedItems([]);
      setSelectionMode(false);

      // Navigate if needed
      if (shouldNavigate) {
        console.log('Navigating away from deleted chat');
        window.location.pathname = '/';
      }
    },
    [deleteChat, loadEntries, db],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);

    if (selectionMode) {
      // If turning selection mode OFF, clear selection
      setSelectedItems([]);
    }
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      console.log('Selected items updated:', newSelectedItems);

      return newSelectedItems; // Return the new array
    });
  }, []); // No dependencies needed

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('Select at least one chat to delete');
      return;
    }

    const selectedChats = list.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      toast.error('Could not find selected chats');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]); // Keep list dependency

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        console.log('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      } else {
        // Select all filtered items, adding them to any existing selections
        const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
        console.log('Selecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
    });
  }, [filteredList]); // Depends only on filteredList

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  // Exit selection mode when sidebar is closed
  useEffect(() => {
    if (!open && selectionMode) {
      /*
       * Don't clear selection state anymore when sidebar closes
       * This allows the selection to persist when reopening the sidebar
       */
      console.log('Sidebar closed, preserving selection state');
    }
  }, [open, selectionMode]);

  useEffect(() => {
    const enterThreshold = 20;
    const exitThreshold = 20;

    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen) {
        return;
      }

      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isSettingsOpen]);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setOpen(false);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    console.log('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  return (
    <>
      {/* Mobile menu trigger button */}
      <button
        onClick={toggleMenu}
        className={classNames(
          'fixed top-4 left-4 z-50 p-3 rounded-xl transition-all duration-200',
          'bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700',
          'text-white shadow-lg hover:shadow-xl hover:scale-105',
          'lg:hidden touch-manipulation',
          'border border-white/20 backdrop-blur-sm'
        )}
        aria-label="Toggle menu"
      >
        <div className={classNames(
          'w-5 h-5 transition-transform duration-200',
          open ? 'rotate-90' : 'rotate-0'
        )}>
          <div className="i-ph:sidebar-simple-duotone text-lg" />
        </div>
      </button>

      {/* Desktop hover indicator */}
      <div
        className={classNames(
          'hidden lg:block fixed left-0 top-0 w-1 h-full z-40 transition-all duration-200',
          'bg-gradient-to-b from-violet-500 to-purple-600',
          hovering ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Overlay */}
      <motion.div
        variants={overlayVariants}
        animate={open ? 'open' : 'closed'}
        initial="closed"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        onClick={closeMenu}
      />

      {/* Sidebar */}
      <motion.div
        ref={menuRef}
        variants={menuVariants}
        animate={open ? 'open' : 'closed'}
        initial="closed"
        className={classNames(
          'fixed left-0 top-0 h-full z-50 flex flex-col',
          'bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950',
          'border-r border-slate-200/80 dark:border-slate-700/80',
          'backdrop-blur-xl shadow-2xl',
          'w-80 lg:w-72'
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <div className="i-ph:code-duotone text-white text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                CodeCraft Studio
              </h1>
              <CurrentDateTime />
            </div>
          </div>
          <button
            onClick={closeMenu}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors lg:hidden"
          >
            <div className="i-ph:x text-lg" />
          </button>
        </div>

        {/* Search and controls */}
        <div className="p-4 space-y-3 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/30 dark:bg-slate-800/30">
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className={classNames(
                'w-full pl-10 pr-4 py-2.5 rounded-xl border',
                'bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm',
                'border-slate-200 dark:border-slate-600',
                'focus:ring-2 focus:ring-violet-500 focus:border-transparent',
                'placeholder-slate-400 dark:placeholder-slate-500',
                'text-sm transition-all duration-200'
              )}
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 i-ph:magnifying-glass text-slate-400" />
          </div>
          
          <div className="flex items-center justify-between">
            <SettingsButton
              onClick={() => setIsControlPanelOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 transition-colors text-sm"
            >
              <div className="i-ph:gear-duotone" />
              Settings
            </SettingsButton>
            <ThemeSwitch />
          </div>
        </div>

        {/* Chat history - improved scrolling */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
            <div className="p-4 space-y-4">
              {allItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <div className="i-ph:chat-circle-duotone text-2xl text-slate-400" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    No conversations yet
                  </p>
                  <p className="text-slate-500 dark:text-slate-500 text-xs mt-1">
                    Start a new chat to see it here
                  </p>
                </div>
              ) : (
                binDates(allItems).map(({ category, items }) => (
                  <div key={category} className="space-y-2">
                    <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                      {category}
                    </h3>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <HistoryItem key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-700/80 bg-white/30 dark:bg-slate-800/30">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>v2.0.0</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Online
            </span>
          </div>
        </div>
      </motion.div>

      {/* Settings panel */}
      <ControlPanel
        isOpen={isControlPanelOpen}
        onClose={() => setIsControlPanelOpen(false)}
      />

      {/* Delete confirmation dialog */}
      <DialogRoot open={!!dialogContent}>
        {/* Dialog content stays the same */}
      </DialogRoot>
    </>
  );
}
