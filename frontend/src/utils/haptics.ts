/**
 * Haptic feedback utility using the Web Vibration API.
 * Safely falls back on desktop / unsupported environments.
 */
export const haptics = {
    light: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(10);
            } catch { /* ignore */ }
        }
    },
    medium: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(20);
            } catch { /* ignore */ }
        }
    },
    heavy: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(40);
            } catch { /* ignore */ }
        }
    },
    success: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate([15, 30, 15]);
            } catch { /* ignore */ }
        }
    },
    error: () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate([40, 60, 40]);
            } catch { /* ignore */ }
        }
    }
};
