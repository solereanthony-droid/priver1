#!/usr/bin/env python3
"""Importe un handoff Claude Design (fichier .dc.html) dans l'app.

Usage : python3 scripts/import-handoff.py "chemin/Chiffrage BTP 974 Mobile.dc.html"

Le gabarit <x-dc> et la classe Component restent la source de vérité ; ce script
réapplique seulement les adaptations de l'app :
- gabarit : classes dc-* (plein écran sur téléphone), sans <helmet> ;
- logique : imports ES, données partagées avec le serveur (src/app/data.js),
  appels IA via window.btpAI (prompts côté serveur), sauvegarde locale par le hook
  usePersistence (restauration filtrée), sources d'images revalidées, exports.
Chaque remplacement est vérifié : si le prototype a changé à cet endroit, le
script s'arrête et dit lequel.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf8')

def section(text, start, end):
    i = text.index(start); j = text.index(end, i)
    return text[i + len(start):j]

def sub(text, old, new, count=1, regex=False, label=''):
    n = len(re.findall(old, text, flags=re.S)) if regex else text.count(old)
    if n < count:
        sys.exit(f'Motif introuvable ({label or old[:60]!r}) : le prototype a changé, adapter scripts/import-handoff.py')
    return re.sub(old, new, text, count=count, flags=re.S) if regex else text.replace(old, new, count)

# ── Gabarit ──────────────────────────────────────────────────────────────────
xdc = section(src, '<x-dc>', '</x-dc>')
helmet = section(xdc, '<helmet>', '</helmet>')
tpl = xdc[xdc.index('</helmet>') + len('</helmet>'):].strip('\n') + '\n'
tpl = sub(tpl, '<div style="min-height:100vh', '<div class="dc-stage" style="min-height:100vh', label='scène')
tpl = sub(tpl, '<div style="width:{{ fit.w }}', '<div class="dc-fit" style="width:{{ fit.w }}', label='cadre')
tpl = sub(tpl, '<div data-screen-label="Téléphone" style=', '<div class="dc-phone" data-screen-label="Téléphone" style=', label='téléphone')
tpl = sub(tpl, '<div data-theme="{{ theme }}" style=', '<div class="dc-screen" data-theme="{{ theme }}" style=', label='écran')
tpl = sub(tpl, '<sc-if value="{{ fr.phone }}" hint-placeholder-val="{{ true }}"><div style="height:50px', '<sc-if value="{{ fr.phone }}" hint-placeholder-val="{{ true }}"><div class="dc-statusbar" style="height:50px', label='barre d’état')
tpl = sub(tpl, '<div ref="{{ scrollRef }}"', '<div class="dc-scroll" ref="{{ scrollRef }}"', label='zone défilante')
(ROOT / 'src/app/template.html').write_text(tpl, encoding='utf8')

# Styles du <helmet> (hors feuille ds/styles.css et scripts externes) → src/styles/handoff.css
css = '\n'.join(m.strip() for m in re.findall(r'<style>(.*?)</style>', helmet, flags=re.S))
(ROOT / 'src/styles/handoff.css').write_text('/* Généré par scripts/import-handoff.py depuis le <helmet> du prototype : ne pas modifier à la main. */\n' + css + '\n', encoding='utf8')

# ── Logique ──────────────────────────────────────────────────────────────────
js = section(src, 'data-dc-script', '</script>')
js = js[js.index('>') + 1:].strip('\n') + '\n'

# Données partagées avec le serveur (prompts IA).
data = []
for name, end in [('CAT_RAW', '\n};\n'), ('PROJETS', '\n};\n'), ('DTU', '\n};\n'), ('METIERS', '\n];\n')]:
    i = js.index(f'const {name} = '); j = js.index(end, i) + len(end)
    data.append('export ' + js[i:j].rstrip('\n'))
    js = js[:i] + js[j:]
multi = re.search(r'^CAT_RAW\.multi = .*;\n', js, flags=re.M)
if multi: data.append(multi.group(0).rstrip('\n')); js = js.replace(multi.group(0), '')
js = re.sub(r'^// Données de démo[^\n]*\n', '', js, count=1, flags=re.M)
(ROOT / 'src/app/data.js').write_text("// Données de démo partagées entre l'app et le serveur (prompts IA). Généré par scripts/import-handoff.py.\n// Catalogues par métier : [désignation, réf, famille, fournisseur, achat HT, unité]\n" + '\n\n'.join(data) + '\n', encoding='utf8')

# IA : le client n'envoie qu'une tâche et ses paramètres ; les prompts sont dans server/prompts.mjs.
js = sub(js, r"    const system = `Tu es l'assistant de chiffrage.*?`;\n", '', regex=True, label='prompt devis')
js = sub(js, "if (!window.claude || !window.claude.complete) throw new Error('indispo');\n      const raw = await window.claude.complete({ model: 'claude-sonnet-4-5', max_tokens: 1000, system, messages: [{ role: 'user', content: txt }] });",
         "// Prompt construit côté serveur (server/prompts.mjs) : le client n'envoie que la demande.\n      if (!window.btpAI) throw new Error('indispo');\n      const raw = await window.btpAI('devis', { metier: m.key, text: txt });", label='appel IA devis')
js = sub(js, r"    const clients = Object\.values\(this\.allProj\(\)\)\.map\((p => p\.client \+ ' \(' \+ p\.addr\.split\(','\)\.pop\(\)\.trim\(\) \+ '\)')\)\.join\('; '\);\n",
         r"    const clients = Object.values(this.allProj()).map(\1);\n", regex=True, label='clients RDV')
js = sub(js, r"    const system = `Tu extrais un rendez-vous.*?`;\n", '', regex=True, label='prompt RDV')
js = sub(js, "if (!window.claude || !window.claude.complete) throw new Error('x');\n      const raw = await window.claude.complete({ model: 'claude-sonnet-4-5', max_tokens: 300, system, messages: [{ role: 'user', content: txt }] });",
         "if (!window.btpAI) throw new Error('x');\n      const raw = await window.btpAI('rdv', { text: txt, today, clients });", label='appel IA RDV')
if 'window.claude' in js: sys.exit('Nouvel appel window.claude dans le prototype : ajouter la tâche dans server/prompts.mjs et ici')

# Sauvegarde locale : gérée par usePersistence (restauration limitée aux clés de KEEP).
js = sub(js, r"\n    try \{\n      const raw = localStorage\.getItem\(Component\.KEY\);.*?\n    \} catch \(e\) \{\}\n  \}\n  componentDidUpdate",
         "\n    // Sauvegarde locale : voir restore() / snapshot() et le hook usePersistence.\n  }\n  componentDidUpdate", regex=True, label='restauration')
js = sub(js, r"\n    clearTimeout\(this\._sv\);\n    this\._sv = setTimeout\(\(\) => \{ try \{ const o = \{\}; Component\.KEEP\.forEach.*?\}, 400\);\n",
         "\n", regex=True, label='enregistrement')
js = sub(js, "\n  spy() {", """
  // Sauvegarde locale (utilisé par usePersistence) : ce qui est gardé, et comment le recharger.
  snapshot(state = this.state) { const o = {}; Component.KEEP.forEach(k => { if (state[k] !== undefined) o[k] = state[k]; }); return o; }
  restore(d) {
    if (!d || typeof d !== 'object') return;
    // Recale le compteur d'identifiants sur les lignes et circuits enregistrés (évite les collisions).
    const ids = [];
    (d.lines || []).forEach(l => ids.push(l.id)); (d.docs || []).forEach(x => (x.lines || []).forEach(l => ids.push(l.id || 0))); (d.plans || []).forEach(p => (p.circuits || []).forEach(c => ids.push(+c.id || 0)));
    UID = Math.max(UID, ...ids.filter(Number.isFinite)) + 1;
    // Ne restaure que les clés attendues : une sauvegarde altérée ne doit pas piloter l'état d'interface.
    this.setState({ ...this.snapshot(d), savedAt: Date.now() });
  }

  spy() {""", label='méthode spy')

# Images importées : revalidées avant affichage (data: image/PDF uniquement).
js = sub(js, "\nlet UID = 1;", """
// Sources d'images importées : data: PNG/JPEG/WebP/GIF ou PDF uniquement (pas de SVG ni de HTML).
const safeSrc = (src, pdf = true) => typeof src === 'string' && new RegExp('^data:(image/(png|jpeg|webp|gif)' + (pdf ? '|application/pdf' : '') + ');base64,[a-z0-9+/=]+$', 'i').test(src) ? src : '';
let UID = 1;""", label='UID')
js = sub(js, "src: p.src || ''", "src: safeSrc(p.src)", label='source plan importé')
js = sub(js, "bg: I.bg || '', hasBg: !!I.bg,", "bg: safeSrc(I.bg, false), hasBg: !!safeSrc(I.bg, false),", label='fond d’implantation')

# Mode plein soleil désactivé : ne pas écrire « --color-bg: inherit » en ligne, sinon il écrase le thème sombre
# ([data-theme="dark"] sur le même élément). Une valeur vide n'émet aucune déclaration.
# (corrigé dans le prototype à partir de la v12 : le remplacement ne s'applique qu'aux anciennes versions)
js = js.replace("{ n: 'inherit', div: 'inherit', bg: 'inherit' }", "{ n: '', div: '', bg: '' }")

# Liens externes (mailto:, wa.me) : noopener, pour que la page ouverte ne puisse pas rediriger l'onglet de l'app.
js = js.replace("window.open(href, '_blank')", "window.open(href, '_blank', 'noopener,noreferrer')")

# Facturation et export CSV : en micro-entreprise (franchise en base, art. 293 B), pas de TVA et HT = TTC.
js = sub(js, "const ht = total / 1.085, t85 = ht * 0.085 * 0.92, t21 = ht * 0.021 * 0.08;",
         "const micro = s.regime === 'micro', ht = micro ? total : total / 1.085, t85 = micro ? 0 : ht * 0.085 * 0.92, t21 = micro ? 0 : ht * 0.021 * 0.08;", label='TVA facturation')
js = sub(js, "const hh = r[1] / 1.085; return [FULL[isMonth ? mi : off + i], n(r[1]), n(hh), n(hh * 0.085 * 0.92), n(hh * 0.021 * 0.08),",
         "const hh = micro ? r[1] : r[1] / 1.085; return [FULL[isMonth ? mi : off + i], n(r[1]), n(hh), n(micro ? 0 : hh * 0.085 * 0.92), n(micro ? 0 : hh * 0.021 * 0.08),", label='TVA export CSV')

# Schéma unifilaire (écran et PDF) : le libellé « IDn » était centré sur le trait vertical d'alimentation (x = 30).
# Il passe à droite du trait, aligné à gauche.
js = js.replace("tx(32, yb - 22, 'ID' + (r + 1), { s: 10, w: 800, a: 'middle', fill: K.sage });",
                "tx(36, yb - 22, 'ID' + (r + 1), { s: 10, w: 800, fill: K.sage });")

# Exports.
js = sub(js, "\nconst docNo = ", "\nexport const docNo = ", label='docNo')
header = """// Logique métier du prototype « Chiffrage BTP 974 » (importée par scripts/import-handoff.py, ne pas modifier à la main :
// corriger le prototype ou le script d'import).
import React from 'react';
import template from './template.html?raw';
import { makeDCLogic } from '../dc/runtime.js';
import { CAT_RAW, PROJETS, DTU, METIERS } from './data.js';

const DCLogic = makeDCLogic(template, { regime: 'assujetti', acompte: 30, paName: 'FactuPro 974' });

"""
(ROOT / 'src/app/logic.js').write_text(header + js.rstrip() + '\n\n// Fonctions pures exposées pour les tests (test/handoff.spec.js).\nexport { idNeed, idStd, wizRooms, wizLayout, planFromLines, offersOf, catOf };\nexport default Component;\n', encoding='utf8')
print('Import terminé : template.html, handoff.css, data.js, logic.js')
