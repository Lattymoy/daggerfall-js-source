// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD-INSURE (2026-10-26, the owner: "being able to insure gear on death"; asked, "Kept, policy spent" at "20% of worth")
// - THE CHARACTER'S POLICIES, AS THIS GAME HOLDS THEM (bible/11-Multiplayer/Wild-Zone.md section 4b).
//
// The account service keeps the policies (server-account/src/wildInsure.js) and spends them (wild.js wildFall); this book
// is the game's read of them and its door to write one. A policy is written as a realm act (systems/realmSaves.js
// realmGoldAct, as the Firmament's respec pays): the purse checkpointed and the premium reserved out of the wallet first,
// a refusal giving back exactly what it took (net/realm/realmGoldLaw.js walletReserve). Insuring is refused inside an open
// PvP zone (`inZone`) - the policy written there would not be in force for the fight it was written in, and the game
// says so before it takes a coin - and offline, where there is no realm record to pay from.
//
// The book answers three readers: the pack's card and menu (ui/enhanced/enhancedInventory.js - the policy's line and the
// Insure act, through the registry below), the first dead frame (scenes/world.js wildDeathBegin - the worn offer leaves out
// what a policy keeps, as the service's own offer does: wildDropLaw.js wornOffer), and the drop's answer (scenes/
// wildDropHost.js - the keys the policies kept, spent here as on the service).
// ═══════════════════════════════════════════════════════════════════
import { ledgerKeyOf } from '../../systems/item/itemIds.js';
import { walletReserve } from '../realm/realmGoldLaw.js';
import { wildInsurable, wildInsuredBy, wildPremium, WILD_INSURE_MAX, WILD_INSURE_SETTLE_S } from '../../systems/wild/wildInsureLaw.js';
import { WILD_TEXT } from '../../systems/wild/wildZone.js';
import { REFUSALS } from '../accountClient.js';

/** How long a read of the policies stands before the card asks again (another device may have written one). */
export const WILD_POLICIES_STALE_MS = 10 * 60_000;

/** @typedef {{ key: string, premium: number, at: number, live: number }} WildPolicy */

/**
 * @param {{ door: { insure?: (body: any) => Promise<any>, policies?: (body: any) => Promise<any> } | null,
 *   realm: { act: (o: any) => Promise<any> } | null, wallet: ((region: number) => any) | null,
 *   character: () => string | null, region?: () => number, inZone?: () => boolean,
 *   now?: () => number }} o
 */
export function createWildInsureBook({ door, realm, wallet, character, region = () => 0, inZone = () => false, now = () => Date.now() }) {
  /** @type {Map<string, WildPolicy>} */
  const policies = new Map();
  let readFor = /** @type {string | null} */ (null), readAt = -Infinity, reading = /** @type {Promise<void> | null} */ (null);
  let busy = false;
  const listeners = new Set();
  const tell = () => { for (const fn of listeners) { try { fn(); } catch { /* a listener is not the book's problem */ } } };
  const take = (/** @type {any[]} */ list) => {
    for (const p of Array.isArray(list) ? list : []) {
      if (p && typeof p.key === 'string' && Number.isSafeInteger(p.at)) policies.set(p.key, { key: p.key, premium: Number(p.premium) || 0, at: p.at, live: Number.isSafeInteger(p.live) ? p.live : p.at + WILD_INSURE_SETTLE_S });
    }
  };
  const book = {
    /** The policies in force for this character, asked of the service - once a character, and again when stale. */
    read() {
      const who = character();
      if (!who || typeof door?.policies !== 'function') return Promise.resolve();
      if (reading && readFor === who) return reading;
      if (who !== readFor) { policies.clear(); readFor = who; }
      readAt = now();
      reading = door.policies({ character: who }).then((r) => {
        if (readFor !== who || !r?.ok) return;
        policies.clear();
        take(r.data?.policies);
        tell();
      }).catch(() => { /* unread: the service's answer at the fall is the truth */ }).finally(() => { reading = null; });
      return reading;
    },
    /** Read again when the character changed or the last read is stale. */
    fresh() { if (character() !== readFor || now() - readAt > WILD_POLICIES_STALE_MS) book.read(); },
    /** The policy on `item`, or null. @param {any} item */
    policyOf(item) { const k = ledgerKeyOf(item); return k != null ? policies.get(k) ?? null : null; },
    /** THE OFFER'S PREDICATE: a piece whose policy is in force now (the first dead frame's worn offer leaves it out). */
    insured() { const t = Math.floor(now() / 1000); return wildInsuredBy([...policies.values()].filter((p) => p.live <= t).map((p) => p.key)); },
    /** The card's line for `item`: insured and in force, insured and soon in force (its minutes), or null. @param {any} item */
    lineOf(item) {
      const p = book.policyOf(item);
      if (!p) return null;
      const left = p.live - Math.floor(now() / 1000);
      return left > 0 ? WILD_TEXT.insuredSoon(Math.ceil(left / 60)) : WILD_TEXT.insuredLine();
    },
    /** The premium a policy on `item` costs. @param {any} item */
    premiumOf: (item) => wildPremium(item),
    /** Whether the pack's card offers Insure for `item` at all: online with a realm record, insurable, not insured. */
    offers(/** @type {any} */ item) { return !!realm && !!wallet && !!character() && wildInsurable(item) && !book.policyOf(item); },
    /** Why `item` cannot be insured now - the words said - or null. @param {any} item */
    refusal(item) {
      if (!realm || !wallet || !character()) return WILD_TEXT.insureOffline();
      if (!wildInsurable(item)) return REFUSALS['insure-piece'];
      if (book.policyOf(item)) return REFUSALS['insure-held'];
      if (inZone()) return WILD_TEXT.insureInZone();
      if (policies.size >= WILD_INSURE_MAX) return REFUSALS['insure-full'];
      if (busy) return REFUSALS.busy;
      const w = wallet(region());
      if (w.gold() < wildPremium(item)) return REFUSALS['realm-gold'];
      return null;
    },
    /** INSURE `item`: the premium paid off the record and the policy written, one act. Answers `{ ok, text }` - the words to
     *  say either way. @param {any} item */
    async insure(item) {
      const no = book.refusal(item);
      if (no) return { ok: false, text: no };
      const key = /** @type {string} */ (ledgerKeyOf(item)), gold = wildPremium(item), at = region();
      const w = /** @type {any} */ (wallet)(at);
      busy = true;
      let r;
      try {
        r = await /** @type {any} */ (realm).act({ reserve: walletReserve(w, gold).reserve, call: (/** @type {any} */ where) => /** @type {any} */ (door).insure({ realm: where, keys: [key], region: at }) });
      } finally { busy = false; }
      if (!r?.ok) return { ok: false, text: REFUSALS[r?.error] ?? REFUSALS.server };
      take(r.data?.policies);
      tell();
      return { ok: true, text: WILD_TEXT.insureDone(gold) };
    },
    /** THE FALL'S ANSWER: the keys its policies kept (server-account/src/wild.js `insured`) - spent there, forgotten here.
     *  Answers how many. @param {unknown} keys */
    spent(keys) {
      const list = Array.isArray(keys) ? keys.filter((k) => typeof k === 'string') : [];
      for (const k of list) policies.delete(k);
      if (list.length) tell();
      return list.length;
    },
    /** @param {() => void} fn */
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return book;
}

/** THE PAGE'S BOOK, for the pack's card and menu (the Firmament's registry's way): set by the world host online, null
 *  elsewhere - and with none the card offers nothing. */
let _book = /** @type {ReturnType<typeof createWildInsureBook> | null} */ (null);
export const setWildInsureBook = (/** @type {ReturnType<typeof createWildInsureBook> | null} */ b) => { _book = b; };
export const wildInsureBook = () => _book;
