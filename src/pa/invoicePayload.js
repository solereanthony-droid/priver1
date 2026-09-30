// Convertit une facture de l'app au format attendu par le serveur PA.
// Format du prototype (v14.2 / v15.1) : doc.addr (adresse de facturation, BG-8), doc.lines, doc.rem (fraction), doc.ac (acompte déduit), doc.micro, doc.siren (SIREN ou
// SIRET), doc.pro, doc.date (JJ/MM/AAAA), doc.chantier. L'ancien instantané de l'app (doc.snap) reste lu.
// Le serveur recalcule tous les montants : seules les lignes, les taux et les identifiants comptent.
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// « 4 rue des Flamboyants, 97460 Saint-Paul » → { line, postcode, city, country }
export function parseAddress(txt) {
  const s = String(txt || '').trim(), m = s.match(/^(.*?),?\s*(\d{5})\s+(.+)$/);
  return m ? { line: m[1].replace(/,\s*$/, '').trim(), postcode: m[2], city: m[3].trim(), country: 'FR' } : { line: s, postcode: '', city: '', country: 'FR' };
}

// JJ/MM/AAAA (ou ancien JJ/MM) → AAAA-MM-JJ
export function isoDate(v, now = new Date()) {
  const p = String(v || '').split('/').map(Number);
  if (!p[0] || !p[1]) return iso(now);
  const d = new Date(p[2] || now.getFullYear(), p[1] - 1, p[0]);
  if (!p[2] && d - now > 30 * 864e5) d.setFullYear(d.getFullYear() - 1);
  return iso(d);
}

const clientName = label => String(label || '').split(' — ')[0].trim();

export function toPaInvoice(doc, co, { buyerSiren = '', buyerName = '', buyerAddress = '', dueDays = 30 } = {}) {
  if (!doc) throw new Error('Facture introuvable.');
  const s = doc.snap;
  const lines = doc.lines || s?.lines;
  if (!lines || !lines.length) throw new Error('Facture sans lignes détaillées : complète-la avant de la transmettre.');
  const issueDate = s ? s.issued : isoDate(doc.date);
  const due = new Date(new Date(issueDate + 'T12:00:00').getTime() + dueDays * 864e5);
  const micro = s ? s.regime === 'micro' : !!doc.micro;
  const pro = s ? s.clientType === 'pro' : !!doc.pro;
  const remisePct = s ? parseFloat(String(s.remiseTxt || '0').replace(',', '.')) || 0 : Math.round((+doc.rem || 0) * 10000) / 100;
  return {
    no: doc.no, issueDate, dueDate: iso(due), currency: 'EUR', regime: micro ? 'micro' : 'assujetti',
    remisePct, prepaid: s ? s.prepaid || 0 : +doc.ac || 0,
    seller: { name: co.name, siret: String(co.siret || '').replace(/\s/g, ''), tva: String(co.tva || '').replace(/\s/g, ''), addr: parseAddress(co.addr) },
    buyer: { type: pro ? 'pro' : 'part', name: buyerName || clientName(s ? s.client : doc.client), siren: String(buyerSiren || (s ? s.clientSiren : doc.siren) || '').replace(/\D/g, ''), addr: parseAddress(buyerAddress || (s ? s.chantier : doc.addr || doc.chantier)) },
    lines: lines.map(l => ({ name: l.name, ref: l.ref, qty: l.qty, unit: l.unit, pu: l.pu, tva: l.tva })),
  };
}
