// Sessions de l'app : un code d'accès « patron » (toutes les fonctions) et un code « salarié » (pas d'accès PA).
// Cookie de session HttpOnly, SameSite=Strict, Secure en HTTPS. Sessions en mémoire (reconnexion après redémarrage).
import crypto from 'node:crypto';

const SID = 'btp_sid', TTL = 30 * 24 * 3600 * 1000, TRIES = 5;

export function createSessions({ ownerCode = '', staffCode = '', tenantId = 'default', now = Date.now } = {}) {
  const sessions = new Map(), attempts = new Map();
  const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  function login(code, ip) {
    const list = (attempts.get(ip) || []).filter(t => now() - t < 60_000);
    if (list.length >= TRIES) return { status: 429 };
    list.push(now()); attempts.set(ip, list);
    const role = ownerCode && eq(code, ownerCode) ? 'owner' : staffCode && eq(code, staffCode) ? 'staff' : null;
    if (!role) return { status: 401 };
    const id = crypto.randomBytes(32).toString('base64url');
    sessions.set(id, { role, tenantId, exp: now() + TTL });
    return { status: 200, id, role };
  }

  function get(req) {
    const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${SID}=([A-Za-z0-9_-]{20,})`));
    const s = m && sessions.get(m[1]);
    if (!s) return null;
    if (s.exp < now()) { sessions.delete(m[1]); return null; }
    return { ...s, id: m[1] };
  }

  const cookie = (id, secure, maxAgeMs = TTL) => `${SID}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure ? '; Secure' : ''}`;
  const logout = req => { const s = get(req); if (s) sessions.delete(s.id); };

  return { login, get, logout, cookie, enabled: !!(ownerCode || staffCode) };
}
