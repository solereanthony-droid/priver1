// Appels IA : le client envoie une tâche (« devis » ou « rdv ») et ses paramètres au serveur,
// qui construit le prompt et garde la clé API. En cas d'échec, la logique bascule sur ses replis locaux.
window.btpAI = async (task, params) => {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, params }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('IA indisponible (' + r.status + ')');
    const { text } = await r.json();
    return text;
  } finally {
    clearTimeout(timer);
  }
};
