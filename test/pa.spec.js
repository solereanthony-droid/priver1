// Intégration plateforme agréée (docs/PLATEFORME_AGREEE.md § 7), contre la PA simulée (server/pa/mock.mjs).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import crypto from 'node:crypto';
import { startMockPa } from '../server/pa/mock.mjs';
import { createXpZ12Adapter } from '../server/pa/adapter.mjs';
import { createPaService } from '../server/pa/service.mjs';
import { createFileStore } from '../server/pa/store.mjs';
import { createLogger } from '../server/pa/log.mjs';
import { canTransition } from '../server/pa/states.mjs';
import { buildCII, computeTotals, validateInvoice } from '../server/pa/einvoice.mjs';
import { createSessions } from '../server/auth.mjs';
import { createPaRoutes } from '../server/pa/routes.mjs';
import App from '../src/app/logic.js';

const KEY = crypto.randomBytes(32), SECRET = 'whsec_test';
const TENANT = 'default';

const invoice = (over = {}) => ({
  no: 'FAC-2026-029', issueDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR', regime: 'assujetti', remisePct: 0, prepaid: 0,
  seller: { name: 'Julien Hoarau Électricité', siret: '73282932000074', tva: 'FR44732829320', addr: { line: '4 rue des Flamboyants', postcode: '97460', city: 'Saint-Paul' } },
  buyer: { type: 'pro', name: 'SCI Les Filaos', siren: '552081317', addr: { line: '18 rue du Four à Chaux', postcode: '97410', city: 'Saint-Pierre' } },
  lines: [
    { name: 'Tableau 3 rangées 39 modules', ref: 'HAG-VF313', qty: 1, unit: 'u', pu: 60.75, tva: 8.5 },
    { name: "Main d'œuvre", qty: 6, unit: 'h', pu: 48, tva: 8.5 },
    { name: 'Travaux d’amélioration (taux réduit)', qty: 1, unit: 'forfait', pu: 1000, tva: 2.1 },
  ],
  ...over,
});

let mock, svc, clock, logs, store;
async function setup({ reachable } = {}) {
  mock = await startMockPa({ reachable });
  clock = Date.now();
  logs = [];
  store = createFileStore(null);
  const log = createLogger(line => logs.push(line));
  const adapter = createXpZ12Adapter({ ...mock.config, redirectUri: 'http://localhost/api/pa/callback' }, { log });
  svc = createPaService({ store, adapter, key: KEY, log, now: () => clock, rand: () => 0.5, webhookSecret: SECRET });
  const { url } = svc.startConnect(TENANT);
  const { code, state } = await mock.consent(url);
  await svc.finishConnect(state, code);
}
const advance = ms => { clock += ms; };
const inv = () => store.tenant(TENANT).invoices['FAC-2026-029'];
const jobs = () => store.tenant(TENANT).jobs;

describe('Plateforme agréée', () => {
  beforeEach(async () => { await setup(); });
  afterEach(async () => { await mock.close(); });

  it('connexion OAuth2 + PKCE : refresh_token chiffré au repos, jamais en clair', () => {
    const c = store.tenant(TENANT).conn;
    expect(c.state).toBe('connecte');
    expect(c.refresh).toMatch(/^v1\./);
    expect(JSON.stringify(store.tenant(TENANT))).not.toMatch(/"refresh_token"|access_token/);
  });

  it('double « Transmettre » et rejeu hors ligne : un seul dépôt côté PA', async () => {
    await svc.submit(TENANT, invoice(), 'cle-client-000000001');
    await svc.submit(TENANT, invoice(), 'cle-client-000000001');       // rejeu de la file hors ligne (même clé)
    await svc.submit(TENANT, invoice());                               // double clic (même contenu)
    await svc.tick(); await svc.tick();
    expect(mock.calls.submit).toBe(1);
    expect(inv().state).toBe('deposee');
  });

  it('503 puis 200 : un nouvel essai avec la même clé d’idempotence, statut final « deposee »', async () => {
    mock.failNext({ status: 503 });
    await svc.submit(TENANT, invoice());
    await svc.tick();
    expect(inv().state).toBe('en_file');
    expect(store.tenant(TENANT).conn.state).toBe('panne_pa');
    advance(3000); await svc.tick();
    expect(mock.calls.submit).toBe(2);
    expect(new Set(mock.calls.idemKeys).size).toBe(1);
    expect(inv().state).toBe('deposee');
    expect(store.tenant(TENANT).conn.state).toBe('connecte');
  });

  it('400 : aucun nouvel essai, retour à « emise » avec un message', async () => {
    mock.failNext({ status: 400, body: { errors: ['BR-FR-05 : mention manquante'] } });
    await svc.submit(TENANT, invoice());
    await svc.tick(); advance(600_000); await svc.tick();
    expect(mock.calls.submit).toBe(1);
    expect(inv().state).toBe('emise');
    expect(inv().errors).toEqual(['BR-FR-05 : mention manquante']);
    expect(jobs()).toHaveLength(0);
  });

  it('429 avec Retry-After: 30 → nouvel essai après 30 s minimum', async () => {
    mock.failNext({ status: 429, retryAfter: 30 });
    await svc.submit(TENANT, invoice());
    await svc.tick();
    expect(jobs()[0].nextAt - clock).toBeGreaterThanOrEqual(30_000);
    advance(29_000); await svc.tick();
    expect(mock.calls.submit).toBe(1);
    advance(1_000); await svc.tick();
    expect(mock.calls.submit).toBe(2);
    expect(inv().state).toBe('deposee');
  });

  it('8 échecs réseau → état « echec » visible', async () => {
    mock.failNext(...Array(8).fill({ status: 502 }));
    await svc.submit(TENANT, invoice());
    for (let i = 0; i < 8; i++) { await svc.tick(); advance(6 * 60_000); }
    expect(mock.calls.submit).toBe(8);
    expect(inv().state).toBe('echec');
  });

  it('webhook : signature fausse, horodatage > 5 min ou rejeu → refusé, aucun changement', async () => {
    await svc.submit(TENANT, invoice()); await svc.tick();
    const flowId = inv().flowId, ev = { eventId: 'evt-1', flowId };
    const bad = mock.signedWebhook('mauvais-secret', ev, Math.floor(clock / 1000));
    await expect(svc.webhook(bad.raw, bad.headers)).rejects.toMatchObject({ status: 401 });
    const old = mock.signedWebhook(SECRET, ev, Math.floor((clock - 6 * 60_000) / 1000));
    await expect(svc.webhook(old.raw, old.headers)).rejects.toMatchObject({ status: 401 });
    const ok = mock.signedWebhook(SECRET, ev, Math.floor(clock / 1000));
    await svc.webhook(ok.raw, ok.headers);
    await expect(svc.webhook(ok.raw, ok.headers)).rejects.toMatchObject({ status: 409 });
    expect(jobs().filter(j => j.kind === 'refresh')).toHaveLength(1);
    expect(inv().state).toBe('deposee');
  });

  it('webhook valide → relève getStatus() ; l’état suit la PA, pas le contenu du webhook', async () => {
    await svc.submit(TENANT, invoice()); await svc.tick();
    const flowId = inv().flowId;
    const w = mock.signedWebhook(SECRET, { eventId: 'evt-2', flowId, status: 210 }, Math.floor(clock / 1000));   // le corps annonce « refusée »…
    mock.setStatus(flowId, 205);                                                                                    // …mais la PA dit « approuvée »
    await svc.webhook(w.raw, w.headers); await svc.tick();
    expect(inv().state).toBe('approuvee');
  });

  it('relève de secours toutes les 15 min, même sans webhook', async () => {
    await svc.submit(TENANT, invoice()); await svc.tick();
    mock.setStatus(inv().flowId, 210, 'Prix non conforme au devis');
    advance(14 * 60_000); await svc.tick();
    expect(inv().state).toBe('deposee');
    advance(60_000); await svc.tick();
    expect(inv().state).toBe('refusee');
    expect(inv().reason).toBe('Prix non conforme au devis');
  });

  it('transitions interdites refusées', () => {
    expect(canTransition('encaissee', 'deposee')).toBe(false);
    expect(canTransition('rejetee', 'deposee')).toBe(false);
    expect(canTransition('refusee', 'approuvee')).toBe(false);
    expect(canTransition('approuvee', 'deposee')).toBe(false);
    expect(canTransition('deposee', 'approuvee')).toBe(true);
    expect(canTransition('en_litige', 'completee')).toBe(true);
  });

  it('encaissement partiel 1 500 € sur 3 000 € : 212 avec le montant, reste 1 500 €, facture non soldée', async () => {
    const f = invoice({ lines: [{ name: 'Travaux', qty: 1, unit: 'forfait', pu: 3000 / 1.085, tva: 8.5 }] });
    await svc.submit(TENANT, f); await svc.tick();
    const grand = inv().grand;
    const half = Math.round(grand / 2 * 100) / 100;
    const v = await svc.recordPayment(TENANT, f.no, half, '2026-10-05', 'paiement-000000000001');
    await svc.recordPayment(TENANT, f.no, half, '2026-10-05', 'paiement-000000000001');   // rejeu : ignoré
    await svc.tick();
    expect(mock.calls.lifecycle).toHaveLength(1);
    expect(mock.calls.lifecycle[0]).toMatchObject({ code: 212, amount: half, date: '2026-10-05' });
    expect(v.remaining).toBeCloseTo(grand - half, 2);
    expect(inv().state).not.toBe('encaissee');
    await svc.recordPayment(TENANT, f.no, Math.round((grand - half) * 100) / 100, '2026-10-20');
    await svc.tick();
    expect(inv().state).toBe('encaissee');
  });

  it('refresh_token expiré → état « reauth », la file d’envoi est conservée', async () => {
    mock.revokeAll(); svc._tokens.clear();
    await svc.submit(TENANT, invoice());
    await svc.tick();
    expect(store.tenant(TENANT).conn.state).toBe('reauth');
    expect(jobs()).toHaveLength(1);
    expect(inv().state).toBe('en_file');
    const { url } = svc.startConnect(TENANT), { code, state } = await mock.consent(url);
    await svc.finishConnect(state, code); await svc.tick();
    expect(inv().state).toBe('deposee');
  });

  it('client absent de l’annuaire → message, rien n’est déposé', async () => {
    await mock.close(); await setup({ reachable: () => false });
    await svc.submit(TENANT, invoice()); await svc.tick();
    expect(mock.calls.submit).toBe(0);
    expect(inv().state).toBe('emise');
    expect(inv().errors[0]).toMatch(/pas encore joignable/);
  });

  it('journaux : aucun contenu de facture, correlationId sur chaque appel', async () => {
    await svc.submit(TENANT, invoice()); await svc.tick();
    await svc.recordPayment(TENANT, 'FAC-2026-029', 100, '2026-10-01'); await svc.tick();
    const all = logs.join('\n');
    expect(all).not.toMatch(/<\?xml|CrossIndustryInvoice|%PDF|SCI Les Filaos|Julien Hoarau|Tableau 3 rangées/);
    const httpLogs = logs.map(l => JSON.parse(l)).filter(l => l.event === 'pa.http');
    expect(httpLogs.length).toBeGreaterThan(2);
    httpLogs.filter(l => l.tenantId).forEach(l => expect(l.correlationId).toMatch(/^[0-9a-f-]{36}$/));
  });
});

describe('Facture EN 16931', () => {
  it('TVA La Réunion : ventilation 8,5 % et 2,1 %, HT + TVA = TTC au centime, identique à totals()', () => {
    const f = invoice({ remisePct: 5, prepaid: 100 });
    expect(validateInvoice(f)).toEqual([]);
    const T = computeTotals(f);
    // base 8,5 % : 60,75 + 6 × 48 = 348,75 − 5 % (17,44) = 331,31 → TVA 28,16 ; base 2,1 % : 1 000 − 50 = 950 → TVA 19,95
    expect(T.vat.map(v => [v.rate, v.basis, v.tax])).toEqual([[8.5, 331.31, 28.16], [2.1, 950, 19.95]]);
    expect(T.grand).toBe(Math.round((T.taxBasis + T.taxTotal) * 100) / 100);
    expect(T.due).toBe(Math.round((T.grand - 100) * 100) / 100);
    // Même devis dans l'app : totals() donne le même TTC.
    const c = new App({ regime: 'assujetti', acompte: 0, paName: 'x' });
    c.state = { ...c.state, remiseTxt: '5', acompte: 0, lines: f.lines.map((l, i) => ({ id: i + 1, kind: 'mat', achat: 0, ...l })) };
    expect(c.totals().ttc).toBe(T.grand);
    const xml = buildCII(f);
    expect(xml).toContain('<ram:GrandTotalAmount>' + T.grand.toFixed(2) + '</ram:GrandTotalAmount>');
    expect(xml).toContain('<ram:ID schemeID="0002">732829320</ram:ID>');
    expect(xml).toContain('<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>');
  });

  it('micro-entreprise : XML sans TVA, catégorie E, mention art. 293 B', () => {
    const f = invoice({ regime: 'micro', seller: { ...invoice().seller, tva: '' } });
    expect(validateInvoice(f)).toEqual([]);
    const xml = buildCII(f), T = computeTotals(f);
    expect(T.taxTotal).toBe(0);
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
    expect(xml).toMatch(/<ram:CategoryCode>E<\/ram:CategoryCode>/);
    expect(xml).not.toMatch(/<ram:CategoryCode>S<\/ram:CategoryCode>/);
    expect(xml).toContain('TVA non applicable, art. 293 B du CGI');
    expect(xml).not.toContain('schemeID="VA"');
  });

  it('contrôles bloquants : SIREN/SIRET (Luhn), client particulier, lignes, devise', () => {
    expect(validateInvoice(invoice({ buyer: { ...invoice().buyer, siren: '552081318' } }))).toEqual([expect.stringMatching(/SIREN du client/)]);
    expect(validateInvoice(invoice({ seller: { ...invoice().seller, siret: '81234567800021' } }))).toEqual([expect.stringMatching(/SIRET du vendeur/)]);
    expect(validateInvoice(invoice({ buyer: { ...invoice().buyer, type: 'part' } }))[0]).toMatch(/particulier/);
    expect(validateInvoice(invoice({ lines: [] }))).toContain('Au moins une ligne est requise.');
    expect(validateInvoice(invoice({ currency: '€' }))[0]).toMatch(/EUR/);
    expect(validateInvoice(invoice({ no: 'FAC-26-1' }))[0]).toMatch(/Numéro/);
  });
});

describe('Routes /api/pa/*', () => {
  let server, base;
  beforeEach(async () => {
    await setup();
    const sessions = createSessions({ ownerCode: 'patron-code-1234', staffCode: 'salarie-code-1234' });
    const send = (res, status, body, type, extra = {}) => { res.writeHead(status, { 'Content-Type': type, ...extra }); res.end(body); };
    const routes = createPaRoutes({ service: svc, sessions, send, sameOrigin: () => true, secureCookie: () => false, clientIp: () => '1.1.1.1' });
    server = http.createServer((req, res) => routes.handle(req, res));
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => { await new Promise(r => server.close(r)); await mock.close(); });
  const login = async code => (await fetch(base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })).headers.get('set-cookie')?.split(';')[0];

  it('compte salarié → 403 sur toutes les routes /api/pa/*, sans session → 401', async () => {
    const staff = await login('salarie-code-1234');
    expect(staff).toMatch(/^btp_sid=/);
    for (const [m, p] of [['GET', '/api/pa/status'], ['POST', '/api/pa/connect'], ['POST', '/api/pa/disconnect'], ['GET', '/api/pa/invoices'], ['POST', '/api/pa/invoices'], ['POST', '/api/pa/invoices/FAC-2026-029/payments']]) {
      const init = { method: m, headers: { Cookie: staff, 'Content-Type': 'application/json' }, body: m === 'POST' ? '{}' : undefined };
      expect((await fetch(base + p, init)).status, p).toBe(403);
      expect((await fetch(base + p, { ...init, headers: { 'Content-Type': 'application/json' } })).status, p).toBe(401);
    }
    const owner = await login('patron-code-1234');
    const r = await fetch(base + '/api/pa/status', { headers: { Cookie: owner } });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ state: 'connecte', paName: 'PA de test' });
  });

  it('cookie de session HttpOnly et SameSite=Strict ; mauvais code limité à 5 essais par minute', async () => {
    const r = await fetch(base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'patron-code-1234' }) });
    expect(r.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Strict/);
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await fetch(base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'x' }) })).status);
    expect(codes.slice(0, 4)).toEqual([401, 401, 401, 401]);
    expect(codes.at(-1)).toBe(429);
  });

  it('dépôt via l’API : 202, puis « Transmise » dans la liste', async () => {
    const owner = await login('patron-code-1234');
    const r = await fetch(base + '/api/pa/invoices', { method: 'POST', headers: { Cookie: owner, 'Content-Type': 'application/json', 'Idempotency-Key': 'aaaaaaaaaaaaaaaa1' }, body: JSON.stringify({ invoice: invoice() }) });
    expect(r.status).toBe(202);
    for (let i = 0; i < 20 && inv()?.state !== 'deposee'; i++) { await new Promise(res => setTimeout(res, 20)); await svc.tick(); }
    const list = await (await fetch(base + '/api/pa/invoices', { headers: { Cookie: owner } })).json();
    expect(list.invoices[0]).toMatchObject({ no: 'FAC-2026-029', state: 'deposee', status: 'Transmise' });
    const bad = await fetch(base + '/api/pa/invoices', { method: 'POST', headers: { Cookie: owner, 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice: invoice({ no: 'FAC-2026-030', buyer: { ...invoice().buyer, siren: '1' } }) }) });
    expect(bad.status).toBe(422);
    expect((await bad.json()).errors[0]).toMatch(/SIREN/);
  });
});
