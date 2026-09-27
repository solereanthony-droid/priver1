import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import vm from 'node:vm';
import { buildTask, TaskError } from '../server/prompts.mjs';

test('seules les tâches connues sont acceptées', () => {
  assert.throws(() => buildTask('libre', { text: 'x' }), TaskError);
  assert.throws(() => buildTask('__proto__', {}), TaskError);
  assert.throws(() => buildTask('devis', { metier: 'pirate', text: 'x' }), TaskError);
  assert.throws(() => buildTask('devis', { metier: 'elec', text: 'x'.repeat(601) }), TaskError);
  assert.throws(() => buildTask('rdv', { text: 'demain', today: '2020-01-01' }), TaskError);
  const t = buildTask('devis', { metier: 'elec', text: ' tableau T4 ' });
  assert.equal(t.user, 'tableau T4');
  assert.match(t.system, /Disjoncteur ph\+N 16 A/);
  const today = new Date().toISOString().slice(0, 10);
  assert.match(buildTask('rdv', { text: 'demain 14 h', today }).system, new RegExp(today));
});

test('serveur : en-têtes, origine, type de contenu, chemins', async t => {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const srv = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: '' }, stdio: 'pipe' });
  t.after(() => srv.kill());
  await new Promise(r => srv.stdout.once('data', r));
  const base = `http://127.0.0.1:${port}`;
  const post = (body, headers = {}) => fetch(base + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });

  const home = await fetch(base + '/');
  assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(base + '/%E0%A4%A')).status, 400);          // URI mal formée : plus de plantage
  assert.equal((await fetch(base + '/..%2f..%2fpackage.json')).status, 403);
  assert.equal((await fetch(base + '/api/complete', { method: 'POST' })).status, 404); // ancien relais générique supprimé
  assert.equal((await post('{"task":"devis"}', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await fetch(base + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal((await post(JSON.stringify({ task: 'libre', params: {} }))).status, 400);
  assert.equal((await post('x'.repeat(9000))).status, 413);
  assert.equal((await fetch(base + '/')).status, home.status);          // toujours en vie

  const js = (await home.text()).match(/\/assets\/index-[\w-]+\.js/)[0];
  const br = await fetch(base + js, { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(br.headers.get('content-encoding'), 'br');                // compression
  assert.match(br.headers.get('cache-control'), /immutable/);
  const sw = await fetch(base + '/sw.js');
  assert.equal(sw.headers.get('cache-control'), 'no-cache');             // service worker toujours revalidé
  const swSrc = await sw.text();
  assert.doesNotThrow(() => new vm.Script(swSrc));                         // script valide
  assert.match(swSrc, new RegExp(js.replace(/\./g, '\\.')));             // le bundle est précaché
});
