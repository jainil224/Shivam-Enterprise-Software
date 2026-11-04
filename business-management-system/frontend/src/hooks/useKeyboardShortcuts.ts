import { useEffect } from 'react';

interface ShortcutHandlers {
  onF10?: () => void;
  onCtrlN?: () => void;
  onCtrlF?: () => void;
  onEscape?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. F10: Company open/switch
      if (e.key === 'F10') {
        e.preventDefault();
        handlers.onF10?.();
        return;
      }

      // 2. Ctrl + N: Add company
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handlers.onCtrlN?.();
        return;
      }

      // 3. Ctrl + F: Search companies
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        handlers.onCtrlF?.();
        return;
      }

      // 4. Escape: Close modals
      if (e.key === 'Escape') {
        handlers.onEscape?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};

