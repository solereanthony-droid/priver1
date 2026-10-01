# Mise à jour du prototype : écran de verrouillage (codes à 6 chiffres, aucun code en clair)

**Date :** 2026-10-01
**Pour :** Claude Design (prototype `Chiffrage BTP 974 Mobile.dc.html`).
**Origine :** décisions prises le 2026-10-01 (voir `GLOSSARY.md`, `docs/adr/0001-verrou-sans-chiffrement-local.md`,
`docs/adr/0002-codes-acces-geres-par-l-app.md`) et § 14 de `RETOUR_DEV.md`. **Déjà fait et testé dans l'app** :
les extraits ci-dessous sont copiés du code de l'app (`src/app/logic.js`, `src/app/template.html`, `src/auth/`).
Les numéros de ligne renvoient au prototype actuel (v15.2).

**`totals()` inchangé.** Aucune règle de calcul ne bouge. La clé de sauvegarde `btp974-mobile-v1` ne change pas.

## 1. Ce qui change, en bref

| Avant (v15.2) | Après |
| --- | --- |
| Pavé à 4 chiffres | **6 chiffres** partout (patron et salariés) ; 000000, 123456, 654321… refusés ou jamais générés |
| `ownerCode` en clair (démo `1974`), affiché dans Réglages | **`ownerHash`** (empreinte PBKDF2) ; code jamais affiché ; plus de `1974` |
| `pin` des salariés en clair, affiché sur la fiche, envoyé par WhatsApp à volonté | **`code: { hash ou srv, at }`** ; code tiré au hasard, **affiché une seule fois** (`rhPin`, non enregistré) |
| Verrou seulement via « Verrouiller maintenant » ; un rechargement déverrouille | **Écran de code à chaque ouverture** ; verrouillage automatique réglable |
| 5 erreurs → 1 minute, compteur perdu au rechargement | Même règle que le serveur, **enregistrée** (`lkGuard`) : 5 essais / min, puis 10 échecs d'affilée → 15 min, 30, 60… 24 h |
| — | Premier lancement : « Choisis ton code patron » ; Réglages : « Changer le code patron » |
| — | Après un code salarié : « C'est bien toi, Kévin ? » |
| — | Anciennes sauvegardes : nouveau Code patron demandé ; codes salariés à 4 chiffres → « Code à renouveler » |

Vocabulaire (`GLOSSARY.md`) : **Code d'accès** (générique), **Code patron** (« code maître » ne s'emploie plus),
**Code salarié**, **Écran de verrouillage**, **Verrouillage automatique**, **Code à renouveler**. Le verrou protège
l'**usage** de l'app, pas les données du téléphone : c'est écrit dans Réglages.

## 2. Comment appliquer

1. Coller les deux blocs utilitaires (§ 4.1) dans le script, juste après `const TODAY` (l. 4007), **avec
   leurs deux commentaires de bornes** : à l'import, l'app remplace ce bloc par `src/auth/` (partagé avec le serveur).
2. Modifier `Component` (§ 4.2) : état initial, `KEEP`, chargement, `componentDidMount` / `componentWillUnmount`,
   remplacement de `lockVals()`, module Équipe, `renderVals()`.
3. Remplacer les trois blocs du gabarit (§ 5).
4. Relire les textes (§ 6) et passer la liste de tests (§ 8).

Règles § 4 du retour dev respectées : chemins simples dans `{{ }}`, pas de ressource externe, pas de `<script>` dans
le gabarit. Les empreintes utilisent `crypto.subtle` (intégré au navigateur, rien à charger).

## 3. Clés et états

- `KEEP` : retirer `ownerCode` ; ajouter `ownerHash`, `lkGuard`, `lockDelay`. Liste complète :
  ```
'lines','client','cliSiren','cliAddr','paAcc','ownerHash','lkGuard','lockDelay','chantier','acompte','remiseTxt','docs','devisSeq','facSeq','metier','regime','events','co','tauxMO','targetM','seuil','coutMO','trRel','rh','puHidden','ordered','relances','acompteDef','formeInfo','planMode','plans','compta','aiHistory','lcShow','payTerm','clientType','retenue','reserve','projSteps','editNo','versionOf','baseCount','sun','paAgo','themePref','layout','account','userProj','orders','cmdSeq','catPref'
  ```
- Salarié (`rh.staff[]`) : `pin` supprimé ; `code: { hash, at }` (prototype et app sans serveur) ou
  `code: { srv: true, at }` (code tenu par le serveur) ; `pinRenew: true` après migration d'une ancienne sauvegarde.
- `lockDelay` : minutes en arrière-plan avant verrouillage (0 = immédiat ; 5 par défaut).
- États non persistés : `locked` (vrai au démarrage), `lkStep` (`login`, `setup`, `setup2`, `old`, `new`, `new2`, `who`),
  `lkCode`, `lkErr`, `lkUntil`, `lkTmp`, `lkOld`, `lkWho`, `lkBusy`, `lkChange`, `role`, `rhPin`, `authMode`
  (`local` / `server`), `restored`. Supprimés : `lkTries`.

## 4. Code (classe `Component` et script)

### 4.1 Utilitaires, après `const TODAY` (l. 4007)

```js
// ── Blocage après trop d'essais (src/auth/lockout.js) ──
// Blocage après trop d'essais de code d'accès : mêmes règles sur le serveur (server/auth.mjs) et dans l'app sans
// serveur (écran de code, mode démo). État en JSON simple, pour être enregistré dans la sauvegarde locale.
// - 5 essais par minute et par origine (adresse IP sur le serveur, l'appareil dans l'app) ;
// - 10 échecs d'affilée, toutes origines confondues : blocage de 15 min, puis 30, 60… jusqu'à 24 h.
//   Un code juste remet le compteur et la durée à zéro.
const LOCKOUT = { PER_MIN: 5, FAILS: 10, BASE: 15 * 60_000, MAX: 24 * 3600_000 };

const freshGuard = () => ({ fails: 0, level: 0, until: 0, tries: {} });

// Essai demandé à l'instant `now` depuis l'origine `key`. Renvoie le nouvel état et, si l'essai est refusé,
// `blocked` = { until, global } (global : blocage progressif ; sinon limite par minute).
function admit(g = freshGuard(), now = Date.now(), key = '') {
  if (g.until > now) return { g, blocked: { until: g.until, global: true } };
  const tries = {};
  for (const [k, list] of Object.entries(g.tries || {})) { const recent = list.filter(t => now - t < 60_000); if (recent.length) tries[k] = recent; }
  const mine = tries[key] || [];
  if (mine.length >= LOCKOUT.PER_MIN) return { g: { ...g, tries }, blocked: { until: mine[0] + 60_000, global: false } };
  return { g: { ...g, tries: { ...tries, [key]: [...mine, now] } }, blocked: null };
}

function fail(g, now = Date.now()) {
  const fails = (g.fails || 0) + 1;
  if (fails < LOCKOUT.FAILS) return { ...g, fails };
  const level = g.level || 0;
  return { ...g, fails: 0, level: level + 1, until: now + Math.min(LOCKOUT.MAX, LOCKOUT.BASE * 2 ** level) };
}

const pass = g => ({ ...g, fails: 0, level: 0, until: 0 });

const hhmm = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const blockedMsg = b => b.global ? `Trop d’essais : accès bloqué jusqu’à ${hhmm(b.until)}` : 'Trop d’essais : patiente une minute';

// ── Codes d'accès (src/auth/code.js) ──
// Codes d'accès (Code patron, Codes salariés) côté app : 6 chiffres, jamais enregistrés en clair.
// L'empreinte (PBKDF2-SHA-256, sel aléatoire) évite seulement que le code s'affiche à qui lit le stockage du
// navigateur : 1 000 000 de combinaisons se parcourent vite. Le verrou ne protège pas les données (ADR 0001).
const CODE_LEN = 6;
const isCode = c => new RegExp(`^\\d{${CODE_LEN}}$`).test(String(c ?? ''));
// Codes trop évidents refusés pour le Code patron et jamais générés : 000000, 123456, 654321…
const weakCode = c => /^(\d)\1+$/.test(c) || '01234567890'.includes(c) || '09876543210'.includes(c);

const ITER = 120_000;
const enc = new TextEncoder();
const toB64 = u8 => btoa(String.fromCharCode(...u8));
const fromB64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));

async function derive(code, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(code)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}

async function hashCode(code) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${toB64(salt)}$${toB64(await derive(code, salt, ITER))}`;
}

async function verifyCode(code, stored) {
  const [kind, iter, salt, hash] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || !isCode(code)) return false;
  const a = await derive(code, fromB64(salt), +iter), b = fromB64(hash);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// Nouveau code aléatoire à 6 chiffres, ni évident ni déjà pris (`taken(code)` → Promise<boolean>).
async function newCode(taken = async () => false) {
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** CODE_LEN;
    const c = String(n).padStart(CODE_LEN, '0');
    if (!weakCode(c) && !(await taken(c))) return c;
  }
}
// ── Fin des utilitaires d'accès ──
```

### 4.2 `Component`

**a. État initial** : ajouter `locked: true, lkStep: 'login'` (par exemple à côté de `toast: ''`).

**b. `KEEP`** (l. 4040) : la liste du § 3.

**c. Chargement de la sauvegarde** (`componentDidMount`, l. 4058). Juste avant le `try`, marquer la
sauvegarde comme lue et le mode d'accès comme local (dans l'app, ces deux valeurs viennent de `usePersistence` et
du serveur) :

```js
    this.setState({ restored: true, authMode: this.state.authMode || 'local' });
```

Puis, dans le `try`, remplacer `this.setState({ ...d, savedAt: Date.now() });` par la migration et une reprise qui
ignore l'ancien `ownerCode` :

```js
      // Anciennes sauvegardes : codes salariés à 4 chiffres en clair désactivés (Code à renouveler). L'ancien
      // ownerCode n'est plus repris : l'écran de code demande un nouveau Code patron (ADR 0002).
      let d2 = d;
      if (d.rh && Array.isArray(d.rh.staff)) d2 = { ...d, rh: { ...d.rh, staff: d.rh.staff.map(({ pin, ...p }) => pin ? { ...p, pinRenew: true } : p) } };
      const { ownerCode, ...rest } = d2;
      this.setState({ ...rest, savedAt: Date.now() });
```

**d. Verrouillage automatique** (`componentDidMount`, après `setTimeout(() => this.initDrag(), 0);`, l. 4056) :

```js
    // Verrouillage automatique : après lockDelay minutes en arrière-plan (0 : dès que l'app passe en arrière-plan).
    this._vis = () => {
      const st = this.state, ms = (st.lockDelay ?? 5) * 60000;
      if (document.visibilityState === 'hidden') { this._hidAt = Date.now(); if (!ms && !st.locked) this.lock(); }
      else if (this._hidAt && !st.locked && Date.now() - this._hidAt >= ms) this.lock();
    };
    document.addEventListener('visibilitychange', this._vis);
```

Et dans `componentWillUnmount()` (l. 4105) :

```js
    document.removeEventListener('visibilitychange', this._vis); clearTimeout(this._lkT);
```

**e. Remplacer `lockVals()`** (l. 4269, jusqu'à `paVals(facs)` exclu) par :

```js
  // ── Écran de verrouillage (ADR 0001 et 0002) ──
  // Il protège l'usage de l'app, pas les données de l'appareil. Codes à 6 chiffres, jamais enregistrés en clair.
  // Étapes : login ; setup / setup2 (premier Code patron) ; old / new / new2 (changer le Code patron) ;
  // who (« C'est bien toi, Kévin ? »). Mode serveur : le serveur vérifie les codes (usePaBridge) ; sinon,
  // empreintes locales et blocage après trop d'essais enregistré dans la sauvegarde (src/auth/lockout.js).
  lock() { this.setState({ locked: true, lkChange: false, lkStep: 'login', lkCode: '', lkErr: '', lkTmp: '', lkOld: '', lkWho: null, lkBusy: false, role: null, rhEmp: null, rhPin: null }); }
  lkStepOf(s = this.state) { return s.locked && (s.lkStep || 'login') === 'login' && s.authMode === 'local' && !s.ownerHash ? 'setup' : s.lkStep || 'login'; }
  unlockAs(role, staffId) {
    if (role === 'staff') {
      const p = this.rhData().staff.find(x => x.id === staffId && x.kind !== 'dir');
      if (!p) { if (globalThis.btpPA && globalThis.btpPA.logout) globalThis.btpPA.logout().catch(() => {}); return this.setState({ lkCode: '', lkBusy: false, lkErr: 'Salarié inconnu sur cet appareil' }); }
      return this.setState({ lkStep: 'who', lkWho: p.id, lkCode: '', lkErr: '', lkBusy: false });
    }
    this.setState({ locked: false, lkChange: false, lkStep: 'login', lkCode: '', lkErr: '', lkTmp: '', lkOld: '', lkBusy: false, role: 'owner' });
  }
  lkBlocked(g, b) {
    this.setState({ lkGuard: g, lkBusy: false, lkCode: '', lkErr: blockedMsg(b), lkUntil: b.until });
    clearTimeout(this._lkT); this._lkT = setTimeout(() => { this._lkT = null; this.setState({ lkErr: '', lkUntil: 0 }); }, Math.min(2 ** 31 - 1, Math.max(0, b.until - Date.now())));
  }
  // Contrôle local d'un code, soumis au blocage : renvoie true si check(code) a réussi.
  async lkGuarded(check, errTxt) {
    const a = admit(this.state.lkGuard, Date.now());
    if (a.blocked) { this.lkBlocked(a.g, a.blocked); return false; }
    this.setState({ lkBusy: true, lkGuard: a.g });
    const ok = await check();
    if (ok) { this.setState({ lkGuard: pass(a.g), lkBusy: false }); return ok; }
    const g = fail(a.g, Date.now());
    if (g.until > Date.now()) this.lkBlocked(g, { until: g.until, global: true });
    else this.setState({ lkGuard: g, lkBusy: false, lkCode: '', lkErr: errTxt });
    return false;
  }
  async staffHas(c) { for (const p of this.rhData().staff) if (p.code && p.code.hash && await verifyCode(c, p.code.hash)) return p.id; return null; }
  async lkSubmit(c) {
    const s = this.state, step = this.lkStepOf(s), server = s.authMode === 'server';
    const again = (lkStep, lkErr) => this.setState({ lkStep, lkErr, lkCode: '', lkBusy: false });
    const done = () => ({ lkChange: false, lkStep: 'login', lkCode: '', lkErr: '', lkTmp: '', lkOld: '', lkBusy: false });
    if (step === 'login') {
      if (server) { if (!(globalThis.__btpLogin && globalThis.__btpLogin(c))) again('login', 'Serveur injoignable : réessaie'); return; }
      const who = await this.lkGuarded(async () => (await verifyCode(c, s.ownerHash)) ? { role: 'owner' } : ((id) => id && { role: 'staff', id })(await this.staffHas(c)), 'Code incorrect');
      if (who) this.unlockAs(who.role, who.id);
      return;
    }
    if (step === 'old') {
      if (server) return this.setState({ lkOld: c, lkStep: 'new', lkCode: '', lkErr: '' });
      if (await this.lkGuarded(() => verifyCode(c, s.ownerHash), 'Code patron actuel incorrect')) this.setState({ lkStep: 'new', lkCode: '', lkErr: '' });
      return;
    }
    if (step === 'setup' || step === 'new') {
      if (weakCode(c)) return again(step, 'Code trop évident : choisis-en un autre');
      return this.setState({ lkStep: step + '2', lkTmp: c, lkCode: '', lkErr: '' });
    }
    const first = step === 'setup2' ? 'setup' : 'new';
    if (c !== s.lkTmp) return again(first, 'Les deux codes ne correspondent pas : recommence');
    this.setState({ lkBusy: true });
    if (server) {
      const r = await (globalThis.__btpOwnerCode && globalThis.__btpOwnerCode(s.lkOld, c));
      if (!r || r.status !== 200) return again(r && (r.status === 401 || r.status === 429) ? 'old' : 'new', String((r && r.data && r.data.error) || 'Serveur injoignable : réessaie').replace(/\.$/, ''));
      this.setState(done()); return this.flash('Code patron changé. Les autres appareils devront le saisir.');
    }
    if (await this.staffHas(c)) return again(first, 'Ce code est déjà celui d’un salarié : choisis-en un autre');
    const ownerHash = await hashCode(c);
    if (step === 'setup2') { this.setState({ ownerHash }); this.unlockAs('owner'); return this.flash('Code patron enregistré'); }
    this.setState({ ownerHash, ...done() }); this.flash('Code patron changé');
  }
  lockVals() {
    const s = this.state;
    if (!s.locked && !s.lkChange) return { lk: { open: false, dots: [], keys: [], pad: false, who: false } };
    const step = this.lkStepOf(s), code = s.lkCode || '', now = Date.now(), pending = s.locked && (!s.authMode || !s.restored);
    const until = Math.max(s.lkUntil || 0, s.authMode === 'local' && s.lkGuard ? s.lkGuard.until || 0 : 0), wait = until > now;
    if (wait && !this._lkT) this._lkT = setTimeout(() => { this._lkT = null; this.setState({ lkErr: '', lkUntil: 0 }); }, Math.min(2 ** 31 - 1, until - now));
    const off = wait || pending || !!s.lkBusy;
    const who = step === 'who' ? this.rhData().staff.find(x => x.id === s.lkWho) : null, firstName = who ? who.nom.split(' ')[0] : '';
    const T = {
      login: ['Code d’accès', 'Patron ou salarié : saisis ton code à 6 chiffres'],
      setup: ['Choisis ton code patron', '6 chiffres, à garder pour toi : il ouvre toute l’app. Il protège l’accès à l’app, pas les données du téléphone.'],
      setup2: ['Confirme ton code patron', 'Saisis-le une seconde fois'],
      old: ['Changer le code patron', 'Saisis ton code actuel'],
      new: ['Nouveau code patron', '6 chiffres, ni 123456 ni 000000'],
      new2: ['Confirme le nouveau code', 'Saisis-le une seconde fois'],
      who: ['C’est bien toi, ' + firstName + ' ?', 'Ton écran de pointage va s’ouvrir.'],
    }[step] || ['Code d’accès', ''];
    const press = k => () => {
      if (off) return;
      if (k === 'del') return this.setState({ lkCode: code.slice(0, -1), lkErr: '' });
      const c = (code + k).slice(0, CODE_LEN); this.setState({ lkCode: c, lkErr: '' });
      if (c.length === CODE_LEN) setTimeout(() => this.lkSubmit(c), 120);
    };
    const yes = () => this.setState({ locked: false, lkStep: 'login', lkWho: null, lkCode: '', lkErr: '', role: 'staff', rhEmp: { who: s.lkWho, ch: 'filaos', h: 8, panier: true } });
    const no = () => { if (s.authMode === 'server' && globalThis.btpPA && globalThis.btpPA.logout) globalThis.btpPA.logout().catch(() => {}); this.lock(); };
    return { lk: { open: true, title: T[0], sub: pending ? 'Un instant…' : T[1], pad: step !== 'who', who: step === 'who', yes, no, yesTxt: 'Oui, c’est moi', noTxt: 'Non, ce n’est pas moi',
      cancel: s.lkChange && !s.locked, onCancel: () => this.setState({ lkChange: false, lkStep: 'login', lkCode: '', lkErr: '', lkTmp: '', lkOld: '' }),
      dots: Array.from({ length: CODE_LEN }, (_, i) => ({ bg: i < code.length ? 'var(--color-neutral-900)' : 'transparent' })),
      err: s.lkErr || (wait ? blockedMsg({ until, global: until - now > 60000 }) : ''), blocked: off, op: off ? 0.45 : 1,
      keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(k => ({ l: k === 'del' ? 'Effacer' : k, show: k !== '', blank: k === '', on: press(k), fs: k === 'del' ? '15px' : '26px', lbl: k === 'del' ? 'Effacer le dernier chiffre' : k })) } };
  }
  // Réglages → Code d'accès : délai de verrouillage automatique et changement du Code patron.
  lockSetVals() {
    const s = this.state, server = s.authMode === 'server', cur = s.lockDelay ?? 5;
    return { lockSet: {
      delayOpts: [[0, 'Immédiat'], [1, '1 min'], [5, '5 min'], [15, '15 min']].map(([v, l]) => { const a = cur === v; return { l, bg: a ? 'var(--color-neutral-900)' : 'transparent', fg: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-800)', onPick: () => this.setState({ lockDelay: v }) }; }),
      delayTxt: cur ? `Après ${cur} min en arrière-plan, l’app redemande le code` : 'Dès que l’app passe en arrière-plan, elle redemande le code',
      changeOff: server && !!s.offline, changeTxt: server && s.offline ? 'Connexion requise pour changer le code' : 'Changer le code patron',
      change: () => { if (server && s.offline) return; this.setState({ lkChange: true, lkStep: 'old', lkCode: '', lkErr: '', lkTmp: '', lkOld: '' }); },
      forgot: server ? 'Code patron oublié : l’hébergeur de l’app le réinitialise sur le serveur.' : 'Code patron oublié : sans serveur, il faut réinitialiser l’app, ce qui efface les données de cet appareil.',
    } };
  }
  // Codes salariés : générés au hasard, affichés une seule fois (rhPin, non enregistré), puis seule l'empreinte reste.
  async staffCode(id) {
    const p = this.rhData().staff.find(x => x.id === id); if (!p || p.kind === 'dir') return;
    if (this.state.authMode === 'server') {
      const r = await (globalThis.__btpStaffCode && globalThis.__btpStaffCode(id, p.nom));
      if (!r || r.status !== 200) return this.flash((r && r.data && r.data.error) || 'Serveur injoignable : réessaie');
      return this.setStaffCode(id, { srv: true, at: TODAY() }, r.data.code);
    }
    const code = await newCode(async c => (await verifyCode(c, this.state.ownerHash)) || !!(await this.staffHas(c)));
    this.setStaffCode(id, { hash: await hashCode(code), at: TODAY() }, code);
  }
  setStaffCode(id, rec, code) {
    this.setState(st => { const R = st.rh || this.rhData(); return { rh: { ...R, staff: R.staff.map(x => { if (x.id !== id) return x; const { pin, pinRenew, ...y } = x; return { ...y, code: rec }; }) }, rhPin: { id, code } }; });
  }
```

**f. Module Équipe**

- `rhData()` (l. 5500) : retirer `pin: '4821',` (Kévin) et `pin: '1937',` (Mathis). Les salariés de
  démo n'ont plus de code : la fiche propose « Créer son code ».
- Après `const setRh = …` (l. 5533), ajouter :
  ```js
    const codeOn = p => !!p.code && (s.authMode === 'server' ? !!p.code.srv : !!p.code.hash);
  ```
- Rappel de pointage (l. 5668) : `need: !ab && !!c && !pts.length && codeOn(p),`
- Écran salarié, bouton « Se déconnecter » (l. 5646) :
  `close: () => s.role === 'staff' ? this.lock() : this.setState({ rhEmp: null }),`
- « Ajouter un salarié » (l. 5676) : ne plus tirer de `pin` (`const app = …, id = 'p' + Date.now();`),
  retirer `pin,` de l'objet créé, et créer son code juste après :
  `this.setState({ rhAdd: null, rhOpen: id }, () => this.staffCode(id));`
- Fiche salarié (l. 5691) : remplacer `hasPin: !!p.pin, pin: p.pin,` et l'ancien `share` par :
  ```js
          canCode: p.kind !== 'dir', ...(() => { const shown = !!s.rhPin && s.rhPin.id === p.id, on = codeOn(p), had = !!(p.pinRenew || p.code);
            return { codeShown: shown, code: shown ? s.rhPin.code : '', codeOn: !shown && on, codeOff: !shown && !on, codeSince: p.code && p.code.at ? 'code actif depuis le ' + p.code.at : 'code actif',
              codeOffTxt: had ? 'Code à renouveler' : 'Aucun code d’accès', codeOffSub: had ? 'L’ancien code ne fonctionne plus.' : 'Crée son code pour qu’il pointe ses heures.', codeBtn: had ? 'Nouveau code' : 'Créer son code',
              newCode: () => this.staffCode(p.id), hideCode: () => this.setState({ rhPin: null }) }; })(),
          share: () => { if (!s.rhPin || s.rhPin.id !== p.id) return; this.draft({ title: 'Accès pointage · ' + first(p), channel: 'wa', body: `Bonjour ${first(p)},\n\nVoici ton accès pour pointer tes heures sur l’application de ${co.name} :\ncode personnel ${s.rhPin.code}\n\nTu ne vois que ton pointage : chantier, heures et panier.\n\n${co.name}` }); },
  ```

**g. `renderVals()`** (l. 6204) : remplacer
`lockNow: () => this.setState({ locked: true, lkCode: '', lkErr: '' }), ownerCode: this.state.ownerCode || '1974',`
par `...this.lockSetVals(), lockNow: () => this.lock(),`

## 5. Gabarit

### 5.1 Écran de code (l. 2951, bloc `<sc-if value="{{ lk.open }}">` entier)

```html
      <sc-if value="{{ lk.open }}" hint-placeholder-val="{{ false }}">
        <div role="dialog" aria-modal="true" aria-label="{{ lk.title }}" data-screen-label="Code d’accès" style="position:absolute;inset:0;z-index:40;background:var(--color-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:40px 28px;animation:btpIn .24s ease">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--color-accent-200);color:var(--color-accent-900);display:flex;align-items:center;justify-content:center"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="3"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;max-width:320px">
            <h1 style="margin:0;font-weight:400;font-family:var(--font-heading);font-size:26px;letter-spacing:-.01em">{{ lk.title }}</h1>
            <div style="font-size:14px;line-height:1.4;color:var(--color-neutral-700)">{{ lk.sub }}</div>
          </div>
          <sc-if value="{{ lk.pad }}" hint-placeholder-val="{{ true }}">
            <div style="display:flex;gap:12px" aria-hidden="true">
              <sc-for list="{{ lk.dots }}" as="o" hint-placeholder-count="6"><span style="width:16px;height:16px;border-radius:50%;border:2px solid var(--color-neutral-900);background:{{ o.bg }}"></span></sc-for>
            </div>
            <div style="min-height:22px;font-size:14px;font-weight:700;color:var(--color-accent-800);text-align:center" aria-live="polite">{{ lk.err }}</div>
            <div style="display:grid;grid-template-columns:repeat(3,72px);gap:14px;opacity:{{ lk.op }}">
              <sc-for list="{{ lk.keys }}" as="k" hint-placeholder-count="12">
                <sc-if value="{{ k.show }}" hint-placeholder-val="{{ true }}">
                  <button style-active="transform:scale(0.92)" onClick="{{ k.on }}" disabled="{{ lk.blocked }}" aria-label="{{ k.lbl }}" style="transition:transform .1s ease;width:72px;height:72px;border:none;border-radius:50%;background:var(--color-neutral-100);cursor:pointer;font:600 {{ k.fs }} var(--font-body);color:var(--color-text)">{{ k.l }}</button>
                </sc-if>
                <sc-if value="{{ k.blank }}" hint-placeholder-val="{{ false }}"><span></span></sc-if>
              </sc-for>
            </div>
          </sc-if>
          <sc-if value="{{ lk.who }}" hint-placeholder-val="{{ false }}">
            <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px">
              <button style-active="transform:scale(0.97)" onClick="{{ lk.yes }}" class="btn btn-primary" style="transition:transform .12s ease;min-height:52px;font-size:16px">{{ lk.yesTxt }}</button>
              <button style-active="transform:scale(0.97)" onClick="{{ lk.no }}" class="btn btn-secondary" style="transition:transform .12s ease;min-height:52px;font-size:16px;border-width:2px;border-color:var(--color-neutral-500)">{{ lk.noTxt }}</button>
            </div>
          </sc-if>
          <sc-if value="{{ lk.cancel }}" hint-placeholder-val="{{ false }}">
            <button onClick="{{ lk.onCancel }}" class="btn btn-ghost" style="min-height:44px;font-size:15px">Annuler</button>
          </sc-if>
        </div>
      </sc-if>
```

Titre en `<h1>` (§ 13.2 du retour dev), 6 points, pavé masqué à l'étape « C'est bien toi ? », « Annuler » pendant
le changement de code.

### 5.2 Réglages → Code d'accès (l. 2190, bloc `#set-lock` entier)

```html
            <div id="set-lock" style="background:var(--color-neutral-100);border-radius:28px;padding:16px 18px 14px;display:flex;flex-direction:column;gap:8px">
              <div style="font-family:var(--font-heading);font-size:20px;letter-spacing:-.01em;padding-bottom:4px">Code d’accès</div>
              <div style="font-size:14px;line-height:1.45;color:var(--color-neutral-800)">Le code patron ouvre toute l’app. Le code d’un salarié n’ouvre que son pointage et ses notes de frais : ni réglages de la plateforme, ni transmission.</div>
              <div style="font-size:14px;line-height:1.45;color:var(--color-neutral-800)">Le code protège l’accès à l’app, pas les données du téléphone : verrouille aussi ton téléphone.</div>
                <div style="display:flex;flex-direction:column;gap:8px;padding:8px 0 10px;border-top:1px solid var(--color-divider)">
                  <div><div style="font-size:15px;font-weight:600;padding-top:4px">Verrouillage automatique</div><div style="font-size:13px;color:var(--color-neutral-700)">{{ lockSet.delayTxt }}</div></div>
                  <div style="display:flex;background:var(--color-surface);border-radius:999px;padding:4px">
                    <sc-for list="{{ lockSet.delayOpts }}" as="o" hint-placeholder-count="4"><button onClick="{{ o.onPick }}" style="flex:1;min-height:40px;border:none;border-radius:999px;font:700 14px var(--font-body);cursor:pointer;background:{{ o.bg }};color:{{ o.fg }}">{{ o.l }}</button></sc-for>
                  </div>
                </div>
              <button style-active="transform:scale(0.97)" onClick="{{ lockSet.change }}" disabled="{{ lockSet.changeOff }}" class="btn btn-secondary" style="transition:transform .12s ease;min-height:48px;font-size:15px;border-width:2px;border-color:var(--color-neutral-500)">{{ lockSet.changeTxt }}</button>
              <button style-active="transform:scale(0.97)" onClick="{{ lockNow }}" class="btn btn-secondary" style="transition:transform .12s ease;min-height:48px;font-size:15px;border-width:2px;border-color:var(--color-neutral-500)">Verrouiller maintenant</button>
              <div style="font-size:13px;line-height:1.4;color:var(--color-neutral-700)">{{ lockSet.forgot }}</div>
            </div>
```

La ligne « Code patron (démo) » disparaît.

### 5.3 Fiche salarié → Accès pointage (l. 758, bloc `<sc-if value="{{ p.hasPin }}">` entier)

```html
                    <sc-if value="{{ p.canCode }}" hint-placeholder-val="{{ false }}">
                      <div style="display:flex;flex-direction:column;gap:8px;border-radius:18px;background:var(--color-accent-2-200);color:var(--color-accent-2-900);padding:12px 14px">
                        <sc-if value="{{ p.codeShown }}" hint-placeholder-val="{{ false }}">
                          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span style="font-size:14px;font-weight:800">Nouveau code</span><span style="font:800 18px ui-monospace,Menlo,monospace;letter-spacing:.15em">{{ p.code }}</span></div>
                          <div style="font-size:13px;line-height:1.4">Envoie-le maintenant : il ne sera plus affiché. L’ancien code ne fonctionne plus.</div>
                          <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <button onClick="{{ p.share }}" class="btn btn-primary" style="flex:1;min-height:44px;font-size:14px">Envoyer par WhatsApp</button>
                            <button onClick="{{ p.hideCode }}" class="btn btn-secondary" style="flex:1;min-height:44px;font-size:14px;border-width:2px;border-color:var(--color-accent-2-700);color:var(--color-accent-2-900)">C’est noté</button>
                          </div>
                        </sc-if>
                        <sc-if value="{{ p.codeOn }}" hint-placeholder-val="{{ false }}">
                          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span style="font-size:14px;font-weight:800">Accès pointage</span><span style="font-size:13px;font-weight:700">{{ p.codeSince }}</span></div>
                          <div style="font-size:13px;line-height:1.4">Ne voit que son pointage : chantier, heures, panier. Aucun prix ni devis.</div>
                          <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <button onClick="{{ p.newCode }}" class="btn btn-primary" style="flex:1;min-height:44px;font-size:14px">Nouveau code</button>
                            <button onClick="{{ p.preview }}" class="btn btn-secondary" style="flex:1;min-height:44px;font-size:14px;border-width:2px;border-color:var(--color-accent-2-700);color:var(--color-accent-2-900)">Voir son écran</button>
                          </div>
                        </sc-if>
                        <sc-if value="{{ p.codeOff }}" hint-placeholder-val="{{ false }}">
                          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span style="font-size:14px;font-weight:800">{{ p.codeOffTxt }}</span></div>
                          <div style="font-size:13px;line-height:1.4">{{ p.codeOffSub }}</div>
                          <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <button onClick="{{ p.newCode }}" class="btn btn-primary" style="flex:1;min-height:44px;font-size:14px">{{ p.codeBtn }}</button>
                            <button onClick="{{ p.preview }}" class="btn btn-secondary" style="flex:1;min-height:44px;font-size:14px;border-width:2px;border-color:var(--color-accent-2-700);color:var(--color-accent-2-900)">Voir son écran</button>
                          </div>
                        </sc-if>
                      </div>
                    </sc-if>
```

Trois états : **code affiché une fois** (« Envoyer par WhatsApp », « C'est noté »), **code actif** (« code actif
depuis le JJ/MM/AAAA », « Nouveau code »), **sans code** (« Aucun code d'accès » / « Créer son code », ou après
migration « Code à renouveler » / « Nouveau code »). Le dirigeant n'a pas de carte.

## 6. Textes (à relire)

- Écran de code : « Code d'accès » · « Patron ou salarié : saisis ton code à 6 chiffres » · « Un instant… »
- Premier code : « Choisis ton code patron » · « 6 chiffres, à garder pour toi : il ouvre toute l'app. Il protège
  l'accès à l'app, pas les données du téléphone. » · « Confirme ton code patron » · « Saisis-le une seconde fois »
- Changement : « Changer le code patron » · « Saisis ton code actuel » · « Nouveau code patron » · « 6 chiffres, ni
  123456 ni 000000 » · « Confirme le nouveau code » · « Annuler »
- Salarié : « C'est bien toi, Kévin ? » · « Ton écran de pointage va s'ouvrir. » · « Oui, c'est moi » · « Non, ce
  n'est pas moi »
- Erreurs : « Code incorrect » · « Code patron actuel incorrect » · « Code trop évident : choisis-en un autre » ·
  « Les deux codes ne correspondent pas : recommence » · « Ce code est déjà celui d'un salarié : choisis-en un autre »
  · « Trop d'essais : patiente une minute » · « Trop d'essais : accès bloqué jusqu'à hh:mm » · « Serveur injoignable :
  réessaie » · « Salarié inconnu sur cet appareil »
- Toasts : « Code patron enregistré » · « Code patron changé » · « Code patron changé. Les autres appareils devront
  le saisir. »
- Réglages : « Le code protège l'accès à l'app, pas les données du téléphone : verrouille aussi ton téléphone. » ·
  « Verrouillage automatique » · « Après 5 min en arrière-plan, l'app redemande le code » · « Dès que l'app passe en
  arrière-plan, elle redemande le code » · « Changer le code patron » · « Connexion requise pour changer le code » ·
  « Code patron oublié : sans serveur, il faut réinitialiser l'app, ce qui efface les données de cet appareil. » ·
  « Code patron oublié : l'hébergeur de l'app le réinitialise sur le serveur. »
- Fiche salarié : « Nouveau code » · « Envoie-le maintenant : il ne sera plus affiché. L'ancien code ne fonctionne
  plus. » · « Envoyer par WhatsApp » · « C'est noté » · « Accès pointage » · « code actif depuis le JJ/MM/AAAA » ·
  « Aucun code d'accès » · « Crée son code pour qu'il pointe ses heures. » · « Créer son code » · « Code à
  renouveler » · « L'ancien code ne fonctionne plus. »

## 7. Branchements côté app (pour information, déjà faits)

Le prototype fonctionne seul (mode `local`). Dans l'app, avec un serveur, ces crochets prennent la main :

| Prototype | Dans l'app |
| --- | --- |
| `authMode`, `restored` | posés par `usePaBridge` (config du serveur) et `usePersistence` ; tant qu'ils manquent : « Un instant… » |
| `globalThis.__btpLogin(code)` | `POST /api/session` ; le serveur répond `{ role, staffId }` puis appelle `unlockAs()` |
| `globalThis.__btpOwnerCode(old, code)` | `POST /api/session/owner-code` ; ferme les autres sessions |
| `globalThis.__btpStaffCode(id, nom)` | `POST /api/session/staff-code` ; le serveur génère le code (`code.srv`) et ferme les sessions du salarié |
| `lock()` | ferme aussi la session du serveur (`btpPA.logout()`) |

`scripts/import-handoff.py` est déjà adapté à cette version. À l'import, il remplace les utilitaires du § 4.1 par
`src/auth/` et retire la ligne `restored / authMode` du § 4.2 c. Il reprend aussi la migration dans `restore()`.
Contrôle fait : la fiche appliquée au prototype v15.2, puis importée, redonne l'app actuelle à l'identique (aux
espaces près). Un prototype qui n'a pas reçu cette mise à jour ne s'importe plus : le script s'arrête sur
« utilitaires d'accès ».

## 8. Tests à passer

- [ ] Premier lancement (sauvegarde vide) : « Choisis ton code patron » ; 123456 refusé ; deux saisies différentes →
      « Les deux codes ne correspondent pas » ; 582916 deux fois → app ouverte, toast « Code patron enregistré ».
- [ ] La sauvegarde (`localStorage`, clé `btp974-mobile-v1`) ne contient ni le code patron ni aucun code salarié.
- [ ] Recharger la page → écran « Code d'accès » ; mauvais code → « Code incorrect » ; bon code → app ouverte.
- [ ] 10 mauvais codes (en respectant 5 par minute) → « Trop d'essais : accès bloqué jusqu'à hh:mm » ; recharger →
      toujours bloqué, pavé grisé.
- [ ] Équipe → Kévin → « Créer son code » → code à 6 chiffres affiché, « Envoyer par WhatsApp » ouvre l'aperçu avec
      ce code ; « C'est noté » → « code actif depuis le … » ; le code n'est plus visible nulle part.
- [ ] « Verrouiller maintenant » → code de Kévin → « C'est bien toi, Kévin ? » ; « Non » → retour au pavé ; « Oui »
      → son écran de pointage ; « Se déconnecter » → écran de code.
- [ ] « Nouveau code » pour Kévin → l'ancien code donne « Code incorrect ».
- [ ] Réglages → « Changer le code patron » : mauvais code actuel → « Code patron actuel incorrect » ; « Annuler »
      referme ; parcours complet → toast « Code patron changé », l'ancien code ne marche plus.
- [ ] Verrouillage automatique « Immédiat » : passer sur un autre onglet puis revenir → écran de code. « 5 min » :
      revenir avant 5 min → pas d'écran de code.
- [ ] Ancienne sauvegarde v15.2 (avec `ownerCode: '1974'` et des `pin`) : « Choisis ton code patron » ; 1974 n'existe
      plus ; Kévin et Mathis affichent « Code à renouveler ».
- [ ] Ajouter un salarié → son code s'affiche aussitôt (une fois).
