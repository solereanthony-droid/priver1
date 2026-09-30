// Service d'intégration avec la plateforme agréée (PA).
// Seul ce service fait avancer l'état des factures, d'après les réponses de la PA (dépôt, relève, webhooks).
// Les envois passent par une file persistante : idempotence, nouveaux essais espacés, reprise après redémarrage.
import crypto from 'node:crypto';
import { seal, open, sha256, pkcePair, randomToken, hmac, safeEqualHex } from './crypto.mjs';
import { PA_CODES, TERMINAL, canTransition, isDeposited, uiStatus } from './states.mjs';
import { MAX_TRIES, retryable, nextDelay } from './retry.mjs';
import { validateInvoice, buildCII, computeTotals, externalValidate } from './einvoice.mjs';

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const POLL_EVERY = 15 * MIN, POLL_MAX_AGE = 60 * DAY, LOOKUP_TTL = DAY, WEBHOOK_SKEW = 5 * MIN, AUTH_TTL = 10 * MIN;

export class PaError extends Error { constructor(status, msg, extra = {}) { super(msg); this.status = status; Object.assign(this, extra); } }

export function createPaService({ store, adapter, key, log = () => {}, now = Date.now, rand = Math.random, webhookSecret = '', validatorCmd = '', resubmitRejected = false, maxJobsPerTick = 5 }) {
  const tokens = new Map();                                        // jetons d'accès : mémoire uniquement
  const cid = () => crypto.randomUUID();
  const T = id => store.tenant(id);
  const save = () => store.save();
  const aad = tenantId => 'pa-token:' + tenantId;

  // ── Connexion OAuth2 (authorization_code + PKCE) ─────────────────────────────
  function startConnect(tenantId) {
    const { verifier, challenge } = pkcePair(), state = randomToken(24);
    T(tenantId).conn.pending = { state, verifier: seal(key, verifier, aad(tenantId)), exp: now() + AUTH_TTL };
    save();
    return { url: adapter.authorizeUrl({ state, challenge }) };
  }

  async function finishConnect(state, code) {
    const tenantId = store.tenants().find(id => T(id).conn.pending?.state === state && typeof state === 'string' && state.length > 20);
    if (!tenantId) throw new PaError(400, 'Demande de connexion inconnue ou expirée.');
    const c = T(tenantId).conn, p = c.pending;
    delete c.pending;
    if (p.exp < now()) { save(); throw new PaError(400, 'Demande de connexion expirée : recommence.'); }
    const tok = await adapter.exchangeCode(code, open(key, p.verifier, aad(tenantId)));
    storeTokens(tenantId, tok);
    Object.assign(c, { state: 'connecte', paName: adapter.name, connectedAt: now(), lastSync: null });
    log({ event: 'pa.connect', tenantId });
    await save();
    return tenantId;
  }

  function storeTokens(tenantId, tok) {
    tokens.set(tenantId, { access: tok.access_token, exp: now() + (+tok.expires_in || 300) * 1000 });
    if (tok.refresh_token) T(tenantId).conn.refresh = seal(key, tok.refresh_token, aad(tenantId));
  }

  async function disconnect(tenantId) {
    const c = T(tenantId).conn;
    if (c.refresh) { try { await adapter.revoke(open(key, c.refresh, aad(tenantId))); } catch { /* révocation au mieux */ } }
    tokens.delete(tenantId);
    T(tenantId).conn = { state: 'non_connecte' };
    log({ event: 'pa.disconnect', tenantId });
    await save();
  }

  // Jeton d'accès valide, renouvelé 60 s avant expiration. Échec de renouvellement → « reauth », la file est conservée.
  async function accessToken(tenantId) {
    const t = tokens.get(tenantId);
    if (t && t.exp - 60_000 > now()) return t.access;
    const c = T(tenantId).conn;
    if (!c.refresh || c.state === 'reauth' || c.state === 'non_connecte') return null;
    try {
      storeTokens(tenantId, await adapter.refresh(open(key, c.refresh, aad(tenantId))));
      return tokens.get(tenantId).access;
    } catch (e) {
      if (e.reauth) { c.state = 'reauth'; tokens.delete(tenantId); log({ event: 'pa.reauth', tenantId, http: e.status }); await save(); }
      return null;
    }
  }

  // ── Dépôt d'une facture ──────────────────────────────────────────────────────
  const view = inv => inv && ({
    no: inv.no, state: inv.state, status: uiStatus(inv.state), flowId: inv.flowId || null,
    errors: inv.errors || [], reason: inv.reason || null, lastCode: inv.history?.at(-1)?.code ?? null,
    depositedAt: inv.depositedAt || null, grand: inv.grand, paid: inv.paidTotal || 0,
    remaining: inv.grand != null ? Math.round((inv.grand - (inv.paidTotal || 0)) * 100) / 100 : null,
    queued: inv.state === 'en_file' || (inv.pendingLifecycle || 0) > 0,
  });

  function dedupeClientKey(t, clientKey, kind, no) {
    if (!clientKey) return null;
    const k = t.clientKeys[clientKey];
    if (k) return k.kind === kind && k.no === no ? k : Promise.reject(new PaError(409, 'Clé d’idempotence déjà utilisée pour une autre action.'));
    t.clientKeys[clientKey] = { kind, no, at: now() };
    return null;
  }

  async function submit(tenantId, invoice, clientKey) {
    const t = T(tenantId);
    const seen = await dedupeClientKey(t, clientKey, 'submit', invoice?.no);
    if (seen) return view(t.invoices[invoice.no]);                               // rejeu de la même action
    const errors = validateInvoice(invoice);
    if (errors.length) throw new PaError(422, 'Facture non conforme.', { errors });
    const xml = buildCII(invoice), ext = await externalValidate(validatorCmd, xml);
    if (!ext.ok) throw new PaError(422, 'Facture non conforme EN 16931.', { errors: ext.errors });
    const fileHash = sha256(xml), idemKey = sha256(`${tenantId}|${invoice.no}|${fileHash}`);
    const prev = t.invoices[invoice.no];
    if (prev) {
      if (prev.idemKey === idemKey && prev.state !== 'emise') return view(prev);           // double clic, rejeu : un seul dépôt
      if (prev.state === 'refusee') throw new PaError(409, 'Facture refusée par le client : émets une nouvelle facture (nouveau numéro).');
      if (prev.state === 'rejetee' && !resubmitRejected) throw new PaError(409, 'Facture rejetée : corrige-la et émets-la sous un nouveau numéro.');
      if (prev.state !== 'emise' && prev.state !== 'rejetee' && prev.state !== 'echec') throw new PaError(409, 'Ce numéro de facture est déjà déposé : un numéro ne peut jamais être réutilisé.');
    }
    const T0 = computeTotals(invoice), inv = t.invoices[invoice.no] = {
      ...(prev?.state === 'echec' ? prev : {}), no: invoice.no, state: 'emise', idemKey, fileHash, grand: T0.grand, buyerSiren: String(invoice.buyer.siren).replace(/\s/g, ''),
      createdAt: prev?.createdAt || now(), history: prev?.state === 'rejetee' ? [] : prev?.history || [], errors: [], payments: prev?.payments || [], paidTotal: prev?.paidTotal || 0,
      file: seal(key, xml, 'pa-file:' + tenantId + ':' + invoice.no),
    };
    move(tenantId, inv, 'en_file');
    t.jobs = t.jobs.filter(j => !(j.kind === 'submit' && j.no === inv.no));
    t.jobs.push({ id: cid(), kind: 'submit', no: inv.no, idemKey, tries: 0, nextAt: now() });
    await save();
    return view(inv);
  }

  function move(tenantId, inv, to, extra = {}) {
    if (!canTransition(inv.state, to)) {
      log({ event: 'pa.transition_refused', tenantId, invoiceNo: inv.no, state: `${inv.state}->${to}` });
      return false;
    }
    inv.state = to;
    Object.assign(inv, extra);
    log({ event: 'pa.state', tenantId, invoiceNo: inv.no, flowId: inv.flowId, state: to });
    return true;
  }

  // ── Encaissement (statut 212), partiel ou total ──────────────────────────────
  async function recordPayment(tenantId, no, amount, date, clientKey) {
    const t = T(tenantId), inv = t.invoices[no];
    if (!inv) throw new PaError(404, 'Facture inconnue de la plateforme.');
    const seen = await dedupeClientKey(t, clientKey, 'payment', no);
    if (seen) return view(inv);
    if (!isDeposited(inv.state)) throw new PaError(409, 'La facture doit d’abord être déposée sur la plateforme.');
    const a = Math.round(+amount * 100) / 100, remaining = Math.round((inv.grand - inv.paidTotal) * 100) / 100;
    if (!(a > 0) || a > remaining + 0.001) throw new PaError(422, `Montant invalide : reste à encaisser ${remaining.toFixed(2)} €.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new PaError(422, 'Date d’encaissement invalide.');
    const seq = inv.payments.length + 1, rest = Math.round((remaining - a) * 100) / 100;
    inv.payments.push({ seq, amount: a, date, rest, sent: false });
    inv.paidTotal = Math.round((inv.paidTotal + a) * 100) / 100;
    inv.pendingLifecycle = (inv.pendingLifecycle || 0) + 1;
    t.jobs.push({ id: cid(), kind: 'lifecycle', no, code: 212, seq, idemKey: sha256(`${tenantId}|${no}|212|${seq}|${a}|${date}`), tries: 0, nextAt: now() });
    await save();
    return view(inv);
  }

  // ── Webhooks : signature HMAC, fraîcheur, anti-rejeu ; ils ne font que déclencher une relève ──
  async function webhook(rawBody, headers) {
    const ts = String(headers['x-timestamp'] || ''), sig = String(headers['x-signature'] || '').replace(/^sha256=/, '');
    if (!webhookSecret || !/^\d{10,13}$/.test(ts)) throw new PaError(401, 'signature absente');
    const tsMs = ts.length === 13 ? +ts : +ts * 1000;
    if (Math.abs(now() - tsMs) > WEBHOOK_SKEW) throw new PaError(401, 'horodatage trop ancien');
    if (!safeEqualHex(hmac(webhookSecret, ts, rawBody), sig)) throw new PaError(401, 'signature invalide');
    let ev;
    try { ev = JSON.parse(rawBody.toString('utf8')); } catch { throw new PaError(400, 'corps invalide'); }
    const id = String(ev.eventId || ''), flowId = String(ev.flowId || '');
    if (!id || !flowId) throw new PaError(400, 'événement incomplet');
    const tenantId = store.tenants().find(tid => Object.values(T(tid).invoices).some(i => i.flowId === flowId));
    if (!tenantId) return { accepted: false };
    const t = T(tenantId);
    purgeSeen(t);
    if (t.seen[id]) throw new PaError(409, 'événement déjà reçu');
    t.seen[id] = now();
    const inv = Object.values(t.invoices).find(i => i.flowId === flowId);
    if (!t.jobs.some(j => j.kind === 'refresh' && j.no === inv.no)) t.jobs.push({ id: cid(), kind: 'refresh', no: inv.no, tries: 0, nextAt: now() });
    log({ event: 'pa.webhook', tenantId, invoiceNo: inv.no, flowId });
    await save();
    return { accepted: true, tenantId };
  }
  const purgeSeen = t => { for (const [k, at] of Object.entries(t.seen)) if (now() - at > DAY) delete t.seen[k]; };

  // Historique renvoyé par la PA → transitions autorisées uniquement, dans l'ordre.
  function applyHistory(tenantId, inv, history) {
    const known = new Set((inv.history || []).map(h => `${h.code}|${h.at}`));
    for (const h of history) {
      const key2 = `${h.code}|${h.at}`, def = PA_CODES[h.code];
      if (known.has(key2) || !def) continue;
      inv.history.push({ code: h.code, at: h.at, reason: h.reason || null });
      known.add(key2);
      if (h.code === 212) continue;                              // posé par nous : l'état suit nos encaissements
      if (move(tenantId, inv, def.state) && (h.code === 210 || h.code === 213 || h.code === 207)) inv.reason = h.reason || null;
    }
  }

  // ── Traitement de la file ────────────────────────────────────────────────────
  async function runJob(tenantId, job) {
    const t = T(tenantId), inv = t.invoices[job.no], correlationId = cid();
    if (!inv) return 'done';
    const token = await accessToken(tenantId);
    if (!token) return 'wait';                                  // non connecté ou reconnexion demandée : on garde la file
    const ctx = { tenantId, correlationId, token };
    inv.correlationIds = [...(inv.correlationIds || []), correlationId].slice(-50);
    const L = f => log({ tenantId, invoiceNo: inv.no, flowId: inv.flowId, correlationId, attempt: job.tries + 1, ...f });

    if (job.kind === 'submit') {
      const cache = t.lookups[inv.buyerSiren];
      if (!cache || now() - cache.at > LOOKUP_TTL) {
        try { t.lookups[inv.buyerSiren] = { ...(await adapter.lookupRecipient(ctx, inv.buyerSiren)), at: now() }; }
        catch (e) { return retryableFail(tenantId, job, inv, e.status || 0, null, L); }
      }
      if (!t.lookups[inv.buyerSiren].reachable) {
        move(tenantId, inv, 'emise', { errors: ['Ce client n’est pas encore joignable par facture électronique. Vérifie son SIREN.'] });
        L({ event: 'pa.submit', state: 'emise', error: 'destinataire introuvable' });
        return 'done';
      }
      const file = Buffer.from(open(key, inv.file, 'pa-file:' + tenantId + ':' + inv.no), 'utf8');
      const r = await adapter.submitInvoice(ctx, file, { invoiceNo: inv.no, fileName: inv.no + '.xml', syntax: 'CII', mime: 'application/xml', sha256: inv.fileHash }, job.idemKey);
      L({ event: 'pa.submit', http: r.status, code: r.code });
      if (r.status >= 200 && r.status < 300) {
        inv.flowId = r.flowId;
        if (+r.code === 213) { move(tenantId, inv, 'rejetee', { reason: r.reason || (r.errors || []).join(' ; ') || null }); inv.history.push({ code: 213, at: new Date(now()).toISOString(), reason: inv.reason }); }
        else { move(tenantId, inv, 'deposee', { depositedAt: now(), errors: [] }); inv.history.push({ code: 200, at: new Date(now()).toISOString(), reason: null }); }
        T(tenantId).conn.state = 'connecte';
        return 'done';
      }
      if (retryable(r.status)) return retryableFail(tenantId, job, inv, r.status, r.retryAfter, L);
      move(tenantId, inv, 'emise', { errors: r.errors?.length ? r.errors : [`Refusé par la plateforme (HTTP ${r.status}) : corrige la facture.`] });
      return 'done';                                            // 4xx : erreur de contenu, jamais de nouvel essai
    }

    if (job.kind === 'lifecycle') {
      const pay = inv.payments.find(p => p.seq === job.seq);
      const r = await adapter.postLifecycle(ctx, inv.flowId, job.code, { amount: pay.amount, date: pay.date, remaining: pay.rest, currency: 'EUR' }, job.idemKey);
      L({ event: 'pa.lifecycle', http: r.status, code: job.code });
      if (r.status >= 200 && r.status < 300) {
        pay.sent = true;
        inv.pendingLifecycle = Math.max(0, (inv.pendingLifecycle || 1) - 1);
        inv.history.push({ code: 212, at: new Date(now()).toISOString(), reason: null, amount: pay.amount });
        if (pay.rest <= 0) move(tenantId, inv, 'encaissee');
        return 'done';
      }
      if (retryable(r.status)) return retryableFail(tenantId, job, inv, r.status, r.retryAfter, L);
      inv.errors = r.errors?.length ? r.errors : [`Encaissement refusé par la plateforme (HTTP ${r.status}).`];
      return 'done';
    }

    if (job.kind === 'refresh') {
      try {
        const { history } = await adapter.getStatus(ctx, inv.flowId);
        applyHistory(tenantId, inv, history);
        inv.lastPoll = now();
        T(tenantId).conn.lastSync = now();
        L({ event: 'pa.status', state: inv.state, code: inv.history.at(-1)?.code });
        return 'done';
      } catch (e) { return retryableFail(tenantId, job, inv, e.status || 0, null, L); }
    }
    return 'done';
  }

  function retryableFail(tenantId, job, inv, status, retryAfter, L) {
    job.tries++;
    const c = T(tenantId).conn;
    if (job.tries >= MAX_TRIES) {
      if (job.kind === 'submit') move(tenantId, inv, 'echec', { errors: ['La plateforme ne répond pas : envoi abandonné après plusieurs essais. Réessaie plus tard.'] });
      L({ event: 'pa.giveup', http: status });
      return 'done';
    }
    job.nextAt = now() + nextDelay(job.tries, retryAfter, rand);
    if (status === 0 || status >= 500) { c.state = 'panne_pa'; c.retryAt = job.nextAt; }
    L({ event: 'pa.retry', http: status });
    return 'retry';
  }

  // Un passage : jobs dus (dans l'ordre), puis relève de secours toutes les 15 min pour les factures non terminales.
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      for (const tenantId of store.tenants()) {
        const t = T(tenantId);
        for (const inv of Object.values(t.invoices)) {
          if (!inv.flowId || TERMINAL.has(inv.state) || now() - inv.createdAt > POLL_MAX_AGE) continue;
          if (now() - (inv.lastPoll || inv.depositedAt || 0) >= POLL_EVERY && !t.jobs.some(j => j.kind === 'refresh' && j.no === inv.no)) t.jobs.push({ id: cid(), kind: 'refresh', no: inv.no, tries: 0, nextAt: now() });
        }
        let n = 0;
        for (const job of [...t.jobs].sort((a, b) => a.nextAt - b.nextAt)) {
          if (job.nextAt > now() || n >= maxJobsPerTick) continue;
          n++;
          const r = await runJob(tenantId, job);
          if (r === 'done') t.jobs = t.jobs.filter(j => j !== job);
          if (r === 'wait') break;
        }
      }
      await save();
    } finally { running = false; }
  }

  function status(tenantId) {
    const t = T(tenantId), c = t.conn;
    return { state: c.state, paName: c.paName || null, lastSync: c.lastSync || null, retryAt: c.state === 'panne_pa' ? c.retryAt : null, queued: t.jobs.length };
  }

  const invoices = tenantId => Object.values(T(tenantId).invoices).map(view);

  return { startConnect, finishConnect, disconnect, status, submit, recordPayment, webhook, tick, invoices, invoice: (tid, no) => view(T(tid).invoices[no]), _tokens: tokens };
}
