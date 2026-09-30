// Stockage des gros contenus (images et PDF importés, en data: URL) dans IndexedDB.
// localStorage est limité à ~5 Mo par site : deux plans importés suffisaient à le saturer,
// et plus rien n'était enregistré. Ici, seules des références courtes restent dans localStorage.

const DB = 'btp974', STORE = 'blobs';
export const REF = 'btp-idb:';
export const MIN_SIZE = 16 * 1024; // en dessous, la donnée reste dans le JSON

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((ok, ko) => {
      if (typeof indexedDB === 'undefined') return ko(new Error('IndexedDB indisponible'));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ko(req.error);
      req.onblocked = () => ko(new Error('IndexedDB bloquée'));
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((ok, ko) => {
    const t = d.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
    t.oncomplete = () => ok(out && 'result' in out ? out.result : undefined);
    t.onerror = t.onabort = () => ko(t.error || new Error('transaction annulée'));
  });
};

export const available = () => db().then(() => true, () => false);

export async function putMany(entries) {
  if (!entries.length) return;
  await tx('readwrite', st => { entries.forEach(([k, v]) => st.put(v, k)); });
}

export async function getMany(keys) {
  const out = new Map();
  if (!keys.length) return out;
  await tx('readonly', st => {
    keys.forEach(k => { const r = st.get(k); r.onsuccess = () => { if (r.result !== undefined) out.set(k, r.result); }; });
  });
  return out;
}

export async function keys() {
  return (await tx('readonly', st => st.getAllKeys())) || [];
}

// Supprime les contenus qui ne sont plus référencés (plan supprimé, fond remplacé…).
export async function prune(keep) {
  const all = await keys(), drop = all.filter(k => !keep.has(k));
  if (drop.length) await tx('readwrite', st => { drop.forEach(k => st.delete(k)); });
  return drop.length;
}

// Empreinte FNV-1a 53 bits du contenu : même image → même clé (pas de doublon).
export function hashKey(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) + s.length.toString(36);
}

// Remplace les gros data: URL par des références ; renvoie le JSON et les contenus à stocker.
export function externalize(value, cache = new Map()) {
  const blobs = new Map(), refs = new Set();
  const json = JSON.stringify(value, (_, v) => {
    if (typeof v !== 'string' || v.length < MIN_SIZE || !v.startsWith('data:')) return v;
    let k = cache.get(v);
    if (!k) { k = hashKey(v); cache.set(v, k); }
    blobs.set(k, v);
    refs.add(k);
    return REF + k;
  });
  return { json, blobs, refs };
}

// Remet les contenus à la place des références (une référence introuvable devient une chaîne vide).
export function refsIn(value, acc = new Set()) {
  if (typeof value === 'string') { if (value.startsWith(REF)) acc.add(value.slice(REF.length)); }
  else if (value && typeof value === 'object') Object.values(value).forEach(v => refsIn(v, acc));
  return acc;
}

export function hydrate(value, found) {
  if (typeof value === 'string') return value.startsWith(REF) ? found.get(value.slice(REF.length)) || '' : value;
  if (Array.isArray(value)) return value.map(v => hydrate(v, found));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, hydrate(v, found)]));
  return value;
}
