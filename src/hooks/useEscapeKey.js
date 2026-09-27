import { useEffect, useRef } from 'react';

// Appelle handler à chaque appui sur Échap (fermeture des feuilles modales).
export function useEscapeKey(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') ref.current(e); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
