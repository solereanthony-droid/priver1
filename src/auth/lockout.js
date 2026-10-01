// Blocage après trop d'essais de code d'accès : mêmes règles sur le serveur (server/auth.mjs) et dans l'app sans
// serveur (écran de code, mode démo). État en JSON simple, pour être enregistré dans la sauvegarde locale.
// - 5 essais par minute et par origine (adresse IP sur le serveur, l'appareil dans l'app) ;
// - 10 échecs d'affilée, toutes origines confondues : blocage de 15 min, puis 30, 60… jusqu'à 24 h.
//   Un code juste remet le compteur et la durée à zéro.
export const LOCKOUT = { PER_MIN: 5, FAILS: 10, BASE: 15 * 60_000, MAX: 24 * 3600_000 };

export const freshGuard = () => ({ fails: 0, level: 0, until: 0, tries: {} });

// Essai demandé à l'instant `now` depuis l'origine `key`. Renvoie le nouvel état et, si l'essai est refusé,
// `blocked` = { until, global } (global : blocage progressif ; sinon limite par minute).
export function admit(g = freshGuard(), now = Date.now(), key = '') {
  if (g.until > now) return { g, blocked: { until: g.until, global: true } };
  const tries = {};
  for (const [k, list] of Object.entries(g.tries || {})) { const recent = list.filter(t => now - t < 60_000); if (recent.length) tries[k] = recent; }
  const mine = tries[key] || [];
  if (mine.length >= LOCKOUT.PER_MIN) return { g: { ...g, tries }, blocked: { until: mine[0] + 60_000, global: false } };
  return { g: { ...g, tries: { ...tries, [key]: [...mine, now] } }, blocked: null };
}

export function fail(g, now = Date.now()) {
  const fails = (g.fails || 0) + 1;
  if (fails < LOCKOUT.FAILS) return { ...g, fails };
  const level = g.level || 0;
  return { ...g, fails: 0, level: level + 1, until: now + Math.min(LOCKOUT.MAX, LOCKOUT.BASE * 2 ** level) };
}

export const pass = g => ({ ...g, fails: 0, level: 0, until: 0 });

const hhmm = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const blockedMsg = b => b.global ? `Trop d’essais : accès bloqué jusqu’à ${hhmm(b.until)}` : 'Trop d’essais : patiente une minute';
