export const UPDATE_EVENT = 'cubbook:update';

let refreshing = false;

export function registerPwa() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const announce = () => window.dispatchEvent(new CustomEvent(UPDATE_EVENT));

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (reg.waiting && navigator.serviceWorker.controller) announce();
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) announce();
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch {
      /* offline SW optional on unsupported origins */
    }
  });
}

export async function applyPwaUpdate() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
  } catch {
    /* ignore */
  }
  window.location.reload();
}
