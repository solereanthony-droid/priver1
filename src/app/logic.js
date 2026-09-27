// Logique métier du prototype « Chiffrage BTP 974 » (reprise telle quelle du handoff de design).
import React from 'react';
import template from './template.html?raw';
import { makeDCLogic } from '../dc/runtime.js';
import { CAT_RAW, PROJETS, DTU, METIERS } from './data.js';

const DCLogic = makeDCLogic(template, { regime: 'assujetti', acompte: 30, paName: 'FactuPro 974' });



// Imports de plans : types autorisés (pas de SVG ni de HTML, qui peuvent embarquer du script).
const PLAN_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const safePlanSrc = src => typeof src === 'string' && /^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,[a-z0-9+/=]+$/i.test(src) ? src : '';
const PLAN_REF = { 16: 'SCH-A9N21024', 20: 'SCH-A9N21025', 32: 'SCH-A9N21027' };
const SECTION = { 10: '1,5', 16: '1,5', 20: '2,5', 32: '6' };
const planIdNote = p0 => 'Calibre des ID à justifier (règle de l\u2019amont ou de l\u2019aval) : ' + p0.diffs.map((d, i) => `ID${i + 1} ${d.cal} A pour ${p0.circuits.filter(c => c.diff === d.id).reduce((a, c) => a + c.cal, 0)} A en aval`).join(', ') + '.';
const FIELD_HELP = {
  name: ['Nom commercial', ['Ton extrait Kbis (société) ou ton extrait D1 / avis de situation au Répertoire des Métiers (EI).', 'Le nom affiché sur ton enseigne ou ton site, s\u2019il est déclaré.'], ''],
  siret: ['SIRET', ['Avis de situation SIRENE de l\u2019Insee, téléchargeable gratuitement sur avis-situation-sirene.insee.fr.', 'Ton extrait Kbis ou D1, ou annuaire-entreprises.data.gouv.fr.'], '14 chiffres : SIREN (9) + NIC (5).'],
  rm: ['N° Répertoire des Métiers', ['Extrait D1 délivré par la Chambre de Métiers et de l\u2019Artisanat de La Réunion (CMA 974).', 'Ton espace sur le guichet unique formalites.entreprises.gouv.fr.'], 'RM 974 suivi du SIREN.'],
  tva: ['N° TVA intracommunautaire', ['Ton espace professionnel sur impots.gouv.fr, rubrique « Données de référence ».', 'Tes déclarations de TVA ou un courrier du SIE.'], 'FR + 2 caractères de clé + SIREN (9 chiffres).'],
  addr: ['Adresse du siège', ['L\u2019adresse déclarée au Kbis ou au D1.', 'En domiciliation, l\u2019adresse du contrat de domiciliation.'], ''],
  tel: ['Téléphone', ['Le numéro que tes clients doivent appeler, affiché sur tes devis.'], '10 chiffres, ex. 0692 12 34 56.'],
  email: ['E-mail', ['L\u2019adresse de contact professionnelle affichée sur tes devis et factures.'], ''],
  assureur: ['Assureur décennale', ['Ton attestation d\u2019assurance décennale, en en-tête du document.', 'Ton espace client chez l\u2019assureur ou ton courtier.'], ''],
  police: ['N° de contrat décennale', ['Sur l\u2019attestation décennale, ligne « contrat n° » ou « police n° ».'], ''],
  decValid: ['Validité de la décennale', ['Sur l\u2019attestation, la période de validité (« du … au … »). Elle est renouvelée chaque année.'], 'JJ/MM/AAAA, la date de fin.'],
  rcAssureur: ['Assureur RC Pro', ['Ton attestation de responsabilité civile professionnelle, souvent émise avec la décennale.'], ''],
  rcPolice: ['N° de contrat RC Pro', ['Sur l\u2019attestation RC Pro, ligne « contrat n° ».'], ''],
  mediateur: ['Médiateur de la consommation', ['Ta fédération professionnelle (CAPEB, FFB…) ou ta CMA te propose un médiateur agréé.', 'La liste officielle des médiateurs sur economie.gouv.fr/mediation-conso.'], 'Nom du médiateur et son site web.'],
  qualif: ['Qualifications et labels', ['Tes certificats Qualifelec, Qualibat ou RGE, avec leur numéro et leur date de validité.'], ''],
  iban: ['IBAN', ['Ton RIB professionnel, dans l\u2019application ou l\u2019espace client de ta banque.'], '27 caractères, commence par FR76.'],
};
const FORMES = {
  ei: { l: 'EI', full: 'Entreprise individuelle (régime réel)', who: 'Seul', resp: 'Patrimoine personnel séparé du patrimoine professionnel par défaut depuis le 15 mai 2022.', imp: 'Impôt sur le revenu (BIC), option IS possible.', soc: 'Travailleur non salarié (SSI).', cap: 'Pas de capital.', tva: 'TVA DOM 8,5 % / 2,1 %, ou franchise sous les seuils.', ment: 'Nom suivi de « EI » ou « Entrepreneur individuel » sur devis et factures.', btp: 'Charges réelles déductibles : adapté quand matériaux et véhicule pèsent lourd.', soc_: false, micro: false },
  micro: { l: 'EI · micro-entreprise', full: 'Entreprise individuelle au régime micro', who: 'Seul', resp: 'Patrimoine personnel protégé par défaut (EI).', imp: 'Régime micro : cotisations et impôt calculés sur le chiffre d\u2019affaires encaissé.', soc: 'Travailleur non salarié (SSI).', cap: 'Pas de capital.', tva: 'Franchise en base : 37 500 € de prestations (seuil majoré 41 250 €), mêmes seuils qu\u2019en métropole. Mention « TVA non applicable, art. 293 B du CGI ».', ment: 'Nom suivi de « EI », mention 293 B tant que la franchise s\u2019applique.', btp: 'Plafond de 83 600 € de CA en prestations. Charges et TVA sur achats non récupérables : vite pénalisant avec beaucoup de matériaux.', soc_: false, micro: true },
  eurl: { l: 'EURL', full: 'Entreprise unipersonnelle à responsabilité limitée', who: '1 associé', resp: 'Limitée aux apports.', imp: 'IR par défaut si l\u2019associé est une personne physique, option IS.', soc: 'Gérant associé unique : travailleur non salarié.', cap: 'Capital libre (1 € minimum).', tva: 'TVA DOM 8,5 % / 2,1 %.', ment: 'Forme, capital social, RCS ou RM, adresse du siège.', btp: 'Cotisations plus légères que la SASU, patrimoine protégé.', soc_: true, micro: false },
  sarl: { l: 'SARL', full: 'Société à responsabilité limitée', who: '2 à 100 associés', resp: 'Limitée aux apports.', imp: 'Impôt sur les sociétés, option IR temporaire (SARL de famille possible).', soc: 'Gérant majoritaire : TNS. Gérant minoritaire ou égalitaire : assimilé salarié.', cap: 'Capital libre (1 € minimum).', tva: 'TVA DOM 8,5 % / 2,1 %.', ment: 'Forme, capital social, RCS ou RM, adresse du siège.', btp: 'Cadre encadré, courant pour les entreprises familiales du bâtiment.', soc_: true, micro: false },
  sasu: { l: 'SASU', full: 'Société par actions simplifiée unipersonnelle', who: '1 associé', resp: 'Limitée aux apports.', imp: 'Impôt sur les sociétés, option IR temporaire.', soc: 'Président assimilé salarié : meilleure protection, cotisations plus élevées.', cap: 'Capital libre (1 € minimum).', tva: 'TVA DOM 8,5 % / 2,1 %.', ment: 'Forme, capital social, RCS ou RM, adresse du siège.', btp: 'Souplesse des statuts, rémunération en salaire et dividendes.', soc_: true, micro: false },
  sas: { l: 'SAS', full: 'Société par actions simplifiée', who: '2 associés ou plus', resp: 'Limitée aux apports.', imp: 'Impôt sur les sociétés, option IR temporaire.', soc: 'Président et directeurs généraux assimilés salariés.', cap: 'Capital libre (1 € minimum).', tva: 'TVA DOM 8,5 % / 2,1 %.', ment: 'Forme, capital social, RCS ou RM, adresse du siège.', btp: 'Grande liberté statutaire, adaptée pour accueillir des associés ou investisseurs.', soc_: true, micro: false },
  snc: { l: 'SNC', full: 'Société en nom collectif', who: '2 associés ou plus', resp: 'Illimitée et solidaire : chaque associé répond des dettes sur ses biens.', imp: 'Impôt sur le revenu, option IS.', soc: 'Associés : travailleurs non salariés.', cap: 'Pas de minimum.', tva: 'TVA DOM 8,5 % / 2,1 %.', ment: 'Forme, capital social, RCS, adresse du siège.', btp: 'Rare dans le bâtiment à cause de la responsabilité illimitée.', soc_: true, micro: false },
  sa: { l: 'SA', full: 'Société anonyme', who: '2 actionnaires (7 si cotée)', resp: 'Limitée aux apports.', imp: 'Impôt sur les sociétés.', soc: 'Président et directeur général assimilés salariés.', cap: '37 000 € minimum, commissaire aux comptes obligatoire.', tva: 'TVA DOM 8,5 % / 2,1 %.', ment: 'Forme, capital social, RCS, adresse du siège.', btp: 'Réservée aux structures importantes.', soc_: true, micro: false },
  scop: { l: 'SCOP', full: 'Société coopérative et participative (SARL ou SAS)', who: 'Salariés associés majoritaires', resp: 'Limitée aux apports.', imp: 'Impôt sur les sociétés, avec avantages liés à la participation.', soc: 'Dirigeants et associés salariés.', cap: 'Selon la forme (SARL ou SAS coopérative).', tva: 'TVA DOM 8,5 % / 2,1 %.', ment: 'Forme, mention « coopérative », capital variable, RCS, siège.', btp: 'Présente dans le BTP pour des équipes qui veulent décider ensemble.', soc_: true, micro: false },
};
const FORME_OF = v => { const s = String(v || '').toLowerCase(); if (FORMES[s]) return s; if (/micro|auto/.test(s)) return 'micro'; if (/eurl/.test(s)) return 'eurl'; if (/sasu/.test(s)) return 'sasu'; if (/sarl/.test(s)) return 'sarl'; if (/sas/.test(s)) return 'sas'; if (/snc/.test(s)) return 'snc'; if (/scop/.test(s)) return 'scop'; if (/^sa$/.test(s)) return 'sa'; return 'ei'; };
const circNature = c => { const l = String(c.label || '').toLowerCase();
  if (/plaque|cuisson/.test(l)) return 'plaque'; if (/lave-linge|lave linge/.test(l)) return 'lavelinge'; if (/borne|recharge|irve|véhicule/.test(l)) return 'irve';
  if (/prises? cuisine|plan de travail/.test(l)) return 'cuisine'; if (/éclairage|eclairage|lumi|spot/.test(l)) return 'eclairage'; if (/prise/.test(l)) return 'prises'; return 'special'; };
const NAT_LABEL = { eclairage: 'points lumineux', prises: 'socles', cuisine: 'socles', plaque: '', lavelinge: '', irve: '', special: '' };

function planFromLines(lines) {
  const q = ref => lines.filter(l => l.ref === ref).reduce((a, l) => a + l.qty, 0), has = ref => q(ref) > 0;
  let diffs = [];
  for (let i = 0; i < q('HAG-CDA742F'); i++) diffs.push({ cal: 40, type: 'A' });
  for (let i = 0; i < q('LEG-411617'); i++) diffs.push({ cal: 63, type: 'AC' });
  if (!diffs.length) diffs = [{ cal: 40, type: 'A' }, { cal: 40, type: 'AC' }];
  const L16 = ['Éclairage séjour', 'Prises séjour', 'Éclairage chambres', 'Prises chambres', 'Éclairage cuisine', 'Prises cuisine', 'Prises salle de bain', 'Éclairage extérieur', 'Prises bureau', 'Volets roulants'];
  const L20 = [...(has('LEG-CLIM20') ? ['Prise clim'] : []), ...(has('ATL-STEA200') ? ['Chauffe-eau'] : []), 'Lave-linge', 'Lave-vaisselle', 'Four'];
  const circ = [];
  for (let i = 0; i < q(PLAN_REF[16]); i++) circ.push({ label: L16[i % L16.length], cal: 16 });
  if (has('RAV-BRAS132') && circ.length > 2) circ[2].label = 'Éclairage + brasseur';
  for (let i = 0; i < q(PLAN_REF[20]); i++) circ.push({ label: L20[i % L20.length], cal: 20 });
  for (let i = 0; i < q(PLAN_REF[32]); i++) circ.push({ label: i ? 'Circuit 32 A' : 'Plaque de cuisson', cal: 32 });
  if (!circ.length) [['Éclairage', 16], ['Prises', 16], ['Prises cuisine', 20], ['Lave-linge', 20], ['Plaque de cuisson', 32]].forEach(([label, cal]) => circ.push({ label, cal }));
  const iA = Math.max(0, diffs.findIndex(d => d.type === 'A')), load = diffs.map(() => 0);
  circ.forEach(c => { const k = circNature(c); c.pts = k === 'eclairage' ? 4 : k === 'prises' ? (c.cal === 20 ? 8 : 5) : k === 'cuisine' ? 6 : 0; });
  circ.forEach(c => { const d = (c.cal === 32 || /lave-linge/i.test(c.label)) ? iA : load.indexOf(Math.min(...load)); c.diff = 'd' + d; load[d]++; });
  return { diffs: diffs.map((d, i) => ({ ...d, id: 'd' + i })), circuits: circ.map(c => ({ ...c, id: UID++ })), parafoudre: has('HAG-SPN215D') };
}

function planDiagram(p, sel, mode, errs = {}) {
  const full = mode !== 'rep';
  let qn = 0;
  const K = { ink: 'var(--color-neutral-900)', acc: 'var(--color-accent-700)', accSoft: 'var(--color-accent-200)', sage: 'var(--color-accent-2-700)', soft: 'var(--color-surface)', paper: 'var(--color-neutral-100)', mute: 'var(--color-neutral-700)' };
  const L = [], R = [], T = [], Hh = [], B = [], Pp = [];
  const pa = (d, c = K.ink, w = 1.8, f = 'none') => Pp.push({ d, c, w, f });
  const sym = (k, x, y, col) => {
    if (k === 'eclairage') { pa(`M${x - 6} ${y}a6 6 0 1 0 12 0a6 6 0 1 0 -12 0`, col); pa(`M${x - 4.2} ${y - 4.2}L${x + 4.2} ${y + 4.2}M${x + 4.2} ${y - 4.2}L${x - 4.2} ${y + 4.2}`, col); }
    else if (k === 'prises' || k === 'cuisine') { pa(`M${x - 7} ${y + 5}A7 7 0 0 1 ${x + 7} ${y + 5}`, col); pa(`M${x} ${y - 2}L${x} ${y - 8}M${x - 5} ${y - 2}L${x + 5} ${y - 2}`, col); }
    else if (k === 'plaque') { pa(`M${x - 7} ${y - 7}h14v14h-14z`, col); pa(`M${x - 3.5} ${y - 1.5}a1.8 1.8 0 1 0 0.01 0M${x + 3.5} ${y - 1.5}a1.8 1.8 0 1 0 0.01 0M${x - 3.5} ${y + 3.5}a1.8 1.8 0 1 0 0.01 0M${x + 3.5} ${y + 3.5}a1.8 1.8 0 1 0 0.01 0`, col, 1.6); }
    else if (k === 'lavelinge') { pa(`M${x - 7} ${y - 7}h14v14h-14z`, col); pa(`M${x - 4} ${y}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`, col, 1.5); }
    else if (k === 'irve') { pa(`M${x - 8} ${y - 7}h16v14h-16z`, col); tx(x, y + 3, 'VE', { s: 7.5, w: 800, a: 'middle', fill: col }); }
    else { pa(`M${x - 7} ${y - 7}h14v14h-14z`, col); pa(`M${x - 7} ${y + 7}L${x + 7} ${y - 7}`, col, 1.5); }
  };
  const ln = (x1, y1, x2, y2, c = K.ink, w = 2) => L.push({ x1, y1, x2, y2, c, w });
  const tx = (x, y, t, o = {}) => T.push({ x, y, t, s: o.s || 10, w: o.w || 600, fill: o.fill || K.ink, a: o.a || 'start', rot: o.rot || '' });
  R.push({ x: 8, y: 8, w: 150, h: 40, rx: 10, fill: K.soft, stroke: K.ink, sw: 2 });
  tx(18, 24, 'Disjoncteur de branchement', { w: 700 });
  tx(18, 39, '500 mA · réseau EDF', { s: 9, w: 500, fill: K.mute });
  const top0 = 110, rowH = full ? 236 : 142, nd = Math.max(1, p.diffs.length);
  ln(30, 48, 30, top0 + (nd - 1) * rowH - 18);
  if (p.parafoudre) { ln(30, 70, 180, 70); R.push({ x: 180, y: 58, w: 104, h: 24, rx: 8, fill: K.paper, stroke: K.sage, sw: 2 }); tx(232, 74, 'Parafoudre type 2', { s: 9, w: 700, a: 'middle' }); }
  p.diffs.forEach((d, r) => {
    const yb = top0 + r * rowH, cs = p.circuits.filter(c => c.diff === d.id), n = cs.length, over = n > 8;
    const sp = n > 1 ? Math.min(full ? 36 : 32, 236 / (n - 1)) : 32, xs = cs.map((c, i) => 80 + i * sp);
    ln(56, yb, n ? xs[n - 1] + 2 : 96, yb, K.ink, 3.5);
    R.push({ x: 8, y: yb - 18, w: 48, h: 36, rx: 9, fill: K.paper, stroke: over ? K.acc : K.sage, sw: 2.5 });
    tx(32, yb - 22, 'ID' + (r + 1), { s: 10, w: 800, a: 'middle', fill: K.sage });
    tx(32, yb - 3, d.cal + ' A', { s: 9, w: 800, a: 'middle' });
    tx(32, yb + 10, '30 mA ' + d.type, { s: 8.5, a: 'middle', fill: K.mute });
    if (!n) tx(70, yb + 24, 'Aucun circuit', { s: 9, fill: K.mute });
    cs.forEach((c, i) => {
      const x = +xs[i].toFixed(1), on = c.id === sel, bad = !!errs[c.id], col = on ? K.acc : K.ink;
      if (on) B.push({ x: +(x - Math.min(sp, 34) / 2).toFixed(1), y: yb - 20, w: +Math.min(sp, 34).toFixed(1), h: full ? 228 : 126, rx: 10 });
      ln(x, yb, x, yb + 14, col);
      R.push({ x: x - 6, y: yb + 14, w: 12, h: 24, rx: 3, fill: on ? K.paper : bad ? K.accSoft : K.paper, stroke: bad ? K.acc : col, sw: bad ? 2.5 : 2 });
      if (bad) { R.push({ x: x + 4, y: yb + 8, w: 10, h: 10, rx: 5, fill: K.acc, stroke: K.acc, sw: 0 }); tx(x + 9, yb + 16, '!', { s: 8, w: 900, a: 'middle', fill: K.paper }); }
      ln(x - 3.5, yb + 33, x + 3.5, yb + 19, col, 1.5);
      ln(x, yb + 38, x, yb + 52, col);
      const kN = circNature(c); sym(kN, x, yb + 62, bad ? K.acc : col);
      if (c.pts > 1 && (kN === 'eclairage' || kN === 'prises' || kN === 'cuisine')) tx(x, yb + 81, '×' + c.pts, { s: 8, w: 800, a: 'middle', fill: K.mute });
      qn++;
      tx(x, yb - 7, 'Q' + qn, { s: 9.5, w: 800, a: 'middle', fill: on ? K.acc : K.sage });
      tx(x, yb + 92, c.cal + ' A', { s: 9, w: 800, a: 'middle', fill: col });
      if (full) {
        const words = String(c.label || 'Circuit').split(' '), l1 = [], l2 = [];
        words.forEach(wd => { ((l1.join(' ') + ' ' + wd).trim().length <= 20 && !l2.length ? l1 : l2).push(wd); });
        let a1 = l1.join(' '), a2 = l2.join(' ');
        if (a2.length > 20) a2 = a2.slice(0, 19) + '…';
        const y0 = yb + 102, sec = String(SECTION[c.cal]).replace('.', ',') + ' mm²';
        tx(x + 3.5, y0, a1, { s: 10, w: on ? 800 : 700, fill: col, rot: `rotate(90 ${x + 3.5} ${y0})` });
        if (a2) tx(x - 7, y0, a2, { s: 10, w: on ? 800 : 700, fill: col, rot: `rotate(90 ${x - 7} ${y0})` });
        tx(x + (a2 ? 12.5 : 12), y0, sec, { s: 8.5, w: 600, fill: K.mute, rot: `rotate(90 ${x + (a2 ? 12.5 : 12)} ${y0})` });
      } else {
        tx(x, yb + 104, String(SECTION[c.cal]).replace('.', ',') + '²', { s: 8.5, w: 600, a: 'middle', fill: K.mute });
      }
      Hh.push({ id: c.id, x: +(x - sp / 2).toFixed(1), y: yb - 18, w: +sp.toFixed(1), h: full ? 232 : 130 });
    });
  });
  const maxY = Math.max(Hh.length ? 0 : 0, ...T.map(t => t.rot ? t.y + String(t.t).length * 5.6 : t.y + 4), ...R.map(r => r.y + r.h), ...B.map(b => b.y + b.h));
  const used = [...new Set(p.circuits.map(circNature))];
  return { L, R, T, B, P: Pp, used, H: Hh, h: Math.ceil(maxY + 10) };
}

function metierRules(key, lines) {
  const q = re => lines.filter(l => l.kind === 'mat' && (re.test(l.ref) || re.test(l.name))).reduce((a, l) => a + l.qty, 0);
  const has = re => q(re) > 0, R = [];
  const add = (t, d, ok, fix, ref) => R.push({ t, d, ok, fix, ref });
  const P = () => {
    const ce = q(/chauffe-eau|STEA/i);
    if (ce) { add('Groupe de sécurité sur chauffe-eau', 'Obligatoire sur tout chauffe-eau à accumulation (NF EN 1487).', q(/WAT-GS/) >= ce, { ref: 'WAT-GS34', qty: Math.max(1, ce - q(/WAT-GS/)) }, 'NF DTU 60.1');
      add('Réducteur de pression', 'Conseillé si la pression du réseau dépasse 3 bar.', has(/WAT-RDP/) ? true : null, has(/WAT-RDP/) ? null : { ref: 'WAT-RDP34', qty: 1 }, 'NF DTU 60.11'); }
    const lav = lines.filter(l => l.kind === 'mat' && /lavabo/i.test(l.name) && !/siphon/i.test(l.name)).reduce((a, l) => a + l.qty, 0);
    if (lav) add('Siphon sur chaque appareil sanitaire', 'Chaque appareil est raccordé par un siphon à l\u2019évacuation.', q(/siphon/i) >= lav, { ref: 'NIC-SIPH32', qty: Math.max(1, lav - q(/siphon/i)) }, 'NF DTU 60.1');
    if (has(/receveur|douche/i)) {
      add('Bonde de douche', 'Évacuation siphonnée du receveur ou de la douche.', has(/bonde/i), { ref: 'NIC-BON90', qty: 1 }, 'NF DTU 60.1');
      add('Mitigeur thermostatique en salle de bain', 'Eau chaude limitée à 50 °C aux points de puisage des pièces de toilette.', has(/thermostat/i), { ref: 'GRO-GROTH', qty: 1 }, 'Arrêté 30/11/2005'); }
  };
  const PT = () => {
    const pe = q(/SEI-ACRM|SEI-GLY|glycéro|peinture acrylique/i);
    if (pe) { add('Impression / sous-couche', 'Couche d\u2019impression adaptée au support avant les couches de finition.', has(/sous-couche/i), { ref: 'SEI-SC10', qty: Math.max(1, Math.ceil(pe / 2)) }, 'NF DTU 59.1');
      add('Préparation du support', 'Rebouchage et ponçage : le support doit être sain, sec et plan.', has(/rebouchage|enduit/i) ? true : null, has(/rebouchage|enduit/i) ? null : { ref: 'TOU-REB5', qty: 1 }, 'NF DTU 59.1');
      add('Protection des ouvrages', 'Bâchage des sols et masquage des menuiseries.', has(/bâche|masquage/i) ? true : null, has(/bâche|masquage/i) ? null : { ref: 'BAC-45', qty: 1 }, 'NF DTU 59.1'); }
    if (has(/glycéro/i)) add('Glycéro en intérieur', 'Préférer une peinture en phase aqueuse étiquetée A+ en pièce habitée.', null, null, 'Étiquetage COV');
  };
  if (key === 'plomb') P();
  if (key === 'peintre') PT();
  if (key === 'multi') { P(); PT(); }
  if (key === 'macon') {
    const pp = q(/parpaing|brique/i);
    if (pp) add('Chaînages horizontaux et verticaux', 'Obligatoires en maçonnerie porteuse, renforcés en zone sismique 2.', has(/HA10|fer à béton/i), { ref: 'FER-HA10', qty: Math.max(2, Math.ceil(pp / 40)) }, 'NF DTU 20.1');
    if (has(/sable|gravillon/i)) { add('Treillis soudé dans le dallage', 'Armature du dallage pour limiter la fissuration.', has(/treillis/i), { ref: 'TRE-ST25', qty: 1 }, 'NF DTU 13.3');
      add('Film polyane sous dallage', 'Barrière contre les remontées d\u2019humidité sur terre-plein.', has(/polyane/i), { ref: 'POL-150', qty: 20 }, 'NF DTU 13.3'); }
  }
  if (key === 'menuis') {
    const lt = q(/terrasse/i);
    if (lt) { add('Lambourdes classe 4', 'Bois de classe d\u2019emploi 4, entraxe adapté aux lames.', has(/lambourde/i), { ref: 'BOI-LAMB4', qty: Math.ceil(lt * 3) }, 'NF DTU 51.4');
      add('Vis inox', 'Fixations inox obligatoires en extérieur, deux vis par appui.', has(/inox/i), { ref: 'QUI-VIS', qty: Math.max(1, Math.ceil(lt / 8)) }, 'NF DTU 51.4'); }
    if (has(/fenêtre|porte-fenêtre/i)) add('Résistance cyclonique 1 200 Pa', 'Fenêtres et portes extérieures : 1 200 Pa minimum à La Réunion.', has(/1 200 Pa|cyclonique/i), { ref: 'ALU-F1200', qty: 1 }, 'Guide CSTB Réunion');
    if (has(/porte/i) && !has(/fenêtre/i)) add('Portes extérieures', 'Si une porte donne sur l\u2019extérieur, justifier 1 200 Pa minimum.', null, null, 'NF DTU 36.5');
  }
  if (key === 'carrel') {
    const gc = q(/grès cérame/i), fa = q(/faïence/i);
    if (gc) add('Mortier-colle C2 pour grès cérame', 'Colle améliorée C2 obligatoire pour les carreaux peu poreux.', has(/C2/), { ref: 'WEB-C225', qty: Math.max(1, Math.ceil(gc / 5)) }, 'NF DTU 52.2');
    if (fa) { add('SPEC en pièce humide', 'Protection à l\u2019eau sous carrelage dans les zones de douche.', has(/SPEC/), { ref: 'WEB-SPEC', qty: Math.max(1, Math.ceil(fa / 4)) }, 'NF DTU 52.2');
      add('Bandes d\u2019angle', 'Renfort de la SPEC aux angles et jonctions sol-mur.', has(/bande/i), { ref: 'WEB-BANDE', qty: 1 }, 'NF DTU 52.2'); }
    if (gc || fa) { add('Primaire d\u2019accrochage', 'Sur support poreux ou ancien carrelage.', has(/primaire/i) ? true : null, has(/primaire/i) ? null : { ref: 'WEB-PRIM5', qty: 1 }, 'NF DTU 52.2');
      add('Joints', 'Joint adapté à la largeur prévue par le fabricant.', has(/WEB-J5|^joint/i), { ref: 'WEB-J5', qty: Math.max(1, Math.ceil((gc + fa) / 15)) }, 'NF DTU 52.2'); }
  }
  if (key === 'couvr') {
    const tl = q(/TOL-BAC|TOL-ALU/);
    if (tl) { add('Tôle 0,75 mm, acier S320GD', 'Épaisseur et nuance minimales en zone cyclonique.', true, null, 'Fiche paracyclonique CSTB');
      const need = Math.ceil(tl / 10), got = q(/VIS-AF|VIS-INOX/);
      add('Fixations renforcées en rive', 'Toutes les nervures fixées sur chaque panne en rive de toiture.', got >= need, { ref: 'VIS-AF', qty: Math.max(1, need - got) }, 'NF DTU 40.35');
      add('Closoirs', 'Obturation des ondes en égout et au faîtage.', has(/closoir/i), { ref: 'TOL-CLOS', qty: Math.ceil(tl / 3) }, 'NF DTU 40.35');
      add('Faîtage', 'Recouvrement du faîtage fixé sur chaque onde.', has(/TOL-FAIT/), { ref: 'TOL-FAIT', qty: Math.max(1, Math.ceil(Math.sqrt(tl))) }, 'NF DTU 40.35');
      add('Bord de mer', 'À moins de 3 km du littoral : aluminium ou inox et vis inox.', has(/TOL-ALU|VIS-INOX/) ? true : null, has(/TOL-ALU|VIS-INOX/) ? null : { ref: 'VIS-INOX', qty: 1 }, 'Fiche paracyclonique CSTB'); }
  }
  return R;
}


let COEF = 1.35;
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const DF_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const NF2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), NF0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const fmt = n => NF2.format(r2(n)) + ' €';
const U = u => u === 'u' ? '' : ' ' + u;
const fmt0 = n => NF0.format(Math.round(n)) + ' €';
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const CAT_CACHE = {};
const catOf = k => CAT_CACHE[k] || (CAT_CACHE[k] = CAT_RAW[k].map((a, i) => ({ id: k + i, name: a[0], ref: a[1], fam: a[2], fourn: a[3], achat: a[4], unit: a[5] })));

let UID = 1;
const matLine = (it, qty) => ({ id: UID++, kind: 'mat', name: it.name, ref: it.ref, fourn: it.fourn, unit: it.unit, qty, achat: it.achat, pu: r2(it.achat * COEF), tva: 8.5 });
const moLine = (h, taux) => ({ id: UID++, kind: 'mo', name: "Main d'œuvre", unit: 'h', qty: h, achat: 0, pu: taux, tva: 8.5 });
const depLine = () => ({ id: UID++, kind: 'dep', name: 'Déplacement', unit: 'forfait', qty: 1, achat: 0, pu: 35, tva: 8.5 });

function demoLines() {
  const c = catOf('elec'), f = ref => c.find(i => i.ref === ref);
  return [matLine(f('HAG-VF313'), 1), matLine(f('HAG-CDA742F'), 1), matLine(f('SCH-A9N21024'), 5), matLine(f('SCH-A9N21025'), 2), matLine(f('SCH-A9N21027'), 1), matLine(f('NEX-R2V3G25'), 25), matLine(f('HAG-SPN215D'), 1), matLine(f('RAV-BRAS132'), 1), moLine(6, 48), depLine()];
}

const DEVIS_ST = ['Brouillon', 'Envoyé', 'Accepté', 'Facturé'];
const FAC_ST = ['Émise', 'Transmise', 'Acceptée', 'Encaissée'];
const TONE = {
  Brouillon: ['var(--color-neutral-300)', 'var(--color-neutral-900)'],
  Envoyé: ['var(--color-accent-200)', 'var(--color-accent-900)'], Émise: ['var(--color-accent-200)', 'var(--color-accent-900)'], Transmise: ['var(--color-accent-200)', 'var(--color-accent-900)'],
  Accepté: ['var(--color-accent-2-300)', 'var(--color-accent-2-900)'], Acceptée: ['var(--color-accent-2-300)', 'var(--color-accent-2-900)'],
  Facturé: ['var(--color-accent-2-700)', 'var(--color-neutral-100)'], Encaissée: ['var(--color-accent-2-700)', 'var(--color-neutral-100)'],
};

class Component extends DCLogic {
  state = {
    tab: 'home', metier: 'elec', regime: this.props.regime ?? 'assujetti',
    lines: demoLines(), client: 'M. et Mme Payet', chantier: '12 chemin des Filaos, Saint-Paul',
    acompte: this.props.acompte ?? 30, remiseTxt: '0',
    aiInput: '', aiState: 'idle', aiMsg: '', aiOk: true,
    recapOpen: false, metierOpen: false, toast: '',
    q: '', fam: 'Tout', docTab: 'devis', devisSeq: 42, facSeq: 29,
    docs: [
      { no: 'DEV-2026-041', type: 'devis', live: true, client: 'M. et Mme Payet — rénovation tableau, Saint-Paul', date: '24/09', st: 0 },
      { no: 'DEV-2026-040', type: 'devis', client: 'Mme Hoarau — cuisine, Le Tampon', date: '19/09', st: 1, ttc: 1284.5, marge: 27 },
      { no: 'DEV-2026-039', type: 'devis', client: 'SCI Les Filaos — Saint-Pierre', date: '11/09', st: 2, ttc: 3910, marge: 24 },
      { no: 'DEV-2026-038', type: 'devis', client: 'M. Grondin — Sainte-Marie', date: '02/09', st: 3, ttc: 2146.8, marge: 22 },
      { no: 'FAC-2026-028', type: 'fac', client: 'SCI Les Filaos — acompte 30 %', date: '15/09', st: 1, ttc: 1173 },
      { no: 'FAC-2026-027', type: 'fac', client: 'M. Grondin — Sainte-Marie', date: '08/09', st: 3, ttc: 2146.8 },
    ],
  };
  scrollRef = React.createRef();

  static KEY = 'btp974-mobile-v1';
  static KEEP = ['lines','client','chantier','acompte','remiseTxt','docs','devisSeq','facSeq','metier','regime','events','co','tauxMO','targetM','seuil','puHidden','ordered','relances','acompteDef','formeInfo','planMode','plans','compta','aiHistory','lcShow','payTerm','clientType','retenue','reserve','projSteps','editNo','versionOf','baseCount','sun','paAgo'];
  componentDidMount() {
    this._esc = e => { if (e.key !== 'Escape') return; if (this.state.help) this.setState({ help: null }); else if (this.state.mailDraft) this.setState({ mailDraft: null }); }; window.addEventListener('keydown', this._esc);
    this._fitN = 0; this._fitT = Date.now();
    this._fit = () => { cancelAnimationFrame(this._fitRaf); this._fitRaf = requestAnimationFrame(() => {
      const now = Date.now(); if (now - this._fitT > 1000) { this._fitT = now; this._fitN = 0; } if (++this._fitN > 4) return;
      const H = window.innerHeight, W = window.innerWidth; if (H < 300 || W < 200) return;
      const k = Math.round(Math.min(1, (H - 32) / 844, (W - 32) / 390) * 50) / 50;
      if (k !== (this.state.fitK || 1)) this.setState({ fitK: k }); }); };
    this._fit(); window.addEventListener('resize', this._fit);
    setTimeout(() => this.initDrag(), 0);
    try {
      const raw = localStorage.getItem(Component.KEY); if (!raw) return;
      const d = JSON.parse(raw), ids = [];
      (d.lines || []).forEach(l => ids.push(l.id)); (d.docs || []).forEach(x => (x.lines || []).forEach(l => ids.push(l.id || 0))); (d.plans || []).forEach(p => (p.circuits || []).forEach(c => ids.push(+c.id || 0)));
      UID = Math.max(UID, ...ids.filter(Number.isFinite)) + 1;
      // Ne restaure que les clés attendues : une sauvegarde altérée ne doit pas piloter l'état d'interface.
      const keep = {}; Component.KEEP.forEach(k => { if (d && Object.hasOwn(d, k)) keep[k] = d[k]; });
      this.setState({ ...keep, savedAt: Date.now() });
    } catch (e) {}
  }
  componentDidUpdate(pp, ps) {
    if (ps && (ps.activeSet !== this.state.activeSet || (ps.tab !== 'set' && this.state.tab === 'set'))) this.centerChip();
    if (!this._dragInit && (this._dragTry = (this._dragTry || 0) + 1) < 5) this.initDrag();
    clearTimeout(this._sv);
    this._sv = setTimeout(() => { try { const o = {}; Component.KEEP.forEach(k => { if (this.state[k] !== undefined) o[k] = this.state[k]; }); localStorage.setItem(Component.KEY, JSON.stringify(o)); } catch (e) {} }, 400);
  }
  spy() {
    if (this.state.tab !== 'set' || Date.now() - (this._lockSpy || 0) < 700) return;
    cancelAnimationFrame(this._spyRaf);
    this._spyRaf = requestAnimationFrame(() => {
      const sc = this.scrollRef.current; if (!sc) return;
      let cur = 'ent';
      sc.querySelectorAll('[id^="set-"]').forEach(el => { if (el.offsetTop - 80 <= sc.scrollTop) cur = el.id.slice(4); });
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) cur = 'aff';
      if (cur !== this.state.activeSet) this.setState({ activeSet: cur });
    });
  }

  centerChip() {
    const sc = this.scrollRef.current, bar = sc && sc.querySelector('[data-setnav]'), chip = bar && bar.querySelector('[data-chip="' + (this.state.activeSet || 'ent') + '"]');
    if (!chip || this._dragging) return;
    const target = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }

  initDrag() {
    const root = this.scrollRef.current && this.scrollRef.current.parentElement;
    if (!root || this._dragInit) return; this._dragInit = true;
    let el = null, sx = 0, sl = 0, moved = false;
    this._pd = e => { if (e.pointerType === 'touch') return; el = e.target.closest('[data-hscroll]'); if (!el) return; sx = e.clientX; sl = el.scrollLeft; moved = false; this._dragging = true; el.style.cursor = 'grabbing'; el.style.scrollSnapType = 'none'; };
    this._pm = e => { if (!el) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; el.scrollLeft = sl - dx; };
    this._pu = () => { if (!el) return; el.style.cursor = 'grab'; el.style.scrollSnapType = ''; el = null; this._dragging = false; if (moved) { this._dragged = true; setTimeout(() => { this._dragged = false; }, 60); } };
    this._cl = e => { if (this._dragged && e.target.closest('[data-hscroll]')) { e.stopPropagation(); e.preventDefault(); } };
    root.addEventListener('pointerdown', this._pd); window.addEventListener('pointermove', this._pm); window.addEventListener('pointerup', this._pu); root.addEventListener('click', this._cl, true);
    this._wh = e => { const b = e.target.closest('[data-hscroll]'); if (b && Math.abs(e.deltaY) > Math.abs(e.deltaX) && b.scrollWidth > b.clientWidth && e.shiftKey) { b.scrollLeft += e.deltaY; e.preventDefault(); } };
    root.addEventListener('wheel', this._wh, { passive: false });
  }

  componentWillUnmount() {
    cancelAnimationFrame(this._fitRaf);
    window.removeEventListener('keydown', this._esc);
    window.removeEventListener('resize', this._fit);
    window.removeEventListener('pointermove', this._pm); window.removeEventListener('pointerup', this._pu); cancelAnimationFrame(this._spyRaf); clearTimeout(this._sv); clearTimeout(this._t); if (this._rec) this._rec.abort(); }

  go = tab => { this.setState(st => ({ rulesOpen: false, tab, prevTab: st.tab !== tab ? st.tab : st.prevTab, recapOpen: false })); const el = this.scrollRef.current; if (el) el.scrollTop = 0; };
  flash = msg => { clearTimeout(this._t); this.setState({ toast: msg }); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); };
  upd = (id, patch) => this.setState(s => ({ lines: s.lines.map(l => l.id === id ? { ...l, ...patch } : l) }));
  metierObj = () => METIERS.find(m => m.key === this.state.metier);

  totals() {
    const { lines, regime, remiseTxt, acompte } = this.state;
    const r = Math.min(Math.max(parseFloat(String(remiseTxt).replace(',', '.')) || 0, 0), 100) / 100;
    let mat = 0, achat = 0, mo = 0, dep = 0; const tvaBase = { 8.5: 0, 2.1: 0 };
    lines.forEach(l => {
      const m = r2(l.pu * l.qty);
      if (l.kind === 'mat') { mat += m; achat += l.achat * l.qty; } else if (l.kind === 'mo') mo += m; else dep += m;
      tvaBase[l.tva] += m;
    });
    const sub = mat + mo + dep, remise = r2(sub * r), ht = r2(sub - remise);
    const micro = regime === 'micro';
    const t85 = micro ? 0 : r2(tvaBase[8.5] * (1 - r) * 0.085), t21 = micro ? 0 : r2(tvaBase[2.1] * (1 - r) * 0.021);
    const ttc = r2(ht + t85 + t21), ac = r2(ttc * acompte / 100);
    const matNet = mat * (1 - r), marge = r2(matNet - achat), pct = matNet > 0 ? marge / matNet * 100 : 0;
    return { mat: r2(mat), mo: r2(mo), dep: r2(dep), remise, ht, t85, t21, ttc, ac, solde: r2(ttc - ac), marge, pct, micro };
  }

  async runAI() {
    const txt = this.state.aiInput.trim();
    if (!txt) { this.setState({ aiMsg: "Écris d'abord une phrase sur le chantier.", aiOk: false }); return; }
    const m = this.metierObj(), cat = catOf(m.key);
    this.setState(st => ({ aiState: 'busy', aiMsg: '', aiHistory: [txt, ...(st.aiHistory || []).filter(x => x !== txt)].slice(0, 8) }));
    try {
      // Le prompt système est construit côté serveur (server/prompts.mjs) : le client n'envoie que la demande.
      if (!window.btpAI) throw new Error('indispo');
      const raw = await window.btpAI('devis', { metier: m.key, text: txt });
      const clean = String(raw).replace(/```json|```/g, '').trim();
      const data = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      const found = [];
      (data.lignes || []).forEach(li => {
        const d = norm(String(li.designation || '')), words = d.split(/[^a-z0-9]+/).filter(w => w.length > 2);
        let best = null, score = 0;
        cat.forEach(c => { const n = norm(c.name); const sc = n === d ? 99 : words.filter(w => n.includes(w)).length; if (sc > score) { score = sc; best = c; } });
        const q = Math.max(1, Math.round(Number(li.quantite) || 1));
        if (best && score > 0) found.push(matLine(best, q));
      });
      const h = Math.max(0, Math.round(Number(data.mo_heures) || 0));
      const lines = [...found, ...(h ? [moLine(h, this.taux())] : []), depLine()];
      if (!found.length) throw new Error('vide');
      this.setState({ lines, aiState: 'idle', aiOk: true, aiMsg: `${lines.length} lignes proposées — vérifie et ajuste.` });
    } catch (e) {
      this.setState({ aiState: 'idle', aiOk: false, aiMsg: "L'IA est indisponible pour l'instant. Ajoute les lignes depuis le catalogue." });
    }
  }

  taux() { return this.state.tauxMO ?? this.metierObj().taux; }

  genLines(ttc) {
    const m = this.metierObj(), c = catOf(m.key);
    const mats = [matLine(c[0], 1), matLine(c[2], 3), matLine(c[Math.min(11, c.length - 1)], 10)];
    const ht = (ttc || 500) / 1.085, matSum = mats.reduce((a, l) => a + l.pu * l.qty, 0);
    return [...mats, moLine(Math.max(1, Math.round((ht - matSum - 35) / this.taux())), this.taux()), depLine()];
  }

  newDevis() {
    const s = this.state, T = this.totals(), no = `DEV-2026-0${s.devisSeq}`;
    const docs = s.docs.map(x => x.live ? { ...x, live: false, lines: s.lines, client: s.client + (s.chantier ? ' — ' + s.chantier : ''), ttc: T.ttc, marge: Math.round(T.pct) } : x);
    this.setState({ docs: [{ no, type: 'devis', live: true, client: 'Nouveau client', date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), st: 0 }, ...docs],
      devisSeq: s.devisSeq + 1, lines: [], client: '', chantier: '', acompte: s.acompteDef ?? 30, editNo: no, versionOf: null, baseCount: 0, aiInput: '', aiMsg: '', remiseTxt: '0' });
    this.go('devis');
    this.flash(`${no} créé`);
  }

  openDevis(no) {
    const s = this.state, T = this.totals(), d = s.docs.find(x => x.no === no);
    if (d.live) return this.go('devis');
    let docs = s.docs.map(x => x.live ? { ...x, live: false, lines: s.lines, client: s.client + (s.chantier ? ' — ' + s.chantier : ''), ttc: T.ttc, marge: Math.round(T.pct) } : x);
    const lines0 = d.lines || this.genLines(d.ttc);
    const [cl, ch] = d.client.split(' — ');
    if (d.st < 2) {
      docs = docs.map(x => x.no === no ? { ...x, live: true } : x);
      this.setState({ docs, lines: lines0.map(l => ({ ...l })), client: cl, chantier: ch || '', editNo: no, versionOf: d.versionOf || null, baseCount: d.baseCount || 0 });
    } else {
      const root = d.versionOf || no, n = s.docs.filter(x => x.versionOf === root).length + 2, nno = `${root}-V${n}`;
      const lines = lines0.map(l => ({ ...l, id: UID++, puTxt: undefined, orig: { qty: l.qty, pu: l.pu } }));
      docs = [{ no: nno, type: 'devis', live: true, client: d.client, date: '26/09', st: 0, versionOf: root, baseCount: lines.length }, ...docs];
      this.setState({ docs, lines, client: cl, chantier: ch || '', editNo: nno, versionOf: root, baseCount: lines.length });
      this.flash(`${d.status === 'Facturé' ? 'Devis facturé' : 'Devis accepté'} : version ${n} créée`);
    }
    this.go('devis');
  }

  openFac(no) {
    const d = this.state.docs.find(x => x.no === no);
    const ht = r2((d.ttc || 0) / (this.state.regime === 'micro' ? 1 : 1.085));
    const lines = (d.lines || [{ name: d.client.split(' — ')[1] ? 'Travaux : ' + d.client.split(' — ')[1] : 'Travaux selon devis', qty: 1, pu: ht }])
      .map(l => ({ id: UID++, name: l.name, qtyTxt: String(l.qty).replace('.', ','), puTxt: String(l.pu).replace('.', ',') }));
    this.setState({ facEdit: { no, client: d.client, lines } });
  }

  facVals() {
    const s = this.state, e = s.facEdit;
    if (!e) return { facOpen: false, fe: { lines: [] } };
    const d = s.docs.find(x => x.no === e.no), micro = s.regime === 'micro';
    const num = t => parseFloat(String(t).replace(',', '.')) || 0;
    const setE = patch => this.setState(st => ({ facEdit: { ...st.facEdit, ...patch } }));
    const setL = (id, patch) => this.setState(st => ({ facEdit: { ...st.facEdit, lines: st.facEdit.lines.map(l => l.id === id ? { ...l, ...patch } : l) } }));
    const ht = r2(e.lines.reduce((a, l) => a + num(l.qtyTxt) * num(l.puTxt), 0));
    const tva = micro ? 0 : r2(ht * 0.085), ttc = r2(ht + tva);
    const status = FAC_ST[d.st], locked = d.st >= 1;
    return {
      facOpen: true,
      fe: {
        no: e.no, date: d.date, status, bg: TONE[status][0], fg: TONE[status][1], locked, pa: this.props.paName || 'FactuPro 974',
        client: e.client, onClient: ev => setE({ client: ev.target.value }),
        lines: e.lines.map(l => ({ ...l, montant: fmt(num(l.qtyTxt) * num(l.puTxt)),
          onName: ev => setL(l.id, { name: ev.target.value }), onQty: ev => setL(l.id, { qtyTxt: ev.target.value }), onPu: ev => setL(l.id, { puTxt: ev.target.value }),
          onDel: () => setE({ lines: e.lines.filter(x => x.id !== l.id) }) })),
        addLine: () => setE({ lines: [...e.lines, { id: UID++, name: 'Nouvelle ligne', qtyTxt: '1', puTxt: '0' }] }),
        ht: fmt(ht), tva: micro ? 'non applicable' : fmt(tva), tvaLabel: micro ? 'TVA (293 B)' : 'TVA 8,5 %', ttc: fmt(ttc),
        saveLabel: locked ? 'Créer la facture rectificative' : 'Enregistrer les modifications',
        plans: this.plans().filter(p => p.facNo === e.no).map(p => ({ name: p.name, onOpen: () => { this.setState({ facEdit: null }); this.openPlan(p.id); } })),
        hasPlans: this.plans().some(p => p.facNo === e.no),
        close: () => this.setState({ facEdit: null }),
        save: () => {
          const lines = e.lines.map(l => ({ name: l.name, qty: num(l.qtyTxt), pu: num(l.puTxt) }));
          if (!locked) {
            this.setState(st => ({ facEdit: null, docs: st.docs.map(x => x.no === e.no ? { ...x, client: e.client, lines, ttc } : x) }));
            this.flash(`${e.no} mise à jour`);
          } else {
            const nno = `FAC-2026-0${s.facSeq}`;
            this.setState(st => ({ facEdit: null, facSeq: st.facSeq + 1, docs: [{ no: nno, type: 'fac', client: e.client, date: '26/09', st: 0, ttc, lines }, ...st.docs] }));
            this.flash(`Avoir + ${nno} créés, à transmettre`);
          }
        },
      },
    };
  }

  paVals(facs) {
    const s = this.state, conn = s.paConn ?? 'ok', ago = s.paAgo ?? 4;
    const n = i => facs.filter(f => f.st >= i).length;
    const map = {
      ok: { label: 'Connectée', sub: ago ? `il y a ${ago} min` : 'à l\u2019instant', dot: 'var(--color-accent-2-700)', halo: 'var(--color-accent-2-300)', action: 'Synchroniser' },
      sync: { label: 'Synchronisation…', sub: 'en cours', dot: 'var(--color-accent-500)', halo: 'var(--color-accent-200)', action: '…' },
      off: { label: 'Déconnectée', sub: 'envois en attente', dot: 'var(--color-accent-700)', halo: 'var(--color-accent-200)', action: 'Reconnecter' },
    }[conn];
    const sync = () => {
      this.setState({ paConn: 'sync' });
      setTimeout(() => {
        this.setState(st => ({ paConn: 'ok', paAgo: 0, docs: st.docs.map(d => d.type === 'fac' && d.st === 0 ? { ...d, st: 1 } : d) }));
        this.flash('Statuts à jour avec la plateforme');
      }, 1200);
    };
    return { ...map, busy: conn === 'sync', name: this.props.paName || 'FactuPro 974',
      onAction: sync,
      tally: `${n(1)} / ${facs.length} transmises`,
      facs: facs.slice(0, 3).map(f => ({ ...f, onOpen: () => this.openFac(f.no) })),
      steps: FAC_ST.map(l => ({ l, c: TONE[l][0] })),
    };
  }

  margeVals(docs, T) {
    const s = this.state, r = s.lines;
    const tgt = s.targetM ?? 26, coef = s.targetM == null ? 1.35 : r2(1 / (1 - tgt / 100));
    const SEUIL = s.seuil ?? 15;
    const tone = p => p < SEUIL ? { ink: 'var(--color-accent-800)', fill: 'var(--color-accent-700)' } : { ink: 'var(--color-accent-2-800)', fill: 'var(--color-accent-2-700)' };
    const devis = docs.filter(d => d.type === 'devis').map(d => {
      let vente, achat;
      if (d.live) { vente = T.mat - (T.mat * 0); achat = T.mat - T.marge; vente = T.marge + achat; }
      else if (d.lines) { vente = d.lines.filter(l => l.kind === 'mat').reduce((a, l) => a + l.pu * l.qty, 0); achat = d.lines.filter(l => l.kind === 'mat').reduce((a, l) => a + l.achat * l.qty, 0); }
      else { vente = d.ttc / 1.085 * 0.55; achat = vente * (1 - d.marge / 100); }
      const marge = vente - achat, pct = vente > 0 ? marge / vente * 100 : 0;
      return { no: d.no, client: d.client.split(' — ')[0], vente: fmt0(vente), achat: fmt0(achat), marge: fmt0(marge), pctTxt: Math.round(pct) + ' %',
        w: Math.min(Math.max(pct, 0), 50) / 50 * 100 + '%', ...tone(pct), v: vente, a: achat, onOpen: () => this.openDevis(d.no) };
    });
    const V = devis.reduce((x, d) => x + d.v, 0), A = devis.reduce((x, d) => x + d.a, 0), M = V - A, P = V ? M / V * 100 : 0;
    const low = P < SEUIL;
    const lines = r.filter(l => l.kind === 'mat').map(l => { const p = l.pu > 0 ? (l.pu - l.achat) / l.pu * 100 : 0; return { name: `${l.qty} × ${l.name}`, marge: fmt((l.pu - l.achat) * l.qty), pct: Math.round(p) + ' %', ink: tone(p).ink }; });
    return { isMarge: s.tab === 'marge', mg: {
      count: devis.length, avg: Math.round(P) + ' %', avgEur: fmt0(M),
      boxBg: low ? 'var(--color-accent-200)' : 'var(--color-accent-2-200)', ink: low ? 'var(--color-accent-900)' : 'var(--color-accent-2-900)',
      vente: fmt(V), achat: '− ' + fmt(A), marge: fmt(M), devis, lines, noLines: !lines.length,
      target: tgt, targetTxt: tgt + ' %', coefTxt: String(coef).replace('.', ','), low: tgt < SEUIL, tInk: tgt < SEUIL ? 'var(--color-accent-800)' : 'var(--color-accent-2-800)',
      onTarget: e => this.setState({ targetM: Number(e.target.value) }),
      apply: () => { this.setState(st => ({ lines: st.lines.map(l => l.kind === 'mat' ? { ...l, pu: r2(l.achat * coef), puTxt: undefined } : l) })); this.flash(`Devis recalculé à ×${String(coef).replace('.', ',')} (${tgt} %)`); },
      coefs: [1.2, 1.35, 1.5, 1.7].map(k => { const a = k === coef, m = Math.round((1 - 1 / k) * 100); return { k: String(k).replace('.', ','), p: Math.round((1 - 1 / k) * 100) + ' %', bg: a ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => this.setState({ targetM: k === 1.35 ? null : m }) }; }),
    } };
  }

  statsVals(ca) {
    const s = this.state, mode = s.statPeriod || 6, isMonth = mode === 'mois', p = isMonth ? 12 : mode;
    const ALL = [['Oct', 9100, 0], ['Nov', 7800, 0], ['Déc', 6200, 0], ['Janv', 8400, 0], ['Févr', 9900, 0], ['Mars', 10700, 0], ['Avr', 8200, 0], ['Mai', 11400, 0], ['Juin', 9600, 0], ['Juil', 13800, 900], ['Août', 12100, 2400], ['Sep', Math.round(ca + 9000), 5200]];
    const FULL = ['octobre 2025', 'novembre 2025', 'décembre 2025', 'janvier 2026', 'février 2026', 'mars 2026', 'avril 2026', 'mai 2026', 'juin 2026', 'juillet 2026', 'août 2026', 'septembre 2026'];
    const mi = s.statMonth ?? 11, off = 12 - p;
    const rows = ALL.slice(-p), max = Math.max(...rows.map(r => r[1]));
    const sel = isMonth ? [ALL[mi]] : rows;
    const total = sel.reduce((a, r) => a + r[1], 0), wait = sel.reduce((a, r) => a + r[2], 0);
    const prev = isMonth ? (mi > 0 ? ALL[mi - 1][1] : 0) : p === 6 ? ALL.slice(0, 6).reduce((a, r) => a + r[1], 0) : 0;
    const pct = prev ? Math.round((total - prev) / prev * 100) : 0;
    const nb = isMonth ? Math.max(3, Math.round(total / 1950)) : p === 6 ? 34 : 61;
    const SC = { 'Émise': 'var(--color-accent-300)', 'Transmise': 'var(--color-accent-500)', 'Acceptée': 'var(--color-accent-2-400)', 'Encaissée': 'var(--color-accent-2-700)' };
    const fr = isMonth && mi < 9 ? [0, 0, 0] : [0.02, 0.043, 0.049];
    const status = [['Émise', total * fr[0]], ['Transmise', total * fr[1]], ['Acceptée', total * fr[2]], ['Encaissée', total * (1 - fr[0] - fr[1] - fr[2])]].map(([l, v]) => ({ l, v: Math.max(v, 0.0001), c: SC[l], amount: fmt0(v) }));
    const seed = isMonth ? mi + 1 : p === 6 ? 20 : 40;
    const cl = [['SCI Les Filaos', 0.24], ['M. Grondin', 0.16], ['Mme Hoarau', 0.11], ['Commune de Saint-Paul', 0.09], ['M. et Mme Payet', 0.08], ['Mme Técher', 0.07]]
      .map(([n, r], i) => [n, r * (0.45 + ((seed * (i + 3) * 7) % 13) / 10)])
      .sort((a, b) => b[1] - a[1]).slice(0, 4);
    const ht = total / 1.085, t85 = ht * 0.085 * 0.92, t21 = ht * 0.021 * 0.08;
    const on = a => a ? ['var(--color-neutral-900)', 'var(--color-neutral-100)'] : ['var(--color-surface)', 'var(--color-neutral-900)'];
    const show = s.lcShow || { ca: true, enc: true, n1: false };
    const selI = isMonth ? mi - off : rows.length - 1;
    const N1 = rows.map((r, i) => Math.round(r[1] * (0.78 + ((i * 37) % 11) / 50)));
    const SER = [['ca', 'CA facturé', 'var(--color-accent-700)', rows.map(r => r[1]), ''], ['enc', 'Encaissé', 'var(--color-accent-2-700)', rows.map(r => r[1] - r[2]), ''], ['n1', 'Année N-1', 'var(--color-neutral-600)', N1, '6 6']];
    const vis = SER.filter(x => show[x[0]]);
    const vmax = Math.max(1000, ...vis.flatMap(x => x[3])) * 1.1;
    const X = i => 36 + i * (272 / Math.max(1, rows.length - 1)), Y = v => 150 - v / vmax * 140;
    const path = arr => arr.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
    const caArr = SER[0][3];
    const lc = {
      series: SER.map(([k, l, c]) => ({ l, c, bg: show[k] ? 'var(--color-surface)' : 'transparent', op: show[k] ? 1 : 0.5, onToggle: () => this.setState({ lcShow: { ...show, [k]: !show[k] } }) })),
      grid: [0, 0.33, 0.66, 1].map(f => ({ y: (150 - f * 140).toFixed(1), ty: (154 - f * 140).toFixed(1), l: Math.round(vmax * f / 1000) })),
      lines: vis.map(([k, l, c, arr, dash]) => ({ d: path(arr), c, dash: dash || 'none' })),
      area: show.ca ? path(caArr) + ` L ${X(caArr.length - 1).toFixed(1)} 150 L ${X(0).toFixed(1)} 150 Z` : '', areaOp: show.ca ? 0.55 : 0,
      dots: vis.flatMap(([k, l, c, arr]) => arr.map((v, i) => ({ x: X(i).toFixed(1), y: Y(v).toFixed(1), c, r: i === selI ? 6 : (rows.length > 6 ? 0 : 3.5) }))).filter(p => p.r > 0),
      selX: X(selI).toFixed(1),
      xs: rows.map((r, i) => ({ l: rows.length > 6 && i % 2 ? '' : r[0], x: X(i).toFixed(1), w: i === selI ? 800 : 600, hx: (X(i) - 136 / Math.max(1, rows.length - 1)).toFixed(1), hw: (272 / Math.max(1, rows.length - 1)).toFixed(1),
        onPick: () => this.setState({ statPeriod: 'mois', statMonth: i + off }) })),
      readout: SER.map(([k, l, c, arr]) => ({ l, c, v: fmt0(arr[selI]) })),
      selLabel: FULL[selI + off],
    };
    const toDocs = (tab, filt) => () => this.setState({ docTab: tab, docFilter: filt }, () => this.go('docs'));
    return { lc, st: {
      isMonth,
      periods: [['mois', 'Mois par mois'], [6, '6 mois'], [12, '12 mois']].map(([v, label]) => { const a = mode === v; return { label, bg: a ? 'var(--color-neutral-100)' : 'transparent', fg: a ? 'var(--color-neutral-900)' : 'var(--color-neutral-700)', onPick: () => this.setState({ statPeriod: v }) }; }),
      monthChips: ALL.map((r, i) => ({ m: r[0], bg: on(i === mi)[0], fg: on(i === mi)[1], onPick: () => this.setState({ statMonth: i }) })),
      periodLabel: isMonth ? FULL[mi] : p === 6 ? '6 derniers mois' : '12 derniers mois',
      total: fmt0(total),
      evo: isMonth ? (prev ? `${pct >= 0 ? '+' : ''}${pct} % par rapport à ${FULL[mi - 1].split(' ')[0]}` : 'Premier mois de la période') : p === 6 ? `${pct >= 0 ? '+' : ''}${pct} % par rapport aux 6 mois précédents` : `Moyenne ${fmt0(total / 12)} par mois`,
      gap: p === 6 ? '10px' : '4px',
      months: rows.map((r, i) => ({ m: r[0], k: (r[1] / 1000).toFixed(1).replace('.', ','), h: Math.round(r[1] / max * 82) + '%', wait: r[2], paid: r[1] - r[2],
        op: isMonth && i + off !== mi ? 0.35 : 1, onPick: () => this.setState({ statPeriod: 'mois', statMonth: i + off }) })),
      tiles: [
        { label: 'En attente de paiement', value: fmt0(wait), sub: 'factures non encaissées', onTap: toDocs('fac', { k: 'unpaid', label: 'non encaissées' }) },
        { label: 'Délai moyen de paiement', value: '23 j', sub: 'après transmission', onTap: toDocs('fac', { k: 'status', v: 'Acceptée', label: 'acceptées, à encaisser' }) },
        { label: 'Factures émises', value: String(nb), sub: isMonth ? FULL[mi] : `sur ${p} mois`, onTap: toDocs('fac', null) },
        { label: 'Panier moyen', value: fmt0(total / nb), sub: 'TTC par facture', onTap: toDocs('fac', null) },
      ],
      status: status.map(x => ({ ...x, onTap: toDocs('fac', { k: 'status', v: x.l, label: x.l.toLowerCase() }) })),
      clients: cl.map(([name, r]) => { const pid = { 'SCI Les Filaos': 'filaos', 'M. Grondin': 'grondin', 'Mme Hoarau': 'hoarau' }[name]; return { name, amount: fmt0(total * r), w: Math.round(r / cl[0][1] * 100) + '%', onTap: pid ? () => this.openProjet(pid) : toDocs('fac', { k: 'client', v: name, label: name }) }; }),
      tva85: fmt(t85), tva21: fmt(t21), tvaTot: fmt(t85 + t21),
      toFacs: () => this.setState({ docTab: 'fac' }, () => this.go('docs')),
    } };
  }

  async rdvAI() {
    const txt = (this.state.rdvText || '').trim();
    if (!txt) return this.flash('Dicte ou écris ton rendez-vous');
    if (this._rec) this._rec.stop();
    const now = new Date(), today = this.iso(now);
    this.setState({ rdvBusy: true, rdvErr: '' });
    let r = null;
    try {
      if (!window.btpAI) throw new Error('x');
      const raw = await window.btpAI('rdv', { text: txt, today });
      const s = String(raw); r = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
    } catch (e) { r = this.rdvFallback(txt); }
    if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) { this.setState({ rdvBusy: false, rdvErr: 'Je n\u2019ai pas compris la date. Précise par ex. « jeudi 14 h ».' }); return; }
    r.time = /^\d{1,2}:\d{2}$/.test(r.time || '') ? r.time.padStart(5, '0') : '08:00';
    r.kind = ['chantier', 'visite', 'fourn'].includes(r.kind) ? r.kind : 'visite';
    const clash = this.events().filter(e => e.date === r.date && Math.abs(this.mins(e.time) - this.mins(r.time)) < 90);
    this.setState({ rdvBusy: false, rdvDraft: { date: r.date, time: r.time, duree: +r.duree || 60, title: r.title || txt.slice(0, 40), place: r.place || '', kind: r.kind, clash: clash.map(e => e.time.replace(':', ' h ') + ' ' + e.title) } });
  }
  mins(t) { const [a, b] = String(t).split(':').map(Number); return a * 60 + (b || 0); }
  rdvFallback(txt) {
    const t = txt.toLowerCase(), d = new Date(); let set = false;
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    if (/après-demain|apres-demain/.test(t)) { d.setDate(d.getDate() + 2); set = true; } else if (/demain/.test(t)) { d.setDate(d.getDate() + 1); set = true; } else if (/aujourd/.test(t)) set = true;
    days.forEach((n, i) => { if (!set && new RegExp('\\b' + n).test(t)) { let k = (i - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + k); set = true; } });
    const dm = t.match(/\ble\s+(\d{1,2})\b/); if (!set && dm) { const n = +dm[1]; if (n < d.getDate()) d.setMonth(d.getMonth() + 1); d.setDate(n); set = true; }
    const tm = t.match(/(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?/);
    const kind = /chantier|travaux|pose/.test(t) ? 'chantier' : /rexel|cged|fournisseur|commande|retrait/.test(t) ? 'fourn' : 'visite';
    const cl = Object.values(PROJETS).find(p => t.includes(p.key.toLowerCase()));
    let place = (txt.match(/\b(?:à|a|au)\s+((?:Saint|Sainte|Le|La|Les)[-\s][A-ZÉa-zé-]+|[A-Z][a-zé-]+)/) || [])[1] || (cl ? cl.addr.split(',').pop().replace(/\d+/g, '').trim() : '');
    if (/\bau\s+(tampon|port)\b/i.test(txt) && place && !/^le /i.test(place)) place = 'Le ' + place;
    const clean = txt.replace(/\b(demain|après-demain|apres-demain|aujourd'hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|prochain)\b/gi, '').replace(/\ble\s+\d{1,2}\b/i, '').replace(/\b(à|a)?\s*\d{1,2}\s*(h|heures?|:)\s*\d{0,2}/i, '').replace(/^(\s*(rdv|rendez-vous))/i, '').replace(/^\s*(à|a)\s+/i, ' ').replace(/\s+/g, ' ').trim();
    if (!place) { const sm = txt.match(/\b((?:Saint|Sainte)-[A-ZÉ][a-zé]+)/); if (sm) place = sm[1]; }
    return set ? { date: this.iso(d), time: tm ? tm[1].padStart(2, '0') + ':' + (tm[2] || '00') : '08:00', title: cl ? cl.client + ' — ' + (kind === 'chantier' ? 'chantier' : 'visite') : (clean.charAt(0).toUpperCase() + clean.slice(1)).slice(0, 40), place, kind } : null;
  }
  timePick(val, onSet) {
    const [hh, mm] = String(val || '08:00').split(':');
    const m5 = String(Math.round(+mm / 5) * 5 % 60).padStart(2, '0');
    return { hh: hh.padStart(2, '0'), mm: m5, onH: e => onSet(e.target.value + ':' + m5), onM: e => onSet(hh.padStart(2, '0') + ':' + e.target.value) };
  }

  normVals() {
    const s = this.state, key = s.metier;
    const all = Object.keys(CAT_RAW).flatMap(k => catOf(k));
    const R = metierRules(key, s.lines);
    const addFix = fx => { const it = all.find(c => c.ref === fx.ref); if (!it) return; this.setState(st => ({ lines: [...st.lines.filter(x => x.kind !== 'dep'), matLine(it, fx.qty), ...st.lines.filter(x => x.kind === 'dep')] })); };
    const items = R.map(r => { const it = r.fix && all.find(c => c.ref === r.fix.ref);
      return { t: r.t, d: r.d, ref: r.ref, ico: r.ok === true ? '✓' : r.ok === false ? '!' : 'i',
        bg: r.ok === true ? 'var(--color-accent-2-700)' : r.ok === false ? 'var(--color-accent-700)' : 'var(--color-neutral-100)', fg: r.ok === null ? 'var(--color-neutral-900)' : 'var(--color-neutral-100)',
        canFix: r.ok !== true && !!it, fixLabel: it ? `+ ${r.fix.qty}${it.unit === 'u' ? '' : ' ' + it.unit} ${it.name}` : '', onFix: () => { addFix(r.fix); this.flash(it.name + ' ajouté'); } }; });
    const miss = R.filter(r => r.ok === false && r.fix);
    return { norm: { show: s.lines.length > 0, items, empty: !items.length, refs: (DTU[key] || []).map(([c, l]) => ({ c, l })), title: 'Conformité ' + this.metierObj().short,
      summary: miss.length ? `${miss.length} élément${miss.length > 1 ? 's' : ''} obligatoire${miss.length > 1 ? 's' : ''} manquant${miss.length > 1 ? 's' : ''}` : 'Rien d\u2019obligatoire ne manque',
      sumFg: miss.length ? 'var(--color-accent-800)' : 'var(--color-accent-2-800)',
      canAll: miss.length > 1, addAll: () => { miss.forEach(r => addFix(r.fix)); this.flash(miss.length + ' éléments ajoutés'); },
      open: s.normOpen ?? true, toggle: () => this.setState({ normOpen: !(s.normOpen ?? true) }), rot: (s.normOpen ?? true) ? 'rotate(180deg)' : 'none',
      emptyTxt: key === 'elec' ? 'Les règles NF C 15-100 sont contrôlées sur le schéma unifilaire du devis.' : 'Ajoute du matériel pour voir les points de conformité.' } };
  }

  rdvVals() {
    const s = this.state, dr = s.rdvDraft, KL = { chantier: 'Chantier', visite: 'Visite / devis', fourn: 'Fournisseur' };
    const setD = k => e => this.setState(st => ({ rdvDraft: { ...st.rdvDraft, [k]: e.target.value } }));
    return { rdv: {
      text: s.rdvText || '', onText: e => this.setState({ rdvText: e.target.value, rdvErr: '' }),
      mic: () => this.toggleMic('rdvText', 'rdvMic'), micOn: !!s.rdvMic, micBg: s.rdvMic ? 'var(--color-accent-700)' : 'var(--color-neutral-100)', micFg: s.rdvMic ? 'var(--color-neutral-100)' : 'var(--color-text)', micRing: s.rdvMic ? '0 0 0 6px var(--color-accent-200)' : 'none',
      busy: !!s.rdvBusy, btn: s.rdvBusy ? 'L\u2019IA prépare le rendez-vous…' : 'Créer le rendez-vous', go: () => this.rdvAI(), err: s.rdvErr || '',
      examples: ['Demain 14 h visite chez Mme Hoarau au Tampon', 'Jeudi 8 h chantier SCI Les Filaos', 'Lundi 16 h retrait commande Rexel au Port'].map(t => ({ t, onPick: () => this.setState({ rdvText: t, rdvErr: '' }) })),
      has: !!dr,
      ...(dr ? { date: dr.date, time: dr.time, title: dr.title, place: dr.place, duree: String(dr.duree),
        when: new Date(dr.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + dr.time.replace(':', ' h '),
        onDate: setD('date'), onTime: setD('time'), tp: this.timePick(dr.time, v => this.setState(st => ({ rdvDraft: { ...st.rdvDraft, time: v } }))), onTitle: setD('title'), onPlace: setD('place'),
        kinds: Object.keys(KL).map(k => ({ l: KL[k], bg: dr.kind === k ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: dr.kind === k ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => this.setState(st => ({ rdvDraft: { ...st.rdvDraft, kind: k } })) })),
        clash: dr.clash.length ? 'Déjà prévu ce jour-là près de cette heure : ' + dr.clash.join(', ') + '.' : '',
        confirm: () => { this.setState(st => ({ events: [...this.events(), { id: Date.now(), date: dr.date, time: dr.time, title: dr.title, place: dr.place, kind: dr.kind }], rdvDraft: null, rdvText: '', calDay: dr.date, calMonth: [+dr.date.slice(0, 4), +dr.date.slice(5, 7) - 1] })); this.flash('Rendez-vous ajouté au planning'); },
        cancel: () => this.setState({ rdvDraft: null }) } : { kinds: [] }),
    } };
  }

  events() {
    return this.state.events ?? [
      { id: 1, date: '2026-09-28', time: '07:30', title: 'Mme Hoarau — cuisine', place: 'Le Tampon', kind: 'chantier' },
      { id: 2, date: '2026-09-29', time: '07:30', title: 'Mme Hoarau — cuisine (fin)', place: 'Le Tampon', kind: 'chantier' },
      { id: 3, date: '2026-09-30', time: '08:00', title: 'SCI Les Filaos — tableau', place: 'Saint-Pierre', kind: 'chantier' },
      { id: 4, date: '2026-09-30', time: '16:00', title: 'Retrait commande Rexel', place: 'Le Port', kind: 'fourn' },
      { id: 5, date: '2026-10-01', time: '14:00', title: 'M. et Mme Payet — visite', place: 'Saint-Paul', kind: 'visite' },
      { id: 6, date: '2026-10-05', time: '08:00', title: 'M. Grondin — clôture chantier', place: 'Sainte-Marie', kind: 'chantier' },
      { id: 7, date: '2026-10-08', time: '10:00', title: 'Devis brasseurs d\u2019air', place: 'Saint-Leu', kind: 'visite' },
      { id: 8, date: '2026-09-22', time: '08:00', title: 'SCI Les Filaos — passage de gaines', place: 'Saint-Pierre', kind: 'chantier' },
    ];
  }

  upcoming() { const t = this.iso(new Date()); return this.events().filter(e => e.date >= t).length; }
  iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  calVals() {
    const s = this.state;
    if (!(s.tab === 'outil' && s.toolOpen === 'planning')) return { cal: { show: false, cells: [], events: [], kinds: [], legend: [] } };
    const today = new Date(), tIso = this.iso(today);
    const sel = s.calDay || tIso;
    const [vy, vm] = s.calMonth || [today.getFullYear(), today.getMonth()];
    const KC = { chantier: 'var(--color-accent-2-700)', visite: 'var(--color-accent-600)', fourn: 'var(--color-neutral-700)' };
    const KL = { chantier: 'Chantier', visite: 'Visite / devis', fourn: 'Fournisseur' };
    const evs = this.events();
    const first = new Date(vy, vm, 1), start = (first.getDay() + 6) % 7, days = new Date(vy, vm + 1, 0).getDate();
    const n = Math.ceil((start + days) / 7) * 7, cells = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(vy, vm, 1 - start + i), iso = this.iso(d), inM = d.getMonth() === vm;
      const de = evs.filter(e => e.date === iso), isSel = iso === sel, isT = iso === tIso;
      cells.push({ d: d.getDate(), aria: DF_LONG.format(d),
        bg: isSel ? 'var(--color-neutral-900)' : 'transparent', fg: isSel ? 'var(--color-neutral-100)' : 'var(--color-text)',
        op: inM ? 1 : 0.35, ring: isT && !isSel ? 'inset 0 0 0 2px var(--color-accent-700)' : 'none',
        dots: [...new Set(de.map(e => e.kind))].slice(0, 3).map(k => ({ c: isSel ? 'var(--color-neutral-100)' : KC[k] })),
        onPick: () => this.setState({ calDay: iso, calMonth: [d.getFullYear(), d.getMonth()] }) });
    }
    const selD = new Date(sel + 'T12:00:00');
    const kind = s.newKind || 'chantier';
    const setM = off => { const d = new Date(vy, vm + off, 1); this.setState({ calMonth: [d.getFullYear(), d.getMonth()] }); };
    return { cal: {
      show: true, cells,
      monthLabel: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      prev: () => setM(-1), next: () => setM(1),
      goToday: () => this.setState({ calDay: tIso, calMonth: [today.getFullYear(), today.getMonth()] }),
      dayLabel: selD.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
      dayShort: selD.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
      events: evs.filter(e => e.date === sel).sort((a, b) => a.time.localeCompare(b.time)).map(e => ({ ...e, time: e.time.replace(':', ' h '), c: KC[e.kind], kindLabel: KL[e.kind],
        onDel: () => this.setState({ events: this.events().filter(x => x.id !== e.id) }) })),
      empty: !evs.some(e => e.date === sel),
      legend: Object.keys(KC).map(k => ({ l: KL[k], c: KC[k] })),
      newTitle: s.newTitle || '', onTitle: e => this.setState({ newTitle: e.target.value }),
      newTime: s.newTime || '08:00', onTime: e => this.setState({ newTime: e.target.value }), tp: this.timePick(s.newTime || '08:00', v => this.setState({ newTime: v })),
      kinds: Object.keys(KC).map(k => ({ l: k === 'visite' ? 'Visite' : KL[k], bg: kind === k ? 'var(--color-neutral-900)' : 'var(--color-neutral-100)', fg: kind === k ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => this.setState({ newKind: k }) })),
      add: () => {
        const title = (s.newTitle || '').trim();
        if (!title) return this.flash('Donne un nom à l\u2019intervention');
        this.setState({ events: [...this.events(), { id: Date.now(), date: sel, time: s.newTime || '08:00', title, place: this.state.chantier ? this.state.chantier.split(',').pop().trim() : 'La Réunion', kind }], newTitle: '' });
        this.flash('Ajouté au planning');
      },
    } };
  }

  toggleMic(key = 'aiInput', flag = 'micOn') {
    if (this._rec) { this._rec.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return this.flash('Dictée non disponible sur ce navigateur');
    const rec = new SR(); rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = true;
    const base = this.state[key] ? String(this.state[key]).trim() + ' ' : '';
    rec.onresult = e => { let txt = ''; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript; this.setState({ [key]: base + txt, aiMsg: '' }); };
    rec.onerror = e => { if (e.error === 'not-allowed') this.flash('Autorise le micro pour dicter'); };
    rec.onend = () => { this._rec = null; this.setState({ [flag]: false }); };
    this._rec = rec; this.setState({ [flag]: true });
    try { rec.start(); } catch (err) { this._rec = null; this.setState({ [flag]: false }); }
  }

  dupDevis() {
    const s = this.state; if (!s.lines.length) return this.flash('Rien à dupliquer');
    const src = s.editNo || 'DEV-2026-041', lines = s.lines.map(l => ({ ...l, id: UID++, orig: undefined }));
    this.newDevis();
    this.setState({ lines });
    this.flash(`Copie de ${src} créée, choisis le client`);
  }

  buildMail(c, L) {
    const co = this.coData(), s = this.state, fr = { mois: 'mensuel', trim: 'trimestriel', an: 'annuel' }[c.freq] || 'mensuel';
    const facs = s.docs.filter(d => d.type === 'fac');
    const todo = L.filter(x => !c.checks[x[0]]), done = L.filter(x => c.checks[x[0]]);
    const hello = c.nom ? 'Bonjour ' + c.nom + ',' : 'Bonjour,';
    const body = [hello, '',
      `Je vous transmets les éléments de ${co.name} pour relecture.`, '',
      `Factures jointes (${facs.length}) : ${facs.map(f => f.no).join(', ') || 'aucune'}.`,
      `Envoi souhaité : ${fr}.`, '',
      ...(todo.length ? ['Points à relire :', ...todo.map(x => '- ' + x[1] + ' : ' + x[2])] : ['Tous les points ont déjà été relus.']),
      ...(done.length ? ['', 'Déjà validés : ' + done.map(x => x[1].toLowerCase()).join(', ') + '.'] : []),
      ...(c.note ? ['', 'Note : ' + c.note] : []),
      '', 'Merci d\u2019avance,', co.name, co.tel].join('\n');
    return { to: c.email || '', cc: '', subject: `${co.name} — éléments à relire (${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })})`, body, attach: facs.map(f => f.no + '.pdf') };
  }

  mailVals() {
    const d = this.state.mailDraft;
    if (!d) return { mail: { open: false, attach: [] } };
    const set = k => e => this.setState(st => ({ mailDraft: { ...st.mailDraft, [k]: e.target.value } }));
    const valid = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(d.to);
    return { mail: { open: true, ...d, onTo: set('to'), onCc: set('cc'), onSubject: set('subject'), onBody: set('body'),
      attach: d.attach.map(a => ({ n: a, onDel: () => this.setState(st => ({ mailDraft: { ...st.mailDraft, attach: st.mailDraft.attach.filter(x => x !== a) } })) })),
      attachCount: d.attach.length ? d.attach.length + ' pièce' + (d.attach.length > 1 ? 's' : '') + ' jointe' + (d.attach.length > 1 ? 's' : '') : 'Aucune pièce jointe',
      toErr: d.to && !valid ? 'Adresse e-mail invalide.' : '', toBorder: d.to && !valid ? 'var(--color-accent-700)' : 'transparent',
      close: () => this.setState({ mailDraft: null }),
      reset: () => { const c = { cabinet: '', nom: '', email: '', tel: '', note: '', freq: 'mois', checks: {}, ...(this.state.compta || {}) }; this.setState({ mailDraft: this.buildMail(c, this._cptL) }); this.flash('Brouillon régénéré'); },
      send: () => {
        if (!valid) return this.flash('Indique une adresse e-mail valide');
        const href = 'mailto:' + encodeURIComponent(d.to) + '?' + [d.cc ? 'cc=' + encodeURIComponent(d.cc) : '', 'subject=' + encodeURIComponent(d.subject), 'body=' + encodeURIComponent(d.body + (d.attach.length ? '\n\nPièces jointes : ' + d.attach.join(', ') : ''))].filter(Boolean).join('&');
        this.setState(st => ({ mailDraft: null, compta: { ...(st.compta || {}), sentAt: Date.now(), email: (st.compta && st.compta.email) || d.to } }));
        try { window.open(href, '_blank'); } catch (e) {}
        this.flash('E-mail prêt dans ta messagerie');
      },
    } };
  }

  cptVals() {
    const s = this.state, c = { cabinet: '', nom: '', email: '', tel: '', note: '', freq: 'mois', checks: {}, sentAt: null, ...(s.compta || {}) };
    const up = patch => this.setState(st => ({ compta: { ...c, ...(st.compta || {}), ...patch } }));
    const on = {}; ['cabinet', 'nom', 'email', 'tel', 'note'].forEach(k => { on[k] = e => up({ [k]: e.target.value }); });
    const T = this.metierObj();
    const L = [
      ['tva', 'Régime et taux de TVA', s.regime === 'micro' ? 'Franchise en base (art. 293 B du CGI)' : 'Assujetti, taux DOM 8,5 % et 2,1 %'],
      ['cgv', 'Conditions de vente', 'Délai de paiement, pénalités de retard, mentions légales'],
      ['marge', 'Tarifs et marge', `Main d'œuvre ${s.tauxMO ?? T.taux} € / h, seuil de marge ${s.seuil ?? 15} %`],
      ['acompte', 'Acomptes et facturation', 'Acompte par défaut, factures d\u2019acompte et de solde'],
      ['pa', 'Facture électronique', 'Plateforme agréée et calendrier 2026-2027'],
    ];
    this._cptL = L;
    const n = L.filter(x => c.checks[x[0]]).length;
    return { cpt: {
      ...c, on,
      freqs: [['mois', 'Mensuel'], ['trim', 'Trimestriel'], ['an', 'Annuel']].map(([k, label]) => { const a = c.freq === k; return { label, bg: a ? 'var(--color-neutral-100)' : 'transparent', fg: a ? 'var(--color-neutral-900)' : 'var(--color-neutral-700)', onPick: () => up({ freq: k }) }; }),
      checks: L.map(([k, l, d]) => { const ok = !!c.checks[k]; return { l, d: ok ? 'Relu et validé' : d, ok, dot: ok ? 'var(--color-accent-2-700)' : 'var(--color-neutral-400)', boxBg: ok ? 'var(--color-accent-2-700)' : 'transparent', onTap: () => up({ checks: { ...c.checks, [k]: !ok } }) }; }),
      progress: `${n} / ${L.length} relus`,
      listOpen: !!s.cptOpen, toggleList: () => this.setState({ cptOpen: !s.cptOpen }), listRot: s.cptOpen ? 'rotate(180deg)' : 'none', listBorder: s.cptOpen ? 'var(--color-accent)' : 'transparent',
      sendLabel: 'Préparer l\u2019e-mail au comptable',
      lastSent: c.sentAt ? 'Dernier envoi le ' + new Date(c.sentAt).toLocaleDateString('fr-FR') : '',
      openMail: () => this.setState({ mailDraft: this.buildMail(c, L) }),
      sendDirect: () => { up({ sentAt: Date.now() }); this.flash(c.email ? `Envoyé à ${c.nom || c.cabinet || c.email}` : 'Ajoute l\u2019e-mail du comptable pour l\u2019envoi réel'); },
    } };
  }

  curNo() { return this.state.editNo || 'DEV-2026-041'; }
  defaultPlans() {
    if (!this._dp) {
      const a = planFromLines(demoLines());
      this._dp = [
        { id: 'p1', name: 'Schéma unifilaire — villa Payet', kind: 'unifilaire', devisNo: 'DEV-2026-041', facNo: null, date: '24/09/2026', ...a },
        { id: 'p2', name: 'Tableau divisionnaire bât. A', kind: 'unifilaire', devisNo: 'DEV-2026-039', facNo: 'FAC-2026-028', date: '12/09/2026', parafoudre: true,
          diffs: [{ id: 'd0', cal: 40, type: 'A' }, { id: 'd1', cal: 40, type: 'AC' }],
          circuits: [['Éclairage logements', 16, 'd1'], ['Prises logements', 16, 'd1'], ['Éclairage communs', 16, 'd1'], ['Prises cuisine', 20, 'd0'], ['Lave-linge', 20, 'd0'], ['Plaque de cuisson', 32, 'd0']].map(([label, cal, diff]) => ({ id: UID++, label, cal, diff })) },
      ];
    }
    return this._dp;
  }
  plans() { return this.state.plans ?? this.defaultPlans(); }
  openPlan(id) { this.setState({ planId: id, planSel: null }); this.go('plan'); }
  newUni() {
    const s = this.state, cur = this.curNo(), ex = this.plans().find(p => p.devisNo === cur && p.kind === 'unifilaire');
    if (ex) return this.openPlan(ex.id);
    const id = 'p' + Date.now(), g = planFromLines(s.lines);
    this.setState(st => ({ plans: [{ id, name: 'Schéma unifilaire — ' + (s.client || cur), kind: 'unifilaire', devisNo: cur, facNo: null, date: new Date().toLocaleDateString('fr-FR'), ...g }, ...(st.plans ?? this.defaultPlans())] }));
    this.openPlan(id); this.flash('Schéma généré depuis ' + cur);
  }
  importPlan(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 3 * 1024 * 1024) return this.flash('Fichier trop lourd : 3 Mo maximum');
    if (!PLAN_MIME.includes(f.type)) return this.flash('Format accepté : image PNG, JPEG, WebP ou PDF');
    const rd = new FileReader();
    rd.onload = () => { const id = 'p' + Date.now(), cur = this.curNo();
      this.setState(st => ({ plans: [{ id, name: f.name.replace(/\.[^.]+$/, ''), kind: 'import', mime: f.type, src: rd.result, fileName: f.name, devisNo: cur, facNo: null, date: new Date().toLocaleDateString('fr-FR') }, ...(st.plans ?? this.defaultPlans())] }));
      this.openPlan(id); this.flash('Plan importé et lié à ' + cur); };
    rd.readAsDataURL(f);
  }
  cmpPlan(p, lines) {
    const cnt = ref => lines.filter(l => l.ref === ref).reduce((a, l) => a + l.qty, 0);
    const pc = cal => p.circuits.filter(c => cal === 16 ? c.cal <= 16 : c.cal === cal).length;
    return [
      ['Disjoncteurs 16 A', pc(16), PLAN_REF[16]], ['Disjoncteurs 20 A', pc(20), PLAN_REF[20]], ['Disjoncteurs 32 A', pc(32), PLAN_REF[32]],
      ['Différentiels type A', p.diffs.filter(d => d.type === 'A').length, 'HAG-CDA742F'], ['Différentiels type AC', p.diffs.filter(d => d.type === 'AC').length, 'LEG-411617'],
      ['Parafoudre', p.parafoudre ? 1 : 0, 'HAG-SPN215D'],
    ].map(([l, pv, ref]) => ({ l, p: pv, d: cnt(ref), ref })).filter(r => r.p || r.d);
  }
  planIssues(p) {
    const out = [], nat = circNature, U = () => UID++;
    const mv = (ids, did) => x => ({ circuits: x.circuits.map(c => ids.includes(c.id) ? { ...c, diff: did } : c) });
    const setC = (id, patch) => x => ({ circuits: x.circuits.map(c => c.id === id ? { ...c, ...patch } : c) });
    const split = (c, max) => x => { const i = x.circuits.findIndex(k => k.id === c.id), extra = (c.pts || 0) - max;
      const nc = { ...c, id: U(), label: c.label + ' 2', pts: extra }; const cs = [...x.circuits]; cs[i] = { ...c, pts: max }; cs.splice(i + 1, 0, nc); return { circuits: cs }; };
    if (p.diffs.length < 2) { const half = p.circuits.slice(Math.ceil(p.circuits.length / 2)).map(c => c.id);
      out.push({ t: 'Au moins 2 interrupteurs différentiels 30 mA sont exigés.', fixL: 'Ajouter ID2 type A', fix: x => { const did = 'd' + (UID++); return { diffs: [...x.diffs, { id: did, cal: 40, type: 'A' }], ...mv(half, did)(x) }; } }); }
    p.diffs.forEach((d, i) => { const cs = p.circuits.filter(c => c.diff === d.id);
      if (cs.length > 8) { const ex = cs.slice(8).map(c => c.id);
        out.push({ t: `ID${i + 1} : ${cs.length} circuits, 8 au maximum par interrupteur différentiel.`, fixL: 'Ajouter un ID', fix: x => { const did = 'd' + (UID++); return { diffs: [...x.diffs, { id: did, cal: 40, type: 'A' }], ...mv(ex, did)(x) }; } }); } });
    let q = 0; const qOf = {}; p.diffs.forEach(d => p.circuits.filter(c => c.diff === d.id).forEach(c => { qOf[c.id] = 'Q' + (++q); }));
    p.circuits.forEach(c => { const d = p.diffs.find(x => x.id === c.diff), k = nat(c), r = qOf[c.id] + ' ' + c.label, pts = c.pts || 0, I = (t, fixL, fix) => out.push({ t, cid: c.id, fixL, fix });
      if (d && d.type !== 'A' && d.type !== 'F' && (k === 'plaque' || k === 'lavelinge' || k === 'irve')) {
        const dA = p.diffs.find(x => (x.type === 'A' || x.type === 'F') && p.circuits.filter(k2 => k2.diff === x.id).length < 8);
        I(`${r} : sur un différentiel type A (ou F) obligatoire.`, dA ? 'Passer sur ' + 'ID' + (p.diffs.indexOf(dA) + 1) : 'Passer l\u2019ID en type A', dA ? mv([c.id], dA.id) : x => ({ diffs: x.diffs.map(k2 => k2.id === d.id ? { ...k2, type: 'A' } : k2) })); }
      if (k === 'plaque' && c.cal < 32) I(`${r} : circuit spécialisé 32 A en 6 mm².`, 'Passer en 32 A', setC(c.id, { cal: 32 }));
      if (k === 'cuisine' && c.cal !== 20) I(`${r} : circuit dédié 20 A en 2,5 mm².`, 'Passer en 20 A', setC(c.id, { cal: 20 }));
      if (k === 'cuisine' && pts > 6) I(`${r} : ${pts} socles, 6 au maximum sur le circuit cuisine.`, 'Diviser le circuit', split(c, 6));
      if (k === 'prises' && c.cal === 16 && pts > 8) I(`${r} : ${pts} socles, 8 au maximum en 16 A / 1,5 mm².`, pts <= 12 ? 'Passer en 20 A' : 'Diviser le circuit', pts <= 12 ? setC(c.id, { cal: 20 }) : split(c, 8));
      if (k === 'prises' && c.cal === 20 && pts > 12) I(`${r} : ${pts} socles, 12 au maximum en 20 A / 2,5 mm².`, 'Diviser le circuit', split(c, 12));
      if (k === 'eclairage' && pts > 8) I(`${r} : ${pts} points lumineux, 8 au maximum par circuit.`, 'Diviser le circuit', split(c, 8));
      if (k === 'eclairage' && c.cal > 16) I(`${r} : éclairage protégé en 10 ou 16 A.`, 'Passer en 16 A', setC(c.id, { cal: 16 }));
      if ((k === 'prises' || k === 'cuisine') && c.cal > 20) I(`${r} : prises protégées en 20 A maximum.`, 'Passer en 20 A', setC(c.id, { cal: 20 }));
      if ((k === 'prises' || k === 'lavelinge') && c.cal < 16) I(`${r} : prises protégées en 16 ou 20 A minimum.`, k === 'lavelinge' ? 'Passer en 20 A' : 'Passer en 16 A', setC(c.id, { cal: k === 'lavelinge' ? 20 : 16 })); });
    if (p.circuits.filter(c => nat(c) === 'eclairage').length < 2) out.push({ t: 'Au moins 2 circuits d\u2019éclairage par logement.', fixL: '+ Circuit éclairage', fix: x => { const dl = x.diffs.map(d => x.circuits.filter(c => c.diff === d.id).length); return { circuits: [...x.circuits, { id: U(), label: 'Éclairage', cal: 10, pts: 4, diff: x.diffs[dl.indexOf(Math.min(...dl))].id }] }; } });
    return out;
  }
  planChecks(p) { return this.planIssues(p).map(i => i.t); }
  rulesVals() {
    const s = this.state, p = s.rulesOpen && this.plans().find(x => x.id === s.planId);
    if (!p || !p.circuits) return { rulesOpen: false, closeRules: () => this.setState({ rulesOpen: false }), rules: { items: [] } };
    const nat = circNature, errs = this.planChecks(p), has = re => errs.some(e => re.test(e));
    const nId = p.diffs.length, maxPer = Math.max(0, ...p.diffs.map(d => p.circuits.filter(c => c.diff === d.id).length));
    const md = this.planModules(p), nEcl = p.circuits.filter(c => nat(c) === 'eclairage').length;
    const R = [
      ['Repérage de chaque circuit', 'Chaque départ porte un repère (Q1, Q2…) et une désignation, reportés sur l\u2019étiquette du tableau. Le schéma est laissé dans le tableau.', true, `${p.circuits.length} départs repérés`],
      ['2 interrupteurs différentiels 30 mA minimum', 'Tous les circuits sont protégés par un différentiel 30 mA, répartis en au moins deux groupes.', nId >= 2, `${nId} ID sur ce schéma`],
      ['8 circuits maximum par ID', 'Au-delà, ajouter un interrupteur différentiel.', maxPer <= 8, `jusqu\u2019à ${maxPer} circuits par ID`],
      ['Type A pour plaque, lave-linge et recharge', 'Ces circuits doivent être sur un différentiel type A (ou F). La recharge en triphasé demande un type B.', !has(/type A/), ''],
      ['Prises : 8 socles en 16 A, 12 en 20 A', '16 A en 1,5 mm² : 8 socles maximum. 20 A en 2,5 mm² : 12 socles. Une prise double compte pour 2.', !has(/socles, (8|12) au maximum/), ''],
      ['Cuisine : circuit dédié 20 A', '6 socles maximum sur le plan de travail, en 2,5 mm² sur un disjoncteur 20 A.', !has(/cuisine|circuit dédié 20 A/), ''],
      ['Éclairage : 8 points par circuit', 'Au moins 2 circuits d\u2019éclairage par logement, protégés en 10 ou 16 A, 1,5 mm².', !has(/points lumineux|éclairage/i) && nEcl >= 2, `${nEcl} circuit${nEcl > 1 ? 's' : ''} d\u2019éclairage`],
      ['Plaque de cuisson : 32 A en 6 mm²', 'Circuit spécialisé, sur un différentiel type A.', !has(/32 A en 6/), ''],
      ['Réserve de 20 % dans le tableau', 'Prévoir des emplacements libres, arrondis au module supérieur.', null, md.txt],
      ['Calibre des ID : amont ou aval', 'Règle de l\u2019aval : la somme des calibres en aval ne dépasse pas celui de l\u2019ID. Sinon, justifier par la règle de l\u2019amont (disjoncteur de branchement) ou passer en 63 A.', null, planIdNote(p).split(' : ')[1]],
    ];
    const ko = R.filter(r => r[2] === false).length;
    const OK = { ico: '✓', bg: 'var(--color-accent-2-700)', fg: 'var(--color-neutral-100)', stc: 'var(--color-accent-2-800)' };
    const KO = { ico: '!', bg: 'var(--color-accent-700)', fg: 'var(--color-neutral-100)', stc: 'var(--color-accent-800)' };
    const IN = { ico: 'i', bg: 'var(--color-surface)', fg: 'var(--color-neutral-900)', stc: 'var(--color-neutral-800)' };
    return { rulesOpen: true, closeRules: () => this.setState({ rulesOpen: false }), rules: {
      summary: ko ? `${ko} règle${ko > 1 ? 's' : ''} à corriger sur ce schéma` : 'Ce schéma respecte les règles vérifiées',
      sumBg: ko ? 'var(--color-accent-200)' : 'var(--color-accent-2-200)', sumFg: ko ? 'var(--color-accent-900)' : 'var(--color-accent-2-900)',
      items: R.map(([t, d, ok, st]) => ({ t, d, st: ok === false ? (errs.find(e => e) && st ? st : 'À corriger') : st, ...(ok === true ? OK : ok === false ? KO : IN) })),
    } };
  }

  acCtl(cur, set) {
    const c = v => Math.max(0, Math.min(50, Math.round(v / 5) * 5));
    return { val: cur, label: cur ? cur + ' %' : 'Aucun', fg: cur ? 'var(--color-text)' : 'var(--color-accent-800)',
      dec: () => set(c(cur - 5)), inc: () => set(c(cur + 5)), onRange: e => set(c(+e.target.value)) };
  }

  planModules(p) {
    const used = p.diffs.length * 2 + p.circuits.length + (p.parafoudre ? 2 : 0), need = Math.ceil(used * 1.2);
    return { used, need, txt: `${used} modules occupés · prévoir au moins ${need} modules (réserve de 20 %)` };
  }
  syncPlan(pid) {
    const p = this.plans().find(x => x.id === pid); if (!p) return;
    const run = () => {
      const s = this.state, cat = catOf('elec'); let lines = s.lines.slice(), n = 0;
      this.cmpPlan(p, lines).forEach(r => {
        if (r.p === r.d) return; n++;
        const first = lines.findIndex(l => l.ref === r.ref), keep = first >= 0 ? lines[first] : null;
        lines = lines.filter(l => l.ref !== r.ref);
        if (r.p > 0) { const nl = keep ? { ...keep, qty: r.p } : matLine(cat.find(c => c.ref === r.ref), r.p);
          let at = first >= 0 ? Math.min(first, lines.length) : lines.findIndex(l => l.kind !== 'mat'); if (at < 0) at = lines.length; lines.splice(at, 0, nl); }
      });
      const cur = this.curNo();
      this.setState(st => ({ lines, plans: (st.plans ?? this.defaultPlans()).map(x => x.id === pid ? { ...x, devisNo: cur } : x) }));
      this.flash(n ? `Devis mis à jour : ${n} ligne${n > 1 ? 's' : ''} ajustée${n > 1 ? 's' : ''}` : 'Le devis correspond déjà au plan');
      this.go('devis');
    };
    if (p.devisNo === this.curNo()) run();
    else if (this.state.docs.find(d => d.no === p.devisNo)) { this.openDevis(p.devisNo); setTimeout(run, 40); }
    else this.flash('Lie d\u2019abord ce plan à un devis');
  }
  planVals() {
    const s = this.state, all = this.plans(), cur = this.curNo(), isElec = s.metier === 'elec';
    const P = st => st.plans ?? this.defaultPlans();
    const planList = all.map(p => ({ name: p.name, isUni: p.kind === 'unifilaire', isImport: p.kind !== 'unifilaire',
      meta: p.kind === 'unifilaire' ? `Unifilaire · ${p.circuits.length} circuits` : (String(p.mime).includes('pdf') ? 'PDF importé' : 'Image importée'),
      date: p.date, links: [p.devisNo, p.facNo].filter(Boolean).join(' · ') || 'Non lié', onOpen: () => this.openPlan(p.id) }));
    const mine = all.filter(p => p.devisNo === cur), uni = mine.find(p => p.kind === 'unifilaire');
    const planBtn = isElec
      ? (uni ? { title: 'Schéma unifilaire', sub: `${uni.circuits.length} circuits · ${uni.diffs.length} différentiel${uni.diffs.length > 1 ? 's' : ''}` + (this.cmpPlan(uni, s.lines).some(r => r.p !== r.d) ? ' · écart avec le devis' : ''), onTap: () => this.openPlan(uni.id) }
             : { title: 'Créer le schéma unifilaire', sub: 'Généré à partir des lignes du devis', onTap: () => this.newUni() })
      : { title: 'Plans du chantier', sub: mine.length ? `${mine.length} plan${mine.length > 1 ? 's' : ''} lié${mine.length > 1 ? 's' : ''}` : 'Importer un plan ou un croquis', onTap: () => { this.setState({ docTab: 'plans', docFilter: null }); this.go('docs'); } };
    const base = { planList, noPlans: !all.length, isPlansTab: s.docTab === 'plans', notPlansTab: s.docTab !== 'plans', isElec, planBtn,
      newUni: () => this.newUni(), onImport: e => this.importPlan(e), hasAnnex: mine.length > 0, annexTxt: mine.map(p => p.name).join(', ') };
    const idNote0 = p0 => 'Calibre des ID à justifier (règle de l\u2019amont ou de l\u2019aval) : ' + p0.diffs.map((d, i) => `ID${i + 1} ${d.cal} A pour ${p0.circuits.filter(c => c.diff === d.id).reduce((a, c) => a + c.cal, 0)} A en aval`).join(', ') + '.';
    const p = s.tab === 'plan' && all.find(x => x.id === s.planId);
    if (!p) return { ...base, isPlan: false, pl: { devisOpts: [], facOpts: [], checks: [], lines: [], rects: [], texts: [], hits: [], circs: [], cmp: [], legend: [], modes: [] } };
    const upd = fn => this.setState(st => ({ plans: P(st).map(x => x.id === p.id ? { ...x, ...fn(x) } : x) }));
    const isUni = p.kind === 'unifilaire', isPdf = !isUni && String(p.mime).includes('pdf');
    let extra = { checks: [], lines: [], rects: [], texts: [], hits: [], circs: [], cmp: [], legend: [], modes: [] };
    if (isUni) {
      const mode = s.planMode || 'full', issues = this.planIssues(p), checks = issues.map(i => i.t), errIds = {}; issues.forEach(i => { if (i.cid != null) errIds[i.cid] = 1; }); const D = planDiagram(p, s.planSel, mode, errIds);
      const focus = id => { this.setState({ planSel: id }); setTimeout(() => { const sc = this.scrollRef.current, el = sc && sc.querySelector('[data-circ="' + id + '"]'); if (el) sc.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' }); }, 60); };
      const applyFix = (i) => { upd(i.fix); this.flash(i.fixL.replace(/^\+ /, '') + ' : corrigé'); };
      const byC = {}; issues.forEach(i => { if (i.cid != null) (byC[i.cid] = byC[i.cid] || []).push(i); });
      const IW = i => ({ t: i.t, fixL: i.fixL, hasFix: !!i.fix, onFix: () => applyFix(i), onGo: () => i.cid != null && focus(i.cid), go: i.cid != null ? 'pointer' : 'default' });
      let qi = 0; const legend = [];
      p.diffs.forEach((d, r) => p.circuits.filter(c => c.diff === d.id).forEach(c => { qi++; legend.push({ q: 'Q' + qi, id: c.id, l: c.label || 'Circuit', prot: c.cal + ' A', sec: String(SECTION[c.cal]).replace('.', ',') + ' mm²', ddr: 'ID' + (r + 1) + ' ' + d.type, bg: c.id === s.planSel ? 'var(--color-accent-200)' : 'transparent', qc: byC[c.id] ? 'var(--color-accent-700)' : 'var(--color-accent-2-800)', warn: byC[c.id] ? ' !' : '',
        onPick: () => this.setState({ planSel: c.id }) }); }));
      const live = p.devisNo === cur, doc = s.docs.find(d => d.no === p.devisNo), lines = live ? s.lines : doc && doc.lines;
      const cmp = lines ? this.cmpPlan(p, lines) : [], nd = cmp.filter(r => r.p !== r.d).length;
      extra = {
        modules: this.planModules(p).txt, idNote: idNote0(p), openRules: () => this.setState({ rulesOpen: true }),
        legend, legendTitle: `Tableau de repérage · ${legend.length} départs`,
        modes: [['full', 'Noms sur le schéma'], ['rep', 'Repères + tableau']].map(([k, l]) => { const a = mode === k; return { l, bg: a ? 'var(--color-neutral-100)' : 'transparent', fg: a ? 'var(--color-neutral-900)' : 'var(--color-neutral-700)', onPick: () => this.setState({ planMode: k }) }; }),
        h: D.h, bands: D.B, paths: D.P, lines: D.L,
        symLegend: D.used.map(k => ({ k, l: ({ eclairage: 'Point lumineux', prises: 'Prise de courant 2P+T', cuisine: 'Prise plan de travail', plaque: 'Plaque de cuisson', lavelinge: 'Lave-linge / appareil', irve: 'Borne de recharge VE', special: 'Circuit spécialisé' })[k],
          d: ({ eclairage: 'M3 9a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M4.8 4.8L13.2 13.2M13.2 4.8L4.8 13.2', prises: 'M2 15A7 7 0 0 1 16 15M9 8L9 2M4 8L14 8', cuisine: 'M2 15A7 7 0 0 1 16 15M9 8L9 2M4 8L14 8', plaque: 'M2 2h14v14h-14zM5.5 7.5a1.8 1.8 0 1 0 .01 0M12.5 7.5a1.8 1.8 0 1 0 .01 0M5.5 12.5a1.8 1.8 0 1 0 .01 0M12.5 12.5a1.8 1.8 0 1 0 .01 0', lavelinge: 'M2 2h14v14h-14zM5 9a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', irve: 'M1 2h16v14h-16z', special: 'M2 2h14v14h-14zM2 16L16 2' })[k] })), rects: D.R, texts: D.T, hits: D.H.map(k => ({ ...k, onPick: () => this.setState({ planSel: s.planSel === k.id ? null : k.id }) })),
        checks: issues.length ? issues.map(IW) : [{ t: '2 ID 30 mA minimum, 8 circuits maximum par ID, type A pour plaque, lave-linge et recharge, sections et nombre de socles conformes.', hasFix: false, go: 'default', onGo: () => {} }],
        fixAll: () => { let n = 0, cur = p; for (let g = 0; g < 16; g++) { const is = this.planIssues(cur).filter(i => i.fix); if (!is.length) break; cur = { ...cur, ...is[0].fix(cur) }; n++; } const done = cur; upd(() => ({ circuits: done.circuits, diffs: done.diffs })); this.flash(n ? `${n} correction${n > 1 ? 's' : ''} appliquée${n > 1 ? 's' : ''}` : 'Rien à corriger'); },
        canFixAll: issues.filter(i => i.fix).length > 1,
        chkTitle: checks.length ? `${checks.length} point${checks.length > 1 ? 's' : ''} à vérifier` : 'Règles de base respectées',
        chkBg: checks.length ? 'var(--color-accent-200)' : 'var(--color-accent-2-200)', chkFg: checks.length ? 'var(--color-accent-900)' : 'var(--color-accent-2-900)',
        circCount: `${p.circuits.length} circuit${p.circuits.length > 1 ? 's' : ''} · ${p.diffs.length} ID`,
        circs: p.circuits.map((c, i) => { const on = c.id === s.planSel, ring = on ? '0 0 0 3px var(--color-accent)' : 'none', di = p.diffs.findIndex(d => d.id === c.diff);
          const setC = patch => upd(x => ({ circuits: x.circuits.map(k => k.id === c.id ? { ...k, ...patch } : k) }));
          const ce = byC[c.id] || [];
          return { id: c.id, errs: ce.map(IW), hasErr: ce.length > 0, ring: on ? ring : ce.length ? '0 0 0 2px var(--color-accent-500)' : 'none', n: 'Q' + (legend.findIndex(x => x.id === c.id) + 1), label: c.label, section: SECTION[c.cal] + ' mm²', bg: on ? 'var(--color-accent-200)' : 'var(--color-surface)',
            diffLabel: `ID${di + 1} · ${p.diffs[di] ? p.diffs[di].type : '?'}`,
            ptsOn: !!NAT_LABEL[circNature(c)], ptsLabel: NAT_LABEL[circNature(c)], pts: c.pts || 0,
            ptsMinus: () => setC({ pts: Math.max(0, (c.pts || 0) - 1) }), ptsPlus: () => setC({ pts: (c.pts || 0) + 1 }),
            onSel: () => this.setState({ planSel: c.id }), onLabel: e => setC({ label: e.target.value }),
            onDel: () => upd(x => ({ circuits: x.circuits.filter(k => k.id !== c.id) })),
            onDiff: () => upd(x => ({ circuits: x.circuits.map(k => k.id === c.id ? { ...k, diff: x.diffs[(di + 1) % x.diffs.length].id } : k) })),
            cals: [10, 16, 20, 32].map(v => ({ l: v + ' A', bg: c.cal === v ? 'var(--color-neutral-900)' : 'var(--color-neutral-100)', fg: c.cal === v ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => setC({ cal: v }) })) }; }),
        addCirc: () => { const id = UID++; upd(x => { const dl = x.diffs.map(d => x.circuits.filter(c => c.diff === d.id).length), di = dl.indexOf(Math.min(...dl)); return { circuits: [...x.circuits, { id, label: 'Nouveau circuit', cal: 16, diff: x.diffs[di].id }] }; }); this.setState({ planSel: id }); },
        diffs: p.diffs.map((d, i) => { const n = p.circuits.filter(c => c.diff === d.id).length; return { l: `ID${i + 1}`, type: 'Type ' + d.type, n: `${n} circuit${n > 1 ? 's' : ''}`, nc: n > 8 ? 'var(--color-accent-800)' : 'var(--color-neutral-700)', canDel: p.diffs.length > 1,
          onType: () => upd(x => ({ diffs: x.diffs.map(k => k.id === d.id ? { ...k, type: ({ AC: 'A', A: 'F', F: 'AC' })[k.type] || 'A' } : k) })),
          onDel: () => upd(x => { const rest = x.diffs.filter(k => k.id !== d.id); return { diffs: rest, circuits: x.circuits.map(c => c.diff === d.id ? { ...c, diff: rest[0].id } : c) }; }) }; }),
        addDiff: () => upd(x => ({ diffs: [...x.diffs, { id: 'd' + Date.now(), cal: 40, type: x.diffs.some(d => d.type === 'A') ? 'AC' : 'A' }] })),
        cmp: cmp.map(r => ({ ...r, c: r.p === r.d ? 'var(--color-accent-2-800)' : 'var(--color-accent-800)' })),
        cmpUnknown: !lines, inSync: !!lines && nd === 0,
        syncLabel: lines ? (nd ? `Mettre à jour le devis (${nd} écart${nd > 1 ? 's' : ''})` : 'Devis à jour') : 'Ouvrir le devis et synchroniser',
        sync: () => this.syncPlan(p.id),
        regen: () => { const g = planFromLines(lines || s.lines); upd(() => g); this.setState({ planSel: null }); this.flash('Schéma régénéré depuis le devis'); },
      };
    }
    if (isUni) {
      const cs = extra.circs, i = cs.findIndex(c => c.id === s.planSel), c = cs[i], lg = c && extra.legend.find(g => g.id === c.id);
      const pick = j => { const n = cs[(j + cs.length) % cs.length]; if (n) this.setState({ planSel: n.id }); };
      extra.hasSel = !!c; extra.noSel = !c;
      extra.sel = c ? { ...c, title: `${c.n} · ${c.label || 'Circuit'}`, meta: `${lg ? lg.prot : ''} · ${lg ? lg.sec : ''} · ${lg ? lg.ddr : ''}${c.ptsOn ? ' · ' + c.pts + ' ' + c.ptsLabel : ''}`, pos: `${i + 1} / ${cs.length}`,
        prev: () => pick(i - 1), next: () => pick(i + 1), close: () => this.setState({ planSel: null }),
        edit: () => { const sc = this.scrollRef.current, el = sc && sc.querySelector('[data-circ="' + c.id + '"]'); if (el) sc.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' }); } } : { cals: [], errs: [] };
    }
    return { ...base, isPlan: true, pl: { ...extra, name: p.name, isUni, isImg: !isUni && !isPdf, isPdf, src: safePlanSrc(p.src), fileName: p.fileName || '',
      kindLabel: isUni ? 'Schéma unifilaire' : 'Plan importé', onName: e => { const v = e.target.value; upd(() => ({ name: v })); },
      facNo: p.facNo || '', openFac: () => { if (p.facNo) this.openFac(p.facNo); },
      openDevis: () => { if (s.docs.find(d => d.no === p.devisNo)) this.openDevis(p.devisNo); else this.flash('Choisis d\u2019abord un devis'); },
      devisOpts: s.docs.filter(d => d.type === 'devis').map(d => { const a = d.no === p.devisNo; return { no: d.no, bg: a ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => upd(() => ({ devisNo: d.no })) }; }),
      facOpts: [{ no: 'Aucune', v: null }, ...s.docs.filter(d => d.type === 'fac').map(d => ({ no: d.no, v: d.no }))].map(o => { const a = (p.facNo || null) === o.v; return { no: o.no, bg: a ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => upd(() => ({ facNo: o.v })) }; }),
      exportSvg: () => { const el = this.scrollRef.current && this.scrollRef.current.querySelector('[data-plan-svg]'); if (!el) return this.flash('Schéma introuvable');
        const cs = getComputedStyle(el); let src = el.outerHTML.replace(/var\((--[a-z0-9-]+)\)/gi, (m, v) => cs.getPropertyValue(v).trim() || m);
        const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' })), a = document.createElement('a'); a.href = url; a.download = (p.name || 'plan').replace(/[^\w\u00C0-\u017F -]+/g, '') + '.svg'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); this.flash('Schéma téléchargé'); },
      share: async () => { const txt = `${p.name} — ${p.circuits ? p.circuits.length + ' circuits' : ''} · lié à ${p.devisNo || 'aucun devis'}`;
        try { if (navigator.share) { await navigator.share({ title: p.name, text: txt }); } else { await navigator.clipboard.writeText(txt); this.flash('Résumé copié'); } } catch (e) {} },
      delLabel: s.planDelAsk === p.id ? 'Confirmer la suppression' : 'Supprimer ce plan', delFg: s.planDelAsk === p.id ? 'var(--color-neutral-100)' : 'var(--color-accent-700)', delBg: s.planDelAsk === p.id ? 'var(--color-accent-700)' : 'transparent',
      del: () => { if (s.planDelAsk !== p.id) { this.setState({ planDelAsk: p.id }); clearTimeout(this._delT); this._delT = setTimeout(() => this.setState({ planDelAsk: null }), 3000); return; }
        this.setState(st => ({ planDelAsk: null, plans: P(st).filter(x => x.id !== p.id), docTab: 'plans' })); this.go('docs'); this.flash('Plan supprimé'); },
    } };
  }

  coData() {
    const d = { name: 'Julien Hoarau Électricité', forme: 'EI', siret: '812 345 678 00021', rm: 'RM 974 812 345 678', tva: 'FR 12 812345678', addr: '4 rue des Flamboyants, 97460 Saint-Paul', tel: '0692 12 34 56', email: 'contact@jh-elec.re',
      assureur: '', police: '', decValid: '', rcAssureur: '', rcPolice: '', mediateur: '', qualif: 'Qualifelec', iban: '' };
    const c = { ...d, ...(this.state.co || {}) };
    c.formeLabel = FORMES[FORME_OF(c.forme)].l;
    ['assureur', 'police', 'mediateur'].forEach(k => { if (c[k] === 'À renseigner') c[k] = ''; });
    return c;
  }

  helpVals() {
    const hp = this.state.help;
    if (!hp) return { help: { open: false, items: [], close: () => {} } };
    const items = (hp.keys || []).map(k => { const x = FIELD_HELP[k]; return x ? { head: x[0], where: x[1].map((t, i) => ({ n: i + 1, t })), fmt: x[2] } : null; }).filter(Boolean);
    return { help: { open: true, title: hp.title, items: items.length === 1 ? [{ ...items[0], head: '' }] : items, close: () => this.setState({ help: null }) } };
  }

  formeVals() {
    const s = this.state, c = this.coData(), k = FORME_OF(c.forme), f = FORMES[k], open = !!s.formeOpen, info = s.formeInfo ?? true;
    const set = patch => this.setState(st => ({ co: { ...this.coData(), ...patch } }));
    const regMatch = f.micro ? s.regime === 'micro' : s.regime !== 'micro';
    return { fm: {
      open, rot: open ? 'rotate(180deg)' : 'none', label: f.l, full: f.full, border: open ? 'var(--color-accent)' : 'transparent',
      toggle: () => this.setState({ formeOpen: !open }),
      opts: Object.entries(FORMES).map(([id, x]) => { const a = id === k; return { l: x.l, full: x.full, who: x.who, bg: a ? 'var(--color-accent-2-200)' : 'transparent', mark: a ? '✓' : '', onPick: () => { set({ forme: id }); this.setState({ formeOpen: false, formeInfo: true }); } }; }),
      info, toggleInfo: () => this.setState({ formeInfo: !info }), infoLabel: info ? 'Masquer les particularités' : 'Voir les particularités',
      rows: [['Associés', f.who], ['Responsabilité', f.resp], ['Imposition', f.imp], ['Statut du dirigeant', f.soc], ['Capital', f.cap], ['TVA à La Réunion', f.tva], ['Sur tes devis et factures', f.ment], ['Pour un artisan du BTP', f.btp]].map(([t, d]) => ({ t, d })),
      isSoc: f.soc_, capital: c.capital || '', onCapital: e => set({ capital: e.target.value }),
      regWarn: !regMatch, regTxt: f.micro ? 'Ton régime de TVA est « Assujetti » alors que la micro-entreprise est en franchise par défaut.' : 'Ton régime de TVA est « Franchise micro » alors que cette forme facture normalement la TVA.',
      regBtn: f.micro ? 'Passer en franchise (293 B)' : 'Passer en assujetti TVA DOM', fixReg: () => this.setState({ regime: f.micro ? 'micro' : 'assujetti' }),
    } };
  }

  coInfoVals() {
    const c = this.coData(), set = k => e => this.setState(st => ({ co: { ...this.coData(), [k]: e.target.value } }));
    const REQ = ['name', 'siret', 'rm', 'addr', 'tel', 'assureur', 'police', 'decValid', 'mediateur'];
    const G = [
      ['Identité', [['name', 'Nom commercial', 'Ex. Hoarau Électricité'], ['siret', 'SIRET', '14 chiffres', 'numeric'], ['rm', 'N° Répertoire des Métiers', 'RM 974 …'], ['tva', 'N° TVA intracommunautaire', 'FR …']]],
      ['Coordonnées', [['addr', 'Adresse du siège', 'Rue, code postal, commune'], ['tel', 'Téléphone', '0692 …', 'tel'], ['email', 'E-mail', 'contact@…', 'email']]],
      ['Assurance décennale', [['assureur', 'Assureur', 'Nom de la compagnie'], ['police', 'N° de contrat', 'Numéro de police'], ['decValid', 'Valable jusqu\u2019au', 'JJ/MM/AAAA', 'numeric']]],
      ['Responsabilité civile pro', [['rcAssureur', 'Assureur RC Pro', 'Nom de la compagnie'], ['rcPolice', 'N° de contrat RC Pro', 'Numéro de police']]],
      ['Autres informations', [['mediateur', 'Médiateur de la consommation', 'Nom et site web'], ['qualif', 'Qualifications / labels', 'RGE, Qualifelec, QualiPV…'], ['iban', 'IBAN pour les virements', 'FR76 …']]],
    ];
    const missing = REQ.filter(k => !String(c[k] || '').trim());
    const digits = v => String(v || '').replace(/\D/g, '');
    const parseD = v => { const m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
    const V = {
      siret: v => digits(v).length === 14 ? '' : 'Le SIRET compte 14 chiffres (' + digits(v).length + ' saisis).',
      tel: v => digits(v).length === 10 ? '' : 'Numéro à 10 chiffres attendu.',
      email: v => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) ? '' : 'Adresse e-mail invalide.',
      decValid: v => parseD(v) ? '' : 'Format attendu : JJ/MM/AAAA.',
      tva: v => /^FR\s?[0-9A-Z]{2}\s?\d{9}$/i.test(String(v).replace(/\s/g, ' ').replace(/ /g, '')) || /^FR/i.test(v) && digits(v).length === 11 ? '' : 'Format : FR + 2 caractères + SIREN (9 chiffres).',
      iban: v => /^FR\d{2}/i.test(String(v).replace(/\s/g, '')) && String(v).replace(/\s/g, '').length === 27 ? '' : 'Un IBAN français compte 27 caractères.',
    };
    const errOf = k => { const v = String(c[k] || '').trim(); return v && V[k] ? V[k](v) : ''; };
    const dv = parseD(c.decValid), days = dv ? Math.ceil((dv - new Date()) / 86400000) : null;
    const expiry = !c.decValid ? '' : !dv ? '' : days < 0 ? `Assurance décennale expirée depuis ${-days} j. Tes devis ne peuvent pas mentionner une assurance valide.` : days <= 60 ? `Assurance décennale : expire dans ${days} j (${c.decValid}). Pense à demander ta nouvelle attestation.` : '';
    const pct = Math.round((REQ.length - missing.length) / REQ.length * 100);
    const labelOf = k => G.flatMap(g => g[1]).find(f => f[0] === k)[1].toLowerCase();
    return { coInfo: {
      progress: `${REQ.length - missing.length} / ${REQ.length} obligatoires`, w: pct + '%',
      fill: missing.length ? 'var(--color-accent-600)' : 'var(--color-accent-2-700)', ink: missing.length ? 'var(--color-accent-800)' : 'var(--color-accent-2-800)',
      hasMissing: missing.length > 0,
      missingTxt: missing.length ? `À compléter pour des devis conformes : ${missing.map(labelOf).join(', ')}.` : '',
      groups: G.map(([title, fs]) => ({ title, onHelp: () => this.setState({ help: { title, keys: fs.map(f => f[0]) } }), fields: fs.map(([k, label, ph, mode]) => { const miss = REQ.includes(k) && !String(c[k] || '').trim();
        const err = errOf(k);
        return { label, lid: 'lbl-' + k, onHelp: () => this.setState({ help: { title: label, keys: [k] } }), ph, mode: mode || 'text', value: c[k] || '', onInput: set(k), flag: miss ? 'obligatoire' : '', err, invalid: !!err, border: err ? 'var(--color-accent-700)' : miss ? 'var(--color-accent-400)' : 'transparent' }; }) })),
      expiry, expBg: days !== null && days < 0 ? 'var(--color-accent-700)' : 'var(--color-accent-200)', expFg: days !== null && days < 0 ? 'var(--color-neutral-100)' : 'var(--color-accent-900)',
      nMissing: missing.length + (expiry && days < 0 ? 1 : 0),
    } };
  }

  cgvVals() {
    const s = this.state, c0 = this.coData(), c = { ...c0, assureur: c0.assureur || 'à renseigner', police: c0.police || 'à renseigner', mediateur: c0.mediateur || 'à renseigner', rm: c0.rm || 'à renseigner' };
    const term = s.payTerm || '30', pro = (s.clientType || 'part') === 'pro', ret = !!s.retenue, res = s.reserve !== false;
    const TERMS = { rec: 'À réception', '30': '30 jours', '45fm': '45 jours fin de mois', '60': '60 jours' };
    const due = (from) => { const d = new Date(from); if (term === 'rec') return d; if (term === '45fm') { d.setDate(d.getDate() + 45); return new Date(d.getFullYear(), d.getMonth() + 1, 0); } d.setDate(d.getDate() + Number(term)); return d; };
    const f = d => d.toLocaleDateString('fr-FR');
    const late = pro ? 'En cas de retard : pénalités au taux de 3 fois le taux d\u2019intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce).'
      : 'En cas de retard : intérêts au taux légal (art. 1231-6 du Code civil).';
    const pay = [`Paiement : ${TERMS[term].toLowerCase()} à compter de la date de facture, soit le ${f(due(new Date()))} pour une facture émise aujourd\u2019hui.`, 'Règlement par virement ou chèque. Pas d\u2019escompte pour paiement anticipé.', late];
    const legal = [
      `Entreprise immatriculée au Répertoire des Métiers : ${c.rm}.`,
      `Assurance décennale : ${c.assureur}, contrat n° ${c.police}${c0.decValid ? ', valable jusqu\u2019au ' + c0.decValid : ''}. Couverture géographique : France métropolitaine et DOM (art. L243-2 du Code des assurances).`,
      s.metier === 'multi' ? 'Travaux réalisés selon les règles de l\u2019art et les DTU de chaque corps d\u2019état.' : `Travaux réalisés selon les règles de l\u2019art : ${(DTU[s.metier] || []).map(d => d[0]).join(', ')}.`,
      'Garanties : parfait achèvement 1 an, bon fonctionnement 2 ans, décennale 10 ans (art. 1792 et suivants du Code civil).',
      ...(c0.rcAssureur ? [`Responsabilité civile professionnelle : ${c0.rcAssureur}${c0.rcPolice ? ', contrat n° ' + c0.rcPolice : ''}.`] : []),
      ...(c0.qualif ? [`Qualifications : ${c0.qualif}.`] : []),
      ...(ret ? ['Retenue de garantie de 5 % du montant TTC, libérée un an après la réception des travaux (loi n° 71-584 du 16 juillet 1971).'] : []),
      ...(res ? ['Le matériel fourni reste la propriété de l\u2019entreprise jusqu\u2019au paiement intégral du prix.'] : []),
      ...(pro ? [] : ['Contrat conclu hors établissement : droit de rétractation de 14 jours (art. L221-18 du Code de la consommation). Aucun paiement ne peut être exigé avant 7 jours.',
        `Médiateur de la consommation : ${c.mediateur} (art. L612-1 du Code de la consommation).`]),
    ];
    const swS = on => on ? { justify: 'flex-end', bg: 'var(--color-accent-2-700)' } : { justify: 'flex-start', bg: 'var(--color-neutral-400)' };
    const fe = s.facEdit && s.docs.find(x => x.no === s.facEdit.no);
    let feDate = new Date(); if (fe && fe.date) { const [dd, mm] = fe.date.split('/').map(Number); feDate = new Date(2026, mm - 1, dd); }
    return { cgv: {
      terms: ['rec', '30', '45fm', '60'].map(k => [k, TERMS[k]]).map(([k, label]) => ({ label, bg: term === k ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: term === k ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => this.setState({ payTerm: k }) })),
      types: [['part', 'Particulier'], ['pro', 'Professionnel']].map(([k, label]) => { const a = (s.clientType || 'part') === k; return { label, bg: a ? 'var(--color-neutral-100)' : 'transparent', bgAlt: a ? 'var(--color-neutral-900)' : 'transparent', fg: a ? 'var(--color-neutral-900)' : 'var(--color-neutral-700)', fgAlt: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-800)', onPick: () => this.setState({ clientType: k }) }; }),
      termLabel: TERMS[term].toLowerCase(), pay, legal,
      ret, res, retSw: swS(ret), resSw: swS(res), toggleRet: () => this.setState({ retenue: !ret }), toggleRes: () => this.setState({ reserve: !res }),
      dueFac: f(due(feDate)), lateTxt: late,
    } };
  }

  relVals(docs) {
    const s = this.state, done = s.relances || {}, now = new Date();
    const items = docs.filter(d => d.type === 'devis' && d.st === 1).map(d => {
      const [dd, mm] = d.date.split('/').map(Number), days = Math.max(0, Math.round((now - new Date(2026, mm - 1, dd)) / 86400000)), ok = !!done[d.no];
      return { client: d.client.split(' — ')[0], amount: d.amount, since: ok ? 'relancé aujourd\u2019hui' : `envoyé il y a ${days} j`, done: ok,
        label: ok ? 'Relancé' : 'Relancer', bg: ok ? 'var(--color-accent-2-300)' : 'var(--color-accent-700)', fg: ok ? 'var(--color-accent-2-900)' : 'var(--color-neutral-100)',
        onOpen: () => this.openDevis(d.no),
        onRelance: () => { this.setState(st => ({ relances: { ...(st.relances || {}), [d.no]: true } })); this.flash(`Relance envoyée à ${d.client.split(' — ')[0]}`); } };
    });
    return { rel: { show: items.length > 0, items, count: items.length + ' en attente de réponse' } };
  }

  openProjet(id) { this.setState({ projId: id }); this.go('projet'); }

  projVals(docs) {
    const s = this.state;
    if (s.tab !== 'projet' || !PROJETS[s.projId]) return { isProj: false, pj: { etapes: [], docs: [], evs: [] } };
    const p = PROJETS[s.projId], done = (s.projSteps || {})[s.projId];
    const etapes = p.etapes.map((e, i) => ({ l: e[0], ok: done ? !!done[i] : e[1] }));
    const nOk = etapes.filter(e => e.ok).length, pct = Math.round(nOk / etapes.length * 100);
    const linked = docs.filter(d => p.devis.includes(d.no) || p.facs.includes(d.no) || (d.versionOf && p.devis.includes(d.versionOf)));
    const t = this.iso(new Date());
    const evs = this.events().filter(e => e.title.includes(p.key) && e.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
      .map(e => ({ when: new Date(e.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + e.time.replace(':', ' h '), title: e.title }));
    return { isProj: true, pj: { ...p, pct: pct + ' %', w: pct + '%',
      etapes: etapes.map((e, i) => ({ ...e, boxBg: e.ok ? 'var(--color-accent-2-700)' : 'transparent', op: e.ok ? 0.6 : 1,
        onTap: () => this.setState(st => { const cur = (st.projSteps || {})[st.projId] || etapes.map(x => x.ok); const nx = cur.slice(); nx[i] = !nx[i]; return { projSteps: { ...(st.projSteps || {}), [st.projId]: nx } }; }) })),
      docs: linked.map(d => ({ no: d.no, kind: d.type === 'fac' ? 'Facture' : 'Devis', amount: d.amount, status: d.status, bg: d.bg, fg: d.fg, onOpen: d.onOpen })),
      plans: this.plans().filter(x => p.devis.includes(x.devisNo) || linked.some(d => d.no === x.devisNo)).map(x => ({ name: x.name, meta: x.kind === 'unifilaire' ? `Schéma unifilaire · ${x.circuits.length} circuits` : 'Plan importé', onOpen: () => this.openPlan(x.id) })),
      noDocs: !linked.length && !this.plans().some(x => p.devis.includes(x.devisNo)), evs, noEvs: !evs.length,
      telHref: 'tel:' + p.tel.replace(/\s/g, ''), mapHref: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.addr),
      addEvent: () => { this.setState({ toolOpen: 'planning', newTitle: p.client + ' — ', calDay: this.iso(new Date()) }); this.go('outil'); },
    } };
  }

  toolVals(docs, T) {
    const s = this.state, done = s.ordered || {};
    const chip = (bg, fg) => ({ cBg: bg, cFg: fg });
    const neutral = chip('var(--color-surface)', 'var(--color-neutral-900)');
    const projets = [
      { a: 'SCI Les Filaos', b: 'Mise aux normes · Saint-Pierre', c: '60 %', ...chip('var(--color-accent-2-300)', 'var(--color-accent-2-900)'), onTap: () => this.openProjet('filaos') },
      { a: 'Mme Hoarau', b: 'Cuisine · Le Tampon', c: 'démarre 28/09', ...neutral, onTap: () => this.openProjet('hoarau') },
      { a: 'M. Grondin', b: 'Tableau · Sainte-Marie', c: 'à clôturer', ...chip('var(--color-accent-200)', 'var(--color-accent-900)'), onTap: () => this.openProjet('grondin') },
    ];
    const devis = docs.filter(d => d.type === 'devis' && d.st < 2).map(d => ({ a: d.client, b: `${d.no} · ${d.amount}`, c: d.status, cBg: d.bg, cFg: d.fg, onTap: () => this.openDevis(d.no) }));
    const planning = [];
    const mats = s.lines.filter(l => l.kind === 'mat').sort((x, y) => x.fourn.localeCompare(y.fourn));
    const matRows = mats.map(l => {
      const ok = !!done[l.id];
      return { isCheck: true, a: `${l.qty}${U(l.unit)} × ${l.name}`, b: `${l.fourn} · ${l.ref}`, c: fmt(l.achat * l.qty), ...neutral,
        boxBg: ok ? 'var(--color-accent-2-700)' : 'transparent', op: ok ? 0.55 : 1,
        onTap: () => this.setState(st => ({ ordered: { ...(st.ordered || {}), [l.id]: !ok } })) };
    });
    const left = mats.filter(l => !done[l.id]).length;
    const achat = mats.reduce((a, l) => a + l.achat * l.qty, 0);
    const P = {
      projets: ['M3 20h18', 'M5 20V9l7-5 7 5v11', 'M10 20v-6h4v6'],
      devis: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M9 13h6M9 17h4'],
      planning: ['M8 2v4M16 2v4', 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M3 10h18'],
      mat: ['M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6', ''],
    };
    const defs = {
      projets: { label: 'Projets en cours', title: 'Projets en cours', sub: `${projets.length} chantiers ouverts`, rows: projets },
      devis: { label: 'Devis en cours', title: 'Devis en cours', sub: 'En attente de signature', rows: devis, isDevis: true, cta: 'Voir tous les devis', onCta: () => this.setState({ docTab: 'devis' }, () => this.go('docs')) },
      planning: { label: 'Planning', title: 'Planning', sub: `${this.upcoming()} interventions à venir`, rows: planning },
      mat: { label: 'Matériel à commander', title: 'Matériel à commander', sub: `Devis en cours · ${left} article${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''} · achat ${fmt(achat)} HT`, rows: matRows, cta: left ? 'Marquer tout commandé' : '', onCta: () => this.setState({ ordered: Object.fromEntries(mats.map(l => [l.id, true])) }) },
    };
    const counts = { projets: projets.length, devis: devis.length, planning: this.upcoming(), mat: left };
    const cur = s.toolOpen ? defs[s.toolOpen] : null;
    return {
      tools: Object.keys(defs).map(k => ({ label: defs[k].label, short: { projets: 'Projets', devis: 'Devis', planning: 'Planning', mat: 'Matériel' }[k], count: counts[k], p1: P[k][0], p2: P[k][1], p3: P[k][2], bg: s.toolOpen === k ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: s.toolOpen === k ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)',
        onOpen: () => { this.setState({ toolOpen: k }); this.go('outil'); } })),
      toolOpen: s.tab === 'outil' && !!cur, closeTool: () => this.go('home'),
      tool: cur ? { ...cur, rows: cur.rows.map(r => ({ isCheck: false, op: 1, onTap: () => {}, ...r })), cta: cur.cta || '' } : { rows: [] },
    };
  }

  renderVals() {
    COEF = this.state.targetM == null ? 1.35 : r2(1 / (1 - this.state.targetM / 100));
    const s = this.state, m = this.metierObj(), T = this.totals(), cat = catOf(s.metier);
    const on = (a) => a ? ['var(--color-neutral-900)', 'var(--color-neutral-100)'] : ['transparent', 'var(--color-neutral-800)'];
    const tabOn = k => s.tab === k ? { bg: 'var(--color-accent-200)', fg: 'var(--color-accent-800)' } : { bg: 'transparent', fg: 'var(--color-neutral-700)' };

    const docs = s.docs.map(d => {
      const ttc = d.live ? T.ttc : d.ttc, list = d.type === 'devis' ? DEVIS_ST : FAC_ST, status = list[d.st];
      return { ...d, status, amount: fmt(ttc), ttc, bg: TONE[status][0], fg: TONE[status][1],
        hint: d.type === 'fac' ? 'Ouvrir la facture' : d.live ? 'En cours d\u2019édition' : d.st < 2 ? 'Modifier le devis' : 'Validé · modifier crée une nouvelle version',
        onOpen: () => d.type === 'fac' ? this.openFac(d.no) : this.openDevis(d.no),
        onCycle: e => { e && e.stopPropagation && e.stopPropagation(); this.setState(st => ({ docs: st.docs.map(x => x.no === d.no ? { ...x, st: (x.st + 1) % list.length } : x) })); } };
    });
    const devisDocs = docs.filter(d => d.type === 'devis'), facs = docs.filter(d => d.type === 'fac');
    const transformed = devisDocs.filter(d => d.st === 3).length;
    const ca = facs.reduce((a, d) => a + d.ttc, 0);
    const marges = s.docs.filter(d => d.type === 'devis').map(d => d.live ? T.pct : d.marge);
    const kpis = [
      { label: 'Devis ce mois', value: String(devisDocs.length), sub: 'septembre 2026' },
      { label: 'Transformés en facture', value: Math.round(transformed / devisDocs.length * 100) + ' %', sub: `${transformed} sur ${devisDocs.length}` },
      { label: 'CA facturé TTC', value: fmt0(ca), sub: `${facs.length} factures` },
      { label: 'Marge brute moy.', value: Math.round(marges.reduce((a, b) => a + b, 0) / marges.length) + ' %', sub: 'matériel, hors MO' },
    ];
    const toDocs = k => () => this.setState({ docTab: k }, () => this.go('docs'));
    const KT = [['var(--color-accent-2-200)', 'var(--color-accent-2-900)'], ['var(--color-accent-200)', 'var(--color-accent-900)'], ['var(--color-accent-2-700)', 'var(--color-neutral-100)'], ['var(--color-surface)', 'var(--color-text)']];
    kpis.forEach((k, i) => { k.bg = KT[i][0]; k.ink = KT[i][1]; });
    kpis.forEach((k, i) => { k.onTap = i === 2 ? () => this.go('stats') : i === 3 ? () => this.go('marge') : toDocs('devis'); });
    const CA = [['Avr', 8200], ['Mai', 11400], ['Juin', 9600], ['Juil', 13800], ['Août', 12100], ['Sep', Math.round(ca + 9000)]];
    const max = Math.max(...CA.map(c => c[1]));
    const bars = CA.map((c, i) => ({ m: c[0], k: (c[1] / 1000).toFixed(1).replace('.', ','), h: Math.round(c[1] / max * 88) + '%', bg: i === CA.length - 1 ? 'var(--color-accent)' : 'var(--color-accent-2-400)' }));
    const jEmit = Math.max(0, Math.ceil((new Date(2027, 8, 1) - new Date()) / 86400000));

    const lines = s.lines.map(l => {
      const t85 = l.tva === 8.5;
      const mg = l.kind === 'mat' && l.pu > 0 ? Math.round((l.pu - l.achat) / l.pu * 100) : null;
      const isV = !!s.baseCount, mark = !isV ? '' : !l.orig ? 'Ajouté' : (l.qty !== l.orig.qty || l.pu !== l.orig.pu) ? 'Modifié' : '';
      return { ...l, mark, markBorder: mark ? 'var(--color-accent-700)' : 'transparent',
        meta: l.kind === 'mat' ? `${l.ref} · ${l.fourn}` : l.kind === 'mo' ? `Taux ${fmt(l.pu)} / h` : 'Forfait',
        montant: fmt(l.pu * l.qty), puTxt: l.puTxt ?? String(l.pu).replace('.', ','),
        showTva: s.regime !== 'micro', margeTxt: mg === null ? '' : `marge ${mg} %`,
        b85: on(t85)[0], f85: on(t85)[1], b21: on(!t85)[0], f21: on(!t85)[1],
        onTva85: () => this.upd(l.id, { tva: 8.5 }), onTva21: () => this.upd(l.id, { tva: 2.1 }),
        onMinus: () => this.upd(l.id, { qty: Math.max(1, l.qty - 1) }), onPlus: () => this.upd(l.id, { qty: l.qty + 1 }),
        onPu: e => { const v = e.target.value; this.upd(l.id, { puTxt: v, pu: r2(parseFloat(v.replace(',', '.')) || 0) }); },
        onDel: () => this.setState(st => ({ lines: st.lines.filter(x => x.id !== l.id) })),
      };
    });

    const SEUIL = s.seuil ?? 15, low = T.pct < SEUIL;
    const gauge = {
      pctTxt: Math.round(T.pct) + ' %', eur: fmt(T.marge), val: Math.round(Math.min(Math.max(T.pct, 0), 50)),
      onDrag: e => { const m = Math.min(Number(e.target.value), 49), rr = Math.min(Math.max(parseFloat(String(s.remiseTxt).replace(',', '.')) || 0, 0), 90) / 100, k = 1 / ((1 - m / 100) * (1 - rr));
        this.setState(st => ({ targetM: m, lines: st.lines.map(l => l.kind === 'mat' ? { ...l, pu: r2(l.achat * k), puTxt: undefined } : l) })); },
      w: Math.min(Math.max(T.pct, 0), 50) / 50 * 100 + '%',
      fill: low ? 'var(--color-accent-700)' : 'var(--color-accent-2-700)',
      boxBg: low ? 'var(--color-accent-200)' : 'var(--color-accent-2-200)',
      ink: low ? 'var(--color-accent-900)' : 'var(--color-accent-2-900)',
      chipBg: low ? 'var(--color-accent-300)' : 'var(--color-accent-2-300)',
      chipFg: low ? 'var(--color-accent-900)' : 'var(--color-accent-2-900)',
      msg: T.mat === 0 ? 'Ajoute du matériel pour voir ta marge.' : low ? `Marge sous ${SEUIL} % : ce chantier te coûte plus qu\u2019il ne rapporte. Revois tes prix ou la remise.` : 'Marge saine. Tu couvres ton matériel avec de la réserve.',
    };
    const recapRows = [
      ['Matériel HT', fmt(T.mat)], ["Main d'œuvre HT", fmt(T.mo)], ['Déplacement', fmt(T.dep)],
      ...(T.remise ? [['Remise', '− ' + fmt(T.remise)]] : []), ['Total HT', fmt(T.ht)],
      ...(T.micro ? [['TVA', 'non applicable (293 B)']] : [['TVA 8,5 %', fmt(T.t85)], ...(T.t21 ? [['TVA 2,1 %', fmt(T.t21)]] : [])]),
    ].map(([k, v]) => ({ k, v }));

    const fams = ['Tout', ...new Set(cat.map(c => c.fam))];
    const qn = norm(s.q.trim());
    const catItems = cat.filter(c => (s.fam === 'Tout' || c.fam === s.fam) && (!qn || norm(c.name + ' ' + c.ref + ' ' + c.fourn).includes(qn)))
      .map(c => ({ ...c, unitTxt: c.unit === 'u' ? '' : ' / ' + c.unit, vente: fmt(c.achat * COEF), achatTxt: fmt(c.achat),
        onAdd: () => { this.setState(st => ({ lines: [...st.lines.filter(x => x.kind !== 'dep'), matLine(c, 1), ...st.lines.filter(x => x.kind === 'dep')] })); this.flash(`${c.name} ajouté au devis`); } }));

    return {
      scrollRef: this.scrollRef,
      isHome: s.tab === 'home', isDevis: s.tab === 'devis', isDocs: s.tab === 'docs', isCat: s.tab === 'cat',
      tabs: { home: tabOn('home'), devis: tabOn('devis'), docs: tabOn('docs'), cat: tabOn('cat'), set: tabOn('set') },
      isSet: s.tab === 'set', goSet: () => this.go('set'), goMarge: () => this.go('marge'),
      sw: s.puHidden ? { justify: 'flex-end', bg: 'var(--color-accent-2-700)' } : { justify: 'flex-start', bg: 'var(--color-neutral-400)' },
      co: (() => { const c = this.coData(); c.capTxt = FORMES[FORME_OF(c.forme)].soc_ && c.capital ? ' au capital de ' + c.capital + ' €' : ''; const set = k => e => this.setState({ co: { ...c, [k]: e.target.value } }); return { ...c, onName: set('name'), onSiret: set('siret'), onAddr: set('addr'), onTel: set('tel'), onRm: set('rm'), onAssureur: set('assureur'), onPolice: set('police'), onMediateur: set('mediateur') }; })(),
      goHome: () => this.go('home'), goDevis: () => this.go('devis'), goDocs: () => { this.setState({ docFilter: null }); this.go('docs'); }, goCat: () => this.go('cat'),
      metierLabel: m.label, metierShort: m.short, kpis, bars, jEmit,
      recentDocs: docs.slice(0, 3),
      devisNo: s.editNo || 'DEV-2026-041',
      versionNote: s.baseCount ? (() => { const withO = s.lines.filter(l => l.orig), mod = withO.filter(l => l.qty !== l.orig.qty || l.pu !== l.orig.pu).length, add = s.lines.length - withO.length, rem = s.baseCount - withO.length; return `Nouvelle version de ${s.versionOf}. Modifications marquées : ${mod} modifiée${mod > 1 ? 's' : ''}, ${add} ajoutée${add > 1 ? 's' : ''}, ${rem} supprimée${rem > 1 ? 's' : ''}.`; })() : '',
      aiInput: s.aiInput, onAiInput: e => this.setState({ aiInput: e.target.value }),
      aiExamples: m.ex.map(t => ({ text: t, onPick: () => this.setState({ aiInput: t, aiMsg: '' }) })),
      runAI: () => this.runAI(), aiBusy: s.aiState === 'busy', aiThinking: s.aiState === 'busy',
      aiBtn: s.aiState === 'busy' ? 'Chiffrage en cours…' : 'Générer avec l\u2019IA',
      dots: React.createElement('span', { style: { display: 'inline-flex', gap: 4 } }, [0, 1, 2].map(i => React.createElement('span', { key: i, style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', animation: `btpDot 1s ${i * 0.15}s infinite ease-in-out` } }))),
      aiMsg: s.aiMsg, aiMsgBg: s.aiOk ? 'var(--color-accent-2-200)' : 'var(--color-accent-200)', aiMsgFg: s.aiOk ? 'var(--color-accent-2-900)' : 'var(--color-accent-900)',
      client: s.client, onClient: e => this.setState({ client: e.target.value }),
      chantier: s.chantier, onChantier: e => this.setState({ chantier: e.target.value }),
      isMicro: T.micro, lines, isEmpty: !s.lines.length, lineCount: `${s.lines.length} ligne${s.lines.length > 1 ? 's' : ''}`,
      addMO: () => this.setState(st => ({ lines: [...st.lines.filter(x => x.kind !== 'dep'), moLine(1, this.taux()), ...st.lines.filter(x => x.kind === 'dep')] })),
      acompte: s.acompte,
      isProvisoire: s.acompte === 0,
      acompteRowLabel: s.acompte ? `Acompte ${s.acompte} % dû à la signature` : 'Aucun acompte',
      acompteSentence: s.acompte ? `Acompte de ${s.acompte} % à la signature, soit ${fmt(T.ac)}. Solde à la fin des travaux.` : 'Aucun acompte demandé. Paiement intégral à la fin des travaux.',
      acDevis: this.acCtl(s.acompte, v => this.setState({ acompte: v })),
      acDef: this.acCtl(s.acompteDef ?? 30, v => this.setState({ acompteDef: v })),
      acompteDefOpts: [0, 30, 40, 50].map(v => { const a = (s.acompteDef ?? 30) === v; return { label: v ? v + ' %' : 'Aucun', bg: a ? 'var(--color-neutral-900)' : 'var(--color-neutral-100)', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => { this.setState({ acompteDef: v }); this.flash(v ? `Acompte par défaut : ${v} %` : 'Sans acompte par défaut : devis provisoires'); } }; }),
      acompteOpts: [0, 30, 40, 50].map(v => { const a = s.acompte === v; return { label: v ? v + ' %' : 'Aucun', bg: a ? 'var(--color-neutral-900)' : 'var(--color-neutral-100)', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => this.setState({ acompte: v }) }; }),
      remiseTxt: s.remiseTxt, onRemise: e => this.setState({ remiseTxt: e.target.value }),
      totalLabel: T.micro ? 'Total HT' : 'Total TTC', ttcTxt: fmt(T.ttc), acompteTxt: fmt(T.ac), soldeTxt: fmt(T.solde),
      gauge, recapRows,
      recapOpen: s.recapOpen, openRecap: () => this.setState({ recapOpen: true }), closeRecap: () => this.setState({ recapOpen: false }),
      saveDevis: () => { this.setState({ recapOpen: false }); this.flash(`Devis ${s.editNo || 'DEV-2026-041'} enregistré`); },
      toFacture: () => {
        if (!s.lines.length) { this.flash('Ajoute au moins une ligne avant de facturer'); return; }
        const no = `FAC-2026-0${s.facSeq}`;
        this.setState(st => ({ facSeq: st.facSeq + 1, docTab: 'fac', recapOpen: false, plans: (st.plans ?? this.defaultPlans()).map(p => p.devisNo === (st.editNo || 'DEV-2026-041') ? { ...p, facNo: no } : p),
          docs: [{ no, type: 'fac', client: `${st.client || 'Client'} — acompte ${st.acompte} % déduit`, date: '24/09', st: 0, ttc: T.ttc - T.ac }, ...st.docs.map(d => d.live ? { ...d, st: 3 } : d)] }));
        this.go('docs'); this.flash(`Facture ${no} créée, acompte reporté`);
      },
      docTabs: [['devis', 'Devis'], ['fac', 'Factures'], ['plans', 'Plans']].map(([k, label]) => { const a = s.docTab === k; return { label, bg: a ? 'var(--color-neutral-100)' : 'transparent', fg: a ? 'var(--color-neutral-900)' : 'var(--color-neutral-700)', onPick: () => this.setState({ docTab: k }) }; }),
      ...(() => { const f = s.docFilter, base = docs.filter(d => d.type === s.docTab);
        const ok = d => !f ? true : f.k === 'status' ? d.status === f.v : f.k === 'unpaid' ? d.type === 'fac' && d.status !== 'Encaissée' : f.k === 'client' ? d.client.startsWith(f.v) : true;
        const list = base.filter(ok);
        return { docList: list, docFilter: { on: !!f, label: f ? f.label : '', count: list.length + ' doc.', empty: !!f && !list.length, clear: () => this.setState({ docFilter: null }) } }; })(),
      q: s.q, onQ: e => this.setState({ q: e.target.value }), catEmpty: !catItems.length, catItems,
      fams: fams.map(f => { const a = s.fam === f; return { label: f, bg: a ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => this.setState({ fam: f }) }; }),
      metierOpen: s.metierOpen, openMetier: () => this.setState({ metierOpen: true }), closeMetier: () => this.setState({ metierOpen: false }),
      metiers: METIERS.map(x => { const a = x.key === s.metier; return { label: x.label, bg: a ? 'var(--color-accent-2-700)' : 'var(--color-neutral-100)', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)',
        onPick: () => { if (a) return this.setState({ metierOpen: false }); this.setState({ metier: x.key, metierOpen: false, fam: 'Tout', q: '', aiInput: '', aiMsg: '', lines: x.key === 'elec' ? demoLines() : [] }); this.flash(`Catalogue ${x.label} chargé`); } }; }),
      regimes: [['assujetti', 'Assujetti TVA DOM'], ['micro', 'Franchise micro']].map(([k, label]) => { const a = s.regime === k; return { label, bg: a ? 'var(--color-neutral-100)' : 'transparent', fg: a ? 'var(--color-neutral-900)' : 'var(--color-neutral-700)', onPick: () => this.setState({ regime: k }) }; }),
      mo: (() => { const t = this.taux(), mos = s.lines.filter(l => l.kind === 'mo'), hrs = mos.reduce((a, l) => a + l.qty, 0);
        return { txt: t + ' €', hours: hrs + ' h', total: fmt(hrs * t),
          minus: () => this.setState({ tauxMO: Math.max(20, t - 1) }), plus: () => this.setState({ tauxMO: Math.min(120, t + 1) }),
          chips: [40, 45, 48, 55, 60].map(v => ({ label: v + ' €', bg: v === t ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: v === t ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)', onPick: () => this.setState({ tauxMO: v }) })),
          apply: () => { this.setState(st => ({ lines: st.lines.map(l => l.kind === 'mo' ? { ...l, pu: t, puTxt: undefined } : l) })); this.flash(`Main d'œuvre passée à ${t} € / h`); } }; })(),
      newDevis: () => this.newDevis(),
      timeOpts: { h: Array.from({ length: 24 }, (_, i) => { const v = String(i).padStart(2, '0'); return { v, l: v + ' h' }; }), m: Array.from({ length: 12 }, (_, i) => { const v = String(i * 5).padStart(2, '0'); return { v, l: v }; }) },
      fit: (() => { const k = Math.max(0.5, s.fitK || 1); return { w: Math.round(390 * k) + 'px', h: Math.round(844 * k) + 'px', t: k < 1 ? `scale(${k.toFixed(3)})` : 'none' }; })(),
      pp: (() => { const hist = (s.aiHistory || []).filter(t => !m.ex.includes(t)), open = !!s.ppOpen;
        const pick = t => () => this.setState({ aiInput: t, aiMsg: '', ppOpen: false });
        return { open, rot: open ? 'rotate(180deg)' : 'none', border: open ? 'var(--color-accent)' : 'var(--color-neutral-500)',
          count: hist.length ? hist.length + ' récent' + (hist.length > 1 ? 's' : '') : '',
          toggle: () => this.setState({ ppOpen: !open }), hasHist: hist.length > 0,
          hist: hist.map(t => ({ text: t, onPick: pick(t), onDel: () => this.setState(st => ({ aiHistory: (st.aiHistory || []).filter(x => x !== t) })) })),
          clear: () => this.setState({ aiHistory: [] }),
          exLabel: 'Exemples ' + m.label.toLowerCase(), ex: m.ex.map(t => ({ text: t, onPick: pick(t) })) }; })(),
      goStats: () => this.go('stats'),
      sun: s.sun ? { n: 'var(--color-neutral-900)', div: 'var(--color-neutral-500)', bg: 'var(--color-neutral-100)' } : { n: 'inherit', div: 'inherit', bg: 'inherit' },
      sunOn: !!s.sun, toggleSun: () => this.setState(st => ({ sun: !st.sun })),
      sunSw: s.sun ? { justify: 'flex-end', bg: 'var(--color-accent-2-700)' } : { justify: 'flex-start', bg: 'var(--color-neutral-400)' },
      savedTxt: 'Devis, factures et réglages gardés sur cet appareil',
      resetDemo: () => { try { localStorage.removeItem(Component.KEY); } catch (e) {} location.reload(); },
      previewOpen: !!s.previewOpen, openPreview: () => this.setState({ previewOpen: true, recapOpen: false }), closePreview: () => this.setState({ previewOpen: false }),
      pv: {
        date: new Date().toLocaleDateString('fr-FR'), client: s.client || 'Client', chantier: s.chantier || '—',
        puCol: s.puHidden ? '0px' : 'auto', puHead: s.puHidden ? '' : 'PU HT',
        lines: s.lines.map(l => ({ name: l.name, qty: String(l.qty).replace('.', ',') + U(l.unit), pu: s.puHidden ? '' : fmt(l.pu), montant: fmt(l.pu * l.qty) })),
      },
      sendDevis: () => {
        if (!s.lines.length) return this.flash('Ajoute au moins une ligne');
        this.setState(st => ({ previewOpen: false, docs: st.docs.map(d => d.live && d.st === 0 ? { ...d, st: 1 } : d) }));
        this.flash(`${s.editNo || 'DEV-2026-041'} envoyé à ${s.client || 'ton client'}`);
      },
      goBack: () => this.go(s.prevTab && s.prevTab !== s.tab ? s.prevTab : 'home'),
      backTitle: 'Retour : ' + ({ home: 'Accueil', devis: 'Devis', docs: 'Documents', stats: 'Facturation', marge: 'Calcul de marge', outil: 'Outils', set: 'Réglages', projet: 'Projet', plan: 'Plan' }[s.prevTab] || 'Accueil'),
      showPu: !s.puHidden, puHidden: !!s.puHidden, puTitle: s.puHidden ? 'Afficher les prix unitaires' : 'Masquer les prix unitaires',
      togglePu: () => this.setState(st => ({ puHidden: !st.puHidden })),
      toast: s.toast, seuilTxt: (s.seuil ?? 15) + ' %', seuilPos: Math.min(s.seuil ?? 15, 50) / 50 * 100 + '%',
      seuilMinus: () => this.setState(st => ({ seuil: Math.max(5, (st.seuil ?? 15) - 1) })), seuilPlus: () => this.setState(st => ({ seuil: Math.min(45, (st.seuil ?? 15) + 1) })), ...this.toolVals(docs, T), pa: this.paVals(facs), ...this.facVals(), ...this.statsVals(ca), isStats: s.tab === 'stats', ...this.margeVals(docs, T), ...this.calVals(), ...this.projVals(docs), ...this.rulesVals(), ...this.relVals(docs), ...this.cgvVals(), ...this.planVals(), ...this.cptVals(), ...this.formeVals(), ...this.helpVals(), ...this.mailVals(), ...this.rdvVals(), ...this.normVals(), ...(() => { const ci = this.coInfoVals(); return { ...ci, setDot: ci.coInfo.nMissing > 0,
        setNav: [['ent', 'Entreprise', ci.coInfo.nMissing], ['tva', 'TVA'], ['tarifs', 'Tarifs'], ['devis', 'Devis'], ['cgv', 'Conditions'], ['compta', 'Comptable'], ['pa', 'Facturation'], ['aff', 'Affichage']].map(([id, label, dot]) => { const a = (s.activeSet || 'ent') === id; return { id, label, dot: dot || 0,
          bg: a ? 'var(--color-neutral-900)' : 'var(--color-surface)', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-900)',
          onGo: () => { if (this._dragged) return; const sc = this.scrollRef.current, el = sc && sc.querySelector('#set-' + id); this._lockSpy = Date.now(); this.setState({ activeSet: id }); if (el) sc.scrollTo({ top: el.offsetTop - 60, behavior: 'smooth' }); } }; }) }; })(),
      onMainScroll: () => this.spy(),
      mic: { on: !!s.micOn, toggle: () => this.toggleMic(), title: s.micOn ? 'Arrêter la dictée' : 'Dicter le chantier', bg: s.micOn ? 'var(--color-accent-700)' : 'var(--color-surface)', fg: s.micOn ? 'var(--color-neutral-100)' : 'var(--color-text)', ring: s.micOn ? '0 0 0 6px var(--color-accent-200)' : 'none' },
      dupDevis: () => { this.setState({ recapOpen: false }); this.dupDevis(); },
    };
  }
}

export default Component;
