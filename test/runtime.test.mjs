import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse, renderTemplate } from '../src/dc/runtime.js';

const html = (tpl, vals) => renderToStaticMarkup(renderTemplate(parse(tpl), vals));

test('trous de texte et d\'attribut', () => {
  assert.equal(html('<p title="n° {{ a.b }}" style="color:{{ c }};--x:1">Bonjour {{ a.b }}</p>', { a: { b: 42 }, c: 'red' }),
    '<p title="n° 42" style="color:red;--x:1">Bonjour 42</p>');
});

test('sc-if et sc-for, y compris dans un <select>', () => {
  const tpl = '<sc-if value="{{ on }}"><b>oui</b></sc-if><select value="{{ v }}" onChange="{{ f }}"><sc-for list="{{ o }}" as="x"><option value="{{ x.v }}">{{ x.l }}</option></sc-for></select>';
  const out = html(tpl, { on: false, v: '05', f: () => {}, o: [{ v: '00', l: '00' }, { v: '05', l: '05' }] });
  assert.equal(out, '<select><option value="00">00</option><option value="05" selected="">05</option></select>');
});

test('attributs SVG et entités', () => {
  assert.equal(html('<svg viewBox="0 0 24 24" stroke-width="2.75"><path d="M1 1"/></svg><span>&amp;&nbsp;x</span>', {}),
    '<svg viewBox="0 0 24 24" stroke-width="2.75"><path d="M1 1"></path></svg><span>&amp; x</span>');
});

test('le gabarit du prototype s\'analyse sans perte de balises', () => {
  const src = fs.readFileSync(new URL('../src/app/template.html', import.meta.url), 'utf8');
  const count = (n, tag) => (n.tag === tag ? 1 : 0) + (n.children || []).reduce((a, c) => a + count(c, tag), 0);
  const tree = parse(src);
  assert.equal(count(tree, 'sc-for'), (src.match(/<sc-for\b/g) || []).length);
  assert.equal(count(tree, 'sc-if'), (src.match(/<sc-if\b/g) || []).length);
  assert.equal(count(tree, 'button'), (src.match(/<button\b/g) || []).length);
});
