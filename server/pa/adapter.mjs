// Adaptateur « API XP Z12-013 » générique (briques Flux et Annuaire, OAuth2).
// Interface commune à tous les adaptateurs (un par PA) :
//   authorizeUrl({ state, challenge })        URL de consentement OAuth2 (authorization_code + PKCE)
//   exchangeCode(code, verifier)              → { access_token, refresh_token, expires_in }
//   refresh(refreshToken)                     → idem ; lève { reauth: true } si le jeton est révoqué ou expiré
//   revoke(refreshToken)
//   lookupRecipient(ctx, siren)               → { reachable, platform }
//   submitInvoice(ctx, file, meta, idemKey)   → { status, flowId, code, errors, retryAfter }
//   getStatus(ctx, flowId)                    → { history: [{ code, at, reason }] }
//   postLifecycle(ctx, flowId, code, payload, idemKey) → { status }
//   listInbound(ctx, since)                   → { flows: [...] }
// ctx = { tenantId, correlationId, token }.
// Les chemins par défaut suivent la structure de l'API AFNOR ; ils se règlent par variables d'environnement
// car chaque PA publie sa propre documentation (à vérifier dans son bac à sable).
export const DEFAULT_PATHS = {
  flows: '/v1/flows',
  flow: '/v1/flows/{flowId}',
  lifecycle: '/v1/flows/{flowId}/lifecycle',
  search: '/v1/flows/search',
  directory: '/v1/directory/siren/{siren}',
};

export class PaHttpError extends Error {
  constructor(status, msg, extra = {}) { super(msg); this.status = status; Object.assign(this, extra); }
}

export function createXpZ12Adapter(cfg, { fetchImpl = fetch, log = () => {} } = {}) {
  const paths = { ...DEFAULT_PATHS, ...(cfg.paths || {}) };
  const allowed = new Set([cfg.baseUrl, cfg.tokenUrl, cfg.authorizeUrl, cfg.revokeUrl].filter(Boolean).map(u => new URL(u).host));

  // Toute requête sortante : hôte en liste blanche, HTTPS (sauf localhost en test), délai de 30 s, corrélation.
  async function call(url, { method = 'GET', headers = {}, body, ctx = {}, timeoutMs = 30_000 } = {}) {
    const u = new URL(url);
    if (!allowed.has(u.host)) throw new PaHttpError(0, 'hôte PA non autorisé');
    if (u.protocol !== 'https:' && !(cfg.allowHttpLocalhost && ['localhost', '127.0.0.1'].includes(u.hostname))) throw new PaHttpError(0, 'HTTPS obligatoire');
    const ctrl = new AbortController(), t0 = Date.now(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(u, { method, headers: { 'X-Correlation-Id': ctx.correlationId || '', ...headers }, body, signal: ctrl.signal, redirect: 'error' });
      log({ event: 'pa.http', tenantId: ctx.tenantId, correlationId: ctx.correlationId, http: res.status, durationMs: Date.now() - t0 });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      return { status: res.status, headers: res.headers, json };
    } catch (e) {
      log({ event: 'pa.http', tenantId: ctx.tenantId, correlationId: ctx.correlationId, http: 0, durationMs: Date.now() - t0, error: e.name === 'AbortError' ? 'délai dépassé' : e.message });
      if (e instanceof PaHttpError) throw e;
      return { status: 0, headers: new Headers(), json: null };                      // erreur réseau : nouvel essai possible
    } finally { clearTimeout(timer); }
  }

  const api = (p, vars = {}) => cfg.baseUrl.replace(/\/$/, '') + p.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k]));
  const bearer = ctx => ({ Authorization: 'Bearer ' + ctx.token });
  const form = obj => new URLSearchParams(Object.entries(obj).filter(([, v]) => v != null));

  async function token(params) {
    const r = await call(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64') }, body: form(params) });
    if (r.status === 200 && r.json?.access_token) return r.json;
    const reauth = r.status === 400 || r.status === 401;                                // invalid_grant : jeton révoqué ou expiré
    throw new PaHttpError(r.status, 'échec OAuth2', { reauth, error: r.json?.error });
  }

  return {
    name: cfg.name || 'PA',
    authorizeUrl({ state, challenge }) {
      const u = new URL(cfg.authorizeUrl);
      Object.entries({ response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: cfg.scope || 'flows directory', state, code_challenge: challenge, code_challenge_method: 'S256' })
        .forEach(([k, v]) => u.searchParams.set(k, v));
      return u.toString();
    },
    exchangeCode: (code, verifier) => token({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, code_verifier: verifier }),
    refresh: refreshToken => token({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    async revoke(refreshToken) {
      if (!cfg.revokeUrl) return;
      await call(cfg.revokeUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64') }, body: form({ token: refreshToken, token_type_hint: 'refresh_token' }) });
    },
    async lookupRecipient(ctx, siren) {
      const r = await call(api(paths.directory, { siren }), { headers: bearer(ctx), ctx });
      if (r.status === 404) return { reachable: false };
      if (r.status !== 200) throw new PaHttpError(r.status, 'annuaire indisponible');
      return { reachable: r.json?.reachable !== false, platform: r.json?.platform || null };
    },
    async submitInvoice(ctx, file, meta, idemKey) {
      const fd = new FormData();
      fd.set('flowInfo', new Blob([JSON.stringify({ trackingId: meta.invoiceNo, name: meta.fileName, flowSyntax: meta.syntax, flowProfile: 'EN16931', sha256: meta.sha256 })], { type: 'application/json' }));
      fd.set('file', new Blob([file], { type: meta.mime }), meta.fileName);
      const r = await call(api(paths.flows), { method: 'POST', headers: { ...bearer(ctx), 'Idempotency-Key': idemKey }, body: fd, ctx });
      return { status: r.status, flowId: r.json?.flowId || null, code: r.json?.status ?? null, errors: r.json?.errors || [], reason: r.json?.reason || null, retryAfter: r.headers.get('retry-after') };
    },
    async getStatus(ctx, flowId) {
      const r = await call(api(paths.flow, { flowId }), { headers: bearer(ctx), ctx });
      if (r.status !== 200) throw new PaHttpError(r.status, 'relève impossible');
      return { history: (r.json?.history || []).map(h => ({ code: +h.code, at: h.at, reason: h.reason || null })) };
    },
    async postLifecycle(ctx, flowId, code, payload, idemKey) {
      const r = await call(api(paths.lifecycle, { flowId }), { method: 'POST', headers: { ...bearer(ctx), 'Content-Type': 'application/json', 'Idempotency-Key': idemKey }, body: JSON.stringify({ code, ...payload }), ctx });
      return { status: r.status, retryAfter: r.headers.get('retry-after'), errors: r.json?.errors || [] };
    },
    async listInbound(ctx, since) {
      const r = await call(api(paths.search), { method: 'POST', headers: { ...bearer(ctx), 'Content-Type': 'application/json' }, body: JSON.stringify({ direction: 'In', updatedAfter: since }), ctx });
      if (r.status !== 200) throw new PaHttpError(r.status, 'recherche impossible');
      return { flows: r.json?.flows || [] };
    },
  };
}
