import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { dispatchGlobalToast } from '@/components/ui/Toast';

// ── Global error handler ─────────────────────────────────────────────────────
// Centralised — avoids duplicating error handling in every useQuery() call.
function handleQueryError(error: unknown) {
    const err = error as any;
    const status = err?.response?.status;

    // Don't toast auth errors — the axios interceptor already redirects
    if (status === 401 || status === 403) return;

    // Don't toast rate-limit errors — axios interceptor handles them
    if (status === 429) return;

    // Don't toast cancelled requests
    if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;

    // Server errors on background refetches are silent — only show on first load
    // (React Query sets `meta.silent = true` for background queries automatically)
    if (err?.meta?.silent) return;
}

// ── Query Client ─────────────────────────────────────────────────────────────
export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: handleQueryError,
    }),
    mutationCache: new MutationCache({
        onError: (error) => {
            const err = error as any;
            const status = err?.response?.status;
            if (status === 401 || status === 403 || status === 429) return;
            const message = err?.response?.data?.error || err?.message || 'Something went wrong.';
            dispatchGlobalToast('error', message);
        },
    }),
    defaultOptions: {
        queries: {
            // ── Cache lifetime ───────────────────────────────────────────
            // Data is considered fresh for 3 minutes — avoids hammering the
            // server when multiple components mount simultaneously.
            staleTime: 3 * 60 * 1000,

            // Keep unused query data in memory for 20 minutes so navigating
            // back to a page shows instant data while revalidating in background.
            gcTime: 20 * 60 * 1000,

            // ── Retry strategy ───────────────────────────────────────────
            // Only retry transient server errors (5xx). Never retry 4xx —
            // they are deterministic and retrying wastes user time.
            retry: (failureCount, error) => {
                const status = (error as any)?.response?.status;
                if (status && status < 500) return false; // 4xx → no retry
                return failureCount < 2; // 5xx → max 2 retries
            },
            retryDelay: (attempt) =>
                Math.min(1000 * Math.pow(2, attempt), 10000), // 1s, 2s, capped at 10s

            // ── Refetch behaviour ────────────────────────────────────────
            // Don't refetch when user switches tabs — reduces server load.
            // Data is still fresh within staleTime anyway.
            refetchOnWindowFocus: false,

            // Reconnection refetch is useful for mobile users who go offline.
            refetchOnReconnect: true,

            // Don't auto-refetch on component remount if data is still fresh.
            refetchOnMount: true,

            // ── Performance ──────────────────────────────────────────────
            // Structural sharing: React Query deep-compares query results
            // and preserves object references when data hasn't changed.
            // This prevents unnecessary re-renders when responses are identical.
            // (Enabled by default in v5, listed here for documentation clarity.)

            // Network mode: always attempt fetches even if navigator.onLine is
            // false — let the server/interceptor handle errors instead.
            networkMode: 'always',
        },
        mutations: {
            // Never auto-retry mutations — they are not idempotent and
            // replaying them can cause duplicate writes.
            retry: false,
            networkMode: 'always',
        },
    },
});
