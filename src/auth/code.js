// Codes d'accès (Code patron, Codes salariés) côté app : 6 chiffres, jamais enregistrés en clair.
// L'empreinte (PBKDF2-SHA-256, sel aléatoire) évite seulement que le code s'affiche à qui lit le stockage du
// navigateur : 1 000 000 de combinaisons se parcourent vite. Le verrou ne protège pas les données (ADR 0001).
export const CODE_LEN = 6;
export const isCode = c => new RegExp(`^\\d{${CODE_LEN}}$`).test(String(c ?? ''));
// Codes trop évidents refusés pour le Code patron et jamais générés : 000000, 123456, 654321…
export const weakCode = c => /^(\d)\1+$/.test(c) || '01234567890'.includes(c) || '09876543210'.includes(c);

const ITER = 120_000;
const enc = new TextEncoder();
const toB64 = u8 => btoa(String.fromCharCode(...u8));
const fromB64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));

async function derive(code, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(code)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}

export async function hashCode(code) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${toB64(salt)}$${toB64(await derive(code, salt, ITER))}`;
}

export async function verifyCode(code, stored) {
  const [kind, iter, salt, hash] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || !isCode(code)) return false;
  const a = await derive(code, fromB64(salt), +iter), b = fromB64(hash);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// Nouveau code aléatoire à 6 chiffres, ni évident ni déjà pris (`taken(code)` → Promise<boolean>).
export async function newCode(taken = async () => false) {
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** CODE_LEN;
    const c = String(n).padStart(CODE_LEN, '0');
    if (!weakCode(c) && !(await taken(c))) return c;
  }
}
