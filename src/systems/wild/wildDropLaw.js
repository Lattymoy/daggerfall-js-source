// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07) - A DEATH IN THE OPEN ZONE: WHAT STAYS, WHAT DROPS, WHAT A KILLER MAY TAKE - THE LAW
// (bible/11-Multiplayer/Wild-Zone.md; systems/wild/wildDeath.js says the owner's words and re-exports every member here).
//
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md): ITS HOME SINCE, A LEAF THE ACCOUNT
// WORKER BUNDLES. A death in the zone drops what the ACCOUNT SERVICE takes off the fallen character's judged record
// (server-account/src/wild.js), never what the fallen's own game hands over - so the drop, the purse's share and the
// killer's worn piece are one law at both ends: the fallen's game takes the same out of its own pack as the service takes
// out of the record, and only the service's list is ever deposited. Every import a leaf the Worker already reads (the
// trade's refusals over plain data - net/realm/realmTradeLaw.js tradeableRecord, the pack's own refusal's law - never the
// pack's module).
//
// STORE-KEEPS (2026-10-26, the owner: "Make it where you cant lose your wagon/horse or anything stored on death"; asked,
// "Wagon + companions' packs"): A DEATH TAKES THE BAG ALONE. The wagon's cargo and every companion's pack and kit are
// storage, and no death in the zone takes storage - neither a piece nor a share of its coin, wherever the wagon stands
// and whoever stands at the side. So the take reads `items` and the purse, and nothing else (CART-AWAY's word and
// COMPANION-DROP's packs retired with it); wildTakeTook still takes out of any list a take names, for an answer from
// before the word asked again (server-account/src/wild.js answers a fall its first take).
// ═══════════════════════════════════════════════════════════════════
import { isPotion, isLightSource, TEMPLATES } from '../item/itemKinds.js';
import { isSurvivalItem } from '../survival/items.js';
import { isFood, isWaterskin } from '../survival/food.js';
import { isRestItem } from '../rest/restItemRows.js';
import { isAmmunition } from '../item/itemTemplates.js';
import { BANDAGE_TEMPLATE } from '../roleplayRealismItems/rriRealism.js';
import { isEquipped } from '../equip.js';
import { DECOR_OWN_KEPT_BACK } from '../../net/decorLaw.js';
import { WILD_ITEMS_MAX } from '../../net/wire.js';
import { remainsFit, recordFits } from '../../net/wild/wildLaw.js'; // INT9: one remains' bound, the room's own
import { RECEIVER_MARKS, tradeableRecord } from '../../net/realm/realmTradeLaw.js';
import { liquidWorthOf, NAVAL_VENDOR, REVENANT_VENDOR } from '../../net/realm/realmGoldLaw.js'; // INT9 (AUDIT): a letter's worth, the judge's wealth's own; COMPANION-DROP: where a save keeps the companions
import { goldStack } from '../inventory.js';
import { isWalletItem, walletHolds } from '../walletItem.js'; // KEEP-WALLET
import { classicPiece, itemWorth } from '../item/itemLaw.js'; // INT9: a classic save's piece stays its character's
import { ledgerKeyOf } from '../item/itemIds.js'; // AUDIT PVP-EASE L1-3: a policy names its piece by the ledger's key

// The groups no death in the zone ever drops: a leaf of their own (wildLeaf.js), re-exported for the drop's readers.
import { WILD_NEVER_GROUPS } from './wildLeaf.js';
export { WILD_NEVER_GROUPS };

/** "except campfires, torches, potions etc" - is this a consumable the fallen keep? */
export function keptOnWildDeath(item) {
  if (!item) return true;
  return (
    isPotion(item) ||
    isLightSource(item) ||
    isSurvivalItem(item) ||
    isFood(item) ||
    isWaterskin(item) ||
    isRestItem(item) ||
    isAmmunition(item) ||
    (item.group === 'UselessItems2' && item.templateIndex === BANDAGE_TEMPLATE)
  );
}

/** May this piece leave its owner at a death in the zone at all? Worn or not - the trade's own refusals over a copy
 *  that is not worn (its `isEquipped` arm is the only one that asks where the piece is), and the kept-back list. */
export function wildCanLose(item) {
  if (!item || keptOnWildDeath(item)) return false;
  // LETTERS-DROP (the owner: "letter of credits should be dropped"): a letter of credit is the one piece of the wallet's
  // that a death in the zone takes, as a coin of the purse is - the Embers and the Shards stay
  if (item.group === 'MiscItems' && item.templateIndex === TEMPLATES.Letter_of_credit && !item.questItem)
    return tradeableRecord({ ...item, equipSlot: undefined });
  if (
    WILD_NEVER_GROUPS.has(item.group) ||
    DECOR_OWN_KEPT_BACK.has(item.templateIndex) ||
    item.templateIndex === TEMPLATES.Spellbook
  )
    return false;
  // KEEP-WALLET (2026-10-09, the owner: "the wallet shouldnt drop in the zone"): the wallet is an organizer - its pieces
  // lie in the pack itself; the Deadlands Embers and the Welkynd Shards stay with the fallen, as the wallet does (bound
  // already) - the letters of credit drop (LETTERS-DROP, above)
  if (isWalletItem(item) || walletHolds(item)) return false;
  // INT9: a classic save's piece is its character's for good (systems/item/itemLaw.js classicPiece - "Keep all, can't sell"):
  // no route hands it to another player, and a death's remains are taken by anyone
  if (classicPiece(item)) return false;
  return tradeableRecord({ ...item, equipSlot: undefined }); // the trade's refusals over plain data (net/realm/realmTradeLaw.js)
}

/**
 * THE DROP: what a death in the zone takes out of the bag (`items`, never a worn piece) - REMOVED from it, in its order,
 * and handed back to be deposited. Pure over the array it is given. STORE-KEEPS: the bag alone - the cart is storage.
 */
export function takeWildDrop(items) {
  const out = [];
  if (!Array.isArray(items)) return out;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (isEquipped(it) || !wildCanLose(it)) continue;
    items.splice(i, 1);
    out.unshift(it);
  }
  return out;
}

/** WILD GOLD: a death at another player's hand in the zone drops a share of the gold carried - each purse's whole
 *  pieces divided by this, floored (no usual death penalty) - into the remains. FOE-KEEPS (2026-10-24, the owner: "I dont
 *  want people to lose everything they have"; asked, "The usual tenth"): a tenth, the usual death's own share
 *  (deathPenalty.js DEATH_GOLD_DIVISOR, pinned equal - this leaf is the account Worker's and the penalty's module is
 *  not); it was half. A divisor because `g / 10` is exact for every whole purse, where `g * 0.1` is a hair over a tenth
 *  (AUDIT DEATH-TENTH's own reason). A death to a foe drops none: it takes the usual penalty, and nothing else
 *  (`/v1/wild/fall` refuses a foe's fall - server-account/src/wild.js). */
export const WILD_GOLD_DIVISOR = 10;
/** The share as a fraction, for those who say it so - the law divides by WILD_GOLD_DIVISOR (AUDIT FOE-KEEPS P3: it
 *  stood beside the divisor as a second number no code read). */
export const WILD_GOLD_LOSS = 1 / WILD_GOLD_DIVISOR;

/** A list's gold stack (its `Currency` item) - a companion's pack's, in an answer from before STORE-KEEPS - or null. */
const coinIn = (/** @type {any} */ list) =>
  Array.isArray(list) ? (list.find((i) => i?.group === 'Currency') ?? null) : null;

/** Take a tenth (the purse's whole pieces / WILD_GOLD_DIVISOR, floored) of the purse (`entity.goldPieces`), in place;
 *  answers it as ONE pile record, or null. STORE-KEEPS: the purse alone - the cart's gold stack and a companion's are
 *  storage (they paid their tenth beside it since CART-AWAY and COMPANION-DROP).
 *  @param {any} entity */
export function takeWildGold(entity) {
  const have = Math.max(0, Math.floor(entity?.goldPieces ?? 0));
  const purse = Math.floor(have / WILD_GOLD_DIVISOR);
  if (purse < 1) return null;
  entity.goldPieces = have - purse;
  return goldStack(purse);
}

/** WILD-INSURE: no piece is insured - the law's default where no policy is read (a death to a foe takes nothing; a test). */
const UNINSURED = (/** @type {any} */ _it) => false;

/** THE KILLER'S CHOICE: the worn pieces a body offers - worn, and a death may let them go - at most WILD_ITEMS_MAX.
 *  AUDIT PVP-EASE L2-2 (the owner: a policy spent "only when it saved the piece"): an insured piece is offered as any
 *  other, and the killer's pick of one lands on nothing - the piece kept and its policy spent (takeWildDeath's `saved`).
 *  So the offer reads no policy at either end, and one end's offer is the other's whatever book each has read
 *  (AUDIT PVP-EASE L2-3, L4-1: the page's book read late or never, its offer named a piece the service's left out).
 *  @param {any} items */
export const wornOffer = (items) =>
  Array.isArray(items) ? items.filter((it) => it && isEquipped(it) && wildCanLose(it)).slice(0, WILD_ITEMS_MAX) : [];

/** A record for the wire: a plain-data copy with the RECEIVER's marks off (its slot, its quest - loot.js's own clamp
 *  strips them too; never sent is better than stripped). */
export function wildRecord(item) {
  const copy = JSON.parse(JSON.stringify(item));
  for (const k of RECEIVER_MARKS) delete copy[k]; // ACQUIRE1's `acquired` among them; MARK-WIRE: one list (net/realm/realmTradeLaw.js)
  return copy;
}

/** INT9 (AUDIT): THE KILLER'S PIECE - the worn offer's `w`th (wornOffer), or, where the relay signed what the offer showed
 *  (`wt`, `[templateIndex, material]` - net/wild/wildReceipt.js), the piece worn now that is that: the `w`th when it still is,
 *  else the first that is, else none (AUDIT INT9: the place alone was an index into a list the fallen built). */
export function wildPickOf(items, w = -1, wt = null) {
  if (!Number.isInteger(w) || w < 0) return null;
  const offer = wornOffer(items);
  if (!Array.isArray(wt)) return offer[w] ?? null;
  const is = (/** @type {any} */ it) => !!it && it.templateIndex === wt[0] && (it.material ?? 0) === wt[1];
  return is(offer[w]) ? offer[w] : (offer.find(is) ?? null);
}

/** INT9 (AUDIT): EVERY PIECE A DEATH COULD TAKE out of `entity` (its killer's piece and the bag's drop) - unfitted,
 *  untouched. The account service asks the ledger of all of them before it takes any (AUDIT INT9: it asked of a dry
 *  run's fitted few, and a piece kept back let in one it never asked of). STORE-KEEPS: the bag's alone. WILD-INSURE: never
 *  a piece a policy keeps (`insured`, takeWildDeath's own).
 *  @param {any} entity @param {number} [w] @param {number[] | null} [wt] @param {{ insured?: (item: any) => boolean }} [opts] */
export function wildDropCandidates(entity, w = -1, wt = null, { insured = UNINSURED } = {}) {
  const bag = Array.isArray(entity?.items) ? entity.items : [];
  const k = wildPickOf(bag, w, wt);
  const drop = bag.filter((it) => !isEquipped(it) && wildCanLose(it) && !insured(it));
  return k && !insured(k) ? [k, ...drop] : drop;
}

/** A piece's worth to the drop's order: a coin or a letter at its gold, any other at its worth (the judge's wealth's own
 *  measure - itemLaw.js itemWorth). */
const dropWorth = (/** @type {any} */ it) => {
  const l = liquidWorthOf(it);
  return l > 0 ? l : itemWorth(it);
};

/**
 * INT9: A DEATH'S WHOLE TAKE, in place, off `entity` - a live character or a judged record alike (`items`, `goldPieces`):
 * the killer's worn piece first (wildPickOf - `w` its place in wornOffer, `wt` what the offer showed; -1 none), then the
 * purse's share of its gold, then the bag's drop BY WORTH, the most first - every piece `keep` names left where it lies,
 * and one heavier than a remains' record (net/wild/wildLaw.js recordFits) left too - fitted to one remains (remainsFit),
 * and what does not fit put back where it came from (AUDIT INT9: the purse came last, so a bag of junk ahead of it kept
 * the gold and the valuables; and a coin's share put back went into the purse). The record's lit light
 * (`lightSourceIndex`, an index into `items` - systems/save/save.js) follows its piece. Answers `{ taken, from, records,
 * killer, gold }`: the pieces taken (the gold a stack of it), where each came from ('bag', 'gold'), their wire records in
 * that order, whether the first is the killer's, and the gold taken `{ purse }`. The account service runs it on the
 * record (server-account/src/wild.js) and answers what it took; the fallen's game takes out exactly that (wildTakeTook) -
 * it never guesses what the ledger kept.
 * STORE-KEEPS (2026-10-26, the owner: "Make it where you cant lose your wagon/horse or anything stored on death"): the bag
 * and the purse alone. The cart's pieces and coin (CART-AWAY's `cart`, 2026-10-15) and every companion's pack, kit and
 * coin (COMPANION-DROP's `packs`, 2026-10-19) are storage, and stay whole.
 * WILD-INSURE (2026-10-26, the owner chose "Kept, policy spent"): `insured` - a piece a policy keeps stays where it lies,
 * worn or in the bag - systems/wild/wildInsureLaw.js wildInsuredBy. AUDIT PVP-EASE L1-3, L2-2 (the owner: spent "only when
 * it saved the piece"): `saved` the ledger keys of the insured pieces THIS death would have taken without them - the
 * killer's pick landed on one, or the bag's drop would have carried it into the remains (a dry run of this same law
 * without the policies, so the remains' bound and the ledger's `keep` judge it as they judge the take). Only those
 * policies are spent: one on a piece no pick named, in a hall that searches no body or past the remains' bound, stays.
 * AUDIT FOE-KEEPS LETTERS-TENTH: `letters` true (the fallen's word, WILD_FALL_LETTERS; a seizure's) - each letter of
 * credit in the bag pays a tenth of its worth into the same pile (`gold.letters`, by its id) and stays where it lies;
 * false, the letters drop whole as any piece (LETTERS-DROP), for a game from before the word. PVP-REWARD: `bag` false, none; `purse` false, no coin.
 * @param {any} entity @param {number} [w] @param {(item: any) => boolean} [keep] @param {number[] | null} [wt]
 * @param {{ letters?: boolean, insured?: (item: any) => boolean, bag?: boolean, purse?: boolean }} [opts]
 */
export function takeWildDeath(
  entity,
  w = -1,
  keep = () => false,
  wt = null,
  { letters = false, insured = UNINSURED, bag: drops = true, purse: coins = true } = {},
) {
  /** @type {string[]} AUDIT PVP-EASE L1-3: the policies this death spends - what it would have taken, kept */
  const saved = insured === UNINSURED ? [] : wildSaved(entity, w, keep, wt, letters, insured, drops);
  const bag = Array.isArray(entity?.items) ? entity.items : [];
  const lit =
    Number.isSafeInteger(entity?.lightSourceIndex) && entity.lightSourceIndex >= 0
      ? bag[entity.lightSourceIndex]
      : undefined;
  const held = (/** @type {any} */ it) => keep(it) || insured(it); // WILD-INSURE: a policy keeps as the ledger does
  /** @type {[any, string][]} each piece taken, and where it came from */
  const took = [];
  const k = wildPickOf(bag, w, wt);
  if (k && !held(k) && recordFits(wildRecord(k))) {
    bag.splice(bag.indexOf(k), 1);
    took.push([k, 'bag']);
  }
  const killer = took.length > 0;
  // the gold, second: the purse's share
  const purse0 = Math.max(0, Math.floor(entity?.goldPieces ?? 0));
  const coin = coins ? takeWildGold(entity) : null;
  /** @type {{ purse: number, letters?: Record<string, number> }} */
  const gold = { purse: coin ? purse0 - Math.max(0, Math.floor(entity.goldPieces ?? 0)) : 0 };
  // LETTERS-TENTH (the fallen's word, `letters`): each letter's tenth into the same pile, the letter kept where it lies
  const shares = letters ? lettersTenth([bag], held) : [];
  const lettersGold = shares.reduce((g, [, n]) => g + n, 0);
  const pile =
    lettersGold > 0
      ? coin
        ? Object.assign(coin, { stackCount: coin.stackCount + lettersGold })
        : goldStack(lettersGold)
      : coin;
  if (lettersGold > 0) gold.letters = Object.fromEntries(shares.map(([it, n]) => [it.uid, n]));
  if (pile) took.push([pile, 'gold']);
  // a piece kept stands aside while the drop is taken, and comes back to its place - LETTERS-TENTH: a letter too
  const aside = bag
    .map((it, i) =>
      held(it) || (letters && shareLetter(it)) || (wildCanLose(it) && !recordFits(wildRecord(it))) ? [i, it] : null,
    )
    .filter((x) => x !== null);
  for (let n = aside.length - 1; n >= 0; n--) bag.splice(/** @type {any} */ (aside[n])[0], 1);
  /** @type {[any, string][]} */
  const drop = (drops ? takeWildDrop(bag) : []).map((it) => /** @type {[any, string]} */ ([it, 'bag']));
  for (const [i, it] of /** @type {[number, any][]} */ (aside)) bag.splice(Math.min(i, bag.length), 0, it);
  const worth = new Map(drop.map(([it]) => [it, dropWorth(it)]));
  drop.sort((a, b) => worth.get(b[0]) - worth.get(a[0])); // stable: equal worth keeps the pack's order
  took.push(...drop);
  const records = remainsFit(took.map(([it]) => wildRecord(it)));
  for (const [it, from] of took.slice(records.length)) {
    if (from === 'bag') {
      bag.push(it);
      continue;
    }
    entity.goldPieces = Math.max(0, Math.floor(entity.goldPieces ?? 0)) + gold.purse;
    for (const [l, n] of shares) l.value += n; // LETTERS-TENTH: whole again
    gold.purse = 0;
    delete gold.letters;
  }
  if (lit !== undefined) entity.lightSourceIndex = bag.indexOf(lit);
  const kept = took.slice(0, records.length);
  return {
    taken: kept.map(([it]) => it),
    from: kept.map(([, f]) => f),
    records,
    killer: killer && records.length > 0,
    gold,
    saved,
  };
}

/** AUDIT PVP-EASE L1-3: the insured pieces a death would have taken without its policies - takeWildDeath run on a copy
 *  of `entity` with none, its taken pieces' keys that a policy names. @returns {string[]} */
function wildSaved(
  /** @type {any} */ entity,
  /** @type {number} */ w,
  /** @type {(item: any) => boolean} */ keep,
  /** @type {number[] | null} */ wt,
  /** @type {boolean} */ letters,
  /** @type {(item: any) => boolean} */ insured,
  /** @type {boolean} */ bag,
) {
  const copy = {
    items: JSON.parse(JSON.stringify(Array.isArray(entity?.items) ? entity.items : [])),
    goldPieces: entity?.goldPieces ?? 0,
  };
  const would = takeWildDeath(copy, w, keep, wt, { letters, bag });
  const keyOf = /** @type {any} */ (insured).keyOf ?? ledgerKeyOf; // INSURE-ALL: the policy's own key (wildInsureLaw.js insureKeyOf)
  return [
    ...new Set(
      would.taken
        .filter((it) => insured(it))
        .map(keyOf)
        .filter((k) => k != null),
    ),
  ];
}

// ── THE PACKS AT THE SIDE (COMPANION-DROP, FIELD BUGS 2026-10-19f; STORE-KEEPS, 2026-10-26) ───────────────────────────
// COMPANION-DROP had a companion at the fallen's side drop his pack with theirs: a crew hand ashore (CREW-COMPANIONS,
// systems/naval/crewCompanions.js) and the sworn revenant at the side, his pack and his kit. STORE-KEEPS made every pack
// storage, which no death takes (takeWildDeath above). The lists stay named here for the one reader left: a fall taken
// before STORE-KEEPS and asked again is answered its first take (server-account/src/wild.js), which may name a pack's
// piece and coin - and the fallen's game takes that out of the pack it names (wildTakeTook), never another list's.

// The zone's count of the sworn at the side and which ones they are: the same leaf (wildLeaf.js), so the companions read
// them without this law's graph; re-exported here for the drop's readers and the account service.
import { WILD_REVENANTS_MAX, wildSwornAtSide } from './wildLeaf.js';
export { WILD_REVENANTS_MAX, wildSwornAtSide };

/** COMPANION-DROP: where a companion's piece lay - the take's word for it (`from`, wildTookOf's `f`): a crew hand's
 *  pack (his boat's number and his name - his for life), a sworn one's pack, a sworn one's kit (its record's id). */
export const WILD_PACK = Object.freeze({
  crew: (/** @type {any} */ boat, /** @type {any} */ name) => `crew:${boat}:${name}`,
  sworn: (/** @type {any} */ id) => `sworn:${id}`,
  kit: (/** @type {any} */ id) => `kit:${id}`,
});

/** @typedef {{ f: string, items: any[], put?: (left: any[]) => void }} WildPack - a list at the side the drop takes
 *  from, its word, and (a kit) how what is left is written back */

/** COMPANION-DROP: a sworn one's kit (`companion.gear`, a slot's key -> its piece - revenantGear.js) as a list the drop
 *  takes from; `put` empties each slot whose piece left the list. @param {string} f @param {any} gear @returns {WildPack} */
function kitPack(f, gear) {
  const items = Object.values(gear).filter((it) => it && typeof it === 'object');
  return {
    f,
    items,
    put: (left) => {
      for (const k of Object.keys(gear))
        if (gear[k] && typeof gear[k] === 'object' && !left.includes(gear[k])) delete gear[k];
    },
  };
}

/** COMPANION-DROP: THE PACKS AT THE PLAYER'S SIDE - each crew hand ashore's (`party`: the crew's party, crewCompanions.js -
 *  live, or the sea's record's `party.party`) and each sworn one's at the side (`revenants`: the feud's list, live or the
 *  record's - wildSwornAtSide), its pack and its kit. The live lists themselves, so the take empties them in place. One
 *  shape at both ends: the account service reads the record's (wildPacksOf), the fallen's game its own live ones.
 *  @param {any} party @param {any} revenants @returns {WildPack[]} */
export function wildPacks(party, revenants) {
  /** @type {WildPack[]} */
  const out = [];
  for (const c of Array.isArray(party) ? party : [])
    if (c && Array.isArray(c.items)) out.push({ f: WILD_PACK.crew(c.boat, c.name), items: c.items });
  for (const r of wildSwornAtSide(revenants)) {
    if (Array.isArray(r.companion?.items)) out.push({ f: WILD_PACK.sworn(r.id), items: r.companion.items });
    if (r.companion?.gear && typeof r.companion.gear === 'object')
      out.push(kitPack(WILD_PACK.kit(r.id), r.companion.gear));
  }
  return out;
}
/** COMPANION-DROP: the packs at the side a RECORD keeps (a save, the service's judged record): its sea's party ashore
 *  (`modData[NAVAL_VENDOR].party.party` - navalHost.js getSaveData) and its feud's sworn (`modData[REVENANT_VENDOR].list` -
 *  revenant.js getSaveData). None for a live character (no `modData`): its game hands its own (wildPacks).
 *  @param {any} save @returns {WildPack[]} */
export const wildPacksOf = (save) =>
  wildPacks(save?.modData?.[NAVAL_VENDOR]?.party?.party, save?.modData?.[REVENANT_VENDOR]?.list);

/** COMPANION-DROP (AUDIT FB1019f B2): THE FALLEN'S WORD THAT ITS GAME READS THE PACKS - `packs` 1 on /v1/wild/fall
 *  (systems/wild/wildDeath.js wildFallWords): its game takes a pack's piece out of that pack and lowers that pack's coin by
 *  its share (wildTakeTook's `packs`, `gold.packs`). STORE-KEEPS: no take of a pack is made any more, and the service
 *  reads no such word; it is still true of this game, which applies an answer from before the word (a fall asked again). */
export const WILD_FALL_PACKS = 1;

/** AUDIT FOE-KEEPS LETTERS-TENTH (2026-10-24; the owner, asked whether a kill should take a letter of credit whole, a tenth
 *  of its worth, or none: "Your choice" - LETTERS-DROP's "letter of credits should be dropped" and FOE-KEEPS' "I dont want
 *  people to lose everything they have" both kept): THE FALLEN'S OWN WORD on /v1/wild/fall that its game takes a letter's
 *  share out of the letter itself (wildTakeTook's `gold.letters`). With it a kill takes a tenth of each letter's worth
 *  into the remains' one gold pile, as it takes the purse's coin, and the letter stays (a 50,000 letter cost 50,000 at a
 *  kill, the same gold as coin 5,000). A tab from before the word is answered as before - the letters drop whole - since
 *  its game would never lower one (server-account/src/wild.js). */
export const WILD_FALL_LETTERS = 1;
/** A letter of credit a kill may take a share of: tradeable, not a quest's, with the id the game finds it again by. */
const shareLetter = (/** @type {any} */ it) =>
  !!it &&
  it.group === 'MiscItems' &&
  it.templateIndex === TEMPLATES.Letter_of_credit &&
  !it.questItem &&
  typeof it.uid === 'string' &&
  !!it.uid &&
  Number.isSafeInteger(it.value) &&
  it.value > 0 &&
  wildCanLose(it);
/** LETTERS-TENTH: each letter in `lists` neither the ledger nor a policy keeps (`keep`), lowered by a tenth of its worth,
 *  in place - answers `[letter, share]` for each. */
function lettersTenth(/** @type {any[][]} */ lists, /** @type {(item: any) => boolean} */ keep) {
  /** @type {[any, number][]} */ const out = [];
  for (const list of lists)
    for (const it of list) {
      if (!shareLetter(it) || keep(it)) continue;
      const n = Math.floor(it.value / WILD_GOLD_DIVISOR);
      if (n > 0) {
        it.value -= n;
        out.push([it, n]);
      }
    }
  return out;
}
/** PVP-NO-TENTH (the owner: "=10% if they domt have initem to roll on", "Letter only pay out 10% if they have not enough
 *  gold"): THE LAST ROLL - a tenth of the purse and the letters together, out of the purse first, the letters (bag order,
 *  each kept where it lies) paying only what the purse cannot. `letters` false (a tab from before the word): the purse
 *  alone. Answers `{ pile, gold }` - `gold` as takeWildDeath's (`purse`, `letters` by id); `pile` null when nothing. */
export function takeWildLastRoll(
  /** @type {any} */ entity,
  keep = (/** @type {any} */ _it) => false,
  { letters = false } = {},
) {
  const have = Math.max(0, Math.floor(entity?.goldPieces ?? 0));
  const paper =
    letters && Array.isArray(entity?.items)
      ? entity.items.filter((/** @type {any} */ it) => shareLetter(it) && !keep(it))
      : [];
  const n = Math.floor(
    (have + paper.reduce((/** @type {number} */ g, /** @type {any} */ it) => g + it.value, 0)) / WILD_GOLD_DIVISOR,
  );
  const purse = Math.min(have, n);
  if (entity && purse > 0) entity.goldPieces = have - purse;
  /** @type {{ purse: number, letters?: Record<string, number> }} */ const gold = { purse };
  let owed = n - purse;
  for (const it of paper) {
    if (owed <= 0) break;
    const k = Math.min(it.value, owed);
    it.value -= k;
    owed -= k;
    (gold.letters ??= {})[it.uid] = k;
  }
  return { pile: n > 0 ? goldStack(n) : null, gold };
}

/** INT9 (AUDIT): WHAT THE SERVICE TOOK, as the fallen's game finds it again - a piece's own marks (`g` group, `t`
 *  template, `m` material, `u` its id, `p` its craft's provenance, `n` its stack, `f` where it lay). */
export const wildTookOf = (/** @type {any[]} */ taken, /** @type {string[]} */ from) =>
  taken
    .map((it, i) => ({
      g: it.group ?? null,
      t: it.templateIndex ?? null,
      m: it.material ?? 0,
      u: typeof it.uid === 'string' ? it.uid : null,
      p: typeof it.provenance === 'string' ? it.provenance : null,
      n: Math.max(1, Math.floor(it.stackCount ?? 1)),
      f: from[i],
    }))
    .filter((x) => x.f !== 'gold');

/**
 * INT9 (AUDIT): THE FALLEN'S GAME TAKES OUT EXACTLY WHAT THE SERVICE TOOK off its record (`took` - wildTookOf; `gold` -
 * `{ purse, cart }`), in place: each piece found by its id or its craft's provenance, else by its marks, in the list it
 * lay in; the purse and the cart's coin lowered by their shares. Never the law run again on the live pack (AUDIT INT9:
 * the game ran it without the ledger's word, and took what the service kept). Answers the pieces taken out.
 * COMPANION-DROP: a piece of a pack at the side out of that pack (`packs` - wildPacks over the game's own party and
 * sworn; a record's own by default), found by its word - one whose pack is not here is left (never another list's
 * piece of the same marks) - and each pack's coin lowered by its share (`gold.packs`).
 * LETTERS-TENTH: each letter named in `gold.letters` (its id: its share) lowered by its share.
 * @param {any} entity @param {any[]} took @param {{ purse?: number, cart?: number, packs?: Record<string, number>, letters?: Record<string, number> } | null} gold @param {(item: any) => void} [before]
 *   told of each piece before it leaves its list (a worn one unequipped)
 * @param {WildPack[]} [packs]
 */
export function wildTakeTook(entity, took, gold, before = (/** @type {any} */ _it) => {}, packs = wildPacksOf(entity)) {
  /** @type {any[] & { letters?: { n: number, gold: number } }} */ const out = [];
  for (const s of Array.isArray(took) ? took : []) {
    const list =
      s?.f === 'cart' ? entity?.wagonItems : s?.f === 'bag' ? entity?.items : packs.find((p) => p.f === s?.f)?.items;
    if (!Array.isArray(list)) continue;
    const same = (/** @type {any} */ it) =>
      !!it &&
      (s.u
        ? it.uid === s.u
        : s.p
          ? it.provenance === s.p
          : !it.uid &&
            !it.provenance &&
            it.group === s.g &&
            it.templateIndex === s.t &&
            (it.material ?? 0) === s.m &&
            Math.max(1, Math.floor(it.stackCount ?? 1)) === s.n);
    const i = list.findIndex(same);
    if (i < 0) continue;
    before(list[i]);
    out.push(list.splice(i, 1)[0]);
  }
  const purse = Math.max(0, Math.floor(gold?.purse ?? 0)),
    cart = Math.max(0, Math.floor(gold?.cart ?? 0));
  if (purse) entity.goldPieces = Math.max(0, Math.floor(entity.goldPieces ?? 0) - purse);
  const coin =
    cart && Array.isArray(entity?.wagonItems) ? entity.wagonItems.find((i) => i?.group === 'Currency') : null;
  if (coin) coin.stackCount = Math.max(0, Math.floor(coin.stackCount ?? 1) - cart);
  // AUDIT FOE-KEEPS LETTERS-TENTH: each letter's share out of the letter itself, found by its id wherever it lies - said
  // on the answer (`out.letters`, the death screen's line)
  const lists = [entity?.items, entity?.wagonItems, ...packs.map((p) => p.items)].filter(Array.isArray);
  for (const [u, share] of Object.entries(gold?.letters ?? {})) {
    const n = Math.max(0, Math.floor(Number(share) || 0)),
      it = n ? lists.flat().find((x) => x?.uid === u) : null;
    if (!it || !Number.isSafeInteger(it.value)) continue;
    it.value = Math.max(0, it.value - n);
    out.letters = { n: (out.letters?.n ?? 0) + 1, gold: (out.letters?.gold ?? 0) + n };
  }
  for (const p of packs) {
    const n = Math.max(0, Math.floor(gold?.packs?.[p.f] ?? 0)),
      c = n ? coinIn(p.items) : null;
    if (c) c.stackCount = Math.max(0, Math.floor(c.stackCount ?? 1) - n);
    p.put?.(p.items);
  }
  return out;
}
