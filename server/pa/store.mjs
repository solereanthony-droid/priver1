// Stockage serveur de l'intégration PA : un fichier JSON par déploiement, écrit de façon atomique
// (fichier temporaire puis renommage). Les jetons y sont chiffrés (voir service.mjs). Pour plusieurs
// instances ou beaucoup de locataires, remplacer par une base de données derrière la même interface.
import fs from 'node:fs';
import path from 'node:path';

export function createFileStore(file) {
  let data = { tenants: {} }, chain = Promise.resolve();
  if (file && fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const write = () => {
    if (!file) return Promise.resolve();
    chain = chain.then(async () => {
      await fs.promises.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const tmp = file + '.' + process.pid + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(data), { mode: 0o600 });
      await fs.promises.rename(tmp, file);
    });
    return chain;
  };
  return {
    tenant(id) {
      return (data.tenants[id] ??= { conn: { state: 'non_connecte' }, invoices: {}, jobs: [], seen: {}, lookups: {}, clientKeys: {} });
    },
    tenants: () => Object.keys(data.tenants),
    save: write,
    flush: () => chain,
  };
}
