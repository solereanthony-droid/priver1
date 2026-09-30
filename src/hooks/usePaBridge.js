import { useEffect, useRef } from 'react';
import { toPaInvoice, isoDate } from '../pa/invoicePayload.js';

// Relie le prototype (v15) à la plateforme agréée (window.btpPA) et aux sessions du serveur.
// - Serveur joignable : l'état de connexion (paSt), le compte (paAcc), les statuts des factures, l'encaissement et
//   l'écran de code d'accès viennent du serveur ; rien n'est simulé.
// - Serveur injoignable (démo statique, sans API) : le prototype garde sa simulation, avec la mention « Démo ».
const FAC_IDX = { 'Émise': 0, 'Transmise': 1, 'Acceptée': 2, 'Encaissée': 3, 'Rejetée': 4, 'Refusée': 5, 'En litige': 6 };
const LIVE = new Set(['connecte', 'sync', 'panne_pa', 'reauth']);
const MEMO = 'btp974-pa-live';
const frDate = t => t ? new Date(t).toLocaleDateString('fr-FR') : undefined;

export function usePaBridge(logic, locked) {
  const cfgRef = useRef(null);

  useEffect(() => {
    const pa = window.btpPA;
    if (!pa) return;
    let status = null, stopped = false;
    const flash = m => logic.flash(m);
    const remember = v => { try { localStorage.setItem(MEMO, v ? '1' : '0'); } catch { /* stockage indisponible */ } };
    const wasLive = () => { try { return localStorage.getItem(MEMO) === '1'; } catch { return false; } };
    const setLive = v => { window.__btpPaLive = v; };

    async function sync() {
      try { status = await pa.status(); } catch { status = null; }
      if (stopped) return;
      if (!status) { setLive(false); return; }                         // démo statique : le prototype simule
      const live = LIVE.has(status.state);
      setLive(live || (status.state === 'hors_ligne' && wasLive()));
      if (status.state !== 'hors_ligne') remember(live);
      if (status.state !== 'hors_ligne') {
        logic.setState(st => ({
          paSt: status.state,
          ...(status.paName ? { paAcc: { ...(st.paAcc || {}), name: status.paName, since: frDate(status.connectedAt) || st.paAcc?.since } } : {}),
          ...(status.lastSync ? { paAgo: Math.max(0, Math.round((Date.now() - status.lastSync) / 60000)) } : {}),
        }));
      }
      if (!live) return;
      const r = await pa.invoices().catch(() => null);
      if (stopped || !r || r.status !== 200) return;
      const byNo = new Map(r.data.invoices.map(i => [i.no, i]));
      const queued = new Set((await pa.pending()).map(p => p.no));
      logic.setState(st => ({ docs: st.docs.map(d => {
        const v = byNo.get(d.no);
        if (d.type !== 'fac' || (!v && !queued.has(d.no) && !d.paQueued)) return d;
        if (!v) return { ...d, paQueued: queued.has(d.no) };
        const st2 = FAC_IDX[v.status] ?? d.st;
        return { ...d, st: st2, motif: v.reason || null, errors: v.errors || [], paQueued: queued.has(d.no) || !!v.queued,
          paPaid: v.paid, paRemaining: v.remaining, paSentAt: frDate(v.depositedAt) || d.paSentAt,
          ...(st2 === 3 && !d.paidOn ? { paidOn: new Date().toLocaleDateString('fr-FR') } : {}) };
      }) }));
    }

    // Menu de statut et Encaissements. true : pris en charge par la plateforme ; false : le prototype simule (démo).
    window.__btpPaSend = (kind, doc, extra = {}) => {
      const offline = !navigator.onLine, live = window.__btpPaLive || (offline && wasLive());
      if (!live) {
        if (!status) { setTimeout(() => flash('Démo : aucun serveur de plateforme agréée, action simulée.'), 0); return false; }
        flash(status.error || 'Connecte ton compte de plateforme agréée dans Réglages → Facture électronique.');
        return true;
      }
      (async () => {
        try {
          if (kind === 'transmit') await pa.transmit(toPaInvoice(doc, logic.coData()));
          else await pa.recordPayment(doc.no, extra.amount ?? doc.paRemaining ?? doc.ttc, isoDate(extra.date || new Date().toLocaleDateString('fr-FR')));
          logic.setState(st => ({ docs: st.docs.map(x => x.no === doc.no ? { ...x, paQueued: true } : x) }));
          flash(offline ? `${doc.no} en attente d’envoi : elle partira à la reconnexion.` : kind === 'transmit' ? `${doc.no} envoyée à la plateforme.` : `Encaissement de ${doc.no} envoyé à la plateforme.`);
        } catch (e) { flash(e.message); }
      })();
      return true;
    };

    // Écran de code d'accès : avec des sessions sur le serveur, c'est lui qui vérifie le code et bloque après 5 essais.
    window.__btpLogin = (code, R) => {
      if (!cfgRef.current?.sessions) return false;
      (async () => {
        let r;
        try { r = await pa.login(code); } catch { r = { status: 0 }; }
        if (r.status === 200) {
          const staffer = r.data.role === 'staff' ? (R?.staff || []).find(x => x.pin && x.kind !== 'dir' && String(x.pin) === code) : null;
          cfgRef.current = { ...cfgRef.current, role: r.data.role };
          logic.setState({ locked: false, lkCode: '', lkErr: '', lkTries: 0, role: r.data.role, ...(staffer ? { rhEmp: { who: staffer.id, ch: 'filaos', h: 8, panier: true } } : {}) });
          sync();
        } else if (r.status === 429) logic.setState({ lkCode: '', lkTries: 0, lkErr: 'Trop d’essais : patiente une minute', lkUntil: Date.now() + 60000 });
        else logic.setState({ lkCode: '', lkErr: r.status === 0 ? 'Serveur injoignable : réessaie' : 'Code incorrect' });
      })();
      return true;
    };

    const onError = e => flash(e.detail.no ? `${e.detail.no} : ${(e.detail.errors && e.detail.errors[0]) || e.detail.message}` : e.detail.message);
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

    (async () => {
      try {
        const c = await pa.config();
        if (c.status === 200) {
          cfgRef.current = c.data;
          // Sessions activées sur le serveur : sans session, l'app s'ouvre sur l'écran de code.
          if (c.data.sessions) logic.setState(c.data.role ? { role: c.data.role, locked: false } : { locked: true, lkCode: '', lkErr: '' });
        }
      } catch { cfgRef.current = null; }
      sync();
    })();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 30_000);
    return () => {
      stopped = true; clearInterval(timer);
      delete window.__btpPaSend; delete window.__btpLogin; delete window.__btpPaLive;
      window.removeEventListener('btp:pa-error', onError); window.removeEventListener('btp:pa-update', onUpdate); window.removeEventListener('online', onUpdate);
    };
  }, [logic]);

  // « Verrouiller maintenant » ou déconnexion du salarié : la session du serveur est fermée aussi.
  useEffect(() => {
    if (locked && cfgRef.current?.sessions && cfgRef.current.role && window.btpPA) {
      cfgRef.current = { ...cfgRef.current, role: null };
      window.btpPA.logout().catch(() => {});
    }
  }, [locked]);
}
