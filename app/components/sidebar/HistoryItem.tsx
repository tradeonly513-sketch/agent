import { useParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import { type ChatHistoryItem } from '~/lib/persistence';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { useCallback } from 'react';
import { Checkbox } from '~/components/ui/Checkbox';
import { Check, Download, Copy, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '~/components/ui/Dropdown';

interface HistoryItemProps {
  item: ChatHistoryItem;
  onDelete?: (event: React.UIEvent) => void;
  onDuplicate?: (id: string) => void;
  exportChat: (id?: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export function HistoryItem({
  item,
  onDelete,
  onDuplicate,
  exportChat,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
}: HistoryItemProps) {
  const { id: urlId } = useParams();
  const isActiveChat = urlId === item.urlId;

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription: item.description,
      customChatId: item.id,
      syncWithGlobalStore: isActiveChat,
    });

  const handleItemClick = useCallback(
    (e: React.MouseEvent) => {
      if (selectionMode) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Item clicked in selection mode:', item.id);
        onToggleSelection?.(item.id);
      }
    },
    [selectionMode, item.id, onToggleSelection],
  );

  const handleCheckboxChange = useCallback(() => {
    console.log('Checkbox changed for item:', item.id);
    onToggleSelection?.(item.id);
  }, [item.id, onToggleSelection]);

  const handleDeleteClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Delete button clicked for item:', item.id);

      if (onDelete) {
        onDelete(event as unknown as React.UIEvent);
      }
    },
    [onDelete, item.id],
  );

  return (
    <div
      className={classNames(
        'group rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/80 dark:hover:bg-gray-800/30 overflow-hidden flex justify-between items-center px-3 py-2.5 transition-all duration-200 ease-in-out hover:shadow-sm',
        { 'text-gray-900 dark:text-white bg-gray-50/80 dark:bg-gray-800/30 shadow-sm': isActiveChat },
        { 'cursor-pointer': selectionMode },
      )}
      onClick={selectionMode ? handleItemClick : undefined}
    >
      {selectionMode && (
        <div className="flex items-center mr-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            id={`select-${item.id}`}
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            className="h-4 w-4"
          />
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            className="flex-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="h-4 w-4 text-gray-500 hover:text-purple-500 transition-colors"
            onMouseDown={handleSubmit}
          >
            <Check />
          </button>
        </form>
      ) : (
        <>
          <a
            href={`/chat/${item.urlId}`}
            className="flex w-full relative truncate block pr-12"
            onClick={selectionMode ? handleItemClick : undefined}
          >
            <WithTooltip tooltip={currentDescription} position="top" sideOffset={8}>
              <span className="truncate">{currentDescription}</span>
            </WithTooltip>
          </a>
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out">
            <Dropdown
              trigger={
                <button
                  type="button"
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 ease-in-out hover:scale-105"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
                </button>
              }
              align="end"
              sideOffset={8}
            >
              <DropdownItem
                onSelect={() => {
                  exportChat(item.id);
                }}
                className="py-2.5 px-3 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors duration-150"
              >
                <Download className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">Export</span>
              </DropdownItem>

              {onDuplicate && (
                <DropdownItem
                  onSelect={() => {
                    onDuplicate?.(item.id);
                  }}
                  className="py-2.5 px-3 hover:bg-green-50 dark:hover:bg-green-950/50 transition-colors duration-150"
                >
                  <Copy className="h-4 w-4 mr-3 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium">Duplicate</span>
                </DropdownItem>
              )}

              <DropdownItem
                onSelect={() => {
                  toggleEditMode();
                }}
                className="py-2.5 px-3 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors duration-150"
              >
                <Pencil className="h-4 w-4 mr-3 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium">Rename</span>
              </DropdownItem>

              <DropdownSeparator />

              <DropdownItem
                onSelect={() => {
                  if (onDelete) {
                    // Create a synthetic event for onDelete
                    const syntheticEvent = {
                      preventDefault: () => {},
                      stopPropagation: () => {},
                    } as React.UIEvent;
                    onDelete(syntheticEvent);
                  }
                }}
                className="py-2.5 px-3 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors duration-150"
              >
                <Trash2 className="h-4 w-4 mr-3" />
                <span className="text-sm font-medium">Delete</span>
              </DropdownItem>
            </Dropdown>
          </div>
        </>
      )}
    </div>
  );
}
