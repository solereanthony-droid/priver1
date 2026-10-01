// Sessions de l'app : un Code patron (toutes les fonctions) et un Code salarié par salarié (son pointage seul,
// pas d'accès PA). Codes à 6 chiffres, jamais conservés en clair : seules leurs empreintes scrypt sont gardées,
// dans un fichier JSON (server/data/auth.json, 0600). APP_OWNER_CODE ne sert qu'à fixer le Code patron au premier
// démarrage ; ensuite, le patron le change dans l'app (ADR 0002).
// Cookie de session HttpOnly, SameSite=Strict, Secure en HTTPS. Sessions en mémoire (reconnexion après redémarrage).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { admit, fail, pass, freshGuard } from '../src/auth/lockout.js';

const SID = 'btp_sid', TTL = 30 * 24 * 3600 * 1000;
const scrypt = promisify(crypto.scrypt);
const N = 2 ** 14, R = 8, P = 1;
export const isCode = c => /^\d{6}$/.test(String(c ?? ''));
const weak = c => /^(\d)\1+$/.test(c) || '01234567890'.includes(c) || '09876543210'.includes(c);

async function hash(code) {
  const salt = crypto.randomBytes(16), h = await scrypt(String(code), salt, 32, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${h.toString('base64')}`;
}
async function verify(code, stored) {
  const [kind, n, r, p, salt, h] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !isCode(code)) return false;
  const want = Buffer.from(h, 'base64'), got = await scrypt(String(code), Buffer.from(salt, 'base64'), want.length, { N: +n, r: +r, p: +p });
  return crypto.timingSafeEqual(got, want);
}

// Fichier des empreintes : { owner: 'scrypt$…', staff: { <id>: { hash, name, at } } }, écrit de façon atomique.
function fileStore(file) {
  let data = { owner: '', staff: {} }, chain = Promise.resolve();
  if (file && fs.existsSync(file)) data = { owner: '', staff: {}, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  const save = () => {
    if (!file) return chain;
    chain = chain.then(async () => {
      await fs.promises.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const tmp = file + '.' + process.pid + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(data), { mode: 0o600 });
      await fs.promises.rename(tmp, file);
    });
    return chain;
  };
  return { data, save };
}

// À appeler au démarrage. Le serveur refuse de démarrer si APP_OWNER_CODE doit servir et ne fait pas 6 chiffres.
export async function createSessions({ ownerCode = '', file = null, tenantId = 'default', now = Date.now } = {}) {
  const store = fileStore(file), sessions = new Map();
  let guard = freshGuard();
  if (!store.data.owner && ownerCode) {
    if (!isCode(ownerCode)) throw new Error('APP_OWNER_CODE doit faire exactement 6 chiffres.');
    if (weak(ownerCode)) throw new Error('APP_OWNER_CODE est trop évident (000000, 123456…) : choisis un autre code à 6 chiffres.');
    store.data.owner = await hash(ownerCode);
    await store.save();
  }

  // Code saisi → { role, staffId } ou null. Toutes les empreintes sont vérifiées en parallèle.
  async function match(code) {
    if (!isCode(code)) return null;
    const staff = Object.entries(store.data.staff);
    const [own, ...st] = await Promise.all([verify(code, store.data.owner), ...staff.map(([, s]) => verify(code, s.hash))]);
    if (own) return { role: 'owner', staffId: null };
    const i = st.indexOf(true);
    return i >= 0 ? { role: 'staff', staffId: staff[i][0] } : null;
  }

  // Essai de code soumis au blocage (limite par IP et blocage progressif global).
  async function attempt(code, ip) {
    const a = admit(guard, now(), ip); guard = a.g;
    if (a.blocked) return { status: 429, retryAt: a.blocked.global ? a.blocked.until : 0 };
    const who = await match(String(code ?? ''));
    guard = who ? pass(guard) : fail(guard, now());
    return who ? { status: 200, ...who } : { status: 401 };
  }

  async function login(code, ip) {
    const r = await attempt(code, ip);
    if (r.status !== 200) return r;
    const id = crypto.randomBytes(32).toString('base64url');
    sessions.set(id, { role: r.role, staffId: r.staffId, tenantId, exp: now() + TTL });
    return { status: 200, id, role: r.role, staffId: r.staffId };
  }

  function get(req) {
    const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${SID}=([A-Za-z0-9_-]{20,})`));
    const s = m && sessions.get(m[1]);
    if (!s) return null;
    if (s.exp < now()) { sessions.delete(m[1]); return null; }
    return { ...s, id: m[1] };
  }

  const drop = keep => { for (const [id, s] of sessions) if (keep(id, s) === false) sessions.delete(id); };

  // Changer le Code patron : l'ancien code compte comme un essai. Ferme toutes les autres sessions.
  async function changeOwner(session, oldCode, code, ip) {
    if (!isCode(code)) return { status: 400, error: 'Le nouveau code doit faire 6 chiffres.' };
    if (weak(code)) return { status: 400, error: 'Code trop évident : choisis-en un autre.' };
    const r = await attempt(oldCode, ip);
    if (r.status === 429) return r;
    if (r.status !== 200 || r.role !== 'owner') return { status: 401, error: 'Code patron actuel incorrect.' };
    if ((await match(code))?.role === 'staff') return { status: 409, error: 'Ce code est déjà celui d’un salarié : choisis-en un autre.' };
    store.data.owner = await hash(code);
    await store.save();
    drop(id => id === session.id);
    return { status: 200 };
  }

  // Nouveau Code salarié, généré ici et renvoyé une seule fois. Ferme les sessions de ce salarié.
  async function newStaffCode(staffId, name = '') {
    let code;
    do code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    while (weak(code) || await match(code));
    store.data.staff[staffId] = { hash: await hash(code), name: String(name).slice(0, 80), at: new Date(now()).toISOString() };
    await store.save();
    drop((id, s) => s.staffId !== staffId);
    return code;
  }

  const cookie = (id, secure, maxAgeMs = TTL) => `${SID}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure ? '; Secure' : ''}`;
  const logout = req => { const s = get(req); if (s) sessions.delete(s.id); };

  return { login, get, logout, cookie, changeOwner, newStaffCode, flush: () => store.save(), get enabled() { return !!store.data.owner; } };
}
