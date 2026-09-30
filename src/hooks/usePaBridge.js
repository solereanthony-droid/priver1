import { useEffect } from 'react';
import { toPaInvoice } from '../pa/invoicePayload.js';

// Relie le menu de statut des factures du prototype à la plateforme agréée (window.btpPA).
// - Plateforme connectée : « Transmettre » et « Enregistrer l'encaissement » partent vraiment (file hors ligne comprise)
//   et les statuts affichés viennent du serveur, jamais d'un changement manuel.
// - Aucune plateforme configurée sur le serveur (démo) : le prototype simule, avec la mention « Démo ».
// - Plateforme configurée mais session ou compte non connecté : rien n'est simulé, un message dit quoi faire.
const FAC_IDX = { 'Émise': 0, 'Transmise': 1, 'Acceptée': 2, 'Encaissée': 3, 'Rejetée': 4, 'Refusée': 5, 'En litige': 6 };
const LIVE = new Set(['connecte', 'sync', 'panne_pa', 'reauth']);
const MEMO = 'btp974-pa-live';
const pad = n => String(n).padStart(2, '0');
const todayIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function usePaBridge(logic) {
  useEffect(() => {
    const pa = window.btpPA;
    if (!pa) return;
    let status = null, stopped = false;
    const flash = m => logic.flash(m);
    const remember = v => { try { localStorage.setItem(MEMO, v ? '1' : '0'); } catch { /* stockage indisponible */ } };
    const wasLive = () => { try { return localStorage.getItem(MEMO) === '1'; } catch { return false; } };

    async function sync() {
      try { status = await pa.status(); } catch { status = null; }
      if (stopped || !status) return;
      if (LIVE.has(status.state)) remember(true);
      else if (status.state === 'non_configure') remember(false);
      if (!LIVE.has(status.state)) return;
      const r = await pa.invoices().catch(() => null);
      if (stopped || !r || r.status !== 200) return;
      const byNo = new Map(r.data.invoices.map(i => [i.no, i]));
      const queued = new Set((await pa.pending()).map(p => p.no));
      logic.setState(st => ({ docs: st.docs.map(d => {
        const v = byNo.get(d.no);
        if (d.type !== 'fac' || (!v && !queued.has(d.no) && !d.paQueued)) return d;
        return { ...d, st: v ? FAC_IDX[v.status] ?? d.st : d.st, motif: v ? v.reason || (v.errors || []).join(' ; ') || null : d.motif, paQueued: queued.has(d.no) || !!v?.queued, paRemaining: v?.remaining ?? d.paRemaining };
      }) }));
    }

    // Renvoie true si l'action est prise en charge (envoi réel ou blocage expliqué) ; false : le prototype simule.
    window.__btpPaSend = (kind, doc) => {
      const offline = !navigator.onLine, live = status ? LIVE.has(status.state) : offline && wasLive();
      if (!live) {
        if (status && status.error) { flash('Connecte-toi à l’app avec ton code d’accès pour transmettre tes factures.'); return true; }
        if (status && status.state === 'non_connecte') { flash('Connecte d’abord ton compte ' + (status.paName || 'de plateforme agréée') + ' dans Réglages → Facture électronique.'); return true; }
        setTimeout(() => flash('Démo : aucune plateforme agréée configurée, action simulée.'), 0);
        return false;
      }
      (async () => {
        try {
          if (kind === 'transmit') await pa.transmit(toPaInvoice(doc, logic.coData()));
          else await pa.recordPayment(doc.no, doc.paRemaining ?? doc.ttc, todayIso());
          logic.setState(st => ({ docs: st.docs.map(x => x.no === doc.no ? { ...x, paQueued: true } : x) }));
          flash(offline ? `${doc.no} en attente d’envoi : elle partira à la reconnexion.` : kind === 'transmit' ? `${doc.no} envoyée à la plateforme.` : `Encaissement de ${doc.no} envoyé à la plateforme.`);
        } catch (e) { flash(e.message); }
      })();
      return true;
    };

    const onError = e => flash(`${e.detail.no} : ${(e.detail.errors && e.detail.errors[0]) || e.detail.message}`);
    const onUpdate = () => { sync(); };
    window.addEventListener('btp:pa-error', onError);
    window.addEventListener('btp:pa-update', onUpdate);
    window.addEventListener('online', onUpdate);

    // Retour de la connexion OAuth : /?pa=connecte ou /?pa=erreur
    const q = new URLSearchParams(location.search).get('pa');
    if (q) {
      flash(q === 'connecte' ? 'Compte de plateforme agréée connecté.' : 'La connexion à la plateforme agréée a échoué : recommence.');
      history.replaceState(null, '', location.pathname);
    }

    sync();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 30_000);
    return () => {
      stopped = true; clearInterval(timer); delete window.__btpPaSend;
      window.removeEventListener('btp:pa-error', onError); window.removeEventListener('btp:pa-update', onUpdate); window.removeEventListener('online', onUpdate);
    };
  }, [logic]);
}
