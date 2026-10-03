// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1.5 — CUSTOMS: an offline character comes into the realm ONCE.
//
// Mac, decision 3: "Migrate once via customs". The plan is
// bible/06-Systems/Realm-Arc.md, "Customs": loans settled from bank and
// purse; liquid wealth - purse, letters of credit, banks - capped at an
// allowance for the level; Renown from its existing track (the service
// carries the track to the realm's id - server-account/src/realm.js
// customsCarry; CUSTOMS-CARRY, Mac 2026-09-29: and its online homes and
// its guild place, what stood before the realm, which AUDIT REALM2 S2
// had left behind; RENOWN-CHAR: its Renown track crosses with it, the
// character's own again - RENOWN-ACCOUNT had made it the account's for
// a day). Skills,
// attributes and items within the online caps, and a custom class
// re-checked, arrive with phase 4's caps.
//
// THIS RUNS ON A COPY OF THE SAVE, never on the local slot: the offline
// character stays exactly what it was and keeps playing offline. What
// crosses is the copy customs made, and only once - the service refuses
// the same offline id a second time.
//
// THE ALLOWANCE IS OPEN. The plan left its number to Mac; the one here
// (CUSTOMS_WEALTH_BASE + CUSTOMS_WEALTH_PER_LEVEL a level) is a first
// setting, named so it can be moved in one place.
//
// AUDIT REALM2 T3: A DEED IS WEALTH TOO - the realm's bank buys a ship, a
// house and the pieces placed in them back for gold. RESTORE (Mac: "Keep
// all, can't sell"): so every deed crosses marked, and the realm's bank
// never buys a crossed one back; customs takes none. applyCustoms says
// the rule, and reclaimCustomsDeeds gives back what it once took.
// ═══════════════════════════════════════════════════════════════════

import { callInEmpireDebt, SHIP_TYPES, SHIP_INTERIOR_MAP_IDS, LOAN_AMNESTY } from './banking.js';
import { interiorSceneName } from './sceneCache.js';   // RESTORE: a deed's room, by its own name
import { BUILDING_KEY_0 } from './talkTopics.js';   // RESTORE: the no-key key a ship's room is filed under
import { firstRestorable } from './saveSlots.js';   // RESTORE: the offline character a realm one came from, on this device
import { deductGold } from './court.js';
import { LEVELING_VIRTUE, newCharacterLevelingSystem } from './oblivionLeveling.js';   // LEVEL-ONLINE: a character crossing levels the Oblivion way
import { isGoldPieces } from './inventory.js';
// AUDIT REALM2 S1: the allowance and the measure live in the law the service reads too (net/realmGoldLaw.js), which holds
// a customs character's first save to them - re-exported here, their home before it; AUDIT REALM2 T2, T3 and T5's
// counting with them (every container, a boat's hold, a deed at what the realm's bank pays)
import { REST_ITEM, REST_ITEMS_ONLINE } from './restItems.js';   // AUDIT REST-PARTY B4: the supplies stay offline while their online sources are shut
import { liquidWorthOf, stashedItemLists, carriedItemLists, liquidWealthOf, deedsOf, customsAllowance, CUSTOMS_WEALTH_BASE, CUSTOMS_WEALTH_PER_LEVEL, CUSTOMS_HOUSE_PRICE } from '../net/realmGoldLaw.js';

export { stashedItemLists, liquidWealthOf, deedsOf, customsAllowance, CUSTOMS_WEALTH_BASE, CUSTOMS_WEALTH_PER_LEVEL, CUSTOMS_HOUSE_PRICE };
const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);
/**
 * CUSTOMS ON A SAVE, in place (hand it a copy). First every loan is called in - the Empire keeps no loan for a
 * newcomer (banking.js callInEmpireDebt at a cap of nothing): the loan's own account, the other accounts, then the
 * purse and its letters; what cannot be paid falls due at once and defaults at the first join, as any call does. Then
 * every deed crosses, marked (crossDeeds, below), and the gold left is capped at the allowance for the level: what the
 * character left in the world first (AUDIT REALM F2: the stashes, which it cannot see from the door), then the bank
 * (the fullest account first), then the wagon's gold and letters, then the pack's letters, then the purse. A record
 * emptied is gone from its list.
 *
 * AUDIT REALM2 T3 counted each deed - the ship, a house, the pieces bought for their rooms - at what the realm's bank
 * pays for it, since customs had counted the purse, the letters and the banks alone and a rich character brought its
 * ship, a house in every region and their pieces in uncounted, to sell there; and it took whole deeds off the copy when
 * the total was over. RESTORE (2026-09-29, Mac: "I want people to get their stuff back" - "Keep all, can't sell"): a
 * deed now crosses whole and is never bought back in the realm (banking.js sellHouse, sellShip), so it carries no gold
 * past the allowance and there is nothing to take. T3's counting stands for a deed the realm's bank would buy (deedsOf);
 * a crossed one is none. (HOUSE-LOSS had first kept a deed only while the deeds by themselves fit - a house alone is
 * past the allowance of every level up to six, so they still lost it.)
 * Answers what customs did - `taken` the gold held back, `crossed` the deeds that came with the character.
 * @param {any} snap
 */
export function applyCustoms(snap) {
  snap.loanAmnesty = LOAN_AMNESTY;   // LOAN-AMNESTY: a character crossing now is past every amnesty - its offline loans are called in below, never forgiven
  const accounts = Array.isArray(snap.bankAccounts) ? snap.bankAccounts : [];
  const call = callInEmpireDebt(accounts, { deductGold: (/** @type {number} */ n) => deductGold(snap, n) }, { cap: 0, nowMinutes: Math.floor(snap.classicMinutes ?? 0) });
  const crossed = crossDeeds(snap);
  const allowance = customsAllowance(snap.level);
  const wealth = liquidWealthOf(snap);
  let excess = Math.max(0, wealth - allowance);
  const take = (/** @type {number} */ have) => { const t = Math.min(excess, Math.max(0, have)); excess -= t; return t; };
  /** @type {Set<any>} */
  const emptied = new Set();
  const takeFrom = (/** @type {any[]} */ list) => {
    for (const it of list) {
      if (!excess) return;
      const t = take(liquidWorthOf(it));
      if (!t) continue;
      if (isGoldPieces(it)) it.stackCount -= t; else it.value -= t;
      if (!liquidWorthOf(it)) emptied.add(it);
    }
  };
  for (const list of stashedItemLists(snap)) takeFrom(list);
  for (const a of [...accounts].sort((x, y) => (y?.accountGold ?? 0) - (x?.accountGold ?? 0))) {
    if (!excess) break;
    a.accountGold -= take(a.accountGold ?? 0);
  }
  for (const list of lists(snap.wagonItems, snap.items)) takeFrom(list);
  if (excess) snap.goldPieces = Math.max(0, (snap.goldPieces ?? 0) - take(snap.goldPieces ?? 0));
  // the records customs emptied leave their lists, in place - a list is held by its container, its pile or its piece
  for (const list of carriedItemLists(snap)) {
    for (let i = list.length - 1; i >= 0; i--) if (emptied.has(list[i])) list.splice(i, 1);
  }
  // AUDIT REST-PARTY B4: REST6's supplies (1700-1706) stay behind while every online source of them is shut
  // (restItems.js REST_ITEMS_ONLINE: the templates ship a release before any shelf, pile or trade carries one, so a
  // client a build behind never meets one) - customs is a door too, and an offline shelf's Bedroll walked in through it,
  // usable, droppable and tradeable online. The offline character keeps them: customs runs on the realm's copy.
  let restKept = 0;
  if (!REST_ITEMS_ONLINE) {
    for (const list of [...carriedItemLists(snap), ...stashedItemLists(snap)]) {
      for (let i = list.length - 1; i >= 0; i--) if (REST_ITEM_IDS.has(list[i]?.templateIndex)) { list.splice(i, 1); restKept++; }
    }
  }
  return { called: call.called, paid: call.paid, owed: call.owed, wealth, allowance, taken: wealth - liquidWealthOf(snap), crossed, restKept };
}
const REST_ITEM_IDS = new Set(Object.values(REST_ITEM));

/**
 * LEVEL-ONLINE (2026-09-30, Mac: "Do not allow people to use daggerfall leveling in online. Characters currently using
 * it online can keep it."): A CHARACTER COMING IN IS A NEW ONLINE CHARACTER, so it crosses onto Oblivion's bar - the
 * one law a new character's system goes through (oblivionLeveling.js newCharacterLevelingSystem). It is run at the
 * Bring online door beside applyCustoms, not inside it - customs is the gold and the deeds, and its report keeps
 * saying only that (ui/enhancedMenu.js bringOnline/customsNow say this line first). The bar starts empty,
 * as a new character's does; the character's level, skills and any level-up already earned are kept (the Oblivion
 * window takes a pending one, which reads the same readyToLevelUp and pendingLevel). Customs runs on the realm's COPY,
 * so the offline character keeps Daggerfall's leveling offline; a character already online never passes here again.
 * Answers whether it switched.
 * @param {any} snap
 */
export function crossLeveling(snap) {
  if (snap.levelingSystem === LEVELING_VIRTUE) return false;
  snap.levelingSystem = newCharacterLevelingSystem(snap.levelingSystem, { online: true });
  snap.levelProgress = 0;
  snap.levelRollUp = 0;
  return true;
}

/** A bought piece crosses paying nothing back (net/decorLaw.js decorSaleBack pays half its `paid`); the owner's own
 *  things (an `item`) never paid anything. */
const crossPieces = (/** @type {any} */ room) => {
  for (const p of Array.isArray(room?.decor) ? room.decor : []) if (p && !p.item) p.paid = 0;
};

/**
 * RESTORE: EVERY DEED CROSSES, MARKED - a house's slot `crossed`, the ship's `shipCrossed` - with every piece in its
 * room set to pay nothing back. The realm's bank never buys a crossed deed back (banking.js), so it is no deed the
 * allowance counts (net/realmGoldLaw.js deedsOf). Answers what crossed, in the report's words: 'ship' and 'house' each.
 * @param {any} snap
 */
export function crossDeeds(snap) {
  /** @type {string[]} */
  const crossed = [];
  for (const deed of deedsOf(snap)) {
    if (deed.slot) deed.slot.crossed = true;
    else snap.shipCrossed = true;
    crossPieces(deed.room);
    crossed.push(deed.slot ? 'house' : 'ship');
  }
  return crossed;
}

/**
 * RESTORE (2026-09-29, Mac: "I want people to get their stuff back"): WHAT CUSTOMS KEPT BACK, GIVEN BACK. Before the
 * deeds crossed, customs took them off the realm's copy - a house's slot emptied, the ship gone, the pieces bought for
 * the room taken out - and left the room itself among the copy's permanent scenes, where a sale never leaves one
 * (banking.js sellHouse and sellShip drop it). So a deed customs took is one the OFFLINE character still owns - its own
 * save, on this device, which customs never touched - while the realm character does not, and the realm character's
 * save still keeps its room: the offline deed and the room left behind, together, are the evidence. A rented room or a
 * house bought and sold in the realm is neither. It comes back as every deed crosses now: marked, and its bought pieces
 * paying nothing back. A realm character that owns a house in that region since keeps its own - nothing is taken to
 * make room - and one that owns a ship keeps it. Once back, the realm character owns it and nothing here matches it
 * again. Answers what came back: `{ houses: [location], ship, pieces }`.
 * @param {any} realm the realm character's save, in place @param {any} offline its offline character's save
 */
export function reclaimCustomsDeeds(realm, offline) {
  /** @type {{ houses: string[], ship: boolean, pieces: number }} */
  const back = { houses: [], ship: false, pieces: 0 };
  if (!realm || typeof realm !== 'object' || !offline || typeof offline !== 'object') return back;
  const permanent = new Set(Array.isArray(realm.sceneCache?.permanentScenes) ? realm.sceneCache.permanentScenes : []);
  const roomIn = (/** @type {any} */ snap, /** @type {string} */ name) => (Array.isArray(snap.sceneCache?.scenes) ? snap.sceneCache.scenes : []).find((/** @type {any} */ sc) => sc?.sceneName === name) ?? null;
  const piecesBack = (/** @type {string} */ name) => {
    const ours = roomIn(realm, name), theirs = roomIn(offline, name);
    if (!ours || !Array.isArray(theirs?.decor)) return;
    if (!Array.isArray(ours.decor)) ours.decor = [];
    const standing = new Set(ours.decor.map((/** @type {any} */ p) => p?.id));
    for (const p of theirs.decor) {
      if (!p || p.item || standing.has(p.id)) continue;
      ours.decor.push({ ...p, paid: 0 });
      back.pieces++;
    }
  };
  const houses = Array.isArray(realm.houses) ? realm.houses : [];
  const theirs = Array.isArray(offline.houses) ? offline.houses : [];
  for (let region = 0; region < theirs.length && region < houses.length; region++) {
    const slot = theirs[region];
    if (!(slot?.buildingKey > 0)) continue;
    const name = interiorSceneName(slot.mapId, slot.buildingKey);
    if (!permanent.has(name) || houses[region]?.buildingKey > 0) continue;
    houses[region] = { ...houses[region], regionIndex: region, location: slot.location ?? '', mapId: slot.mapId, buildingKey: slot.buildingKey, crossed: true };
    piecesBack(name);
    back.houses.push(slot.location ?? '');
  }
  const ship = offline.ownedShip ?? SHIP_TYPES.None;
  if (ship !== SHIP_TYPES.None && (realm.ownedShip ?? SHIP_TYPES.None) === SHIP_TYPES.None) {
    const name = interiorSceneName(SHIP_INTERIOR_MAP_IDS[ship], BUILDING_KEY_0);
    if (permanent.has(name)) {
      realm.ownedShip = ship;
      realm.shipCrossed = true;
      piecesBack(name);
      back.ship = true;
    }
  }
  return back;
}

/** RESTORE: the offline character a realm character came from, on this device - its newest save this build can restore
 *  (systems/saveSlots.js firstRestorable) - given to reclaimCustomsDeeds. Null when there is nothing to give back from. */
export function reclaimFromDevice(/** @type {any} */ realm, /** @type {unknown} */ origin, { find = firstRestorable } = {}) {
  if (typeof origin !== 'string' || !origin) return null;
  const offline = find((/** @type {any} */ e) => e?.snap?.characterId === origin)?.snap ?? null;
  return offline ? reclaimCustomsDeeds(realm, offline) : null;
}

/** RESTORE: what came back, in the player's words - or none, when nothing did. */
export function reclaimLines(/** @type {{ houses: string[], ship: boolean, pieces: number } | null} */ back) {
  if (!back || (!back.houses.length && !back.ship)) return [];
  const where = back.houses.map((l) => (l ? `your house in ${l}` : 'your house'));
  const what = [...(back.ship ? ['your ship'] : []), ...where].join(' and ');
  return [`Customs had kept back ${what}. ${back.houses.length + (back.ship ? 1 : 0) > 1 ? 'They are' : 'It is'} yours again, with every piece in ${back.houses.length + (back.ship ? 1 : 0) > 1 ? 'them' : 'it'}. The realm's bank does not buy back what came through customs.`];
}

/** LEVEL-ONLINE: the door's words for a Daggerfall-levelling character coming in. */
export const LEVELING_CROSS_LINE = Object.freeze({
  before: 'Online characters level the Oblivion Remastered way: this character will level by the skill bar from here on.',
  after: 'Online, this character levels the Oblivion Remastered way, by the skill bar.',
});

/** CUSTOMS-CARRY (2026-09-29): what the door promises before customs runs, whatever it finds - what crosses beside the
 *  save (the service carries the home and the guild place, realm.js CHARACTER_TABLES), what stays, and the once. */
export const CUSTOMS_PROMISE = Object.freeze([
  'Your online homes and your guild place come with you.',
  'Your offline character stays exactly as it is, loans and gold included, and keeps playing offline.',
  'A character comes into the realm once.',
]);

/** What customs did, in the Online door's words - or, `before` it runs (FIELD 2026-09-29, Dracula/Valentin: "HOW TF WAS
 *  I SUPPOSED TO KNOW YALL WOULD FORCE THE LOANS TO BE PAID"), what it will do: the same report off a copy customs ran
 *  on, told ahead, and the door's promise under it. */
export function customsLines({ called, owed, wealth, allowance, taken, crossed = [], restKept = 0 }, { before = false } = {}) {
  const lines = [];
  if (called > 0) {
    lines.push(before
      ? (owed > 0 ? `Customs will call in ${called} gold of loans; ${owed} cannot be paid and falls due.` : `Customs will call in ${called} gold of loans and pay them from your bank and purse.`)
      : (owed > 0 ? `Customs called in ${called} gold of loans; ${owed} could not be paid and falls due.` : `Customs called in ${called} gold of loans, and they are paid.`));
  }
  if (taken > 0) {
    lines.push(before
      ? `You carry ${wealth} gold; the realm lets a character of this level bring ${allowance}. ${taken} will stay behind.`
      : `You carried ${wealth} gold; the realm lets a character of this level bring ${allowance}. ${taken} stays behind.`);
  }
  // RESTORE: every deed comes along - and the door says so, since the realm's bank will not buy it back
  const houses = crossed.filter((d) => d === 'house').length;
  const what = [crossed.includes('ship') ? 'your ship' : '', houses > 1 ? `${houses} houses` : houses ? 'your house' : ''].filter(Boolean).join(' and ');
  if (what) lines.push(`${what[0].toUpperCase()}${what.slice(1)} ${before ? 'will come' : 'came'} with you, every piece in ${crossed.length > 1 ? 'them' : 'it'}; the realm's bank does not buy back what comes through customs.`);
  if (restKept > 0) lines.push(`Your camping supplies ${before ? 'will stay' : 'stayed'} with your offline character - they are not yet sold in the realm.`);   // AUDIT REST-PARTY B4
  if (!lines.length) lines.push(before ? 'Customs finds nothing to settle.' : 'Customs found nothing to settle.');
  return before ? [...lines, ...CUSTOMS_PROMISE] : lines;
}
