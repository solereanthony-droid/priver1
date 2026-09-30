// @vitest-environment jsdom
// Tests v15 → v15.2 (MISE_A_JOUR_v15.md) et branchements de l'app (paiement, code d'accès).
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import fs from 'node:fs';
import App from '../src/app/logic.js';
import { usePaBridge } from '../src/hooks/usePaBridge.js';
import { toPaInvoice } from '../src/pa/invoicePayload.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const sp = t => String(t).replace(/[  ]/g, ' ');
const live = (state = {}, props = {}) => {
  const c = new App({ regime: 'assujetti', acompte: 30, paName: 'FactuPro 974', ...props });
  c.state = { ...c.state, ...state };
  c.setState = (u, cb) => { const p = typeof u === 'function' ? u(c.state, c.props) : u; if (p) c.state = { ...c.state, ...p }; if (cb) cb(); };
  c.flash = m => { c.lastFlash = m; }; c.go = tab => { c.state = { ...c.state, tab }; };
  return c;
};
const fac = (c, no) => { c.state = { ...c.state, tab: 'docs', docTab: 'fac' }; return c.renderVals().docList.find(d => d.no === no); };
const cf = (c, no) => fac(c, no)._cf('docs');
const today = () => new Date().toLocaleDateString('fr-FR');
afterEach(() => { delete globalThis.__btpPaSend; delete globalThis.__btpLogin; delete globalThis.__btpPaLive; delete window.btpPA; });

describe('v15.2 : Alizé Pilote', () => {
  it('manifeste et page : nom, icônes any + maskable 192 / 512', () => {
    const m = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(m).toMatchObject({ name: 'Alizé Pilote', short_name: 'Alizé Pilote', theme_color: '#c67139', background_color: '#f5ead8' });
    for (const purpose of ['any', 'maskable']) for (const size of ['192x192', '512x512']) {
      const ic = m.icons.find(i => i.purpose === purpose && i.sizes === size);
      expect(ic, purpose + size).toBeTruthy();
      const png = fs.readFileSync('public' + ic.src);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)].join('x')).toBe(size);
    }
    const html = fs.readFileSync('index.html', 'utf8');
    expect(html).toMatch(/<title>Alizé Pilote<\/title>/);
    expect(html).toMatch(/apple-touch-icon/);
  });
  it('clé de sauvegarde inchangée', () => expect(App.KEY).toBe('btp974-mobile-v1'));
});

describe('v15 : menu de statut', () => {
  it('particulier : pas de « Transmettre », encaissement avec mention e-reporting', () => {
    const c = live({ tab: 'devis', clientType: 'part', client: 'M. Payet' });
    c.renderVals().doFacture();
    const no = c.state.docs.find(d => d.type === 'fac' && d.lines).no;
    const x = cf(c, no);
    expect(x.cfOkTxt).toBe('Enregistrer l’encaissement');
    expect(x.cfNote).toMatch(/e-reporting/);
  });

  it('encaissement partiel 500 € sur 1 173 € puis solde ; montant > reste et date future refusés', () => {
    const c = live();
    let x = cf(c, 'FAC-2026-028');
    x.onCfAmt({ target: { value: '2000' } }); cf(c, 'FAC-2026-028').cfOk();
    expect(c.lastFlash).toMatch(/supérieur au reste/);
    const futur = new Date(Date.now() + 5 * 864e5).toLocaleDateString('fr-FR');
    cf(c, 'FAC-2026-028').onCfAmt({ target: { value: '500' } }); cf(c, 'FAC-2026-028').onCfDate({ target: { value: futur } }); cf(c, 'FAC-2026-028').cfOk();
    expect(c.lastFlash).toMatch(/pas dans le futur/);
    cf(c, 'FAC-2026-028').onCfDate({ target: { value: today() } }); cf(c, 'FAC-2026-028').cfOk();
    let d = c.state.docs.find(d => d.no === 'FAC-2026-028');
    expect(d).toMatchObject({ st: 1, paPaid: 500, paRemaining: 673 });
    expect(sp(fac(c, 'FAC-2026-028').paLine)).toBe('Payé 500,00 € · reste 673,00 €');
    x = cf(c, 'FAC-2026-028');
    expect(x.cfAmt).toBe('673');
    x.cfOk();
    d = c.state.docs.find(d => d.no === 'FAC-2026-028');
    expect(d.st).toBe(3);
    expect(d.paidOn).toBe(today());
  });

  it('hors ligne : « Transmettre » → en attente d’envoi, plus d’action tant que l’envoi attend', () => {
    const c = live({ tab: 'devis', clientType: 'pro', cliSiren: '552 081 317', client: 'SCI Les Filaos', cliAddr: '18 rue du Four à Chaux, 97410 Saint-Pierre' });
    c.renderVals().doFacture();
    const no = c.state.docs.find(d => d.type === 'fac' && d.lines).no;
    c.state = { ...c.state, offline: true };
    cf(c, no).cfOk();
    expect(c.state.docs.find(d => d.no === no).paQueued).toBe(true);
    expect(cf(c, no).cfHasOk).toBeFalsy();
  });

  it('états de la plateforme : action adaptée dans le menu', () => {
    for (const [paState, txt] of [['non_configure', 'Choisir ma plateforme'], ['non_connecte', 'Connecter mon compte'], ['reauth', 'Connecter mon compte'], ['panne_pa', 'Connecter mon compte'], ['connecte', 'Transmettre à la plateforme']]) {
      const c = live({ tab: 'devis', clientType: 'pro', cliSiren: '552 081 317', client: 'SCI', cliAddr: '1 rue X, 97400 Saint-Denis' }, { paState });
      c.renderVals().doFacture();
      expect(cf(c, c.state.docs.find(d => d.type === 'fac' && d.lines).no).cfOkTxt, paState).toBe(txt);
    }
  });
});

describe('v15.1 : adresse de facturation', () => {
  it('client pro sans adresse : vérification bloquée ; avec adresse → doc.addr, puis BG-8 du XML', () => {
    const c = live({ tab: 'devis', clientType: 'pro', cliSiren: '552 081 317', client: 'SCI Les Filaos', chantier: '' });
    c.renderVals().toFacture();
    c.renderVals().fv.checks.forEach((_, i) => c.renderVals().fv.checks[i].toggle());
    expect(c.renderVals().fv.warn.join(' ')).toMatch(/Adresse de facturation du client manquante/);
    c.renderVals().onCliAddr({ target: { value: '3 allée des Songes, 97400 Saint-Denis' } });
    c.renderVals().doFacture();
    const doc = c.state.docs.find(d => d.type === 'fac' && d.lines);
    expect(doc.addr).toBe('3 allée des Songes, 97400 Saint-Denis');
    expect(toPaInvoice(doc, { name: 'A', siret: '73282932000074', tva: 'FR44732829320', addr: '4 rue X, 97460 Saint-Paul' }).buyer.addr).toMatchObject({ postcode: '97400', city: 'Saint-Denis' });
  });
});

describe('v15 : écran de code d’accès (sans serveur : contrôle local de démo)', () => {
  it('1974 → patron ; code salarié → écran salarié ; 5 erreurs → blocage 1 min', async () => {
    vi.useFakeTimers();
    const c = live({ locked: true });
    const type = code => { for (const k of code) c.renderVals().lk.keys.find(x => x.l === k).on(); vi.advanceTimersByTime(200); };
    type('1974');
    expect(c.state).toMatchObject({ locked: false, role: 'owner' });
    const pin = String(c.rhData().staff.find(x => x.pin && x.kind !== 'dir').pin);
    c.state = { ...c.state, locked: true, role: null };
    type(pin);
    expect(c.state.role).toBe('staff');
    c.state = { ...c.state, locked: true, role: null };
    for (let i = 0; i < 5; i++) type('0000');
    expect(c.renderVals().lk.blocked).toBe(true);
    expect(c.renderVals().lk.err).toMatch(/patiente une minute/);
    vi.useRealTimers();
  });
});

describe('branchements de l’app', () => {
  async function mountBridge(pa, state) {
    window.btpPA = pa;
    const logic = { state, flashes: [], flash(m) { this.flashes.push(m); }, coData: () => ({ name: 'JH', siret: '73282932000074', tva: 'FR44732829320', addr: '4 rue des Flamboyants, 97460 Saint-Paul' }),
      setState(u) { const p = typeof u === 'function' ? u(this.state) : u; this.state = { ...this.state, ...p }; } };
    function Host() { usePaBridge(logic, !!logic.state.locked); return null; }
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(React.createElement(Host)); });
    await act(() => new Promise(r => setTimeout(r, 20)));
    return { logic, unmount: () => act(() => root.unmount()) };
  }
  const connected = extra => ({
    config: vi.fn(async () => ({ status: 200, data: { configured: true, sessions: true, role: null } })),
    status: vi.fn(async () => ({ state: 'connecte', paName: 'PA test' })),
    invoices: vi.fn(async () => ({ status: 200, data: { invoices: [] } })), pending: vi.fn(async () => []),
    transmit: vi.fn(), recordPayment: vi.fn(async () => ({ queued: true })), logout: vi.fn(async () => ({})), ...extra,
  });

  it('encaissement : montant et date saisis envoyés au format ISO', async () => {
    const pa = connected();
    const { unmount } = await mountBridge(pa, { docs: [] });
    expect(globalThis.__btpPaSend('pay', { no: 'FAC-2026-028', ttc: 1173 }, { amount: 500, date: '30/09/2026' })).toBe(true);
    await act(() => new Promise(r => setTimeout(r, 10)));
    expect(pa.recordPayment).toHaveBeenCalledWith('FAC-2026-028', 500, '2026-09-30');
    await unmount();
  });

  it('code d’accès avec sessions serveur : écran de code au démarrage, code vérifié par le serveur', async () => {
    const pa = connected({ login: vi.fn(async code => code === '424242' ? { status: 200, data: { role: 'owner' } } : code === '999999' ? { status: 429, data: {} } : { status: 401, data: {} }) });
    const { logic, unmount } = await mountBridge(pa, { docs: [] });
    expect(logic.state.locked).toBe(true);
    expect(globalThis.__btpLogin('0000', { staff: [] })).toBe(true);
    await act(() => new Promise(r => setTimeout(r, 10)));
    expect(logic.state.lkErr).toBe('Code incorrect');
    globalThis.__btpLogin('999999', { staff: [] }); await act(() => new Promise(r => setTimeout(r, 10)));
    expect(logic.state.lkErr).toMatch(/patiente une minute/);
    globalThis.__btpLogin('424242', { staff: [] }); await act(() => new Promise(r => setTimeout(r, 10)));
    expect(logic.state).toMatchObject({ locked: false, role: 'owner' });
    await unmount();
  });
});
