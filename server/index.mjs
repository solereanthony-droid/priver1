// Petit serveur : sert l'app construite (dist/) et relaie les appels IA vers l'API Claude.
// La clé (ANTHROPIC_API_KEY) ne quitte jamais le serveur.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist');
const PORT = +process.env.PORT || 8787;
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };

let client = null;
const claude = () => (client ??= new Anthropic());

async function complete(body) {
  const { system, messages, max_tokens } = body || {};
  if (!Array.isArray(messages) || !messages.length) throw Object.assign(new Error('messages manquants'), { status: 400 });
  const res = await claude().beta.messages.create({
    model: MODEL,
    max_tokens: Math.min(+max_tokens || 1000, 4000),
    system: typeof system === 'string' ? system : undefined,
    messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') })),
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  if (res.stop_reason === 'refusal') throw Object.assign(new Error('refus'), { status: 502 });
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function readBody(req) {
  return new Promise((ok, ko) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 64e3) { ko(Object.assign(new Error('trop gros'), { status: 413 })); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ko(Object.assign(new Error('JSON invalide'), { status: 400 })); } });
  });
}

function serveStatic(req, res) {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(DIST, url));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end('Lancer « npm run build » d’abord.'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  if (req.url === '/api/complete' && req.method === 'POST') {
    try {
      const text = await complete(await readBody(req));
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ text }));
    } catch (e) {
      console.error('[api/complete]', e.status || '', e.message);
      res.writeHead(e.status && e.status < 500 ? e.status : 502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'IA indisponible' }));
    }
    return;
  }
  serveStatic(req, res);
}).listen(PORT, () => console.log(`Chiffrage BTP 974 → http://localhost:${PORT} (modèle ${MODEL})`));
