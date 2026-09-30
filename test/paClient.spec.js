// @vitest-environment jsdom
// Client PA de l'app : file hors ligne (IndexedDB), rejeu idempotent, conversion des factures.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { btpPA, flush } from '../src/pa/paClient.js';
import { toPaInvoice, parseAddress } from '../src/pa/invoicePayload.js';
import { validateInvoice, computeTotals } from '../server/pa/einvoice.mjs';
import App from '../src/app/logic.js';

const online = v => Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });
const reply = (status, body = {}) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const payload = { no: 'FAC-2026-029', lines: [] };

describe('file d’envoi hors ligne', () => {
  beforeEach(async () => {
    online(true);
    for (const p of await btpPA.pending()) await flush();           // vide la file des tests précédents
    vi.restoreAllMocks();
  });

  it('hors ligne : l’action attend ; à la reconnexion elle part une fois, avec une clé d’idempotence stable', async () => {
    online(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply(503));
    await btpPA.transmit(payload);
    await btpPA.transmit(payload);                                       // double clic hors ligne : pas de doublon
    expect(await btpPA.pending()).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    online(true);
    await flush();                                                       // 503 : on garde et on réessaiera
    const k1 = fetchSpy.mock.calls[0][1].headers['Idempotency-Key'];
    expect(await btpPA.pending()).toHaveLength(1);
    const [item] = await btpPA.pending();
    expect(item.tries).toBe(1);

    fetchSpy.mockImplementation(() => reply(202, { no: 'FAC-2026-029', state: 'en_file' }));
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);          // délai d'attente écoulé
    await flush();
    const k2 = fetchSpy.mock.calls[1][1].headers['Idempotency-Key'];
    expect(k2).toBe(k1);
    expect(k1).toMatch(/^[0-9a-f]{32}$/);
    expect(await btpPA.pending()).toHaveLength(0);
  });

  it('erreur de contenu (422) : action retirée de la file et erreur signalée', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply(422, { error: 'Facture non conforme.', errors: ['SIREN du client absent ou invalide (clé de Luhn).'] }));
    const got = new Promise(r => window.addEventListener('btp:pa-error', e => r(e.detail), { once: true }));
    await btpPA.transmit({ ...payload, no: 'FAC-2026-030' });
    await flush();
    expect(await got).toMatchObject({ no: 'FAC-2026-030', errors: [expect.stringMatching(/SIREN/)] });
    expect(await btpPA.pending()).toHaveLength(0);
  });

  it('statut « hors_ligne » sans réseau', async () => {
    online(false);
    expect(await btpPA.status()).toMatchObject({ state: 'hors_ligne' });
  });
});

describe('facture de l’app → facture électronique', () => {
  it('la facture créée garde sa date réelle et son contenu, et passe les contrôles EN 16931', () => {
    const c = new App({ regime: 'assujetti', acompte: 30, paName: 'x' });
    c.setState = (u, cb) => { const p = typeof u === 'function' ? u(c.state, c.props) : u; if (p) c.state = { ...c.state, ...p }; cb && cb(); };
    c.flash = () => {};
    c.state = { ...c.state, tab: 'devis', clientType: 'pro', client: 'SCI Les Filaos', chantier: '18 rue du Four à Chaux, 97410 Saint-Pierre',
      co: { siret: '732 829 320 00074', tva: 'FR44732829320' } };
    const T = c.totals();
    c.renderVals().doFacture();
    const doc = c.state.docs.find(d => d.type === 'fac' && d.snap);
    const today = new Date();
    expect(doc.date).toBe(today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    const p2 = n => String(n).padStart(2, '0');
    expect(doc.snap.issued).toBe(`${today.getFullYear()}-${p2(today.getMonth() + 1)}-${p2(today.getDate())}`);
    expect(doc.snap.lines.length).toBe(c.state.lines.length);

    const inv = toPaInvoice(doc, c.coData(), { buyerSiren: '552081317' });
    expect(validateInvoice(inv)).toEqual([]);
    const S = computeTotals(inv);
    expect(S.grand).toBe(T.ttc);                        // même TTC que l'app
    expect(S.due).toBeCloseTo(doc.ttc, 2);              // net à payer = TTC − acompte, comme sur la facture
    expect(inv.buyer.addr).toEqual({ line: '18 rue du Four à Chaux', postcode: '97410', city: 'Saint-Pierre', country: 'FR' });
  });

  it('client particulier : refus clair (hors champ de la facture électronique B2B)', () => {
    const doc = { no: 'FAC-2026-031', snap: { issued: '2026-09-30', client: 'M. Payet', chantier: '', clientType: 'part', regime: 'assujetti', remiseTxt: '0', prepaid: 0, lines: [{ name: 'x', qty: 1, unit: 'u', pu: 10, tva: 8.5 }] } };
    const errs = validateInvoice(toPaInvoice(doc, { name: 'A', siret: '73282932000074', tva: 'FR44732829320', addr: '1 rue X, 97400 Saint-Denis' }));
    expect(errs.some(e => /particulier/.test(e))).toBe(true);
  });

  it('adresse : « 4 rue des Flamboyants, 97460 Saint-Paul »', () => {
    expect(parseAddress('4 rue des Flamboyants, 97460 Saint-Paul')).toEqual({ line: '4 rue des Flamboyants', postcode: '97460', city: 'Saint-Paul', country: 'FR' });
  });
});
