import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

/**
 * Global keyboard shortcuts hook for Zenith
 * 
 * Shortcuts:
 * - Ctrl+N: Open Notifications
 * - Ctrl+D: Go to Dashboard
 * - Ctrl+T: Go to Timetable
 * - Ctrl+K: Quick search (future)
 * - Arrow keys: Scroll in modals/pages
 * - Escape: Close modals (handled by Modal component)
 */
export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'n',
      ctrl: true,
      action: () => navigate('/notifications'),
      description: 'Open Notifications'
    },
    {
      key: 'd',
      ctrl: true,
      action: () => navigate('/'),
      description: 'Go to Dashboard'
    },
    {
      key: 't',
      ctrl: true,
      action: () => navigate('/timetable'),
      description: 'Open Timetable'
    },
    {
      key: 'a',
      ctrl: true,
      action: () => navigate('/analytics'),
      description: 'Open Analytics'
    },
    {
      key: 'c',
      ctrl: true,
      shift: true,
      action: () => navigate('/calendar'),
      description: 'Open Calendar'
    },
    {
      key: 's',
      ctrl: true,
      shift: true,
      action: () => navigate('/settings'),
      description: 'Open Settings'
    }
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    const isTyping = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;

    if (isTyping) return;

    // Check for matching shortcuts
    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }

    // Arrow key scrolling for modals and pages
    const modal = document.querySelector('[role="dialog"]') || 
                  document.querySelector('.modal-content') ||
                  document.querySelector('.overflow-y-auto');
    
    if (modal) {
      const scrollAmount = 100;
      switch (event.key) {
        case 'ArrowDown':
          modal.scrollTop += scrollAmount;
          break;
        case 'ArrowUp':
          modal.scrollTop -= scrollAmount;
          break;
        case 'PageDown':
          modal.scrollTop += modal.clientHeight * 0.8;
          break;
        case 'PageUp':
          modal.scrollTop -= modal.clientHeight * 0.8;
          break;
        case 'Home':
          if (event.ctrlKey) {
            modal.scrollTop = 0;
          }
          break;
        case 'End':
          if (event.ctrlKey) {
            modal.scrollTop = modal.scrollHeight;
          }
          break;
      }
    }
  }, [navigate, location]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return shortcuts for potential UI display
  return { shortcuts };
};

/**
 * Hook for enabling arrow key scrolling in a specific container
 */
export const useArrowKeyScroll = (containerRef: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const scrollAmount = 50;
      
      switch (event.key) {
        case 'ArrowDown':
          container.scrollTop += scrollAmount;
          event.preventDefault();
          break;
        case 'ArrowUp':
          container.scrollTop -= scrollAmount;
          event.preventDefault();
          break;
        case 'ArrowLeft':
          container.scrollLeft -= scrollAmount;
          event.preventDefault();
          break;
        case 'ArrowRight':
          container.scrollLeft += scrollAmount;
          event.preventDefault();
          break;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    container.tabIndex = 0; // Make container focusable
    
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef]);
};

export default useKeyboardShortcuts;
