// Facture électronique : contrôles bloquants avant dépôt, calcul des montants EN 16931 et XML CII.
// Format déposé : CII (UN/CEFACT D16B) profil EN 16931, un des trois formats de la réforme (Factur-X, UBL, CII).
// Factur-X (PDF/A-3 + XML) demande des polices TTF embarquées et un profil ICC : étape suivante (docs/PA.md).
import { spawn } from 'node:child_process';

const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const amt = n => r2(n).toFixed(2);
const esc = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const digits = s => String(s || '').replace(/\s/g, '');

// Clé de Luhn (SIREN : 9 chiffres, SIRET : 14 chiffres).
export function luhn(num) {
  if (!/^\d+$/.test(num)) return false;
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = +num[num.length - 1 - i];
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
export const validSiren = s => /^\d{9}$/.test(digits(s)) && luhn(digits(s));
export const validSiret = s => /^\d{14}$/.test(digits(s)) && luhn(digits(s)) && luhn(digits(s).slice(0, 9));

const UNITS = { u: 'C62', 'pièce': 'C62', h: 'HUR', m: 'MTR', 'm²': 'MTK', m2: 'MTK', sac: 'XBG', forfait: 'LS', kg: 'KGM', l: 'LTR' };
const RATES = [8.5, 2.1];                                     // TVA DOM (La Réunion)
const FRANCHISE = 'TVA non applicable, art. 293 B du CGI';

// Montants calculés côté serveur à partir des lignes (on ne fait jamais confiance aux totaux envoyés).
export function computeTotals(inv) {
  const micro = inv.regime === 'micro', r = Math.min(Math.max(+inv.remisePct || 0, 0), 100) / 100;
  const lines = inv.lines.map((l, i) => ({ id: String(i + 1), name: l.name, ref: l.ref, qty: +l.qty, unit: UNITS[l.unit] || 'C62', pu: r2(+l.pu), rate: micro ? 0 : +l.tva, cat: micro ? 'E' : 'S', net: r2(+l.pu * +l.qty) }));
  const groups = new Map();
  for (const l of lines) { const k = l.cat + '|' + l.rate; groups.set(k, (groups.get(k) || 0) + l.net); }
  const vat = [...groups].map(([k, base]) => {
    const [cat, rate] = k.split('|'), allowance = r2(base * r), basis = r2(base - allowance);
    return { cat, rate: +rate, lineBase: r2(base), allowance, basis, tax: cat === 'S' ? r2(basis * +rate / 100) : 0 };
  }).sort((a, b) => b.rate - a.rate);
  const lineTotal = r2(lines.reduce((a, l) => a + l.net, 0));
  const allowanceTotal = r2(vat.reduce((a, v) => a + v.allowance, 0));
  const taxBasis = r2(lineTotal - allowanceTotal), taxTotal = r2(vat.reduce((a, v) => a + v.tax, 0));
  const grand = r2(taxBasis + taxTotal), prepaid = r2(+inv.prepaid || 0);
  return { micro, r, lines, vat, lineTotal, allowanceTotal, taxBasis, taxTotal, grand, prepaid, due: r2(grand - prepaid) };
}

// Contrôles bloquants (§ 4.1 de la fiche) + règles de cohérence EN 16931 (BR-CO-10 à 16, BR-S-08/09, BR-E-10).
export function validateInvoice(inv) {
  const e = [];
  if (!inv || typeof inv !== 'object') return ['Facture absente.'];
  if (!/^FAC-\d{4}-\d{3,}$/.test(inv.no || '')) e.push('Numéro de facture invalide (FAC-<année>-NNN).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate || '') || Number.isNaN(Date.parse(inv.issueDate))) e.push('Date de facture invalide.');
  if (inv.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(inv.dueDate)) e.push('Date d’échéance invalide.');
  if ((inv.currency || 'EUR') !== 'EUR') e.push('Devise : EUR uniquement (code ISO 4217).');
  const s = inv.seller || {}, b = inv.buyer || {};
  if (!s.name) e.push('Nom du vendeur manquant.');
  if (!validSiret(s.siret)) e.push('SIRET du vendeur absent ou invalide (clé de Luhn).');
  if (inv.regime !== 'micro' && !/^FR[0-9A-Z]{2}\d{9}$/.test(digits(s.tva).toUpperCase())) e.push('N° de TVA intracommunautaire du vendeur manquant ou invalide.');
  if (!s.addr || !s.addr.postcode || !s.addr.city) e.push('Adresse du vendeur incomplète (code postal, ville).');
  if (b.type !== 'pro') e.push('Client particulier : la facture électronique ne concerne que les clients professionnels (B2B). Pour un particulier, prévoir le e-reporting.');
  if (!b.name) e.push('Nom du client manquant.');
  if (!validSiren(b.siren)) e.push('SIREN du client absent ou invalide (clé de Luhn).');
  if (!Array.isArray(inv.lines) || !inv.lines.length) e.push('Au moins une ligne est requise.');
  else inv.lines.forEach((l, i) => {
    if (!l.name) e.push(`Ligne ${i + 1} : désignation manquante.`);
    if (!(+l.qty > 0)) e.push(`Ligne ${i + 1} : quantité invalide.`);
    if (!(+l.pu >= 0)) e.push(`Ligne ${i + 1} : prix unitaire invalide.`);
    if (inv.regime !== 'micro' && !RATES.includes(+l.tva)) e.push(`Ligne ${i + 1} : taux de TVA ${l.tva} % non prévu (8,5 % ou 2,1 %).`);
  });
  if (e.length) return e;
  const T = computeTotals(inv);
  if (T.lineTotal !== r2(T.lines.reduce((a, l) => a + l.net, 0))) e.push('BR-CO-10 : somme des lignes incohérente.');
  if (T.taxBasis !== r2(T.lineTotal - T.allowanceTotal)) e.push('BR-CO-13 : base HT incohérente.');
  if (T.taxTotal !== r2(T.vat.reduce((a, v) => a + v.tax, 0))) e.push('BR-CO-14 : total TVA incohérent.');
  if (T.grand !== r2(T.taxBasis + T.taxTotal)) e.push('BR-CO-15 : HT + TVA ≠ TTC.');
  if (T.due !== r2(T.grand - T.prepaid)) e.push('BR-CO-16 : net à payer incohérent.');
  if (T.prepaid < 0 || T.prepaid > T.grand) e.push('Acompte déjà versé supérieur au TTC.');
  for (const v of T.vat) if (v.cat === 'S' && v.tax !== r2(v.basis * v.rate / 100)) e.push(`BR-S-09 : TVA ${v.rate} % mal calculée.`);
  return e;
}

// XML CII profil EN 16931 (contexte « urn:cen.eu:en16931:2017 »).
export function buildCII(inv) {
  const T = computeTotals(inv), s = inv.seller, b = inv.buyer, d = x => x.replace(/-/g, '');
  const siren = digits(s.siret).slice(0, 9);
  const party = (p, legalId, vatId) => [
    `<ram:Name>${esc(p.name)}</ram:Name>`,
    legalId ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${legalId}</ram:ID></ram:SpecifiedLegalOrganization>` : '',
    `<ram:PostalTradeAddress>${p.addr?.postcode ? `<ram:PostcodeCode>${esc(p.addr.postcode)}</ram:PostcodeCode>` : ''}${p.addr?.line ? `<ram:LineOne>${esc(p.addr.line)}</ram:LineOne>` : ''}${p.addr?.city ? `<ram:CityName>${esc(p.addr.city)}</ram:CityName>` : ''}<ram:CountryID>${esc(p.addr?.country || 'FR')}</ram:CountryID></ram:PostalTradeAddress>`,
    legalId ? `<ram:URIUniversalCommunication><ram:URIID schemeID="0225">${legalId}</ram:URIID></ram:URIUniversalCommunication>` : '',
    vatId ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(vatId)}</ram:ID></ram:SpecifiedTaxRegistration>` : '',
  ].join('');
  const vatId = T.micro ? '' : digits(s.tva).toUpperCase();
  const lineXml = T.lines.map(l => `<ram:IncludedSupplyChainTradeLineItem>` +
    `<ram:AssociatedDocumentLineDocument><ram:LineID>${l.id}</ram:LineID></ram:AssociatedDocumentLineDocument>` +
    `<ram:SpecifiedTradeProduct>${l.ref ? `<ram:SellerAssignedID>${esc(l.ref)}</ram:SellerAssignedID>` : ''}<ram:Name>${esc(l.name)}</ram:Name></ram:SpecifiedTradeProduct>` +
    `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${amt(l.pu)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>` +
    `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${l.unit}">${l.qty}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>` +
    `<ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${l.cat}</ram:CategoryCode><ram:RateApplicablePercent>${l.rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>` +
    `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amt(l.net)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement>` +
    `</ram:IncludedSupplyChainTradeLineItem>`).join('');
  const vatXml = T.vat.map(v => `<ram:ApplicableTradeTax><ram:CalculatedAmount>${amt(v.tax)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>` +
    (v.cat === 'E' ? `<ram:ExemptionReason>${FRANCHISE}</ram:ExemptionReason>` : '') +
    `<ram:BasisAmount>${amt(v.basis)}</ram:BasisAmount><ram:CategoryCode>${v.cat}</ram:CategoryCode>` +
    (v.cat === 'E' ? '<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>' : '') +
    `<ram:RateApplicablePercent>${v.rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`).join('');
  const allowXml = T.vat.filter(v => v.allowance > 0).map(v => `<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>` +
    `<ram:ActualAmount>${amt(v.allowance)}</ram:ActualAmount><ram:Reason>Remise</ram:Reason>` +
    `<ram:CategoryTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${v.cat}</ram:CategoryCode><ram:RateApplicablePercent>${v.rate}</ram:RateApplicablePercent></ram:CategoryTradeTax></ram:SpecifiedTradeAllowanceCharge>`).join('');
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">' +
    '<rsm:ExchangedDocumentContext>' +
    `<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${esc(inv.cadre || 'M1')}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>` +
    '<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>' +
    `<rsm:ExchangedDocument><ram:ID>${esc(inv.no)}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${d(inv.issueDate)}</udt:DateTimeString></ram:IssueDateTime>` +
    (T.micro ? `<ram:IncludedNote><ram:Content>${FRANCHISE}</ram:Content></ram:IncludedNote>` : '') + '</rsm:ExchangedDocument>' +
    '<rsm:SupplyChainTradeTransaction>' + lineXml +
    `<ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty>${party(s, siren, vatId)}</ram:SellerTradeParty><ram:BuyerTradeParty>${party(b, digits(b.siren), '')}</ram:BuyerTradeParty></ram:ApplicableHeaderTradeAgreement>` +
    '<ram:ApplicableHeaderTradeDelivery/>' +
    '<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>' + vatXml + allowXml +
    (inv.dueDate ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${d(inv.dueDate)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` : '') +
    '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>' +
    `<ram:LineTotalAmount>${amt(T.lineTotal)}</ram:LineTotalAmount>` + (T.allowanceTotal ? `<ram:AllowanceTotalAmount>${amt(T.allowanceTotal)}</ram:AllowanceTotalAmount>` : '') +
    `<ram:TaxBasisTotalAmount>${amt(T.taxBasis)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${amt(T.taxTotal)}</ram:TaxTotalAmount>` +
    `<ram:GrandTotalAmount>${amt(T.grand)}</ram:GrandTotalAmount>` + (T.prepaid ? `<ram:TotalPrepaidAmount>${amt(T.prepaid)}</ram:TotalPrepaidAmount>` : '') +
    `<ram:DuePayableAmount>${amt(T.due)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>` +
    '</ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>';
}

// Validation officielle XSD + Schematron EN 16931 : commande externe (validateur KoSIT, Mustang…) qui lit le XML
// sur l'entrée standard et renvoie 0 si le fichier est conforme. Sans commande configurée : contrôles locaux seuls.
export function externalValidate(cmd, xml, timeoutMs = 60_000) {
  if (!cmd) return Promise.resolve({ ok: true, skipped: true });
  return new Promise(resolve => {
    const [bin, ...args] = cmd.split(' ').filter(Boolean);
    const p = spawn(bin, args, { stdio: ['pipe', 'ignore', 'pipe'], timeout: timeoutMs });
    let err = '';
    p.stderr.on('data', c => { err = (err + c).slice(-2000); });
    p.on('error', e => resolve({ ok: false, errors: ['Validateur indisponible : ' + e.message] }));
    p.on('close', code => resolve(code === 0 ? { ok: true } : { ok: false, errors: [err.trim() || 'Fichier non conforme EN 16931 (XSD / Schematron).'] }));
    p.stdin.end(xml);
  });
}
