// Mise en route de l'intégration PA à partir des variables d'environnement (voir docs/PA.md).
import path from 'node:path';
import { loadKey } from './crypto.mjs';
import { createFileStore } from './store.mjs';
import { createXpZ12Adapter } from './adapter.mjs';
import { createPaService } from './service.mjs';
import { createLogger } from './log.mjs';

export async function createPaFromEnv(env = process.env, { dataDir } = {}) {
  const provider = env.PA_PROVIDER || '';
  if (!provider) return null;                                      // intégration désactivée : routes PA en 503
  const key = loadKey(env.PA_ENC_KEY);
  const log = createLogger();
  let cfg, mock = null;
  if (provider === 'mock') {
    const { startMockPa } = await import('./mock.mjs');
    mock = await startMockPa();
    cfg = { ...mock.config, name: 'PA simulée', redirectUri: env.PA_REDIRECT_URI || 'http://localhost:8787/api/pa/callback' };
  } else if (provider === 'xpz12') {
    const need = ['PA_BASE_URL', 'PA_AUTHORIZE_URL', 'PA_TOKEN_URL', 'PA_CLIENT_ID', 'PA_CLIENT_SECRET', 'PA_REDIRECT_URI'].filter(k => !env[k]);
    if (need.length) throw new Error('Configuration PA incomplète : ' + need.join(', '));
    cfg = {
      name: env.PA_NAME || 'Plateforme agréée', baseUrl: env.PA_BASE_URL, authorizeUrl: env.PA_AUTHORIZE_URL, tokenUrl: env.PA_TOKEN_URL, revokeUrl: env.PA_REVOKE_URL || '',
      clientId: env.PA_CLIENT_ID, clientSecret: env.PA_CLIENT_SECRET, redirectUri: env.PA_REDIRECT_URI, scope: env.PA_SCOPE,
      paths: env.PA_PATHS ? JSON.parse(env.PA_PATHS) : undefined,
    };
  } else throw new Error('PA_PROVIDER inconnu : ' + provider + ' (xpz12 ou mock)');

  const store = createFileStore(path.resolve(env.PA_DATA_FILE || path.join(dataDir || 'server/data', 'pa.json')));
  const adapter = createXpZ12Adapter(cfg, { log });
  const service = createPaService({ store, adapter, key, log, webhookSecret: env.PA_WEBHOOK_SECRET || '', validatorCmd: env.PA_VALIDATOR_CMD || '', resubmitRejected: env.PA_RESUBMIT_REJECTED === '1' });
  const timer = setInterval(() => service.tick().catch(e => log({ event: 'pa.tick', error: e.message })), 5000);
  timer.unref();
  return { service, mock, stop: async () => { clearInterval(timer); await store.flush(); if (mock) await mock.close(); } };
}
