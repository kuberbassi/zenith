import { useEffect } from 'react';

/**
 * Hook to add global haptic feedback to clicks and interactions.
 * Works on devices that support the Vibration API (navigator.vibrate).
 */
export const useHaptics = () => {
  useEffect(() => {
    // Standard haptic duration for a "click" feel
    const CLICK_VIBRATION_MS = 15;

    const handleInteraction = () => {
      // Check if vibration is supported
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        // Trigger a short vibration
        try {
          navigator.vibrate(CLICK_VIBRATION_MS);
        } catch (error) {
          // Ignore errors
        }
      }
    };

    // Use pointerdown for faster response on mobile
    window.addEventListener('pointerdown', handleInteraction, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handleInteraction, { capture: true });
    };
  }, []);
};
