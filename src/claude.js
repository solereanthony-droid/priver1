// Appels IA : le client envoie une tâche (« devis » ou « rdv ») et ses paramètres au serveur,
// qui construit le prompt et garde la clé API.
// Les erreurs portent un code lu par le prototype : 'offline', 429, 400, sinon message par défaut (502).
const fail = (code, msg) => Object.assign(new Error(msg), { code, status: code });

window.btpAI = async (task, params) => {
  if (!navigator.onLine) throw fail('offline', 'hors ligne');
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    let r;
    try {
      r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, params }),
        signal: ctrl.signal,
      });
    } catch {
      throw fail(navigator.onLine ? 502 : 'offline', 'réseau');
    }
    if (!r.ok) throw fail(r.status === 429 || r.status === 400 ? r.status : 502, 'IA indisponible (' + r.status + ')');
    const { text } = await r.json();
    return text;
  } finally {
    clearTimeout(timer);
  }
};
