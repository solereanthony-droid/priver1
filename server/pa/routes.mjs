// Routes HTTP de l'intégration PA : /api/session (et ses codes d'accès) et /api/pa/*.
// Toutes les routes PA exigent une session « patron » (salarié → 403), sauf le retour OAuth et les webhooks,
// protégés respectivement par le paramètre state (lié au vérificateur PKCE) et par la signature HMAC.
import { PaError } from './service.mjs';

const MAX_JSON = 256 * 1024, MAX_WEBHOOK = 64 * 1024;

function readRaw(req, max) {
  return new Promise((ok, ko) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size <= max) chunks.push(c); });
    req.on('end', () => size > max ? ko(new PaError(413, 'trop gros')) : ok(Buffer.concat(chunks)));
    req.on('error', ko);
  });
}

export function createPaRoutes({ service, sessions, send, sameOrigin, secureCookie, clientIp, appUrl = '/' }) {
  const out = (res, status, obj, headers) => send(res, status, JSON.stringify(obj), 'application/json', headers);

  async function readJson(req) {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new PaError(415, 'JSON attendu');
    const raw = await readRaw(req, MAX_JSON);
    try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { throw new PaError(400, 'JSON invalide'); }
  }

  function owner(req) {
    const s = sessions.get(req);
    if (!s) throw new PaError(401, 'Connexion à l’app requise.');
    if (s.role !== 'owner') throw new PaError(403, 'Accès réservé au responsable de l’entreprise.');
    return s;
  }

  const hhmm = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const tooMany = r => r.retryAt ? `Trop d’essais : accès bloqué jusqu’à ${hhmm(r.retryAt)}.` : 'Trop d’essais : patiente une minute.';

  const idemKey = req => {
    const k = String(req.headers['idempotency-key'] || '');
    if (k && !/^[A-Za-z0-9_-]{16,100}$/.test(k)) throw new PaError(400, 'Clé d’idempotence invalide.');
    return k || null;
  };

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
    try {
      if (m === 'POST' && !sameOrigin(req) && p !== '/api/pa/webhook') throw new PaError(403, 'origine refusée');

      // ── Session et codes d'accès (server/auth.mjs) ──
      if (p === '/api/session') {
        if (m === 'POST') {
          if (!sessions.enabled) throw new PaError(503, 'Codes d’accès non configurés sur le serveur.');
          const { code } = await readJson(req), r = await sessions.login(String(code || ''), clientIp(req));
          if (r.status !== 200) throw new PaError(r.status, r.status === 429 ? tooMany(r) : 'Code incorrect.');
          return out(res, 200, { role: r.role, staffId: r.staffId }, { 'Set-Cookie': sessions.cookie(r.id, secureCookie(req)) });
        }
        if (m === 'GET') { const s = sessions.get(req); return s ? out(res, 200, { role: s.role, staffId: s.staffId }) : out(res, 401, { error: 'non connecté' }); }
        if (m === 'DELETE') { sessions.logout(req); return out(res, 200, {}, { 'Set-Cookie': sessions.cookie('x', secureCookie(req), 0) }); }
        throw new PaError(405, 'méthode');
      }
      // Changer le Code patron : { old, code }. Les autres sessions sont fermées.
      if (p === '/api/session/owner-code') {
        if (m !== 'POST') throw new PaError(405, 'méthode');
        const s = owner(req), { old, code } = await readJson(req);
        const r = await sessions.changeOwner(s, String(old || ''), String(code || ''), clientIp(req));
        if (r.status !== 200) throw new PaError(r.status, r.status === 429 ? tooMany(r) : r.error);
        return out(res, 200, { ok: true });
      }
      // Nouveau Code salarié : { id, name } → { code }, affiché une seule fois par l'app.
      if (p === '/api/session/staff-code') {
        if (m !== 'POST') throw new PaError(405, 'méthode');
        owner(req);
        const { id, name } = await readJson(req);
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(id || ''))) throw new PaError(400, 'Salarié inconnu.');
        return out(res, 200, { code: await sessions.newStaffCode(String(id), String(name || '')) });
      }

      // ── Webhook de la PA (signé) ──
      if (p === '/api/pa/webhook') {
        if (m !== 'POST') throw new PaError(405, 'méthode');
        if (!service) throw new PaError(503, 'PA non configurée');
        const raw = await readRaw(req, MAX_WEBHOOK);
        await service.webhook(raw, req.headers);
        out(res, 202, { ok: true });
        service.tick().catch(() => {});                          // traitement après la réponse
        return;
      }

      // ── Retour OAuth2 (navigateur redirigé par la PA) ──
      if (p === '/api/pa/callback') {
        if (!service) throw new PaError(503, 'PA non configurée');
        let ok = false;
        if (url.searchParams.get('code')) { try { await service.finishConnect(url.searchParams.get('state'), url.searchParams.get('code')); ok = true; } catch { ok = false; } }
        res.writeHead(302, { Location: `${appUrl}?pa=${ok ? 'connecte' : 'erreur'}`, 'Cache-Control': 'no-store' });
        return res.end();
      }

      if (!p.startsWith('/api/pa/')) throw new PaError(404, 'introuvable');
      // Public : l'app sait si une plateforme est configurée (sinon, mode démo) et si une session est ouverte.
      if (p === '/api/pa/config' && m === 'GET') { const ss = sessions.get(req); return out(res, 200, { configured: !!service, sessions: sessions.enabled, role: ss ? ss.role : null, staffId: ss ? ss.staffId : null }); }
      const s = owner(req);
      if (!service) throw new PaError(503, 'Plateforme agréée non configurée sur le serveur.');
      const t = s.tenantId;

      if (p === '/api/pa/status' && m === 'GET') return out(res, 200, service.status(t));
      if (p === '/api/pa/connect' && m === 'POST') return out(res, 200, service.startConnect(t));
      if (p === '/api/pa/disconnect' && m === 'POST') { await service.disconnect(t); return out(res, 200, service.status(t)); }
      if (p === '/api/pa/invoices' && m === 'GET') return out(res, 200, { invoices: service.invoices(t) });
      if (p === '/api/pa/invoices' && m === 'POST') {
        const { invoice } = await readJson(req), v = await service.submit(t, invoice, idemKey(req));
        service.tick().catch(() => {});
        return out(res, 202, v);
      }
      let mm;
      if ((mm = p.match(/^\/api\/pa\/invoices\/(FAC-\d{4}-\d{3,})\/payments$/)) && m === 'POST') {
        const { amount, date } = await readJson(req), v = await service.recordPayment(t, mm[1], amount, date, idemKey(req));
        service.tick().catch(() => {});
        return out(res, 202, v);
      }
      throw new PaError(404, 'introuvable');
    } catch (e) {
      const status = e instanceof PaError ? e.status : 500;
      if (status >= 500 && !(e instanceof PaError)) console.error('[api/pa]', e.message);
      out(res, status, { error: status >= 500 && !(e instanceof PaError) ? 'erreur serveur' : e.message, ...(e.errors ? { errors: e.errors } : {}) });
    }
  }
  return { handle };
}
