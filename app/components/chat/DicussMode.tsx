import { classNames } from '~/utils/classNames';
import { IconButton } from '~/components/ui';
import { MessageCircle } from 'lucide-react';

export function DiscussMode() {
  return (
    <div>
      <IconButton
        title="Discuss"
        className={classNames(
          'transition-all flex items-center gap-1 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent',
        )}
      >
        <MessageCircle className="text-lg" />
      </IconButton>
    </div>
  );
}
