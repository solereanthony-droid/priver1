// @vitest-environment jsdom
// Sauvegarde locale : gros contenus dans IndexedDB, alerte si le stockage est plein.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as blobs from '../src/storage/blobStore.js';
import App from '../src/app/App.jsx';
import BtpLogic from '../src/app/logic.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollTo ??= function () {};

const bigPng = n => 'data:image/png;base64,' + 'A'.repeat(n);
const tick = (ms = 30) => act(() => new Promise(r => setTimeout(r, ms)));
const mount = () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host); act(() => root.render(React.createElement(App)));
  return { host, unmount: () => act(() => root.unmount()) };
};
const saved = () => JSON.parse(localStorage.getItem(BtpLogic.KEY) || 'null');
const plan = (id, src) => ({ id, name: 'Plan ' + id, kind: 'import', mime: 'image/png', src, fileName: id + '.png', devisNo: 'DEV-2026-041', facNo: null, date: '30/09/2026' });

describe('externalize / hydrate', () => {
  it('remplace les gros data: URL par des références et les restaure', () => {
    const img = bigPng(40000), small = 'data:image/png;base64,AAAA';
    const { json, blobs: found, refs } = blobs.externalize({ a: [img, small], b: { c: img }, d: 'texte' });
    expect(json.length).toBeLessThan(400);
    expect(found.size).toBe(1);                      // même image → une seule copie
    expect([...refs]).toHaveLength(1);
    const back = blobs.hydrate(JSON.parse(json), found);
    expect(back).toEqual({ a: [img, small], b: { c: img }, d: 'texte' });
    expect(blobs.hydrate(JSON.parse(json), new Map()).a[0]).toBe('');   // référence perdue → vide, sans planter
  });
});

describe('Sauvegarde avec plans importés', () => {
  beforeEach(async () => {
    localStorage.clear();
    await blobs.prune(new Set());
  });

  it('plans importés : localStorage reste léger, tout est restauré au rechargement', async () => {
    const a = bigPng(1_500_000), b = bigPng(1_500_001);   // l'ancienne sauvegarde doit elle-même tenir dans le quota
    localStorage.setItem(BtpLogic.KEY, JSON.stringify({ client: 'Mme Import', plans: [plan('pa', a), plan('pb', b)] }));   // ancienne sauvegarde (en ligne)
    let app = mount();
    await tick(80);
    // Une modification déclenche l'enregistrement au nouveau format.
    const input = () => [...app.host.querySelectorAll('input')].find(i => i.value === 'Mme Import');
    act(() => app.host.querySelectorAll('nav button')[1].click());
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    act(() => { const i = input(); set.call(i, 'Mme Import 2'); i.dispatchEvent(new Event('input', { bubbles: true })); });
    await vi.waitFor(() => expect(saved().client).toBe('Mme Import 2'), { timeout: 3000 });
    expect(localStorage.getItem(BtpLogic.KEY).length).toBeLessThan(200_000);
    expect(saved().plans.map(p => p.src)).toEqual([expect.stringMatching(/^btp-idb:/), expect.stringMatching(/^btp-idb:/)]);
    expect(await blobs.keys()).toHaveLength(2);
    app.unmount();

    // « Rechargement » : les images reviennent d'IndexedDB.
    app = mount();
    await tick(80);
    act(() => app.host.querySelectorAll('nav button')[1].click());
    expect([...app.host.querySelectorAll('input')].some(i => i.value === 'Mme Import 2')).toBe(true);
    app.unmount();
    const restored = await blobs.getMany([...blobs.refsIn(saved())]);
    expect([...restored.values()].map(v => v.length).sort()).toEqual([a.length, b.length].sort());
  });

  it('stockage plein : l’utilisateur est prévenu au lieu de perdre ses modifications en silence', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    const app = mount();
    await tick(50);
    act(() => app.host.querySelectorAll('nav button')[1].click());
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const i = [...app.host.querySelectorAll('input')].find(x => x.value === 'M. et Mme Payet');
    act(() => { set.call(i, 'X'); i.dispatchEvent(new Event('input', { bubbles: true })); });
    await vi.waitFor(() => expect(app.host.textContent).toMatch(/Stockage plein/), { timeout: 3000 });
    spy.mockRestore();
    app.unmount();
  });
});
