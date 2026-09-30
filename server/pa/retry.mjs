// Politique de nouvel essai (§ 4.2) : erreur réseau, 408, 429 ou 5xx → nouvel essai ; autre 4xx → jamais.
export const MAX_TRIES = 8;
const BASE = 2000, CAP = 5 * 60_000;

export const retryable = status => status === 0 || status === 408 || status === 429 || status >= 500;

// Délai exponentiel (2 s, 4 s, 8 s… plafond 5 min) avec variation aléatoire ; Retry-After est un minimum.
export function nextDelay(tries, retryAfterHeader, rand = Math.random) {
  const exp = Math.min(CAP, BASE * 2 ** Math.max(0, tries - 1));
  const jittered = Math.round(exp / 2 + rand() * exp / 2);
  const ra = parseRetryAfter(retryAfterHeader);
  return Math.max(jittered, ra ?? 0);
}

export function parseRetryAfter(v, now = Date.now()) {
  if (v == null || v === '') return null;
  if (/^\d+$/.test(String(v).trim())) return +v * 1000;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : Math.max(0, t - now);
}
