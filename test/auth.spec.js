// Codes d'accès côté serveur : 6 chiffres, empreintes seulement, un code par salarié, blocage progressif.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSessions } from '../server/auth.mjs';
import { admit, fail, pass, freshGuard, LOCKOUT } from '../src/auth/lockout.js';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'auth-')), 'auth.json');
const req = id => ({ headers: { cookie: 'btp_sid=' + id } });

describe('blocage après trop d’essais (règle commune serveur / app)', () => {
  it('10 échecs → 15 min, puis 30 ; un succès remet à zéro ; 5 essais par minute et par origine', () => {
    let g = freshGuard(), t = 1_000_000;
    for (let i = 0; i < 10; i++) { const a = admit(g, t, 'ip' + i); expect(a.blocked).toBeNull(); g = fail(a.g, t); }
    expect(admit(g, t, 'neuve').blocked).toEqual({ until: t + LOCKOUT.BASE, global: true });
    t += LOCKOUT.BASE + 1;
    for (let i = 0; i < 10; i++) g = fail(admit(g, t, 'x' + i).g, t);
    expect(g.until).toBe(t + 2 * LOCKOUT.BASE);
    expect(pass(g)).toMatchObject({ fails: 0, level: 0, until: 0 });
    let h = freshGuard();
    for (let i = 0; i < 5; i++) h = admit(h, 0, 'a').g;
    expect(admit(h, 0, 'a').blocked).toMatchObject({ global: false });
    expect(admit(h, 0, 'b').blocked).toBeNull();
    expect(admit(h, 60_001, 'a').blocked).toBeNull();
  });
  it('plafond de 24 h', () => {
    let g = { ...freshGuard(), level: 20 };
    for (let i = 0; i < 10; i++) g = fail(g, 0);
    expect(g.until).toBe(LOCKOUT.MAX);
  });
});

describe('sessions et codes d’accès', () => {
  it('APP_OWNER_CODE : 6 chiffres obligatoires, code évident refusé', async () => {
    await expect(createSessions({ ownerCode: '4242' })).rejects.toThrow(/6 chiffres/);
    await expect(createSessions({ ownerCode: '123456' })).rejects.toThrow(/évident/);
    expect((await createSessions({})).enabled).toBe(false);
  });

  it('aucun code en clair dans le fichier ; APP_OWNER_CODE ne sert qu’au premier démarrage', async () => {
    const file = tmp();
    const s = await createSessions({ ownerCode: '424242', file });
    expect(fs.readFileSync(file, 'utf8')).not.toContain('424242');
    expect((fs.statSync(file).mode & 0o777).toString(8)).toBe('600');
    const r = await s.login('424242', 'a');
    expect(await s.changeOwner(s.get(req(r.id)), '424242', '581903', 'a')).toEqual({ status: 200 });
    const again = await createSessions({ ownerCode: '424242', file });        // variable inchangée : sans effet
    expect((await again.login('424242', 'b')).status).toBe(401);
    expect((await again.login('581903', 'b')).role).toBe('owner');
  });

  it('un code par salarié : la session porte son identifiant ; nouveau code → ancien refusé et sessions fermées', async () => {
    const s = await createSessions({ ownerCode: '424242' });
    const ck = await s.newStaffCode('k', 'Kévin Payet'), cm = await s.newStaffCode('m', 'Mathis Rivière');
    expect(ck).toMatch(/^\d{6}$/);
    expect(new Set([ck, cm, '424242']).size).toBe(3);
    const rk = await s.login(ck, 'a');
    expect(rk).toMatchObject({ status: 200, role: 'staff', staffId: 'k' });
    expect((await s.login(cm, 'a')).staffId).toBe('m');
    const ck2 = await s.newStaffCode('k', 'Kévin Payet');
    expect(s.get(req(rk.id))).toBeNull();
    expect((await s.login(ck, 'b')).status).toBe(401);
    expect((await s.login(ck2, 'b')).staffId).toBe('k');
  });

  it('changer le Code patron : ancien code exigé, code d’un salarié refusé, autres sessions fermées', async () => {
    const s = await createSessions({ ownerCode: '424242' });
    const ck = await s.newStaffCode('k', 'Kévin');
    const me = await s.login('424242', 'a'), other = await s.login('424242', 'b'), staff = await s.login(ck, 'c');
    const sess = s.get(req(me.id));
    expect((await s.changeOwner(sess, '000001', '581903', 'a')).status).toBe(401);
    expect((await s.changeOwner(sess, '424242', '111111', 'a')).status).toBe(400);
    expect((await s.changeOwner(sess, '424242', ck, 'a')).status).toBe(409);
    expect((await s.changeOwner(sess, '424242', '581903', 'a')).status).toBe(200);
    expect(s.get(req(me.id))).not.toBeNull();
    expect(s.get(req(other.id))).toBeNull();
    expect(s.get(req(staff.id))).toBeNull();
  });

  it('10 échecs d’affilée, même depuis des IP différentes → verrou, même pour le bon code', async () => {
    let t = 1_000_000;
    const s = await createSessions({ ownerCode: '424242', now: () => t });
    for (let i = 0; i < 10; i++) expect((await s.login('000000', 'ip' + i)).status).toBe(401);
    expect(await s.login('424242', 'ip-neuve')).toMatchObject({ status: 429, retryAt: t + 15 * 60_000 });
    t += 15 * 60_000 + 1;
    expect((await s.login('424242', 'ip-neuve')).status).toBe(200);
  });
});
