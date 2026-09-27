import { useEffect } from 'react';

// Mode hors ligne et mises à jour (build de production uniquement).
// Quand une nouvelle version attend, émet « btp:update-ready » (le prototype affiche la pilule
// « Nouvelle version disponible ») et expose window.__btpApplyUpdate() pour l'appliquer.
export function useServiceWorker(url = '/sw.js') {
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let reg = null, applying = false, reloading = false;

    const announce = () => window.dispatchEvent(new Event('btp:update-ready'));
    const track = w => w && w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) announce();
    });
    // Recharge seulement si l'utilisateur a demandé la mise à jour (pas à la première installation).
    const onControllerChange = () => { if (!applying || reloading) return; reloading = true; location.reload(); };

    window.__btpApplyUpdate = () => {
      applying = true;
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      else location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.register(url).then(r => {
      reg = r;
      if (r.waiting && navigator.serviceWorker.controller) announce();
      track(r.installing);
      r.addEventListener('updatefound', () => track(r.installing));
    }).catch(() => {});

    // Vérifie les mises à jour quand l'app revient au premier plan.
    const onVisible = () => { if (document.visibilityState === 'visible' && reg) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
      delete window.__btpApplyUpdate;
    };
  }, [url]);
}
