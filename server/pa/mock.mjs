// PA simulée (tests et démonstration locale, PA_PROVIDER=mock) : même interface HTTP que l'adaptateur XP Z12-013.
// OAuth2 avec PKCE, dépôts idempotents, cycle de vie, annuaire, pannes et réponses programmables, webhooks signés.
import http from 'node:http';
import crypto from 'node:crypto';
import { hmac } from './crypto.mjs';

export async function startMockPa({ clientId = 'app', clientSecret = 'secret', reachable = () => true } = {}) {
  const codes = new Map(), refresh = new Map(), access = new Map(), flows = new Map(), byIdem = new Map();
  const script = [];                                   // réponses forcées pour les prochains dépôts : { status, retryAfter }
  const calls = { submit: 0, idemKeys: [], lifecycle: [], directory: 0, token: 0 };
  let seq = 0;

  const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(body ? JSON.stringify(body) : ''); };
  const read = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
  const authed = req => access.has(String(req.headers.authorization || '').replace(/^Bearer /, ''));
  const basic = req => req.headers.authorization === 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const issue = () => { const a = crypto.randomBytes(16).toString('hex'), r = crypto.randomBytes(16).toString('hex'); access.set(a, 1); refresh.set(r, 1); return { access_token: a, refresh_token: r, expires_in: 3600, token_type: 'Bearer' }; };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'), body = await read(req);
    if (url.pathname === '/oauth/authorize') {
      // Consentement automatique : renvoie le code sur l'URL de retour.
      const code = crypto.randomBytes(12).toString('hex');
      codes.set(code, { challenge: url.searchParams.get('code_challenge'), redirect: url.searchParams.get('redirect_uri') });
      const back = new URL(url.searchParams.get('redirect_uri'));
      back.searchParams.set('code', code); back.searchParams.set('state', url.searchParams.get('state'));
      res.writeHead(302, { Location: back.toString() }); return res.end();
    }
    if (url.pathname === '/oauth/token') {
      calls.token++;
      if (!basic(req)) return json(res, 401, { error: 'invalid_client' });
      const p = new URLSearchParams(body.toString());
      if (p.get('grant_type') === 'authorization_code') {
        const c = codes.get(p.get('code')); codes.delete(p.get('code'));
        const ok = c && crypto.createHash('sha256').update(p.get('code_verifier') || '').digest('base64url') === c.challenge;
        return ok ? json(res, 200, issue()) : json(res, 400, { error: 'invalid_grant' });
      }
      if (p.get('grant_type') === 'refresh_token') {
        if (!refresh.has(p.get('refresh_token'))) return json(res, 400, { error: 'invalid_grant' });
        refresh.delete(p.get('refresh_token'));
        return json(res, 200, issue());
      }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }
    if (url.pathname === '/oauth/revoke') { refresh.delete(new URLSearchParams(body.toString()).get('token')); return json(res, 200); }
    if (!authed(req)) return json(res, 401, { error: 'unauthorized' });

    let m;
    if ((m = url.pathname.match(/^\/v1\/directory\/siren\/(\d{9})$/))) {
      calls.directory++;
      return reachable(m[1]) ? json(res, 200, { reachable: true, platform: 'PA du client' }) : json(res, 404, { error: 'not_found' });
    }
    if (url.pathname === '/v1/flows' && req.method === 'POST') {
      calls.submit++;
      calls.idemKeys.push(req.headers['idempotency-key']);
      const forced = script.shift();
      if (forced) return json(res, forced.status, forced.body || { error: 'forced' }, forced.retryAfter != null ? { 'Retry-After': String(forced.retryAfter) } : {});
      const idem = req.headers['idempotency-key'];
      if (idem && byIdem.has(idem)) return json(res, 200, flows.get(byIdem.get(idem)).out);
      const text = body.toString('latin1');
      if (!/multipart\/form-data/.test(req.headers['content-type'] || '') || !/CrossIndustryInvoice/.test(text)) return json(res, 400, { errors: ['Fichier illisible'] });
      const flowId = 'F' + (++seq), out = { flowId, status: 200 };
      flows.set(flowId, { history: [{ code: 200, at: new Date().toISOString() }], out, file: text });
      if (idem) byIdem.set(idem, flowId);
      return json(res, 200, out);
    }
    if ((m = url.pathname.match(/^\/v1\/flows\/([^/]+)$/)) && req.method === 'GET') {
      const f = flows.get(m[1]);
      return f ? json(res, 200, { flowId: m[1], history: f.history }) : json(res, 404, {});
    }
    if ((m = url.pathname.match(/^\/v1\/flows\/([^/]+)\/lifecycle$/)) && req.method === 'POST') {
      const f = flows.get(m[1]);
      if (!f) return json(res, 404, {});
      const idem = req.headers['idempotency-key'], payload = JSON.parse(body.toString() || '{}');
      if (!calls.lifecycle.some(l => l.idem === idem)) { calls.lifecycle.push({ flowId: m[1], idem, ...payload }); f.history.push({ code: payload.code, at: new Date().toISOString() }); }
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/v1/flows/search') return json(res, 200, { flows: [] });
    json(res, 404, {});
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base, calls, flows,
    config: { name: 'PA de test', baseUrl: base, tokenUrl: base + '/oauth/token', authorizeUrl: base + '/oauth/authorize', revokeUrl: base + '/oauth/revoke', clientId, clientSecret, allowHttpLocalhost: true },
    // Consentement simulé : suit l'URL d'autorisation et renvoie { code, state } comme le ferait la redirection.
    async consent(authorizeUrl) {
      const r = await fetch(authorizeUrl, { redirect: 'manual' }), loc = new URL(r.headers.get('location'));
      return { code: loc.searchParams.get('code'), state: loc.searchParams.get('state') };
    },
    failNext: (...list) => script.push(...list),
    setStatus(flowId, code, reason) { flows.get(flowId).history.push({ code, at: new Date().toISOString(), reason }); },
    revokeAll() { refresh.clear(); access.clear(); },
    expireAccess() { access.clear(); },
    signedWebhook(secret, event, ts = Math.floor(Date.now() / 1000)) {
      const raw = Buffer.from(JSON.stringify(event));
      return { raw, headers: { 'x-timestamp': String(ts), 'x-signature': 'sha256=' + hmac(secret, String(ts), raw) } };
    },
    close: () => new Promise(r => server.close(r)),
  };
}
