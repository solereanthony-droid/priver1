// Base IndexedDB de l'app (« btp974 ») : gros contenus de la sauvegarde (v1) et file d'envoi vers la PA (v2).
const NAME = 'btp974', VERSION = 2;
export const STORES = { blobs: 'blobs', paQueue: 'paQueue' };

let dbp = null;
export function openDb() {
  if (!dbp) {
    dbp = new Promise((ok, ko) => {
      if (typeof indexedDB === 'undefined') return ko(new Error('IndexedDB indisponible'));
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.blobs)) db.createObjectStore(STORES.blobs);
        if (!db.objectStoreNames.contains(STORES.paQueue)) db.createObjectStore(STORES.paQueue, { keyPath: 'id' });
      };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); dbp = null; }; ok(req.result); };
      req.onerror = () => ko(req.error);
      req.onblocked = () => ko(new Error('IndexedDB bloquée'));
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

// Exécute fn(store) dans une transaction ; renvoie la valeur de la dernière requête, s'il y en a une.
export async function withStore(name, mode, fn) {
  const d = await openDb();
  return new Promise((ok, ko) => {
    const t = d.transaction(name, mode), out = fn(t.objectStore(name));
    t.oncomplete = () => ok(out && 'result' in out ? out.result : undefined);
    t.onerror = t.onabort = () => ko(t.error || new Error('transaction annulée'));
  });
}
