import { useEffect, useRef } from 'react';
import * as blobs from '../storage/blobStore.js';

// Sauvegarde locale : recharge au montage (restore, puis onLoad, sauvegarde ou non), puis enregistre snapshot(state) 400 ms après chaque changement.
// Les gros contenus (plans importés, fonds d'implantation) vont dans IndexedDB ; localStorage ne garde que le JSON
// et des références. Si l'enregistrement échoue quand même (stockage plein ou bloqué), onError prévient l'utilisateur
// une fois, puis de nouveau après un enregistrement réussi.
export function usePersistence(key, state, { snapshot, restore, onError, onLoad }) {
  const loaded = useRef(false);
  const last = useRef('');
  const cache = useRef(new Map());
  const seq = useRef(0);
  const warned = useRef(false);
  const idb = useRef(null); // Promise<boolean>

  useEffect(() => {
    let cancelled = false;
    idb.current = blobs.available();
    (async () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          last.current = raw;
          let data = JSON.parse(raw);
          const refs = [...blobs.refsIn(data)];
          if (refs.length) {
            const found = await idb.current ? await blobs.getMany(refs).catch(() => new Map()) : new Map();
            data = blobs.hydrate(data, found);
          }
          if (!cancelled) restore(data);
        }
      } catch { /* sauvegarde illisible : on repart des valeurs par défaut */ }
      if (!cancelled) { loaded.current = true; if (onLoad) onLoad(); }
    })();
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(async () => {
      const mine = ++seq.current;
      const snap = snapshot(state);
      const useIdb = await idb.current;
      const { json, blobs: found, refs } = useIdb ? blobs.externalize(snap, cache.current) : { json: JSON.stringify(snap), blobs: new Map(), refs: new Set() };
      if (json === last.current) return;
      try {
        if (found.size) await blobs.putMany([...found]);
        if (mine !== seq.current) return; // un enregistrement plus récent a pris le relais
        localStorage.setItem(key, json);
        last.current = json;
        warned.current = false;
        if (useIdb) blobs.prune(refs).catch(() => {});
      } catch (e) {
        if (!warned.current && onError) { warned.current = true; onError(e); }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [key, state]); // eslint-disable-line react-hooks/exhaustive-deps
}
