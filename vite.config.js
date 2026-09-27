import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Génère dist/sw.js avec la liste des fichiers à mettre en cache pour le mode hors ligne.
function serviceWorker() {
  return {
    name: 'btp974-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg',
        ...Object.keys(bundle).filter(f => !f.endsWith('.map')).map(f => '/' + f)];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12);
      const src = fs.readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8')
        .replace('const PRECACHE = __PRECACHE__;', 'const PRECACHE = ' + JSON.stringify([...new Set(files)]) + ';')
        .replace("'btp974-__VERSION__'", "'btp974-" + version + "'");
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: { assetsInlineLimit: 0 }, // polices et images en fichiers : CSP stricte et mise en cache hors ligne
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { include: ['test/**/*.spec.js'], environment: 'node' },
});
