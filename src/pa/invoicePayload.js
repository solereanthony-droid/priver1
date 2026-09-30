// Convertit une facture de l'app (document avec son instantané « snap ») au format attendu par le serveur PA.
// Le serveur recalcule tous les montants : seules les lignes, les taux et les identifiants comptent.
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// « 4 rue des Flamboyants, 97460 Saint-Paul » → { line, postcode, city, country }
export function parseAddress(txt) {
  const s = String(txt || '').trim(), m = s.match(/^(.*?),?\s*(\d{5})\s+(.+)$/);
  return m ? { line: m[1].replace(/,\s*$/, '').trim(), postcode: m[2], city: m[3].trim(), country: 'FR' } : { line: s, postcode: '', city: '', country: 'FR' };
}

export function toPaInvoice(doc, co, { buyerSiren = '', buyerName = '', buyerAddress = '', dueDays = 30 } = {}) {
  const snap = doc && doc.snap;
  if (!snap) throw new Error('Facture sans contenu enregistré : recrée-la depuis le devis pour pouvoir la transmettre.');
  const issued = new Date(snap.issued + 'T12:00:00'), due = new Date(issued.getTime() + dueDays * 864e5);
  return {
    no: doc.no, issueDate: snap.issued, dueDate: iso(due), currency: 'EUR', regime: snap.regime === 'micro' ? 'micro' : 'assujetti',
    remisePct: parseFloat(String(snap.remiseTxt || '0').replace(',', '.')) || 0, prepaid: snap.prepaid || 0,
    seller: { name: co.name, siret: String(co.siret || '').replace(/\s/g, ''), tva: String(co.tva || '').replace(/\s/g, ''), addr: parseAddress(co.addr) },
    buyer: { type: snap.clientType === 'pro' ? 'pro' : 'part', name: buyerName || snap.client, siren: String(buyerSiren || snap.clientSiren || '').replace(/\s/g, ''), addr: parseAddress(buyerAddress || snap.chantier) },
    lines: snap.lines.map(l => ({ name: l.name, ref: l.ref, qty: l.qty, unit: l.unit, pu: l.pu, tva: l.tva })),
  };
}
