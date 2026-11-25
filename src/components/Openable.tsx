import type { ReactNode } from 'react';

/**
 * A message bubble you can tap (or long-press: that is the context-menu event on Android) to open its actions.
 * Links and buttons inside it stop propagation, so they keep doing their own thing.
 */
export function Openable({ onOpen, children, className = '' }: { onOpen: () => void; children: ReactNode; className?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpen();
      }}
      className={`cursor-pointer select-text outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      {children}
    </div>
  );
}
