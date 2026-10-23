// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - a ship wrecked
// and boarded, her hold a prize; bible/03-World/Eltheric-Ocean.md SHIP-PVP) - A WRECK'S SERVICE HALF on the page: the
// receipt the relay signed (net/wild/wildReceipt.js `n1`, handed here by scenes/naval/seaBroadsides.js) carried to the
// account service (server-account/src/seaWreck.js, net/accountClient.js accountSeaWreck). Built by the sea's host
// (scenes/seaVenturesHost.js).
//
//   HER CAPTAIN'S (the receipt's `f` mine): carried at once, a record act (systems/realmSaves.js realmGoldAct - where my
//     record stands, checkpointed first, and only over a checkpoint that went); boarded, the pieces the prize took come
//     back, by their marks, and her game takes the same out of her hold (navalHost.js pvp.takeHold) - said (a tab that
//     joined her record since is told none: it holds none of them).
//   HER KILLER'S (`k` mine): boarded or not - a wreck is a kill at sea - carried a moment after it is signed and again
//     until the service answers it: her own carry's answer, or past her grace (SEA_WRECK_GRACE_S) the prize taken itself;
//     then, boarded, the prizes held for my character collected into my record and my pack, said. A prize left uncollected
//     here stands on a freeport's board (seaBountyHost.js), its press the same collect.
//   Both asked again while the answer says nothing of the wreck (SEA_WRECK_TRANSIENT), until the receipt expires, and
//     kept in the page's storage across a reload (SEA_WRECK_KEPT_KEY).
//
// deps = {
//   session                 the realm session (world.js realmSession)
//   checkpoint()            the record checkpointed (world.js onlineCheckpoint)
//   character() -> id       my realm character
//   me() -> account | null  my account (online.js `acct`)
//   naval() -> host | null  the naval host (pvp.takeHold)
//   door?                   the service's door (accountSeaWreck) - its own, when none is given
//   storage?                where the owed carries are kept (systems/appStorage.js) - its own, when none is given
//   say(text, s)
//   now?() -> ms            this machine's clock
// }
// ═══════════════════════════════════════════════════════════════════
import { accountSeaWreck } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';
import { realmGoldAct } from '../systems/realmSaves.js';
import { readSeaWreck } from '../net/wild/wildReceipt.js';
import { openSeaHold } from '../systems/naval/seaHoldGuard.js';
import { addItem } from '../systems/inventory.js';
import { playerEntity } from '../characters/playerEntity.js';
import { t } from '../systems/textManager.js';

/** A killer's tab first asks for its wreck this long after it is signed, s - her captain's own carry first; the service
 *  answers her carry's answer the moment it stands, else her grace (SEA_WRECK_GRACE_S). */
export const SEA_WRECK_SLACK_S = 5;
/** A killer's carry asked again this often while the service cannot answer it yet (ms) - until its receipt expires. */
export const SEA_WRECK_RETRY_MS = 15_000;
/** Her captain's carry asked again this often while it cannot be (ms) - a checkpoint refused, the session busy. */
export const SEA_WRECK_CAPTAIN_RETRY_MS = 2_000;
/** AUDIT SEA VENTURES E3, B7: the answers that say nothing of the wreck - asked again: her grace, the session holding
 *  another act or a save not yet landed, the service down or busy, a record that moved under a seize, a key not stood. */
export const SEA_WRECK_TRANSIENT = Object.freeze(['grace', 'busy', 'offline', 'server', 'rate', 'seq', 'no-signing-key', 'no-gate-key']);
/** AUDIT SEA VENTURES E2: the carries owed, kept in the page's storage across a reload - the most kept. */
export const SEA_WRECK_KEPT_KEY = 'dfo.sea.wrecksDue';
export const SEA_WRECK_KEPT_MAX = 16;

/**
 * MY PRIZES COLLECTED: every piece the service holds for my character from wrecks I boarded, into my record (a record
 * act) and my pack, said - the board's press and the killer's own carry. Answers the act's outcome.
 * @param {{ session: any, checkpoint: () => void, character: () => string, door: any, say?: (text: string, s?: number) => void }} o
 */
export function collectSeaPrizes({ session, checkpoint, character, door, say }) {
  return realmGoldAct({
    session, checkpoint: () => checkpoint(), needsAnswer: true,
    call: (/** @type {any} */ at) => door.collect({ character: character(), realm: at }),
    apply: (/** @type {any} */ a) => {
      const items = Array.isArray(a?.data?.items) ? a.data.items : [];
      for (const it of items) addItem((playerEntity.items ??= []), it);
      if (items.length) say?.(t('sea.pvp.prizeTaken', 'Plunder from a wreck\'s hold is in your pack: {n, plural, one {# piece} other {# pieces}}.', { n: items.length }), 5);
    },
  });
}

/**
 * MY HOLD'S GOODS BACK: every piece of my hold a killer of mine left the service holding past SEA_PRIZE_HOLD_S, into my
 * record (a record act) and my pack, said - the board's press.
 * @param {{ session: any, checkpoint: () => void, character: () => string, door: any, say?: (text: string, s?: number) => void }} o
 */
export function reclaimSeaPrizes({ session, checkpoint, character, door, say }) {
  return realmGoldAct({
    session, checkpoint: () => checkpoint(), needsAnswer: true,
    call: (/** @type {any} */ at) => door.reclaim({ character: character(), realm: at }),
    apply: (/** @type {any} */ a) => {
      const items = Array.isArray(a?.data?.items) ? a.data.items : [];
      for (const it of items) addItem((playerEntity.items ??= []), it);
      if (items.length) say?.(t('sea.pvp.holdBack', 'Goods your killer never collected are back in your pack: {n, plural, one {# piece} other {# pieces}}.', { n: items.length }), 5);
    },
  });
}

/** @param {any} deps */
export function createSeaWreckHost(deps) {
  const now = () => Number(deps.now?.()) || Date.now();
  let door = deps.door ?? null;
  const doorNow = () => (door ??= accountSeaWreck({ fetch: (u, i) => globalThis.fetch(u, i), storage: appStorage() }));
  const storage = () => { try { return deps.storage ?? appStorage(); } catch { return null; } };
  const seen = new Set();      // wrecks owed here, or carried
  const due = new Map();       // r -> { rc, c, role, at, busy } - my wrecks to carry: her captain's, her killer's
  let restoredFor = null;
  const say = (/** @type {string} */ text, s = 5) => deps.say?.(text, s);

  /** The carries owed, kept in the page's storage (AUDIT SEA VENTURES E2: a reload lost them). */
  const keep = () => { try { storage()?.setItem(SEA_WRECK_KEPT_KEY, JSON.stringify([...due.values()].map((w) => w.rc))); } catch { /* storage refused: kept by this page alone */ } };
  /** A RECEIPT OWED BY ME: her captain's carried at once, her killer's past her grace (`live` - just signed; restored from
   *  storage, asked at once and the service says its grace). Answers whether it is mine and new. */
  function owe(/** @type {string} */ rc, /** @type {any} */ c, /** @type {string} */ me, live = false) {
    const role = c.f === me ? 'captain' : c.k === me ? 'killer' : null;
    if (!role || seen.has(c.r) || now() / 1000 >= c.e) return false;
    seen.add(c.r);
    if (seen.size > 64) seen.delete(seen.values().next().value);
    due.set(c.r, { rc, c, role, at: role === 'killer' && live ? now() + SEA_WRECK_SLACK_S * 1000 : now(), busy: false });
    while (due.size > SEA_WRECK_KEPT_MAX) due.delete(due.keys().next().value);
    return true;
  }
  /** The carries a reload left owed, read back once for my account. */
  function restore(/** @type {string} */ me) {
    if (restoredFor === me) return;
    restoredFor = me;
    let list = [];
    try { list = JSON.parse(storage()?.getItem(SEA_WRECK_KEPT_KEY) ?? '[]'); } catch { list = []; }
    for (const rc of Array.isArray(list) ? list : []) { const c = typeof rc === 'string' ? readSeaWreck(rc) : null; if (c) owe(rc, c, me); }
  }
  /** HER CAPTAIN'S CARRY: a record act, its prize's pieces out of her hold, said. AUDIT SEA VENTURES E4: only over a
   *  checkpoint that went - a refused one (a duel, the death screen) left the service's record behind her game, the prize
   *  taken off a hold she had already emptied, and the piece kept in her pack as well: answered 'busy' unasked. */
  function asCaptain(/** @type {any} */ w) {
    let stood = false;
    return realmGoldAct({
      session: deps.session, needsAnswer: true,
      checkpoint: () => { stood = deps.checkpoint?.() !== false; },
      call: (/** @type {any} */ at) => (stood ? doorNow().wreck({ receipt: w.rc, realm: at }) : Promise.resolve({ ok: false, error: 'busy' })),
      apply: (/** @type {any} */ a) => {
        const d = a?.data ?? {};
        const took = Array.isArray(d.took) ? d.took : [];
        const out = took.length ? deps.naval?.()?.pvp?.takeHold?.(w.c.u, took) ?? [] : [];
        const n = out.length || Math.max(0, Math.floor(Number(d.n) || 0));   // her record already without them: still said
        if (n) say(t('sea.pvp.holdTaken', 'Your wreck was boarded and her hold plundered: {n, plural, one {# piece} other {# pieces}} taken.', { n }), 6);
        else if (w.c.b === 1) say(t('sea.pvp.holdSpared', 'Your wreck was boarded, but nothing in her hold was worth the taking.'), 5);
      },
    });
  }
  /** HER KILLER'S CARRY: the wreck - boarded or not, a kill at sea (AUDIT SEA VENTURES E2: an unboarded wreck was hers
   *  alone to carry) - and, boarded, my prizes collected. */
  async function asKiller(/** @type {any} */ w) {
    const res = await doorNow().wreck({ receipt: w.rc });
    if (res?.ok && w.c.b === 1) await collectSeaPrizes({ session: deps.session, checkpoint: () => deps.checkpoint?.(), character: () => deps.character?.(), door: doorNow(), say: (x, s) => say(x, s) });
    return res;
  }
  /** A carry settled - landed, refused for good, or its receipt expired: forgotten, and her hold (her captain's) open
   *  again (systems/naval/seaHoldGuard.js - AUDIT SEA VENTURES B3). */
  function settled(/** @type {string} */ r, /** @type {any} */ w) {
    due.delete(r);
    keep();
    if (w.role === 'captain') openSeaHold(w.c.u);
  }
  /** A WRECK'S SIGNED RECEIPT (seaBroadsides.js hear's `wc`): mine, kept to carry. */
  function receipt(/** @type {unknown} */ rc) {
    const c = readSeaWreck(rc), me = deps.me?.() ?? null;
    if (!c || !me) return;
    restore(me);
    if (!owe(/** @type {string} */ (rc), c, me, true)) return;
    if (c.k === me && c.b !== 1) say(t('sea.pvp.notBoarded', 'You did not board her in time. Her hold stays her captain\'s.'), 5);
    keep();
  }
  /** THE FRAME (the sea's host's guns' step): each carry come due asked - again its wait on while the answer says nothing
   *  of the wreck (SEA_WRECK_TRANSIENT - AUDIT SEA VENTURES E3, B7), until the receipt expires. */
  function frame() {
    const me = deps.me?.() ?? null;
    if (me) restore(me);
    if (!due.size || !deps.session || deps.session.lost) return;
    const at = now();
    for (const [r, w] of due) {
      if (w.busy || at < w.at) continue;
      if (at / 1000 >= w.c.e) { settled(r, w); continue; }
      w.busy = true;
      (w.role === 'captain' ? asCaptain(w) : asKiller(w)).then((/** @type {any} */ res) => {
        if (res?.ok || res?.unknown || !SEA_WRECK_TRANSIENT.includes(res?.error)) { settled(r, w); return; }
        w.at = now() + (w.role === 'captain' ? SEA_WRECK_CAPTAIN_RETRY_MS : SEA_WRECK_RETRY_MS);
      }).catch((e) => { console.warn('[sea] the wreck failed', e?.message ?? e); w.at = now() + SEA_WRECK_RETRY_MS; }).finally(() => { w.busy = false; });
    }
  }
  return { receipt, frame };
}
