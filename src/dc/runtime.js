// Moteur de rendu des gabarits « dc » du prototype (remplace support.js, non fourni).
// Le gabarit HTML est analysé une seule fois, puis rendu en éléments React à chaque
// render() à partir des valeurs renvoyées par renderVals().
//
// Syntaxe prise en charge :
//   {{ chemin.vers.valeur }}                  trou de texte ou d'attribut
//   <sc-if value="{{ cond }}">…</sc-if>        rendu conditionnel
//   <sc-for list="{{ items }}" as="x">…</sc-for> répétition
//   style-active="…" / style-hover="…"        styles d'état (pression / survol)
//   onClick / onInput / onChange / …           gestionnaires (fonctions de renderVals)
//   ref="{{ monRef }}"                          réf React
import React from 'react';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const NO_TEXT = new Set(['svg', 'g', 'select', 'table', 'thead', 'tbody', 'tr', 'defs', 'clipPath', 'mask']);
const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m);

// ── Analyse ───────────────────────────────────────────────────────────────────
export function parse(src) {
  const root = { tag: '#root', attrs: [], children: [] }, stack = [root];
  const ATTR = /\s*([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/y;
  let i = 0;
  const text = t => { if (t) stack[stack.length - 1].children.push({ text: decode(t) }); };
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { text(src.slice(i)); break; }
    text(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt); i = e < 0 ? src.length : e + 3; continue; }
    if (src[lt + 1] === '/') {
      const gt = src.indexOf('>', lt), tag = src.slice(lt + 2, gt).trim();
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].tag === tag) { stack.length = k; break; }
      i = gt + 1; continue;
    }
    const m = /^<([a-zA-Z][\w:-]*)/.exec(src.slice(lt, lt + 64));
    if (!m) { text('<'); i = lt + 1; continue; }
    const node = { tag: m[1], attrs: [], children: [] };
    let j = lt + m[0].length;
    for (;;) {
      while (/\s/.test(src[j])) j++;
      if (src[j] === '>' || src.startsWith('/>', j)) break;
      ATTR.lastIndex = j;
      const a = ATTR.exec(src);
      if (!a || !a[0]) { j++; continue; }
      node.attrs.push([a[1], a[2] ?? a[3] ?? '']);
      j = ATTR.lastIndex;
    }
    const selfClose = src.startsWith('/>', j);
    i = j + (selfClose ? 2 : 1);
    stack[stack.length - 1].children.push(node);
    if (!selfClose && !VOID.has(node.tag.toLowerCase())) stack.push(node);
  }
  prune(root);
  return root;
}

// Les blancs d'indentation disparaissent ; un blanc entre deux éléments en ligne devient une espace.
function prune(n, inNoText) {
  if (!n.children) return;
  const noText = inNoText || NO_TEXT.has(n.tag);
  n.children = n.children.filter(c => {
    if (c.text === undefined) { prune(c, noText && c.tag !== 'text' && c.tag !== 'option'); return true; }
    if (/\S/.test(c.text)) return true;
    if (noText || /\n/.test(c.text)) return false;
    c.text = ' ';
    return true;
  });
}

// ── Valeurs ───────────────────────────────────────────────────────────────────
const LIT = { true: true, false: false, null: null, undefined: undefined };
function lookup(expr, scope) {
  if (expr in LIT) return LIT[expr];
  if (/^-?\d+(\.\d+)?$/.test(expr)) return +expr;
  let v = scope;
  for (const k of expr.split('.')) { if (v == null) return undefined; v = v[k]; }
  return v;
}
const single = s => { const m = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(s); return m && m[1]; };
const interp = (s, scope) => s.includes('{{') ? s.replace(HOLE, (_, e) => { const v = lookup(e, scope); return v == null || v === false ? '' : String(v); }) : s;

// ── Styles ────────────────────────────────────────────────────────────────────
const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const cssProp = p => p.startsWith('--') ? p : p.startsWith('-ms-') ? camel(p.slice(1)) : p.startsWith('-') ? camel(p[1].toUpperCase() + p.slice(2)) : camel(p);
const STYLE_CACHE = new Map();
function styleObj(css) {
  let o = STYLE_CACHE.get(css);
  if (o) return o;
  o = {};
  let depth = 0, start = 0;
  const decl = d => {
    const c = d.indexOf(':'); if (c < 0) return;
    const p = d.slice(0, c).trim(), v = d.slice(c + 1).trim().replace(/\s*!important$/, '');
    if (p && v) o[cssProp(p)] = v;
  };
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '(') depth++; else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) { decl(css.slice(start, i)); start = i + 1; }
  }
  decl(css.slice(start));
  if (STYLE_CACHE.size > 5000) STYLE_CACHE.clear();
  STYLE_CACHE.set(css, o);
  return o;
}

// style-active / style-hover → classes générées (les !important battent le style en ligne).
const STATE_CLS = new Map();
let stateSheet = null;
function stateClass(kind, css) {
  const key = kind + '|' + css;
  let cls = STATE_CLS.get(key);
  if (cls) return cls;
  cls = `dc-${kind}-${STATE_CLS.size}`;
  STATE_CLS.set(key, cls);
  const decls = css.split(';').filter(d => d.includes(':')).map(d => d.trim() + ' !important').join(';');
  const rule = kind === 'active' ? `.${cls}:active:not(:disabled){${decls}}` : `@media (hover:hover){.${cls}:hover:not(:disabled){${decls}}}`;
  if (typeof document !== 'undefined') {
    if (!stateSheet) { const el = document.createElement('style'); el.setAttribute('data-dc-states', ''); document.head.appendChild(el); stateSheet = el.sheet; }
    stateSheet.insertRule(rule, stateSheet.cssRules.length);
  }
  return cls;
}

// ── Rendu ─────────────────────────────────────────────────────────────────────
const RENAME = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', inputmode: 'inputMode', readonly: 'readOnly', maxlength: 'maxLength', autocomplete: 'autoComplete', autofocus: 'autoFocus', crossorigin: 'crossOrigin', enterkeyhint: 'enterKeyHint' };
const BOOL = new Set(['disabled', 'checked', 'readOnly', 'required', 'multiple', 'autoFocus', 'hidden', 'selected']);

function props(node, scope) {
  const p = {};
  let cls = '', handlers = {};
  for (const [name, raw] of node.attrs) {
    if (name.startsWith('hint-')) continue;
    if (name === 'style-active' || name === 'style-hover') { cls += ' ' + stateClass(name.slice(6), raw); continue; }
    const hole = single(raw);
    if (name === 'style') { p.style = styleObj(interp(raw, scope)); continue; }
    if (name === 'ref') { const r = hole ? lookup(hole, scope) : undefined; if (r) p.ref = r; continue; }
    if (/^on[A-Z]/.test(name)) { const f = hole ? lookup(hole, scope) : undefined; if (typeof f === 'function') handlers[name] = f; continue; }
    const key = RENAME[name] || (name.includes('-') && !/^(aria|data)-/.test(name) ? camel(name) : name);
    let v = hole ? lookup(hole, scope) : interp(raw, scope);
    if (BOOL.has(key)) v = hole ? !!v : true;
    if (key === 'className') { cls += ' ' + (v ?? ''); continue; }
    if (v === undefined || v === null) { if (key !== 'value') continue; v = ''; }
    p[key] = v;
  }
  if (cls.trim()) p.className = cls.trim();
  const tag = node.tag.toLowerCase();
  // Accessibilité : les pictos décoratifs sont masqués aux lecteurs d'écran, les boutons-icônes nommés par leur title.
  if (tag === 'svg' && !('aria-hidden' in p) && !('role' in p) && !('aria-label' in p)) { p['aria-hidden'] = 'true'; p.focusable = 'false'; }
  if (tag === 'button' && p.title && !('aria-label' in p) && !('aria-labelledby' in p)) p['aria-label'] = p.title;
  if (tag === 'input' && (p.type === 'email' || p.type === 'tel') && !('spellCheck' in p)) p.spellCheck = false;
  // Champs contrôlés : React déclenche onChange à chaque frappe (équivalent de onInput).
  if ((tag === 'input' || tag === 'textarea' || tag === 'select') && 'value' in p) {
    if (p.type === 'file') delete p.value;
    const h = handlers.onInput || handlers.onChange;
    if (h) { p.onChange = h; delete handlers.onInput; delete handlers.onChange; }
    else if (p.type !== 'file') p.readOnly = true;
  }
  return Object.assign(p, handlers);
}

function kids(list, scope) {
  const out = [];
  for (const c of list) {
    const r = renderNode(c, scope);
    if (Array.isArray(r) && !r.$keyed) out.push(...r); else if (r !== null && r !== undefined && r !== false) out.push(r);
  }
  return out;
}

function renderNode(n, scope) {
  if (n.text !== undefined) {
    if (!n.text.includes('{{')) return n.text;
    const h = single(n.text);
    if (h && n.text.trim() === n.text) {
      const v = lookup(h, scope);
      if (v == null || v === false || v === true) return null;
      if (Array.isArray(v)) { const a = v.slice(); a.$keyed = true; return a; }
      return typeof v === 'object' ? v : String(v);
    }
    return interp(n.text, scope);
  }
  if (n.tag === 'sc-if') {
    const raw = (n.attrs.find(a => a[0] === 'value') || [])[1] || '';
    const v = single(raw) ? lookup(single(raw), scope) : raw;
    return v ? kids(n.children, scope) : null;
  }
  if (n.tag === 'sc-for') {
    const at = Object.fromEntries(n.attrs), list = lookup(single(at.list) || at.list, scope), as = at.as || 'item';
    if (!list || !list.length) return null;
    const out = Array.from(list, (item, i) => {
      const s = Object.create(scope); s[as] = item; s[as + 'Index'] = i;
      const k = item && typeof item === 'object' ? item.key ?? item.id ?? i : i;
      return React.createElement(React.Fragment, { key: String(k) + ':' + i }, ...kids(n.children, s));
    });
    out.$keyed = true;
    return out;
  }
  if (n.tag === '#root') return kids(n.children, scope);
  return React.createElement(n.tag, props(n, scope), ...kids(n.children, scope));
}

export function renderTemplate(tree, vals) {
  const out = renderNode(tree, vals);
  return React.createElement(React.Fragment, null, ...out);
}

// Classe de base de la logique du prototype (« class Component extends DCLogic »).
// Ce n'est plus un composant React : c'est un contrôleur piloté par le hook useLogic
// (src/hooks/useLogic.js), qui lui fournit state, setState et les appels de cycle de vie.
export function makeDCLogic(templateSource, defaultProps = {}) {
  const tree = parse(templateSource);
  return class DCLogic {
    constructor(props = {}) { this.props = { ...defaultProps, ...props }; }
    setState() { throw new Error('DCLogic : setState n\u2019est disponible qu\u2019à travers useLogic()'); }
    render() { return renderTemplate(tree, this.renderVals()); }
  };
}
