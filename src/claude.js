// window.claude.complete() du prototype → appel au serveur (/api/complete).
// La clé API reste côté serveur ; si le serveur ne répond pas, la logique bascule sur ses replis locaux.
window.claude = {
  async complete({ model, max_tokens, system, messages }) {
    const r = await fetch('/api/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });
    if (!r.ok) throw new Error('IA indisponible (' + r.status + ')');
    const { text } = await r.json();
    return text;
  },
};
