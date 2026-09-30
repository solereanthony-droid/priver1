// Tests de la liste « Tests v13 » (docs/design-handoff/MISES_A_JOUR.md).
import { describe, it, expect, vi, afterEach } from 'vitest';
import App from '../src/app/logic.js';

const live = (state = {}) => {
  const c = new App({ regime: 'assujetti', acompte: 30, paName: 'FactuPro 974' });
  c.state = { ...c.state, ...state };
  c.setState = (u, cb) => { const p = typeof u === 'function' ? u(c.state, c.props) : u; if (p) c.state = { ...c.state, ...p }; if (cb) cb(); };
  c.flash = m => { c.lastFlash = m; };
  return c;
};
const V = c => c.renderVals();
const sp = t => String(t).replace(/[\u202f\u00a0]/g, ' ');
const ev = value => ({ target: { value } });
afterEach(() => vi.unstubAllGlobals());

describe('Accueil', () => {
  it('le titre reprend le nom des Réglages (prénom abrégé), une forme juridique reste entière', () => {
    const c = live({ tab: 'home' });
    expect(V(c).coName).toBe('J. Hoarau Électricité');
    V(c).co.onName(ev('SARL Dupont'));
    expect(V(c).coName).toBe('SARL Dupont');
    V(c).co.onName(ev('Dupont'));
    expect(V(c).coName).toBe('Dupont');
  });
  it('pastille En ligne / Hors ligne', () => {
    expect(V(live({ offline: false })).net.txt).toBe('En ligne');
    expect(V(live({ offline: true })).net.txt).toBe('Hors ligne');
  });
});

describe('Encaissements', () => {
  it('« Marquer encaissée » déplace la facture dans le relevé et met à jour les totaux', () => {
    const c = live({ tab: 'enc' });
    const before = V(c).enc, due = before.due.find(d => d.no === 'FAC-2026-028');
    expect(before.paid.map(p => p.no)).not.toContain('FAC-2026-028');
    due.markPaid();
    const after = V(c).enc;
    expect(after.paid.map(p => p.no)).toContain('FAC-2026-028');
    expect(after.due.map(d => d.no)).not.toContain('FAC-2026-028');
    expect(sp(after.paidTot)).toBe('3 320 €');
    expect(after.dueTot).not.toBe(before.dueTot);
    expect(c.state.docs.find(d => d.no === 'FAC-2026-028').paidOn).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);   // v15 : JJ/MM/AAAA
    expect(sp(JSON.stringify(V(live({ ...c.state, tab: 'home' }))))).toMatch(/dont 3 320 € encaissé/);
  });
});

describe('Aperçu des messages', () => {
  const stubOpen = () => { const open = vi.fn(); vi.stubGlobal('window', { open }); return open; };

  it('relance : fermer n’enregistre rien, « Ouvrir » marque la relance J+3', () => {
    const open = stubOpen();
    const c = live({ tab: 'transfo' });
    const trRel0 = JSON.stringify(c.state.trRel || {});
    V(c).tr.wait[0].mail();
    expect(V(c).mail.open).toBe(true);
    V(c).mail.close();
    expect(JSON.stringify(c.state.trRel || {})).toBe(trRel0);
    expect(open).not.toHaveBeenCalled();
    V(c).tr.wait[0].mail();
    V(c).mail.send();
    expect(open).toHaveBeenCalledOnce();
    expect(JSON.stringify(c.state.trRel || {})).not.toBe(trRel0);
    expect(V(c).tr.wait[0].steps[0].bg).not.toBe(V(live({ tab: 'transfo' })).tr.wait[0].steps[0].bg);
  });

  it('objet et texte modifiés partent dans le mailto:, « Revenir au texte proposé » restaure', () => {
    const open = stubOpen();
    const c = live({ tab: 'transfo' });
    V(c).tr.wait[0].mail();
    const orig = V(c).mail.subject;
    V(c).mail.onSubject(ev('Objet modifié'));
    V(c).mail.reset();
    expect(V(c).mail.subject).toBe(orig);
    V(c).mail.onSubject(ev('Objet modifié'));
    V(c).mail.onBody(ev('Texte modifié & accentué'));
    V(c).mail.send();
    const href = open.mock.calls[0][0];
    expect(href).toMatch(/^mailto:/);
    expect(decodeURIComponent(href)).toContain('subject=Objet modifié');
    expect(decodeURIComponent(href)).toContain('body=Texte modifié & accentué');
    expect(open.mock.calls[0][2]).toBe('noopener,noreferrer');
  });
});

describe('Vérification avant facture', () => {
  it('bouton grisé tant que les 3 cases ne sont pas cochées ; facture créée « Émise », non transmise', () => {
    const c = live({ tab: 'devis' });
    V(c).toFacture();
    let fv = V(c).fv;
    expect(fv.open).toBe(true);
    expect(fv.blocked).toBe(true);
    const docs0 = c.state.docs.length;
    fv.ok();
    expect(c.state.docs.length).toBe(docs0);                 // rien tant que ce n'est pas coché
    V(c).fv.checks.forEach((_, i) => V(c).fv.checks[i].toggle());
    fv = V(c).fv;
    expect(fv.cnt).toBe('3 / 3');
    expect(fv.blocked).toBe(false);
    fv.ok();
    const fac = c.state.docs.find(d => d.no === 'FAC-2026-029');
    expect(fac).toBeTruthy();
    expect(fac.type).toBe('fac');
    expect(fac.st).toBe(0);                                  // 0 = Émise (FAC_ST), pas « Transmise »
  });
  it('client vide → alerte bloquante', () => {
    const c = live({ tab: 'devis', client: '' });
    V(c).toFacture();
    V(c).fv.checks.forEach((_, i) => V(c).fv.checks[i].toggle());
    const fv = V(c).fv;
    expect(fv.warn.length).toBeGreaterThan(0);
    expect(fv.blocked).toBe(true);
  });
});

describe('Export CSV pour le comptable', () => {
  it('UTF-8 avec BOM, séparateur « ; », décimales à virgule', async () => {
    let blob = null;
    const a = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => a, body: { appendChild: vi.fn() } });
    vi.stubGlobal('URL', { createObjectURL: b => { blob = b; return 'blob:x'; }, revokeObjectURL: vi.fn() });
    const c = live({ tab: 'stats' });
    V(c).st.exportCsv();
    expect(a.click).toHaveBeenCalled();
    expect(a.download).toMatch(/\.csv$/);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.slice(3)).split('\n');
    expect(text[0]).toBe('Mois;CA TTC;CA HT;TVA 8,5 %;TVA 2,1 %;Encaissé;En attente');
    for (const row of text.slice(1)) {
      const cells = row.split(';');
      expect(cells).toHaveLength(7);
      cells.slice(1).forEach(x => expect(x).toMatch(/^-?\d+,\d{2}$/));
    }
  });
});

describe('Export CSV en micro-entreprise', () => {
  it('pas de TVA (art. 293 B) : colonnes TVA à 0, HT = TTC', async () => {
    let blob = null;
    vi.stubGlobal('document', { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } });
    vi.stubGlobal('URL', { createObjectURL: b => { blob = b; return 'blob:x'; }, revokeObjectURL() {} });
    const c = live({ tab: 'stats', regime: 'micro' });
    V(c).st.exportCsv();
    const rows = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(3)).split('\n').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) { const [, ttc, ht, t85, t21] = r.split(';'); expect(ht).toBe(ttc); expect(t85).toBe('0,00'); expect(t21).toBe('0,00'); }
  });
});

describe('Calcul de marge', () => {
  it('remise simulée au-delà du maximum → terracotta ; « Corriger les N lignes » supprime les alertes', () => {
    const c = live({ tab: 'marge' });
    // Une ligne vendue presque au prix d'achat passe sous le seuil (15 %).
    c.setState(st => ({ lines: st.lines.map((l, i) => i === 0 ? { ...l, pu: l.achat * 1.05 } : l) }));
    let mg = V(c).mg;
    mg.onSim(ev('30'));
    expect(V(c).mg.simInk).toMatch(/accent-(?!2)/);
    expect(V(c).mg.nLow).toBeTruthy();
    V(c).mg.fixAll();
    expect(V(c).mg.nLow).toBeFalsy();
  });
});

describe('Documents', () => {
  it('recherche sans accents, cases de statut filtrantes', () => {
    const c = live({ tab: 'docs', docQ: 'grondin' });
    expect(V(c).docList.map(d => d.client)).toEqual([expect.stringMatching(/^M\. Grondin/)]);
    c.setState({ docQ: '' });
    const all = V(c).docList.length;
    V(c).docChips[1].onPick();
    const filtered = V(c).docList;
    expect(filtered.length).toBeLessThan(all);
    expect(new Set(filtered.map(d => d.status))).toEqual(new Set([V(c).docChips[1].l]));
    V(c).docChips[1].onPick();
    expect(V(c).docList.length).toBe(all);
  });
});

describe('Plans', () => {
  it('« Implanter mes circuits » : l’image importée devient le fond de l’implantation', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const c = live();
    c.setState({ plans: [{ id: 'pi', name: 'Plan maison', kind: 'import', mime: 'image/png', src: png, fileName: 'plan.png', devisNo: c.curNo(), facNo: null, date: '29/09/2026' }, ...c.plans()] });
    c.implantFrom('pi');
    const uni = c.plans().find(p => p.kind === 'unifilaire' && p.devisNo === c.curNo());
    expect(uni.impl.bg).toBe(png);
    expect(c.state.tab).toBe('plan');
    expect(V(c).pl.im.bg).toBe(png);
  });
});

describe('Retour arrière', () => {
  for (const tab of ['docs', 'devis', 'set', 'marge', 'enc', 'panier', 'transfo']) {
    it(`« ${tab} » revient à l’écran précédent, sinon à l’Accueil`, () => {
      const c = live({ tab: 'stats' });
      c.go(tab);
      V(c).goBack();
      expect(c.state.tab).toBe('stats');
      const d = live({ tab, prevTab: undefined });
      V(d).goBack();
      expect(d.state.tab).toBe('home');
    });
  }
});
