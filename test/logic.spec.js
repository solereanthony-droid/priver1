// Règles métier du prototype (« à reproduire exactement ») et rendu de chaque écran.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App, { docNo } from '../src/app/logic.js';

const make = (state = {}, props = {}) => {
  const c = new App({ regime: 'assujetti', acompte: 30, paName: 'FactuPro 974', ...props });
  c.state = { ...c.state, ...state };
  c.setState = () => {};
  return c;
};

const LINES = [
  { id: 1, kind: 'mat', name: 'Prise 2P+T', unit: 'u', qty: 3, achat: 7, pu: 10, tva: 8.5 },
  { id: 2, kind: 'mat', name: 'Article 2,1 %', unit: 'u', qty: 1, achat: 70, pu: 100, tva: 2.1 },
  { id: 3, kind: 'mo', name: "Main d'œuvre", unit: 'h', qty: 2, achat: 0, pu: 48, tva: 8.5 },
  { id: 4, kind: 'dep', name: 'Déplacement', unit: 'forfait', qty: 1, achat: 0, pu: 35, tva: 8.5 },
];

describe('totals()', () => {
  it('TVA DOM 8,5 % et 2,1 % sur la base remisée, acompte et solde au centime', () => {
    const T = make({ lines: LINES, remiseTxt: '10', acompte: 30 }).totals();
    expect(T).toMatchObject({ mat: 130, mo: 96, dep: 35, remise: 26.1, ht: 234.9, t85: 12.32, t21: 1.89, ttc: 249.11, ac: 74.73, solde: 174.38, marge: 26, micro: false });
    expect(T.pct).toBeCloseTo(22.22, 2);
  });
  it('micro-entreprise : TVA 0 (art. 293 B), TTC = HT', () => {
    const T = make({ lines: LINES, remiseTxt: '0', acompte: 0, regime: 'micro' }).totals();
    expect(T).toMatchObject({ t85: 0, t21: 0, ht: 261, ttc: 261, ac: 0, solde: 261, micro: true });
  });
  it('remise saisie avec virgule, bornée entre 0 et 100 %', () => {
    expect(make({ lines: LINES, remiseTxt: '5,5' }).totals().remise).toBe(14.36);
    expect(make({ lines: LINES, remiseTxt: '250' }).totals().ht).toBe(0);
    expect(make({ lines: LINES, remiseTxt: '-3' }).totals().remise).toBe(0);
  });
});

describe('numérotation', () => {
  const d = new Date(2027, 0, 5);
  it('trois chiffres minimum, sans « 0 » en trop au-delà de 99', () => {
    expect(docNo('DEV', 42, d)).toBe('DEV-2027-042');
    expect(docNo('FAC', 7, d)).toBe('FAC-2027-007');
    expect(docNo('DEV', 100, d)).toBe('DEV-2027-100');
  });
});

describe('rendu des écrans', () => {
  const screens = ['home', 'devis', 'docs', 'cat', 'set', 'stats', 'marge', 'outil', 'projet', 'plan'];
  for (const tab of screens) {
    it(`écran « ${tab} » sans erreur`, () => {
      const html = renderToStaticMarkup(make({ tab }).render());
      expect(html.length).toBeGreaterThan(1000);
    });
  }
  it('feuilles modales (récap, métier, aperçu) sans erreur', () => {
    for (const st of [{ tab: 'devis', recapOpen: true }, { metierOpen: true }, { tab: 'devis', previewOpen: true }]) {
      expect(renderToStaticMarkup(make(st).render())).toContain('data-screen-label');
    }
  });
  it('devis sans acompte marqué provisoire', () => {
    expect(renderToStaticMarkup(make({ tab: 'devis', previewOpen: true, acompte: 0 }).render())).toMatch(/PROVISOIRE/i);
  });
});
