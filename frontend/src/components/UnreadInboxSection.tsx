import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { Badge, Button, Spinner } from './ui';
import { UnreadInboxItemCard } from './UnreadInboxItemCard';
import { useUnreadInbox } from '../hooks/useUnreadInbox';

export function UnreadInboxSection() {
  const { data: items, isLoading } = useUnreadInbox();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const count = items?.length ?? 0;

  // Default to open the first time there's something to show, but don't
  // fight the user if they've since collapsed it.
  useEffect(() => {
    if (!hasAutoOpened && count > 0) {
      setIsCollapsed(false);
      setHasAutoOpened(true);
    }
  }, [count, hasAutoOpened]);

  if (!isLoading && count === 0) {
    return null;
  }

  return (
    <div className="surface-base rounded-lg shadow-md border border-theme-default p-6">
      <Button
        variant="ghost"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="w-full justify-between px-0 py-0 font-normal"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-content-tertiary" />
          <h2 className="text-lg font-bold text-content-primary">Unread</h2>
          {count > 0 && (
            <Badge variant="primary" size="sm">
              {count}
            </Badge>
          )}
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-5 h-5 text-content-tertiary" />
        ) : (
          <ChevronUp className="w-5 h-5 text-content-tertiary" />
        )}
      </Button>

      {!isCollapsed && (
        <div className="mt-4 space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-content-secondary text-sm">
              <Spinner size="sm" /> Loading...
            </div>
          )}
          {items?.map((item) => (
            <UnreadInboxItemCard key={item.notification.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
