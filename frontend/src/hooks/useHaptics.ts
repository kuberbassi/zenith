import { useEffect } from 'react';
import { haptics } from '../utils/haptics';

/**
 * Hook to add global haptic feedback to clicks and interactions.
 * Works on devices that support the Vibration API (navigator.vibrate), falling back to audio synthesis.
 */
export const useHaptics = () => {
  useEffect(() => {
    const handleInteraction = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Only trigger vibration if the target is interactive
      const isInteractive = 
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.closest('button') || 
        target.closest('a') || 
        target.closest('[role="button"]') || 
        target.closest('.cursor-pointer') ||
        target.classList.contains('cursor-pointer');

      if (!isInteractive) return;

      haptics.light();
    };

    // Use pointerdown for faster response on mobile
    window.addEventListener('pointerdown', handleInteraction, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handleInteraction, { capture: true });
    };
  }, []);
};
