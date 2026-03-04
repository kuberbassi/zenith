/**
 * In development: unregister any stale service workers left over from previous
 * sessions (VitePWA dev-sw, custom sw.js, etc.). Stale SWs intercept navigation
 * requests and cause "Could not establish connection" errors.
 *
 * In production: VitePWA handles SW registration automatically via registerType: 'autoUpdate'.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const isDev = import.meta.env.DEV

  if (isDev) {
    // Unregister ALL service workers in dev to prevent stale caching issues
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) console.log('[SW] Unregistered stale service worker:', registration.scope)
        })
      }
    })

    // Clear all caches left by previous SW registrations
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name)
        }
        if (names.length) console.log('[SW] Cleared stale caches:', names.join(', '))
      })
    }
  }
}
