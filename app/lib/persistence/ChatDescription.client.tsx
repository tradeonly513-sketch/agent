import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { description as descriptionStore } from '~/lib/persistence';
import { CheckCircle, Edit } from 'lucide-react';

export function ChatDescription() {
  const initialDescription = useStore(descriptionStore)!;

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription,
      syncWithGlobalStore: true,
    });

  if (!initialDescription) {
    // doing this to prevent showing edit button until chat description is set
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      {editing ? (
        <form onSubmit={handleSubmit} className="flex items-center justify-center">
          <input
            type="text"
            className="bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary rounded px-2 mr-2 w-fit"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{ width: `${Math.max(currentDescription.length * 8, 100)}px` }}
          />
          <TooltipProvider>
            <WithTooltip tooltip="Save title">
              <div className="flex justify-between items-center p-2 rounded-md bg-bolt-elements-item-backgroundAccent">
                <button
                  type="submit"
                  className="scale-110 hover:text-bolt-elements-item-contentAccent"
                  onMouseDown={handleSubmit}
                >
                  <CheckCircle />
                </button>
              </div>
            </WithTooltip>
          </TooltipProvider>
        </form>
      ) : (
        <>
          {currentDescription}
          <TooltipProvider>
            <WithTooltip tooltip="Rename chat">
              <button
                type="button"
                className="ml-2 scale-110 hover:text-bolt-elements-item-contentAccent"
                onClick={(event) => {
                  event.preventDefault();
                  toggleEditMode();
                }}
              >
                <Edit />
              </button>
            </WithTooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  );
}
