// Client de l'intégration PA côté app (window.btpPA). Parle uniquement à notre serveur (/api/pa/*) : aucune
// URL ni aucun secret de PA dans l'app. Les actions « Transmettre » et « Enregistrer l'encaissement » passent par
// une file IndexedDB (paQueue), rejouée dans l'ordre à la reconnexion et au démarrage, avec la même clé
// d'idempotence : un double clic ou un rejeu ne crée jamais deux dépôts.
import { withStore, STORES } from '../storage/db.js';

const Q = STORES.paQueue;
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const key = () => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')).replace(/-/g, '');

async function api(method, path, body, idem) {
  const r = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(idem ? { 'Idempotency-Key': idem } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* corps vide */ }
  return { status: r.status, data };
}

const all = () => withStore(Q, 'readonly', st => st.getAll()).then(list => (list || []).sort((a, b) => a.seq - b.seq));
const put = item => withStore(Q, 'readwrite', st => { st.put(item); });
const del = id => withStore(Q, 'readwrite', st => { st.delete(id); });

let flushing = null;
// Rejoue la file dans l'ordre. Erreur réseau, 429 ou 5xx : on s'arrête et on réessaiera ; autre 4xx : l'action est
// retirée et l'erreur signalée (contenu à corriger) ; 401 : session expirée, on garde la file.
export function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    if (!navigator.onLine) return;
    for (const item of await all()) {
      if (item.nextAt > Date.now()) break;
      let r;
      try { r = await api('POST', item.path, item.body, item.id); } catch { r = { status: 0 }; }
      if (r.status >= 200 && r.status < 300) { await del(item.id); emit('btp:pa-update', { no: item.no, invoice: r.data }); continue; }
      if (r.status === 0 || r.status === 401 || r.status === 408 || r.status === 429 || r.status >= 500) {
        item.tries = (item.tries || 0) + 1;
        item.nextAt = Date.now() + Math.min(300_000, 2000 * 2 ** (item.tries - 1));
        await put(item);
        if (r.status === 401) emit('btp:pa-error', { no: item.no, message: 'Session expirée : reconnecte-toi à l’app pour envoyer les factures en attente.' });
        break;
      }
      await del(item.id);
      emit('btp:pa-error', { no: item.no, message: r.data?.error || 'Envoi refusé.', errors: r.data?.errors || [] });
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

async function enqueue(kind, no, path, body) {
  const items = await all();
  const same = items.find(i => i.kind === kind && i.no === no && JSON.stringify(i.body) === JSON.stringify(body));
  if (same) return { queued: true, id: same.id };                 // déjà en attente : pas de doublon
  const item = { id: key(), seq: Date.now() + Math.random(), kind, no, path, body, tries: 0, nextAt: 0 };
  await put(item);
  emit('btp:pa-update', { no, queued: true });
  flush();
  return { queued: true, id: item.id };
}

export const btpPA = {
  session: () => api('GET', '/api/session'),
  login: code => api('POST', '/api/session', { code }),
  logout: () => api('DELETE', '/api/session'),
  changeOwnerCode: (old, code) => api('POST', '/api/session/owner-code', { old, code }),
  newStaffCode: (id, name) => api('POST', '/api/session/staff-code', { id, name }),
  async status() {
    if (!navigator.onLine) return { state: 'hors_ligne', queued: (await all()).length };
    const cfg = await api('GET', '/api/pa/config');
    if (cfg.status !== 200) throw new Error('serveur injoignable');
    if (cfg.status !== 200 || !cfg.data?.configured) return { state: 'non_configure' };
    if (cfg.data.role !== 'owner') return { state: 'non_connecte', error: cfg.data.role ? 'Accès réservé au responsable de l’entreprise.' : 'Connexion à l’app requise.' };
    const r = await api('GET', '/api/pa/status');
    return r.status === 200 ? { ...r.data, queued: r.data.queued + (await all()).length } : { state: r.status === 503 ? 'non_configure' : 'non_connecte', error: r.data?.error };
  },
  config: () => api('GET', '/api/pa/config'),
  async connect() {
    let r;
    try { r = await api('POST', '/api/pa/connect'); } catch { r = { status: 0 }; }
    if (r.status === 200 && r.data?.url) { location.assign(r.data.url); return r; }
    emit('btp:pa-error', { message: r.status === 503 ? 'Aucune plateforme agréée n’est configurée sur le serveur : connexion impossible (mode démo).'
      : r.status === 401 ? 'Connecte-toi à l’app avec ton code d’accès.' : r.status === 403 ? 'Réservé au responsable de l’entreprise.' : 'Connexion impossible pour le moment : réessaie.' });
    return r;
  },
  async disconnect() { const r = await api('POST', '/api/pa/disconnect').catch(() => ({ status: 0 })); emit('btp:pa-update', {}); return r; },
  invoices: () => api('GET', '/api/pa/invoices'),
  transmit: invoice => enqueue('submit', invoice.no, '/api/pa/invoices', { invoice }),
  recordPayment: (no, amount, date) => enqueue('payment', no, `/api/pa/invoices/${encodeURIComponent(no)}/payments`, { amount, date }),
  pending: async () => (await all()).map(({ id, kind, no, tries }) => ({ id, kind, no, tries })),
  flush,
};

export function installPaClient() {
  window.btpPA = btpPA;
  window.addEventListener('online', () => flush());
  flush().catch(() => {});
  setInterval(() => { flush().catch(() => {}); }, 60_000);
}
