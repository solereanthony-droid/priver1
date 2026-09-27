import { useEffect, useRef } from 'react';

// Sauvegarde locale : recharge au montage (restore), puis enregistre snapshot(state) 400 ms après chaque changement.
// Les erreurs de stockage (navigation privée, quota plein) sont ignorées : l'app continue sans sauvegarde.
export function usePersistence(key, state, { snapshot, restore }) {
  const loaded = useRef(false);
  const last = useRef('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) { last.current = raw; restore(JSON.parse(raw)); }
    } catch { /* sauvegarde illisible : on repart des valeurs par défaut */ }
    loaded.current = true;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        const raw = JSON.stringify(snapshot(state));
        if (raw !== last.current) { localStorage.setItem(key, raw); last.current = raw; }
      } catch { /* quota plein ou stockage bloqué */ }
    }, 400);
    return () => clearTimeout(t);
  }, [key, state]); // eslint-disable-line react-hooks/exhaustive-deps
}
