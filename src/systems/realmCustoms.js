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
import { interiorSceneName, LOOT_CONTAINER_TYPES } from './sceneCache.js';   // RESTORE: a deed's room, by its own name; AUDIT REST III B4: a shop's shelf told from a chest
import { BUILDING_KEY_0 } from './talkTopics.js';   // RESTORE: the no-key key a ship's room is filed under
import { firstRestorable } from './saveSlots.js';   // RESTORE: the offline character a realm one came from, on this device
import { deductGold } from './court.js';
import { LEVELING_CLASSIC, newCharacterLevelingSystem } from './oblivionLeveling.js';   // LEVEL-ONLINE-2: a character crossing levels the Daggerfall way
import { levelUpSkillSumAnchor } from './advancement.js';   // LEVEL-ONLINE-2: ...from the start of the level it has
import { isGoldPieces } from './inventory.js';
// AUDIT REALM2 S1: the allowance and the measure live in the law the service reads too (net/realmGoldLaw.js), which holds
// a customs character's first save to them - re-exported here, their home before it; AUDIT REALM2 T2, T3 and T5's
// counting with them (every container, a boat's hold, a deed at what the realm's bank pays)
import { REST_ITEM, restItemsOnline } from './restItems.js';   // AUDIT REST-PARTY B4: the supplies stay offline while their online sources are shut (REST-LOOT: open since 2026-10-05; the switch is the way back)
import { liquidWorthOf, stashedItemLists, carriedItemLists, liquidWealthOf, deedsOf, customsAllowance, CUSTOMS_WEALTH_BASE, CUSTOMS_WEALTH_PER_LEVEL, CUSTOMS_HOUSE_PRICE } from '../net/realmGoldLaw.js';
import { cardWorth, cardWorthOf, isCardRecord, customsCardAllowance } from '../net/cardWorthLaw.js';   // CARDS9: the cards' customs, one law with the service's first save

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
  for (const list of lists(snap.wagonItems, snap.bagItems, snap.items)) takeFrom(list);   // BAG1: the bag's materials too
  if (excess) snap.goldPieces = Math.max(0, (snap.goldPieces ?? 0) - take(snap.goldPieces ?? 0));
  // the records customs emptied leave their lists, in place - a list is held by its container, its pile or its piece
  for (const list of carriedItemLists(snap)) {
    for (let i = list.length - 1; i >= 0; i--) if (emptied.has(list[i])) list.splice(i, 1);
  }
  // AUDIT REST-PARTY B4: REST6's supplies (1700-1706) stay behind while every online source of them is shut
  // (restItems.js restItemsOnline: the templates ship a release before any shelf, pile or trade carries one, so a
  // client a build behind never meets one) - customs is a door too, and an offline shelf's Bedroll walked in through it,
  // usable, droppable and tradeable online. The offline character keeps them: customs runs on the realm's copy.
  // REST-LOOT (2026-10-05): the sources are open, so a character's own walk in; this stands behind the switch.
  let restKept = 0;
  if (!restItemsOnline()) {
    const strip = (/** @type {any[]} */ list) => {
      let n = 0;
      for (let i = list.length - 1; i >= 0; i--) if (REST_ITEM_IDS.has(list[i]?.templateIndex)) { list.splice(i, 1); n++; }
      return n;
    };
    const scenes = Array.isArray(snap.sceneCache?.scenes) ? snap.sceneCache.scenes : [];
    // AUDIT REST III B4: THE LINE IS SAID OF THE CHARACTER'S OWN. Every list a save holds is stripped, as before, but a
    // shop's shelf in the scene cache, a dungeon's own loot pile and a dead foe's pack were never the character's: one
    // who had only looked at a General Store's shelf heard "Your rest supplies will stay with your offline character".
    // (A chest, a dropped pile, the ship's hold: what is in them, the character put there - the port's supplies ride
    // no house loot.)
    const foreign = new Set();
    for (const sc of scenes) for (const c of sc?.lootContainers ?? []) if (c?.containerType === LOOT_CONTAINER_TYPES.ShopShelves && Array.isArray(c.items)) foreign.add(c.items);
    for (const pile of snap.world?.piles ?? []) if (Array.isArray(pile?.items)) foreign.add(pile.items);
    for (const foe of snap.world?.foes ?? []) if (foe?.dead && Array.isArray(foe.items)) foreign.add(foe.items);
    // AUDIT REST II H9: and the repairer's counter (save.js otherItems - restored to the pack's owner on the way in)
    for (const list of new Set([...carriedItemLists(snap), ...(Array.isArray(snap.otherItems) ? [snap.otherItems] : [])])) {
      const n = strip(list);
      if (!foreign.has(list)) restKept += n;
    }
    // AUDIT REST III B2: AND WHAT STANDS AS THE OWNER'S OWN DECOR (DECOR2a's decorOwn, by piece id - an item set down in
    // the offline house or the ship): online, the piece taken down or the house sold hands it back to the pack
    // (worldModes.js decorReturnStrays, sceneCache.js takeSceneOwn) - the door B4 and H9 shut, open. The item stays
    // offline, and the piece it stood as goes with it.
    for (const sc of scenes) {
      const own = sc?.decorOwn && typeof sc.decorOwn === 'object' ? sc.decorOwn : null;
      for (const id of own ? Object.keys(own) : []) {
        if (!REST_ITEM_IDS.has(own[id]?.templateIndex)) continue;
        delete own[id];
        if (Array.isArray(sc.decor)) sc.decor = sc.decor.filter((/** @type {any} */ p) => p?.id !== id);
        restKept++;
      }
    }
  }
  const cards = cardCustoms(snap);   // CARDS9: and the cards, at their worth
  return { called: call.called, paid: call.paid, owed: call.owed, wealth, allowance, taken: wealth - liquidWealthOf(snap), crossed, restKept, cardsKept: cards.kept, cardWorth: cards.worth, cardAllowance: cards.allowance };
}

/**
 * CARDS9 (bible/11-Multiplayer/Tavern-Cards.md section 28): THE CARDS' CUSTOMS, in place (the realm's copy, as all of
 * customs is). A character brings cards worth no more than customsCardAllowance(level) (net/cardWorthLaw.js - the
 * starter deck's worth and a sum a level); past it the DEAREST card goes first, one card at a time off its stack, until
 * the rest fit - a stash's before the wagon's before the pack's (customs' own order, carriedItemLists). The offline
 * character keeps every card. Answers `{ kept, worth, allowance }`: the cards that stayed behind, the worth carried
 * before, the allowance.
 * @param {any} snap
 */
export function cardCustoms(snap) {
  const allowance = customsCardAllowance(snap?.level);
  const worth = cardWorthOf(snap);
  let over = worth - allowance, kept = 0;
  if (over <= 0) return { kept, worth, allowance };
  const held = [];
  for (const list of carriedItemLists(snap)) for (const rec of list) if (isCardRecord(rec) && cardWorth(rec.card) > 0) held.push({ list, rec });
  held.sort((a, b) => cardWorth(b.rec.card) - cardWorth(a.rec.card));   // stable: the lists' own order within a worth
  for (const { list, rec } of held) {
    while (over > 0 && list.includes(rec)) {
      const w = cardWorth(rec.card);
      if ((rec.stackCount ?? 1) > 1) rec.stackCount -= 1; else list.splice(list.indexOf(rec), 1);
      over -= w;
      kept++;
    }
    if (over <= 0) break;
  }
  return { kept, worth, allowance };
}
const REST_ITEM_IDS = new Set(Object.values(REST_ITEM));

/**
 * LEVEL-ONLINE (2026-09-30), REVERSED BY LEVEL-ONLINE-2 (2026-10-06, Mac: "Oblivion should be locked. Currently players
 * are forced into oblivion"): A CHARACTER COMING IN IS A NEW ONLINE CHARACTER, so it crosses onto the online law's
 * system - Daggerfall's - the one law a new character's system goes through (oblivionLeveling.js
 * newCharacterLevelingSystem). It is run at the Bring online door beside applyCustoms, not inside it - customs is the
 * gold and the deeds, and its report keeps saying only that (ui/enhancedMenu.js bringOnline/customsNow say this line
 * first). An Oblivion character's bar is dropped and its skill sum re-anchored at the START of the level it has
 * (advancement.js levelUpSkillSumAnchor) - Daggerfall's sum was never its measure, so read raw it could pay out
 * several levels at once or owe them; a level-up already earned is kept (the anchor is the pending level's, and the
 * Daggerfall window takes the same readyToLevelUp and pendingLevel). Customs runs on the realm's COPY, so the offline
 * character keeps Oblivion's leveling offline. A Daggerfall character (or a save from before ORL1, which reads as
 * one) crosses untouched. LEVEL-ONLINE-3 (2026-10-06, Mac: "Can we somehow switch people who have oblivion leveling
 * online"): THE REALM BOOT runs it too (scenes/world.js `releveled`, beside the loan amnesty), so a character born
 * online on Oblivion's bar under LEVEL-ONLINE is switched at its next join, its first checkpoint keeping it; once
 * switched it reads as Daggerfall's and passes untouched. Answers whether it switched.
 * @param {any} snap
 */
export function crossLeveling(snap) {
  const system = newCharacterLevelingSystem(snap.levelingSystem, { online: true });
  if ((snap.levelingSystem ?? LEVELING_CLASSIC) === system) return false;
  snap.levelingSystem = system;
  snap.levelProgress = 0;
  snap.levelRollUp = 0;
  const level = Number.isFinite(snap.level) ? snap.level : 1;
  const target = snap.readyToLevelUp === true ? level + 1 : level;
  if (Number.isFinite(snap.currentLevelUpSkillSum)) {
    snap.startingLevelUpSkillSum = levelUpSkillSumAnchor(snap.currentLevelUpSkillSum, target);
  }
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
    // WD3 (AUDIT WD3 S2): the deed's town layout crosses with it - its key names a building only in that layout
    delete houses[region].layout;
    if (typeof slot.layout === 'string' && slot.layout) houses[region].layout = slot.layout;
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

/** LEVEL-ONLINE-2: the door's words for an Oblivion-levelling character coming in. */
export const LEVELING_CROSS_LINE = Object.freeze({
  before: 'Online characters level the Daggerfall way: this character will level by its skills from here on, starting from its current level.',
  after: 'Online, this character levels the Daggerfall way, by its skills.',
  switched: 'Online characters now level the Daggerfall way: you will level by your skills from here on, starting from your current level.',
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
export function customsLines({ called, owed, wealth, allowance, taken, crossed = [], restKept = 0, cardsKept = 0, cardWorth: cardsWorth = 0, cardAllowance = 0 }, { before = false } = {}) {
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
  if (restKept > 0) lines.push(`Your rest supplies ${before ? 'will stay' : 'stayed'} with your offline character - they are not yet sold in the realm.`);   // AUDIT REST-PARTY B4; AUDIT REST II H13: the Tonics, Salts, Draughts and Candles are rest supplies, not camping
  // CARDS9: the cards past the allowance, the dearest first
  if (cardsKept > 0) lines.push(`Your cards are worth ${cardsWorth} gold; the realm lets a character of this level bring ${cardAllowance}. ${cardsKept} ${cardsKept === 1 ? 'card' : 'cards'}, the dearest, ${before ? 'will stay' : 'stayed'} with your offline character.`);
  if (!lines.length) lines.push(before ? 'Customs finds nothing to settle.' : 'Customs found nothing to settle.');
  return before ? [...lines, ...CUSTOMS_PROMISE] : lines;
}
