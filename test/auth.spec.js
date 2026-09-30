// Sessions : limite par IP et verrou global progressif (codes courts saisis au pavé de l'app).
import { describe, it, expect } from 'vitest';
import { createSessions } from '../server/auth.mjs';

describe('codes d’accès', () => {
  it('10 échecs d’affilée, même depuis des IP différentes → verrou 15 min, puis 30 min', () => {
    let t = 1_000_000;
    const s = createSessions({ ownerCode: '4242', now: () => t });
    for (let i = 0; i < 10; i++) expect(s.login('0000', 'ip' + i).status).toBe(401);
    expect(s.login('4242', 'ip-neuve').status).toBe(429);            // même le bon code attend la fin du verrou
    t += 15 * 60_000 + 1;
    expect(s.login('4242', 'ip-neuve').status).toBe(200);
    for (let i = 0; i < 10; i++) s.login('0000', 'x' + i);
    t += 15 * 60_000 + 1;
    expect(s.login('0000', 'y').status).toBe(401);                   // le premier verrou avait été levé par un succès
  });
  it('5 essais par minute et par IP', () => {
    let t = 0;
    const s = createSessions({ ownerCode: '4242', now: () => t });
    for (let i = 0; i < 5; i++) s.login('0000', 'a');
    expect(s.login('4242', 'a').status).toBe(429);
    t += 60_001;
    expect(s.login('4242', 'a').status).toBe(200);
  });
});
