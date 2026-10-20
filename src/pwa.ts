/**
 * PWA Service Worker Registration
 *
 * Requirements:
 * - Register ONLY in production builds (import.meta.env.PROD)
 * - Auto-update when a new version is deployed
 * - Fail silently if service worker is unsupported, disabled, or running in a sandboxed iframe
 */

export function registerPWA(): void {
  // Only register in production builds and when window & navigator are present
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Strictly skip in development mode
  if (!import.meta.env.PROD) {
    return;
  }

  try {
    // Detect sandboxed iframe without allow-same-origin / SW permissions
    const inIframe = window.self !== window.top;
    if (inIframe) {
      // In sandboxed iframes, service worker registration typically throws a SecurityError
      // We safely probe or skip to avoid unhandled rejections
      try {
        if (!window.isSecureContext) {
          return;
        }
      } catch {
        return;
      }
    }

    // Dynamic import to keep dev bundle lightweight and avoid unhandled evaluation in iframes
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        try {
          const updateSW = registerSW({
            immediate: true,
            onNeedRefresh() {
              // Automatically activate updated service worker
              updateSW(true);
            },
            onOfflineReady() {
              // App is ready for offline use
            },
            onRegisterError(_error) {
              // Fail silently in sandboxed iframes or restricted environments
            },
          });
        } catch {
          // Fail silently
        }
      })
      .catch(() => {
        // Fallback standard registration if virtual module is unavailable
        try {
          navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
            // Fail silently
          });
        } catch {
          // Fail silently
        }
      });
  } catch {
    // Fail silently
  }
}
