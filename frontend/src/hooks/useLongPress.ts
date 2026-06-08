import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  threshold?: number;
  onStart?: (e: any) => void;
  onCancel?: (e: any) => void;
}

export const useLongPress = (
  callback: (e: any) => void,
  options: UseLongPressOptions = {}
) => {
  const { threshold = 500, onStart, onCancel } = options;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isTriggered = useRef(false);

  const start = useCallback(
    (event: any) => {
      // Prevent context menu on mobile
      if (event.type === 'touchstart') {
        // We can let touch events flow but prevent default on long hold
      }

      isTriggered.current = false;
      if (onStart) onStart(event);

      timerRef.current = setTimeout(() => {
        isTriggered.current = true;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([20, 40, 20]); // distinct OnePlus-like haptic feedback pattern
          } catch (e) {
            // ignore
          }
        }
        callback(event);
      }, threshold);
    },
    [callback, threshold, onStart]
  );

  const stop = useCallback(
    (event: any) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (!isTriggered.current && onCancel) {
        onCancel(event);
      }
    },
    [onCancel]
  );

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};

export default useLongPress;
