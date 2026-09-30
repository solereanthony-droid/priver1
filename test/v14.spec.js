// @vitest-environment jsdom
// Tests v14.1 / v14.2 (MISES_A_JOUR.md) et pont entre le menu de statut et la plateforme agréée (usePaBridge).
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/app/logic.js';
import { usePaBridge } from '../src/hooks/usePaBridge.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const live = (state = {}) => {
  const c = new App({ regime: 'assujetti', acompte: 30, paName: 'FactuPro 974' });
  c.state = { ...c.state, ...state };
  c.setState = (u, cb) => { const p = typeof u === 'function' ? u(c.state, c.props) : u; if (p) c.state = { ...c.state, ...p }; if (cb) cb(); };
  c.flash = m => { c.lastFlash = m; }; c.go = tab => { c.state = { ...c.state, tab }; };
  return c;
};
const facs = c => { c.state = { ...c.state, tab: 'docs', docTab: 'fac' }; return c.renderVals().docList; };
const cf = (c, no) => facs(c).find(d => d.no === no)._cf('docs');
const newFac = (over = {}) => {
  const c = live({ tab: 'devis', clientType: 'pro', cliSiren: '552 081 317', client: 'SCI Les Filaos', ...over });
  c.renderVals().doFacture();
  return { c, no: c.state.docs.find(d => d.type === 'fac' && d.lines).no };
};

describe('v14.1 : statuts de facture', () => {
  it('Émise complète → « Transmettre » ; incomplète → « Compléter la facture »', () => {
    let { c, no } = newFac();
    expect(cf(c, no).cfOkTxt).toBe('Transmettre à la plateforme');
    ({ c, no } = newFac({ cliSiren: '' }));
    expect(cf(c, no).cfOkTxt).toBe('Compléter la facture');
    expect(cf(c, 'FAC-2026-028').cfOkTxt).not.toBe('Transmettre à la plateforme');   // facture de démo sans lignes
  });

  it('aucun chemin manuel vers Transmise ou Acceptée depuis un statut déposé', () => {
    const c = live();
    for (const st of [1, 2, 3, 4, 5, 6]) {
      c.state = { ...c.state, docs: c.state.docs.map(d => d.no === 'FAC-2026-028' ? { ...d, st } : d) };
      expect(['Transmise', 'Acceptée']).not.toContain(cf(c, 'FAC-2026-028').cfNext);
    }
  });

  it('Rejetée → « Corriger et réémettre » : même numéro, retour en Émise, motif effacé', () => {
    const c = live();
    const x = cf(c, 'FAC-2026-026');
    expect(x.cfOkTxt).toBe('Corriger et réémettre');
    x.cfOk();
    const d = c.state.docs.find(d => d.no === 'FAC-2026-026');
    expect(d.st).toBe(0);
    expect(d.motif).toBeFalsy();
  });

  it('Refusée → nouvelle facture avec « replaces », l’originale reste Refusée', () => {
    const c = live();
    c.state = { ...c.state, docs: c.state.docs.map(d => d.no === 'FAC-2026-027' ? { ...d, st: 5, motif: 'Prix' } : d) };
    const n0 = c.state.docs.length;
    cf(c, 'FAC-2026-027').cfOk();
    expect(c.state.docs.length).toBe(n0 + 1);
    const nu = c.state.docs.find(d => d.replaces === 'FAC-2026-027');
    expect(nu.no).toMatch(new RegExp(`^FAC-${new Date().getFullYear()}-\\d{3}$`));
    expect(nu.st).toBe(0);
    expect(c.state.docs.find(d => d.no === 'FAC-2026-027').st).toBe(5);
  });
});

describe('v14.2 : SIREN / SIRET du client', () => {
  it('812 453 678 accepté, 812 453 679 refusé, SIRET à 14 chiffres accepté si la clé est bonne', () => {
    const c = live({ tab: 'devis', clientType: 'pro' });
    const err = v => { c.renderVals().onCliSiren({ target: { value: v } }); return c.renderVals().cliSirErr; };
    expect(err('812 453 678')).toBeFalsy();
    expect(err('812 453 679')).toBeTruthy();
    expect(err('732 829 320 00074')).toBeFalsy();
  });
});

describe('pont menu de statut ↔ plateforme agréée', () => {
  afterEach(() => { delete window.btpPA; vi.restoreAllMocks(); });

  async function mountBridge(pa, state) {
    window.btpPA = pa;
    const logic = { state, flashes: [], flash(m) { this.flashes.push(m); }, coData: () => ({ name: 'JH', siret: '73282932000074', tva: 'FR44732829320', addr: '4 rue des Flamboyants, 97460 Saint-Paul' }),
      setState(u) { const p = typeof u === 'function' ? u(this.state) : u; this.state = { ...this.state, ...p }; } };
    function Host() { usePaBridge(logic); return null; }
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(React.createElement(Host)); });
    await act(() => new Promise(r => setTimeout(r, 20)));
    return { logic, unmount: () => act(() => root.unmount()) };
  }
  const doc = { no: 'FAC-2026-040', type: 'fac', st: 0, date: '30/09/2026', client: 'SCI Les Filaos — acompte 30 % déduit', pro: true, siren: '552081317', chantier: '18 rue X, 97410 Saint-Pierre', rem: 0, ac: 0, ttc: 108.5, lines: [{ name: 'Prise', qty: 1, unit: 'u', pu: 100, tva: 8.5 }] };

  it('serveur injoignable (démo statique) : le prototype simule, avec la mention « Démo »', async () => {
    const pa = { config: vi.fn(async () => { throw new Error('réseau'); }), status: vi.fn(async () => { throw new Error('réseau'); }), invoices: vi.fn(), pending: vi.fn(async () => []), transmit: vi.fn() };
    const { logic, unmount } = await mountBridge(pa, { docs: [doc] });
    expect(window.__btpPaSend('transmit', doc)).toBe(false);
    await act(() => new Promise(r => setTimeout(r, 5)));
    expect(logic.flashes.at(-1)).toMatch(/^Démo/);
    expect(pa.transmit).not.toHaveBeenCalled();
    await unmount();
  });

  it('plateforme configurée mais pas de session : rien n’est simulé, message clair, écran de code', async () => {
    const pa = { config: vi.fn(async () => ({ status: 200, data: { configured: true, sessions: true, role: null } })), status: vi.fn(async () => ({ state: 'non_connecte', error: 'Connexion à l’app requise.' })), invoices: vi.fn(), pending: vi.fn(async () => []), transmit: vi.fn() };
    const { logic, unmount } = await mountBridge(pa, { docs: [doc] });
    expect(logic.state.locked).toBe(true);
    expect(logic.state.paSt).toBe('non_connecte');
    expect(window.__btpPaSend('transmit', doc)).toBe(true);
    expect(logic.flashes.at(-1)).toMatch(/Connexion à l’app requise/);
    expect(pa.transmit).not.toHaveBeenCalled();
    await unmount();
  });

  it('plateforme connectée : envoi réel ; le statut affiché vient du serveur', async () => {
    let served = [];
    const pa = {
      config: vi.fn(async () => ({ status: 200, data: { configured: true, sessions: false, role: 'owner' } })),
      status: vi.fn(async () => ({ state: 'connecte', paName: 'PA test', connectedAt: Date.UTC(2026, 8, 30, 8) })),
      invoices: vi.fn(async () => ({ status: 200, data: { invoices: served } })),
      pending: vi.fn(async () => []),
      transmit: vi.fn(async () => ({ queued: true })),
    };
    const { logic, unmount } = await mountBridge(pa, { docs: [doc] });
    expect(window.__btpPaSend('transmit', doc)).toBe(true);
    await act(() => new Promise(r => setTimeout(r, 10)));
    expect(pa.transmit).toHaveBeenCalledWith(expect.objectContaining({ no: 'FAC-2026-040', buyer: expect.objectContaining({ siren: '552081317', type: 'pro' }) }));
    expect(logic.state.docs[0].st).toBe(0);                          // pas de passage manuel à « Transmise »
    expect(logic.state.docs[0].paQueued).toBe(true);
    served = [{ no: 'FAC-2026-040', status: 'Rejetée', reason: 'Destinataire inconnu', errors: [], queued: false, remaining: 108.5 }];
    await act(async () => { window.dispatchEvent(new CustomEvent('btp:pa-update', { detail: {} })); await new Promise(r => setTimeout(r, 10)); });
    expect(logic.state.docs[0]).toMatchObject({ st: 4, motif: 'Destinataire inconnu', paQueued: false });
    expect(logic.state.paSt).toBe('connecte');
    expect(logic.state.paAcc).toMatchObject({ name: 'PA test', since: '30/09/2026' });
    await unmount();
  });
});
