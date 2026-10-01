// @vitest-environment jsdom
// v15.3 → v15.8 (MISE_A_JOUR_v15.md) et adaptations de l'app (scripts/import-handoff.py) : session d'onglet
// décidée après lecture de la sauvegarde, pas de window.btpDemo, preuve d'accord archivée avec la facture.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import App from '../src/app/logic.js';

const live = (state = {}) => {
  const c = new App({ regime: 'assujetti', acompte: 30, paName: 'FactuPro 974' });
  c.state = { ...c.state, ...state };
  c.setState = (u, cb) => { const p = typeof u === 'function' ? u(c.state, c.props) : u; if (p) c.state = { ...c.state, ...p }; if (cb) cb(); };
  c.flash = m => { c.lastFlash = m; }; c.go = tab => { c.state = { ...c.state, tab }; };
  return c;
};
const devis = (c, no) => { c.state = { ...c.state, tab: 'docs', docTab: 'devis' }; return c.renderVals().docList.find(d => d.no === no)._cf('docs'); };
afterEach(() => { try { sessionStorage.clear(); } catch (e) { /* jsdom */ } });

describe('v15.7 : session d’onglet (adaptée à l’app)', () => {
  const mount = state => {
    const c = live({ locked: true, ...state });
    c.componentDidMount();
    return c;
  };
  const ready = (c, extra) => { const ps = c.state; c.state = { ...c.state, restored: true, ...extra }; c.componentDidUpdate(c.props, ps); };
  const remember = (role, ageMs = 1000) => sessionStorage.setItem(App.SKEY, JSON.stringify({ role, rhEmp: null, at: Date.now() - ageMs }));

  it('rechargement dans le délai : rouvre sans code, mais seulement une fois la sauvegarde lue et le mode connu', () => {
    remember('owner');
    const c = mount();
    expect(c.state.locked).toBe(true);                                // rien n'est décidé au montage
    ready(c, { authMode: 'local', lockDelay: 5 });
    expect(c.state).toMatchObject({ locked: false, role: 'owner' });
    c.componentWillUnmount();
  });
  it('délai « Immédiat » lu dans la sauvegarde, délai dépassé ou mode serveur : code demandé', () => {
    for (const [extra, age] of [[{ authMode: 'local', lockDelay: 0 }, 1000], [{ authMode: 'local', lockDelay: 5 }, 6 * 60000], [{ authMode: 'server', lockDelay: 5 }, 1000]]) {
      remember('owner', age);
      const c = mount();
      ready(c, extra);
      expect(c.state.locked, JSON.stringify(extra)).toBe(true);
      c.componentWillUnmount();
    }
  });
  it('« Verrouiller » efface la session d’onglet ; aucun code ni empreinte dedans', () => {
    const c = live({ locked: false, role: 'owner', ownerHash: 'pbkdf2$1$x$y' });
    c.componentDidUpdate(c.props, { ...c.state, locked: true });
    const saved = sessionStorage.getItem(App.SKEY);
    expect(saved).toContain('owner');
    expect(saved).not.toContain('pbkdf2');
    c.lock();
    expect(sessionStorage.getItem(App.SKEY)).toBeNull();
  });
});

describe('import du prototype', () => {
  it('pas de poignée globale sur l’état (window.btpDemo)', () => {
    expect(fs.readFileSync('src/app/logic.js', 'utf8')).not.toContain('btpDemo');
  });
  it('cadenas de l’Accueil relié à lock()', () => {
    expect(fs.readFileSync('src/app/template.html', 'utf8')).toMatch(/onClick="\{\{ lockNow \}\}" aria-label="Verrouiller l’app"/);
  });
});

describe('v15.6 : état d’un devis et e-mail de validation', () => {
  const proof = { src: 'data:image/png;base64,iVBORw0KGgo=', name: 'bon-pour-accord.png', pdf: false };
  it('Brouillon → Accepté bloqué ; Envoyé → Accepté seulement avec la preuve ; retour à Envoyé efface la preuve', () => {
    const c = live({ locked: false, role: 'owner' });
    c.state = { ...c.state, docs: c.state.docs.map(d => d.no === 'DEV-2026-040' ? { ...d, st: 0 } : d), stCf: { no: 'DEV-2026-040', ctx: 'docs', to: 2 } };
    let x = devis(c, 'DEV-2026-040');
    expect(x.cfHasWarn).toBe(true);
    x.cfOk();
    expect(c.state.docs.find(d => d.no === 'DEV-2026-040').st).toBe(0);

    c.state = { ...c.state, docs: c.state.docs.map(d => d.no === 'DEV-2026-040' ? { ...d, st: 1 } : d), stCf: { no: 'DEV-2026-040', ctx: 'docs', to: 2 } };
    x = devis(c, 'DEV-2026-040');
    expect(x).toMatchObject({ cfNeedProof: true, cfOkOp: 0.45 });
    x.cfOk();
    expect(c.state.docs.find(d => d.no === 'DEV-2026-040').st).toBe(1);
    c.state = { ...c.state, stCf: { ...c.state.stCf, proof } };
    devis(c, 'DEV-2026-040').cfOk();
    expect(c.state.docs.find(d => d.no === 'DEV-2026-040')).toMatchObject({ st: 2, accProof: proof });

    c.state = { ...c.state, stCf: { no: 'DEV-2026-040', ctx: 'docs', to: 1 } };
    devis(c, 'DEV-2026-040').cfOk();
    expect(c.state.docs.find(d => d.no === 'DEV-2026-040')).toMatchObject({ st: 1, accProof: null });
  });

  it('la facture issue d’un devis accepté garde la preuve d’accord du client', () => {
    const c = live({ locked: false, role: 'owner', tab: 'devis' });
    const liveNo = c.state.docs.find(d => d.live).no;
    c.state = { ...c.state, docs: c.state.docs.map(d => d.live ? { ...d, st: 2, accProof: proof, accAt: '01/10/2026' } : d) };
    c.renderVals().doFacture();
    const f = c.state.docs.find(d => d.type === 'fac' && d.devisNo === liveNo);
    expect(f).toMatchObject({ accProof: proof, accAt: '01/10/2026' });
  });
});
