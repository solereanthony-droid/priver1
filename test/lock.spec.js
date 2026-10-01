// @vitest-environment jsdom
// Écran de verrouillage (ADR 0001 et 0002) : codes à 6 chiffres, jamais en clair, verrou à chaque ouverture,
// premier Code patron, Code salarié propre à chacun, blocage progressif enregistré, verrouillage automatique.
import { describe, it, expect, afterEach } from 'vitest';
import App from '../src/app/logic.js';
import { verifyCode, weakCode } from '../src/auth/code.js';

const live = (state = {}) => {
  const c = new App({ regime: 'assujetti', acompte: 30, paName: 'FactuPro 974' });
  c.state = { ...c.state, restored: true, authMode: 'local', ...state };
  c.setState = (u, cb) => { const p = typeof u === 'function' ? u(c.state, c.props) : u; if (p) c.state = { ...c.state, ...p }; if (cb) cb(); };
  c.flash = m => { c.lastFlash = m; }; c.go = tab => { c.state = { ...c.state, tab }; };
  return c;
};
// Saisie au pavé : le sixième chiffre déclenche la vérification (asynchrone : empreintes PBKDF2).
const type = async (c, code) => {
  for (const k of code) c.renderVals().lk.keys.find(x => x.l === k).on();
  await new Promise(r => setTimeout(r, 140));
  for (let i = 0; i < 100 && c.state.lkBusy; i++) await new Promise(r => setTimeout(r, 20));
};
const reload = c => { const n = live({ authMode: 'local' }); n.restore(JSON.parse(JSON.stringify(c.snapshot()))); return n; };
afterEach(() => { delete globalThis.__btpLogin; delete globalThis.__btpStaffCode; delete globalThis.__btpOwnerCode; });

describe('écran de verrouillage', () => {
  it('verrouillé à chaque ouverture ; « Un instant… » tant que la sauvegarde et le mode ne sont pas connus', () => {
    const c = new App({});
    expect(c.state.locked).toBe(true);
    c.state = { ...c.state, restored: false };
    expect(c.renderVals().lk).toMatchObject({ open: true, sub: 'Un instant…', blocked: true });
    expect(c.renderVals().lk.dots).toHaveLength(6);
  });

  it('premier lancement : choisir le Code patron (deux fois), code évident refusé, rien en clair dans la sauvegarde', async () => {
    const c = live();
    expect(c.renderVals().lk.title).toBe('Choisis ton code patron');
    await type(c, '123456');
    expect(c.state.lkErr).toMatch(/trop évident/);
    await type(c, '582916');
    expect(c.renderVals().lk.title).toBe('Confirme ton code patron');
    await type(c, '582917');
    expect(c.state.lkErr).toMatch(/ne correspondent pas/);
    await type(c, '582916'); await type(c, '582916');
    expect(c.state).toMatchObject({ locked: false, role: 'owner' });
    const saved = JSON.stringify(c.snapshot());
    expect(saved).not.toContain('582916');
    expect(await verifyCode('582916', c.state.ownerHash)).toBe(true);
    expect(App.KEEP).not.toContain('ownerCode');
  });

  it('Code patron : mauvais code refusé ; 10 échecs → blocage jusqu’à hh:mm, qui survit au rechargement', async () => {
    const c = live({ ownerHash: await (await import('../src/auth/code.js')).hashCode('582916') });
    expect(c.renderVals().lk.title).toBe('Code d’accès');
    await type(c, '000001');
    expect(c.state.lkErr).toBe('Code incorrect');
    c.state = { ...c.state, lkGuard: { ...c.state.lkGuard, fails: 9 } };
    await type(c, '000002');
    expect(c.renderVals().lk.err).toMatch(/accès bloqué jusqu’à \d\d:\d\d/);
    const n = reload(c);
    expect(n.renderVals().lk).toMatchObject({ blocked: true });
    expect(n.renderVals().lk.err).toMatch(/accès bloqué jusqu’à/);
    await type(n, '582916');                                           // même le bon code attend
    expect(n.state.locked).toBe(true);
    clearTimeout(c._lkT); clearTimeout(n._lkT);
  });

  it('Code salarié : généré, affiché une seule fois, unique ; « C’est bien toi ? » avant son écran', async () => {
    const { hashCode } = await import('../src/auth/code.js');
    const c = live({ locked: false, role: 'owner', ownerHash: await hashCode('582916'), tab: 'rh' });
    let card = c.renderVals().rh.staff.find(p => p.nom === 'Kévin Payet');
    expect(card).toMatchObject({ canCode: true, codeOff: true, codeOffTxt: 'Aucun code d’accès', codeBtn: 'Créer son code' });
    await c.staffCode('k');
    const code = c.state.rhPin.code;
    expect(code).toMatch(/^\d{6}$/);
    expect(weakCode(code)).toBe(false);
    card = c.renderVals().rh.staff.find(p => p.nom === 'Kévin Payet');
    expect(card).toMatchObject({ codeShown: true, code });
    card.share();
    expect(c.state.mailDraft.body).toContain('code personnel ' + code);
    card.hideCode();
    card = c.renderVals().rh.staff.find(p => p.nom === 'Kévin Payet');
    expect(card).toMatchObject({ codeShown: false, codeOn: true, code: '' });
    expect(JSON.stringify(c.snapshot())).not.toContain(code);
    expect(c.renderVals().rh.staff.find(p => p.nom === 'Julien Hoarau').canCode).toBe(false);

    c.lock();
    await type(c, code);
    expect(c.renderVals().lk).toMatchObject({ who: true, pad: false, title: 'C’est bien toi, Kévin ?' });
    c.renderVals().lk.no();
    expect(c.state).toMatchObject({ locked: true, lkStep: 'login', role: null });
    await type(c, code);
    c.renderVals().lk.yes();
    expect(c.state).toMatchObject({ locked: false, role: 'staff', rhEmp: { who: 'k' } });

    // Nouveau code : l'ancien ne fonctionne plus.
    c.lock(); c.state = { ...c.state, locked: false, role: 'owner' };
    await c.staffCode('k');
    c.lock();
    await type(c, code);
    expect(c.state.lkErr).toBe('Code incorrect');
  });

  it('ancienne sauvegarde : ownerCode et codes à 4 chiffres abandonnés, nouveau Code patron demandé, « Code à renouveler »', () => {
    const c = live();
    const R = c.rhData();
    c.restore({ ownerCode: '1974', rh: { ...R, staff: R.staff.map(p => p.id === 'k' ? { ...p, pin: '4821' } : p) } });
    expect(c.state.ownerCode).toBeUndefined();
    expect(JSON.stringify(c.snapshot())).not.toContain('4821');
    expect(c.renderVals().lk.title).toBe('Choisis ton code patron');
    c.state = { ...c.state, locked: false, tab: 'rh' };
    expect(c.renderVals().rh.staff.find(p => p.nom === 'Kévin Payet')).toMatchObject({ codeOff: true, codeOffTxt: 'Code à renouveler', codeBtn: 'Nouveau code' });
  });

  it('changer le Code patron : code actuel exigé, puis le nouveau deux fois ; Annuler referme', async () => {
    const { hashCode } = await import('../src/auth/code.js');
    const c = live({ locked: false, role: 'owner', ownerHash: await hashCode('582916') });
    c.renderVals().lockSet.change();
    expect(c.renderVals().lk).toMatchObject({ open: true, title: 'Changer le code patron', cancel: true });
    await type(c, '111112');
    expect(c.state.lkErr).toBe('Code patron actuel incorrect');
    await type(c, '582916');
    await type(c, '730481'); await type(c, '730481');
    expect(c.state.lkChange).toBe(false);
    expect(await verifyCode('730481', c.state.ownerHash)).toBe(true);
    c.renderVals().lockSet.change();
    c.renderVals().lk.onCancel();
    expect(c.renderVals().lk.open).toBe(false);
  });

  it('mode serveur : le serveur vérifie les codes et crée les Codes salariés ; changement impossible hors ligne', async () => {
    const c = live({ authMode: 'server' });
    expect(c.renderVals().lk.title).toBe('Code d’accès');                 // pas de premier code local
    const seen = [];
    globalThis.__btpLogin = code => { seen.push(code); return true; };
    await type(c, '582916');
    expect(seen).toEqual(['582916']);
    c.state = { ...c.state, locked: false, role: 'owner', tab: 'rh' };
    globalThis.__btpStaffCode = async () => ({ status: 200, data: { code: '730481' } });
    await c.staffCode('k');
    expect(c.state.rhPin).toEqual({ id: 'k', code: '730481' });
    expect(c.rhData().staff.find(p => p.id === 'k').code).toMatchObject({ srv: true });
    expect(JSON.stringify(c.snapshot())).not.toContain('730481');
    c.state = { ...c.state, offline: true };
    expect(c.renderVals().lockSet).toMatchObject({ changeOff: true, changeTxt: 'Connexion requise pour changer le code' });
  });

  it('verrouillage automatique : immédiat, ou après le délai choisi en arrière-plan', () => {
    const c = live({ locked: false, role: 'owner', lockDelay: 0 });
    c.componentDidMount();
    const hide = v => { Object.defineProperty(document, 'visibilityState', { value: v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };
    hide('hidden');
    expect(c.state).toMatchObject({ locked: true, role: null });
    c.state = { ...c.state, locked: false, role: 'owner', lockDelay: 5 };
    hide('hidden'); hide('visible');
    expect(c.state.locked).toBe(false);
    c._hidAt = Date.now() - 5 * 60000 - 1; hide('visible');
    expect(c.state.locked).toBe(true);
    c.componentWillUnmount();
    expect(c.renderVals().lockSet.delayOpts.map(o => o.l)).toEqual(['Immédiat', '1 min', '5 min', '15 min']);
  });
});
