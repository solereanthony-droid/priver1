// Journal structuré de l'intégration PA : jamais de contenu de facture (XML, PDF, montants détaillés, noms).
// Champs autorisés uniquement ; tout le reste est ignoré.
const ALLOWED = ['event', 'tenantId', 'invoiceNo', 'flowId', 'correlationId', 'http', 'code', 'state', 'durationMs', 'attempt', 'error'];

export function createLogger(sink = line => process.stdout.write(line + '\n')) {
  return (fields) => {
    const o = { at: new Date().toISOString() };
    for (const k of ALLOWED) if (fields[k] !== undefined) o[k] = k === 'error' ? String(fields[k]).slice(0, 200) : fields[k];
    sink(JSON.stringify(o));
  };
}
