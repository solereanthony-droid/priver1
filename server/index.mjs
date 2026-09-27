// Petit serveur : sert l'app construite (dist/) et exécute les tâches IA via l'API Claude.
// La clé (ANTHROPIC_API_KEY) ne quitte jamais le serveur.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { buildTask, TaskError } from './prompts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist');
const PORT = +process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
const RATE_MAX = +process.env.AI_RATE_LIMIT || 20; // requêtes IA par minute et par adresse IP
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const MAX_BODY = 8 * 1024;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()',
};

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

let client = null;
const claude = () => (client ??= new Anthropic({ timeout: 40_000, maxRetries: 1 }));

// ── Limitation de débit (fenêtre glissante en mémoire) ────────────────────────
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX;
}
setInterval(() => { const now = Date.now(); for (const [ip, ts] of hits) if (!ts.some(t => now - t < 60_000)) hits.delete(ip); }, 60_000).unref();

const clientIp = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

// Refuse les appels venant d'une autre origine (un site tiers ne peut pas consommer le quota IA).
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

async function runTask(body) {
  const { task, params } = body || {};
  const t = buildTask(task, params);
  const res = await claude().beta.messages.create({
    model: MODEL,
    max_tokens: t.max_tokens,
    system: t.system,
    messages: [{ role: 'user', content: t.user }],
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  if (res.stop_reason === 'refusal') throw new HttpError(502, 'refus');
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function readJson(req) {
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return Promise.reject(new HttpError(415, 'JSON attendu'));
  return new Promise((ok, ko) => {
    let s = '', size = 0;
    req.setEncoding('utf8');
    req.on('data', c => { size += Buffer.byteLength(c); if (size > MAX_BODY) { s = ''; ko(new HttpError(413, 'trop gros')); } else s += c; }); // au-delà : lu puis jeté (requestTimeout borne la durée)
    req.on('end', () => { if (size > MAX_BODY) return; try { ok(JSON.parse(s || '{}')); } catch { ko(new HttpError(400, 'JSON invalide')); } });
    req.on('error', ko);
  });
}

const send = (res, status, body, type = 'application/json') => {
  if (res.headersSent) return;
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-store', ...(status === 413 ? { Connection: 'close' } : {}) });
  res.end(body);
};

async function handleAi(req, res) {
  if (req.method !== 'POST') return send(res, 405, JSON.stringify({ error: 'méthode' }));
  if (!sameOrigin(req)) return send(res, 403, JSON.stringify({ error: 'origine refusée' }));
  if (rateLimited(clientIp(req))) return send(res, 429, JSON.stringify({ error: 'trop de requêtes' }));
  try {
    const text = await runTask(await readJson(req));
    send(res, 200, JSON.stringify({ text }));
  } catch (e) {
    const status = e instanceof TaskError || e instanceof HttpError ? e.status : 502;
    if (status >= 500) console.error('[api/ai]', e.status || '', e.message);
    send(res, status, JSON.stringify({ error: status < 500 ? e.message : 'IA indisponible' }));
  }
}

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non autorisée', 'text/plain; charset=utf-8');
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, 'Requête invalide', 'text/plain; charset=utf-8'); }
  if (url.includes('\0')) return send(res, 400, 'Requête invalide', 'text/plain; charset=utf-8');
  let file = path.resolve(DIST, '.' + url);
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return send(res, 403, 'Interdit', 'text/plain; charset=utf-8');
  let st = fs.statSync(file, { throwIfNoEntry: false });
  if (!st || !st.isFile()) {
    if (path.extname(url)) return send(res, 404, 'Introuvable', 'text/plain; charset=utf-8');
    file = path.join(DIST, 'index.html');
    st = fs.statSync(file, { throwIfNoEntry: false });
    if (!st) return send(res, 404, 'Lancer « npm run build » d’abord.', 'text/plain; charset=utf-8');
  }
  const immutable = file.startsWith(path.join(DIST, 'assets') + path.sep);
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

const server = http.createServer((req, res) => {
  const route = req.url.split('?')[0];
  if (route === '/api/ai') handleAi(req, res).catch(e => { console.error(e); send(res, 500, '{}'); });
  else if (route.startsWith('/api/')) send(res, 404, JSON.stringify({ error: 'introuvable' }));
  else serveStatic(req, res);
});
server.headersTimeout = 10_000;
server.requestTimeout = 60_000;
server.listen(PORT, HOST, () => console.log(`Chiffrage BTP 974 → http://${HOST}:${PORT} (modèle ${MODEL})`));
