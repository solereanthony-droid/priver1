// Cycle de vie des factures électroniques.
// Codes : norme XP Z12-012 (liste des « statuts du cycle de vie », 200 à 213). Seuls 200, 210, 212 et 213 sont
// obligatoires. La table ci-dessous suit la liste officielle des spécifications externes ; la fiche projet
// (PLATEFORME_AGREEE.md) numérotait différemment 202, 204, 208 et 209 : à confirmer avec la PA retenue.
export const PA_CODES = {
  200: { state: 'deposee', label: 'Déposée' },
  201: { state: 'emise_pa', label: 'Émise par la plateforme' },
  202: { state: 'recue', label: 'Reçue par la plateforme du client' },
  203: { state: 'mise_dispo', label: 'Mise à disposition du client' },
  204: { state: 'prise_en_charge', label: 'Prise en charge par le client' },
  205: { state: 'approuvee', label: 'Approuvée' },
  206: { state: 'approuvee_partielle', label: 'Approuvée partiellement' },
  207: { state: 'en_litige', label: 'En litige' },
  208: { state: 'suspendue', label: 'Suspendue' },
  209: { state: 'completee', label: 'Complétée' },
  210: { state: 'refusee', label: 'Refusée' },
  211: { state: 'paiement_transmis', label: 'Paiement transmis' },
  212: { state: 'encaissee', label: 'Encaissée' },
  213: { state: 'rejetee', label: 'Rejetée' },
};

// Rang d'avancement : on ne revient jamais en arrière, sauf à l'intérieur d'un litige.
const RANK = {
  brouillon: 0, emise: 1, en_file: 2, echec: 2, deposee: 3, emise_pa: 4, recue: 5, mise_dispo: 6,
  prise_en_charge: 7, en_litige: 7, suspendue: 7, completee: 7, approuvee_partielle: 8, approuvee: 8,
  paiement_transmis: 9, encaissee: 10, rejetee: 99, refusee: 99,
};
export const TERMINAL = new Set(['rejetee', 'refusee', 'encaissee']);
const DISPUTE = new Set(['prise_en_charge', 'en_litige', 'suspendue', 'completee']);
const DEPOSITED = new Set(['deposee', 'emise_pa', 'recue', 'mise_dispo', 'prise_en_charge', 'en_litige', 'suspendue', 'completee', 'approuvee_partielle', 'approuvee', 'paiement_transmis']);

export const isDeposited = s => DEPOSITED.has(s);

// Correspondance avec les 4 statuts affichés par le prototype (+ les nouveaux).
export function uiStatus(state) {
  if (['brouillon', 'emise', 'en_file', 'echec'].includes(state)) return 'Émise';
  if (['deposee', 'emise_pa', 'recue', 'mise_dispo', 'prise_en_charge', 'completee'].includes(state)) return 'Transmise';
  if (['approuvee', 'approuvee_partielle', 'paiement_transmis'].includes(state)) return 'Acceptée';
  if (state === 'encaissee') return 'Encaissée';
  return { rejetee: 'Rejetée', refusee: 'Refusée', en_litige: 'En litige', suspendue: 'En litige' }[state] || 'Émise';
}

export function canTransition(from, to) {
  if (!(to in RANK) || !(from in RANK)) return false;
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;                                  // sortie d'un état terminal interdite
  if (from === 'echec') return to === 'en_file' || to === 'emise';       // nouvel essai ou retour à la correction
  if (to === 'echec') return from === 'en_file';
  if (to === 'en_file') return from === 'emise';
  if (to === 'emise') return from === 'en_file';                         // erreur de contenu : retour à la correction
  if (to === 'rejetee') return from === 'en_file' || isDeposited(from);
  if (to === 'refusee') return isDeposited(from);
  if (DISPUTE.has(from) && DISPUTE.has(to)) return true;                 // litige, suspension, complétée
  return RANK[to] > RANK[from];
}
