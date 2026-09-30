// Primitives de sécurité de l'intégration PA : chiffrement au repos, PKCE, signatures, empreintes.
import crypto from 'node:crypto';

// Clé AES-256 (32 octets, base64) fournie par l'environnement (coffre), jamais stockée dans le dépôt.
export function loadKey(b64) {
  if (!b64) throw new Error('PA_ENC_KEY manquante : génère-la avec « openssl rand -base64 32 »');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('PA_ENC_KEY doit faire 32 octets (base64)');
  return key;
}

// AES-256-GCM : iv aléatoire de 12 octets, étiquette d'authentification vérifiée au déchiffrement.
export function seal(key, plain, aad = '') {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const body = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

export function open(key, sealed, aad = '') {
  const [v, iv, tag, body] = String(sealed).split('.');
  if (v !== 'v1') throw new Error('format chiffré inconnu');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64')), d.final()]).toString('utf8');
}

const b64url = buf => buf.toString('base64url');
export const randomToken = (n = 32) => b64url(crypto.randomBytes(n));
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

// PKCE (RFC 7636) : vérificateur aléatoire, défi S256.
export function pkcePair() {
  const verifier = randomToken(48);
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) };
}

// Signature HMAC-SHA256 des webhooks : « horodatage.corps brut », comparaison à temps constant.
export const hmac = (secret, timestamp, rawBody) =>
  crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');

export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8'), y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
