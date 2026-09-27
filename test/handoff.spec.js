// Tests de la liste « Tests à passer » du handoff v11 (docs/design-handoff/MISES_A_JOUR.md).
import { describe, it, expect, vi, afterEach } from 'vitest';
import App, { idNeed, wizRooms, wizLayout, offersOf, catOf } from '../src/app/logic.js';

// Contrôleur avec un setState synchrone (sans React), pour enchaîner les actions comme un utilisateur.
const live = (state = {}) => {
  const c = new App({ regime: 'assujetti', acompte: 30, paName: 'FactuPro 974' });
  c.state = { ...c.state, ...state };
  c.setState = (u, cb) => { const p = typeof u === 'function' ? u(c.state, c.props) : u; if (p) c.state = { ...c.state, ...p }; if (cb) cb(); };
  return c;
};
const plan = (c, id) => c.plans().find(p => p.id === id);
const pick = o => (o.on || o.onPick)();
afterEach(() => vi.useRealTimers());

describe('Plan unifilaire', () => {
  it('« Tout corriger » supprime toutes les alertes du plan de démo « villa Payet »', () => {
    const c = live({ tab: 'plan', planId: 'p1' });
    expect(c.planIssues(plan(c, 'p1')).filter(i => i.fix).length).toBeGreaterThan(0);
    c.renderVals().pl.fixAll();
    expect(c.planIssues(plan(c, 'p1')).filter(i => i.fix)).toEqual([]);
  });

  it('calibre des ID : 40 A pour 76 A calculés → alerte, « Passer en 63 A » la résout', () => {
    const c = live();
    const p = {
      diffs: [{ id: 'd0', cal: 40, type: 'A' }, { id: 'd1', cal: 40, type: 'AC' }],
      circuits: [['Chauffe-eau', 20, 'd0'], ['Chauffage séjour', 20, 'd0'], ['Prises cuisine', 20, 'd0'], ['Plaque de cuisson', 32, 'd0'], ['Lave-linge', 20, 'd0'],
        ['Éclairage', 10, 'd1'], ['Éclairage chambres', 10, 'd1']].map(([label, cal, diff], i) => ({ id: 900 + i, label, cal, diff, pts: 2 })),
    };
    expect(idNeed(p, p.diffs[0]).need).toBe(76);
    const alert = c.planIssues(p).find(i => /ID1 : 40 A, il faut au moins 76 A/.test(i.t));
    expect(alert.fixL).toBe('Passer en 63 A');
    const fixed = { ...p, ...alert.fix(p) };
    expect(c.planIssues(fixed).some(i => /^ID1 :.*il faut au moins/.test(i.t))).toBe(false);
  });
});

describe('Assistant « Plan du logement »', () => {
  const w = { S: 90, ch: 3, sdb: 1, wc: true, open: false, cellier: true, bureau: 0, garage: false, terrasse: true };
  it('90 m², 3 chambres, cuisine fermée, cellier → 9 pièces habitables + terrasse, séjour de 26 m²', () => {
    // La fiche du handoff annonce « 10 pièces + terrasse » : le calcul du prototype donne 9 pièces + terrasse (10 éléments).
    expect(wizRooms(w).map(r => r.n)).toEqual(['Entrée', 'Séjour', 'Cuisine', 'Cellier', 'WC', 'Chambre 1', 'Chambre 2', 'Chambre 3', 'Salle de bain']);
    expect(wizRooms(w).find(r => r.n === 'Séjour').m2).toBe(26);
    const L = wizLayout(w).rooms;
    expect(L).toHaveLength(10);
    expect(L.at(-1)).toMatchObject({ n: 'Terrasse', ext: true });
  });

  it('« Placer selon la norme » : minimums par pièce et circuits dans les limites', () => {
    vi.useFakeTimers();
    const c = live({ tab: 'plan', planId: 'p1' });
    c.renderVals().pl.views[1].on();
    let im = c.renderVals().pl.im;
    im.wiz.show();
    im = c.renderVals().pl.im;
    pick(im.wiz.yns[0].opts[1]);                              // cuisine fermée
    pick(c.renderVals().pl.im.wiz.yns[2].opts[0]);             // cellier
    c.renderVals().pl.im.wiz.gen();                           // génère puis place les symboles
    vi.runAllTimers();

    const p = plan(c, 'p1'), { rooms, items } = p.impl;
    const inRoom = (r, s) => items.filter(i => i.s === s && i.x >= r.x && i.x <= r.x + r.w && i.y >= r.y && i.y <= r.y + r.h).length;
    const room = n => rooms.find(r => r.n === n);
    expect(inRoom(room('Séjour'), 'pc')).toBe(7);
    expect(inRoom(room('Séjour'), 'rj')).toBe(2);
    for (const n of ['Chambre 1', 'Chambre 2', 'Chambre 3']) { expect(inRoom(room(n), 'pc')).toBe(3); expect(inRoom(room(n), 'rj')).toBe(1); }
    expect(inRoom(room('Cuisine'), 'pc')).toBe(6);
    expect(inRoom(room('Cuisine'), 'p32')).toBe(1);

    const lim = c2 => /cuisine/i.test(c2.label) && c2.cal === 20 ? 6 : c2.cal >= 20 ? 12 : 8;
    for (const ci of p.circuits) expect(ci.pts || 0, ci.label).toBeLessThanOrEqual(lim(ci));
  });
});

describe('Comparateur de prix', () => {
  it('« Choisir » met à jour fournisseur, achat et PU des lignes du devis, et les totaux', () => {
    const c = live({ tab: 'cat' });
    const line = c.state.lines.find(l => l.kind === 'mat'), before = c.totals();
    const item = catOf(c.state.metier).find(x => x.ref === line.ref);
    const offers = offersOf(item);
    expect(offers.length).toBeGreaterThanOrEqual(2);
    c.setState({ cmpRef: line.ref });
    const rows = c.renderVals().cmp.rows, i = rows.findIndex(r => r.fourn !== line.fourn);
    rows[i].on();
    const upd = c.state.lines.find(l => l.id === line.id), chosen = offers.find(o => o.fourn === rows[i].fourn);
    expect(upd).toMatchObject({ fourn: chosen.fourn, achat: chosen.achat });
    expect(upd.pu).toBeCloseTo(chosen.achat * 1.35, 2);
    expect(c.state.catPref[line.ref]).toEqual({ fourn: chosen.fourn, achat: chosen.achat });
    expect(c.totals().ttc).not.toBe(before.ttc);
  });
});
