// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEARCH1 (2026-10-03, Mac: "can you make those objects interactable?
// with a 33/33/33 check to spawn either and undead enemy (even undead
// elites 50%) or when interacted with it you get loot and the quickloot
// window lets you loot up 1-4 random items 1 of them always gold. the
// last chance it a message that you found nothing valuable" ... "DONT let
// the mob spawn when the message opens only when he clicks it away" ...
// "once interacted with those they should have a cooldown of 5 ingame
// hours" ... "DUNGEONS ONLY with the exception of Graveyard tombstones
// 2/3rd of the tombstones should have the message that you found nothing
// valuable" ... "other items in dungeons like chests that attracts other
// enemies based on what you find in dungeons. Locked chests/crates should
// also exist. All those ... should have half of the interact range as
// doors").
//
// THE PORT'S OWN. Classic Daggerfall searches no coffin, shelf, headstone
// or crate - every one of these is a static model in DFU, batched into its
// block. This module is the whole law, pure but for the item minters (which
// a test hands its own); the hosts stand the targets and the windows:
//   - scenes/dungeonContext.js: coffins, sarcophagi, shelves, headstones,
//     chests and crates in a dungeon's RDB blocks;
//   - scenes/world.js + scenes/worldModes.js: the headstones of a
//     Graveyard-type location above ground (the streaming world);
//   - scenes/exterior.js (the one-city bench) and the building interiors
//     stand none - see the record in bible/06-Systems/Searchables.md.
//
// WHICH MODELS. Read off the player's own ARCH3D.BSA and BLOCKS.BSA by the
// texture archive each model wears (TEXTURE.092 "coffins organ", TEXTURE.073
// "Gravestone fronts", TEXTURE.071/072/081 the shelf fronts, TEXTURE.090's
// crate and box faces) and where it stands (every RDB block, every GRVE RMB
// block). The ids are DFU's own model numbers; no art ships.
// ═══════════════════════════════════════════════════════════════════

import { DOOR_ACTIVATION_DISTANCE, RAY_DISTANCE } from '../player/activate.js';   // GRAVE-PARTY: and the ray's own, a searchable's reach once the body is near it
import { isShopShelfModel } from './shopStock.js';
import { registerModSaveData } from './modSaveData.js';
import { eliteHash, eliteRng, elitesAllowed, eliteRenownOpen } from './eliteFoes.js';   // AUDIT BAL: and where elites stand at all; RENOWN-GATE: and the searcher's Renown
import { goldStack } from './inventory.js';
import { createRandomWeapon, createRandomArmor, createRandomJewellery, createRandomReligiousItem, createRandomGem, createRandomClothing, createRandomPotion } from './loot/loot.js';
import { createRandomBook } from './books.js';
import { setItemFields, mintCondition, isAmmunition } from './item/itemTemplates.js';
import { rollLootRarity, pileSource } from './loot/lootRarity.js';
import { noteFirstUse } from './tutorials.js';   // TUT1: the first touch of a system pops its tutorial page
import { WATER_SPECIES } from '../characters/dungeonEnemies.js';   // SLAUGHTER-BOX: a search's foe stands on the floor, never a swimmer
import { t } from './textManager.js';   // GRAVE-PARTY: who searched it, in the player's language

// ── reach and time ──────────────────────────────────────────────────
/** Half a door's reach (DoorActivationDistance, 128 classic units): 64 units, 1.6 m. GRAVE-PARTY (FIELD BUGS 2026-10-16b):
 *  measured from the BODY to the nearest point of the object's box (searchReachFor), no longer from the eye. */
export const SEARCH_REACH = DOOR_ACTIVATION_DISTANCE / 2;
/**
 * GRAVE-PARTY (FIELD BUGS 2026-10-16b, "objects in tombs are un lootable"): HOW FAR THE BODY IS FROM A SEARCHABLE - the
 * distance from the upright segment the player stands as (the feet to `top`, the head) to the nearest point of the
 * object's box, metres. A coffin lies on the floor: the eye's ray met its lid a metre and more below the eye, so
 * SEARCH_REACH from the eye left it "too far away" a pace from the player's boots (under ~0.9 m across, standing
 * beside it). The body reaches what it stands beside, at any height.
 * @param {{min: number[], max: number[]}} aabb @param {number[]} feet @param {number} top
 */
export function searchBodyDistance(aabb, feet, top) {
  const gap = (v, lo, hi) => (v < lo ? lo - v : v > hi ? v - hi : 0);
  const dx = gap(feet[0], aabb.min[0], aabb.max[0]), dz = gap(feet[2], aabb.min[2], aabb.max[2]);
  const lo = Math.min(feet[1], top), hi = Math.max(feet[1], top);
  const dy = hi < aabb.min[1] ? aabb.min[1] - hi : lo > aabb.max[1] ? lo - aabb.max[1] : 0;
  return Math.hypot(dx, dy, dz);
}
/**
 * GRAVE-PARTY: A SEARCHABLE TARGET'S `reach` - the hit distance its handler gates on (MC-2's law, player/activate.js
 * answersPress and every host's "too far" arm). Its box within SEARCH_REACH of the body (searchBodyDistance): the ray's
 * own, so whatever the ray meets of it answers. Further: SEARCH_REACH, which the ray already exceeds - no point of the
 * eye's ray to the box is nearer it than the body's nearest point - so it says the refusal, as it did. No feet known:
 * the eye's law, as it was. A departure from SEARCH1's "half of the interact range as doors" measured as a door's is: the
 * bound is the same 1.6 m, from the body.
 */
export function searchReachFor(aabb, feet, top) {
  if (!aabb || !Array.isArray(feet) || !feet.every(Number.isFinite)) return SEARCH_REACH;
  return searchBodyDistance(aabb, feet, Number.isFinite(top) ? top : feet[1]) <= SEARCH_REACH ? RAY_DISTANCE : SEARCH_REACH;
}
/** Five game hours between two searches of one object, in game minutes. */
export const SEARCH_COOLDOWN_MINUTES = 5 * 60;

// ── what is searchable ──────────────────────────────────────────────
/** @typedef {'coffin'|'sarcophagus'|'shelf'|'tombstone'|'chest'|'crate'} SearchKind */
/** Each kind: its plaque name, and whether its foe is the grave's (undead) or the place's (the dungeon's own roster). */
export const SEARCH_KINDS = Object.freeze({
  coffin:      Object.freeze({ name: 'Coffin',      grave: true,  lockable: false }),
  sarcophagus: Object.freeze({ name: 'Sarcophagus', grave: true,  lockable: false }),
  shelf:       Object.freeze({ name: 'Shelf',       grave: true,  lockable: false }),
  tombstone:   Object.freeze({ name: 'Grave',       grave: true,  lockable: false }),
  chest:       Object.freeze({ name: 'Chest',       grave: false, lockable: true }),
  crate:       Object.freeze({ name: 'Crate',       grave: false, lockable: true }),
});

/** TEXTURE.092's low wooden coffins (41315-41318) and its lidded sarcophagi (41319-41327). 41120 wears the same
 *  archive and is the pipe organ - not here. */
const COFFINS = new Set([41315, 41316, 41317, 41318]);
const SARCOPHAGI = new Set([41319, 41320, 41321, 41322, 41323, 41324, 41325, 41326, 41327]);
/** The shelf fronts DFU's own ShopShelves list does not carry (shopStock.js SHOP_SHELF_MODEL_INDICES): the same
 *  71/72/81 shelf art on 41010, 41025, 41027, 41043, 41045, 41807 and 41809. */
const EXTRA_SHELVES = new Set([41010, 41025, 41027, 41043, 41045, 41807, 41809]);
/** TEXTURE.090's framed box (record 2): the chests. */
const CHESTS = new Set([41811, 41812, 41816, 41817, 41826, 41829]);
/** TEXTURE.090's crate faces (records 3, 13, 14). */
const CRATES = new Set([41815, 41818, 41822, 41824, 41825, 41827, 41828, 41830, 41831, 41832, 41833, 41834]);
/** The headstones: every GRVE model wearing TEXTURE.073 whose footprint is a grave's, not a mausoleum's (43083-43086,
 *  43105-43116 and 43137+ are the pedestals, obelisks, tombs and vaults). */
const TOMBSTONE_RANGES = Object.freeze([[43011, 43082], [43101, 43104], [43117, 43136], [43142, 43145]]);
export const isTombstoneModel = (id) => TOMBSTONE_RANGES.some(([a, b]) => id >= a && id <= b);

/** What a model is to a searcher, or null. @returns {SearchKind|null} */
export function searchableKind(modelIdNum) {
  const id = Number(modelIdNum);
  if (!Number.isInteger(id)) return null;
  if (COFFINS.has(id)) return 'coffin';
  if (SARCOPHAGI.has(id)) return 'sarcophagus';
  if (CHESTS.has(id)) return 'chest';
  if (CRATES.has(id)) return 'crate';
  if (isShopShelfModel(id) || EXTRA_SHELVES.has(id)) return 'shelf';
  if (isTombstoneModel(id)) return 'tombstone';
  return null;
}
export const searchName = (kind, locked = false) => `${locked ? 'Locked ' : ''}${SEARCH_KINDS[kind]?.name ?? 'Object'}`;

// ── the roll ────────────────────────────────────────────────────────
/** @typedef {'foe'|'loot'|'nothing'} SearchOutcome */
/** A dungeon's object: a third each. A graveyard's headstone: two in three nothing, the last third split evenly. */
export function rollSearchOutcome({ graveyard = false, rolls = Math.random } = {}) {
  noteFirstUse('searchables');   // TUT1
  const r = rolls();
  if (graveyard) return r < 2 / 3 ? 'nothing' : (r < 5 / 6 ? 'loot' : 'foe');
  return r < 1 / 3 ? 'foe' : (r < 2 / 3 ? 'loot' : 'nothing');
}

/** The undead a grave gives up, DFU's mobile types with their own levels (ENEMY_BASICS): skeletal warrior 9, zombie
 *  10, ghost 11, mummy 11, wraith 15, vampire 19, ancient vampire 20, lich 20, ancient lich 21. */
export const SEARCH_UNDEAD = Object.freeze([
  Object.freeze({ type: 15, level: 9 }), Object.freeze({ type: 17, level: 10 }), Object.freeze({ type: 18, level: 11 }),
  Object.freeze({ type: 19, level: 11 }), Object.freeze({ type: 23, level: 15 }), Object.freeze({ type: 28, level: 19 }),
  Object.freeze({ type: 30, level: 20 }), Object.freeze({ type: 32, level: 20 }), Object.freeze({ type: 33, level: 21 }),
]);
/** A kind stands if its level is at most the player's plus this, and the first four always may. */
export const SEARCH_UNDEAD_LEVEL_SLACK = 3;
export const SEARCH_UNDEAD_FLOOR_LEVEL = 11;
/** One undead for a player of `level`, evenly among those that may stand. */
export function pickSearchUndead(level = 1, rolls = Math.random) {
  const top = Math.max(SEARCH_UNDEAD_FLOOR_LEVEL, (level | 0) + SEARCH_UNDEAD_LEVEL_SLACK);
  const pool = SEARCH_UNDEAD.filter((u) => u.level <= top);
  return pool[Math.min(pool.length - 1, Math.floor(rolls() * pool.length))].type;
}
/** A chest's or a crate's foe: one of the kinds this dungeon already stands (its own roster, the layout's), else an
 *  undead. SLAUGHTER-BOX (FIELD BUGS 2026-10-15c): never one of the roster's water species - it stands on the dry floor
 *  beside the box, and a Slaughterfish, a Dreugh or a Lamia stands in the roster only for a marker under water. */
export function pickRosterFoe(roster, level = 1, rolls = Math.random) {
  const pool = [...new Set((roster ?? []).filter((t) => Number.isInteger(t) && t >= 0 && !WATER_SPECIES.has(t)))];
  if (!pool.length) return pickSearchUndead(level, rolls);
  return pool[Math.min(pool.length - 1, Math.floor(rolls() * pool.length))];
}
/** "even undead elites 50%": half the foes a search wakes stand as elites (systems/eliteFoes.js - five times the
 *  health, three times the blows, the size and the glow). */
export const SEARCH_ELITE_CHANCE = 0.5;
/** SEARCH1-PARTY (Mac: "when enemies spawn it must be 2 per player and if the room is too small then in a floor
 *  connected to the door to the room"): two foes for every player of the party standing there; the first is the one the
 *  message names and the only one the elite roll can make an elite, the rest its plain kin. */
export const SEARCH_FOES_PER_PLAYER = 2;
/** How far apart two of them stand, and how far off the room's door may be to take the overflow (metres). */
export const SEARCH_FOE_SPACING = 0.9;
export const SEARCH_DOOR_REACH_M = 30;
/** AUDIT BAL (bible/05-Combat/Balance-Arc.md section 10): only where elites stand (eliteFoes.js elitesAllowed - online,
 *  or offline under the loot ladder; an elite's drop is the ladder's) - the roll drawn first, so a search's dice are
 *  the same either way. With the ladder off a search woke an elite and its ladder-tier drop, the one door that did.
 *  RENOWN-GATE (bible/06-Systems/Revenants.md section 39): and online only from the searcher's Renown 5
 *  (eliteFoes.js eliteRenownOpen) - the foes a search wakes are the searcher's own stands. */
export const rollSearchElite = (rolls = Math.random) => rolls() < SEARCH_ELITE_CHANCE && elitesAllowed() && eliteRenownOpen();

// ── the loot ────────────────────────────────────────────────────────
export const SEARCH_LOOT_MIN = 1;
export const SEARCH_LOOT_MAX = 4;
/** The gold, per player level (always one of the items). */
export const SEARCH_GOLD_PER_LEVEL = Object.freeze([6, 18]);
/** The goods each kind is drawn from - the minter's names (searchMinters in the host). */
export const SEARCH_GOODS = Object.freeze({
  coffin:      Object.freeze(['jewellery', 'religious', 'gem', 'weapon']),
  sarcophagus: Object.freeze(['jewellery', 'religious', 'gem', 'armor', 'weapon']),
  tombstone:   Object.freeze(['jewellery', 'religious', 'gem']),
  shelf:       Object.freeze(['book', 'potion', 'potion', 'gem']),
  chest:       Object.freeze(['weapon', 'armor', 'clothing', 'gem', 'potion', 'jewellery']),
  crate:       Object.freeze(['clothing', 'potion', 'weapon', 'armor']),
});
/**
 * THE FIND: one to four items, one of them gold. `mint` is `{ [good]: (level, rolls) => item|null }`; a good that
 * mints nothing is drawn again (four tries), so the list never pads with nulls.
 */
export function rollSearchLoot(kind, level = 1, mint = {}, rolls = Math.random) {
  const lv = Math.max(1, level | 0);
  const count = SEARCH_LOOT_MIN + Math.floor(rolls() * (SEARCH_LOOT_MAX - SEARCH_LOOT_MIN + 1));
  const [lo, hi] = SEARCH_GOLD_PER_LEVEL;
  const items = [goldStack(Math.max(1, Math.round(lv * (lo + rolls() * (hi - lo)))))];
  const goods = SEARCH_GOODS[kind] ?? SEARCH_GOODS.chest;
  for (let n = 1; n < count; n++) {
    for (let tries = 0; tries < 4; tries++) {
      const fn = mint[goods[Math.floor(rolls() * goods.length)]];
      const it = typeof fn === 'function' ? fn(lv, rolls) : null;
      if (it) { items.push(it); break; }
    }
  }
  return items;
}

// ── the locks ───────────────────────────────────────────────────────
/** One chest or crate in three is locked, its lock 1..15 - a door's scale (actionSystem.js interiorLockpickingChance:
 *  5 x (level - lock) + Lockpicking, 5..95). The same on every client and every visit: a hash of where it stands. */
export const SEARCH_LOCKED_SHARE = 1 / 3;
export const SEARCH_LOCK_MAX = 15;
export function searchLockValue(kind, locationKey, objectKey) {
  if (!SEARCH_KINDS[kind]?.lockable) return 0;
  const r = eliteRng(eliteHash('search-lock', locationKey, objectKey));
  return r() < SEARCH_LOCKED_SHARE ? 1 + Math.floor(r() * SEARCH_LOCK_MAX) : 0;
}

// ── the ledger: the cooldown and the picked locks ───────────────────
const _ledger = new Map();   // `${location}|${object}` -> { t: game minute searched (or -Infinity), u: picked, w: who searched it - a partymate's name, null for me }
export const searchKey = (locationKey, objectKey) => `${locationKey}|${objectKey}`;
/** Minutes until it may be searched again (0: now). */
export function searchCooldownLeft(key, nowMinutes) {
  const e = _ledger.get(key);
  if (!e || !Number.isFinite(e.t)) return 0;
  return Math.max(0, SEARCH_COOLDOWN_MINUTES - (nowMinutes - e.t));
}
/** The longest name a search is told by. */
export const SEARCH_WHO_MAX = 32;
/** A search at `nowMinutes` - mine (`who` null), or a partymate's by their name (GRAVE-PARTY: landed from the room's word
 *  underground, the cell's above). The LATER search holds the five hours: a word about an earlier one (a memory, a
 *  welcome) never shortens a search already marked. */
export function markSearched(key, nowMinutes, who = null) {
  const e = _ledger.get(key);
  if (e && Number.isFinite(e.t) && e.t > nowMinutes) return;
  _ledger.set(key, { ...(e ?? { u: false }), t: nowMinutes, w: typeof who === 'string' && who ? who.slice(0, SEARCH_WHO_MAX) : null });
}
export const isPicked = (key) => !!_ledger.get(key)?.u;
export const markPicked = (key) => { _ledger.set(key, { t: -Infinity, w: null, ...(_ledger.get(key) ?? {}), u: true }); };
/** The text a searched object answers inside its five hours. */
export const SEARCHED_TEXT = 'You have already searched here.';
/** GRAVE-PARTY (FIELD BUGS 2026-10-16b): who searched it, when another of the party did - their name, else null (mine). */
export const searchedBy = (key) => _ledger.get(key)?.w ?? null;
/** GRAVE-PARTY: what a searched object answers inside its hours - SEARCHED_TEXT for my own search, and the searcher by
 *  name for a partymate's ("Already searched by Ann."), so a stone a partymate searched is not a mystery. */
export const searchedText = (key) => { const w = searchedBy(key); return w ? t('search.searchedBy', 'Already searched by {name}.', { name: w }) : SEARCHED_TEXT; };

/** THE SAVE: every picked lock and every cooldown still running; at most SEARCH_LEDGER_MAX rows, newest kept. */
export const SEARCH_LEDGER_MAX = 4000;
export const SEARCH_SAVE_VENDOR = 'Searchables';
export function searchLedgerRecord(nowMinutes = Infinity) {
  const rows = [];
  for (const [k, e] of _ledger) {
    const live = Number.isFinite(e.t) && (!Number.isFinite(nowMinutes) || nowMinutes - e.t < SEARCH_COOLDOWN_MINUTES);
    if (live || e.u) rows.push(e.w ? [k, Number.isFinite(e.t) ? e.t : null, e.u ? 1 : 0, e.w] : [k, Number.isFinite(e.t) ? e.t : null, e.u ? 1 : 0]);   // GRAVE-PARTY: a partymate's search keeps their name
  }
  rows.sort((a, b) => (b[1] ?? -Infinity) - (a[1] ?? -Infinity));
  return { rows: rows.slice(0, SEARCH_LEDGER_MAX) };
}
export function restoreSearchLedger(record) {
  _ledger.clear();
  for (const r of Array.isArray(record?.rows) ? record.rows.slice(0, SEARCH_LEDGER_MAX) : []) {
    if (!Array.isArray(r) || typeof r[0] !== 'string' || r[0].length > 200) continue;
    const t = Number.isFinite(r[1]) ? r[1] : -Infinity;
    _ledger.set(r[0], { t, u: r[2] === 1, w: typeof r[3] === 'string' && r[3] ? r[3].slice(0, SEARCH_WHO_MAX) : null });
  }
}
let _clock = () => Infinity;
/** The host's game clock, so a save drops cooldowns already run out. */
export const setSearchClock = (fn) => { _clock = typeof fn === 'function' ? fn : () => Infinity; };
registerModSaveData(SEARCH_SAVE_VENDOR, {
  newSaveData: () => ({ rows: [] }),
  getSaveData: () => searchLedgerRecord(_clock()),
  restoreSaveData: (r) => restoreSearchLedger(r),
});
/** Tests only. */
export const _resetSearchLedgerForTests = () => _ledger.clear();

// ── GRAVE-PARTY: whose search it was ────────────────────────────────
// (FIELD BUGS 2026-10-16b, "graveyard loot on headstones are able to be looted by others, objects in tombs are un
// lootable"; Mac, SEARCH1-PARTY: "When one player in the party interacted with it no one else can again for 5 hours".)
// A search's five hours are its searcher's PARTY's - underground (the room's `srch:<i>` word, scenes/searchRoom.js) and
// above (the cell's grave stamps, net/overworldLaw.js) alike - and never a stranger's: a stranger's search locks nothing
// of mine, mine nothing of theirs. Who a searcher is to me is the streaming host's party lens, registered here.
/** The longest account a search names. */
export const SEARCH_ACCT_MAX = 128;
const acctOk = (a) => typeof a === 'string' && a.length > 0 && a.length <= SEARCH_ACCT_MAX;
/** The party lens: `{ self() -> my account, selfName() -> my character's name, inParty(acct), nameOf(acct) -> a member's
 *  name, acctOfPeer(peerId) }` (the hub's picture and the session's issued name - scenes/searchPartyHost.js registers the
 *  streaming host's). None (the bench, offline): every other searcher is nobody of mine. */
let _party = null;
export const setSearchParty = (lens) => { _party = lens && typeof lens === 'object' ? lens : null; };
/** The lens registered now (a harness standing several players in one process swaps them by it). */
export const searchPartyLens = () => _party;
/** My own account, or null. */
export const searchSelfAcct = () => { const a = _party?.self?.(); return acctOk(a) ? a : null; };
/** Who a searcher's account is to me: 'me', 'party', or null (a stranger, or nobody the lens knows). */
export function searchKinOf(acct) {
  if (!acctOk(acct) || !_party) return null;
  if (acct === searchSelfAcct()) return 'me';
  return _party.inParty?.(acct) ? 'party' : null;
}
/** The account behind a peer id (my own tab, a partymate's), or null - a live word's speaker. */
export const searchAcctOfPeer = (id) => { const a = typeof id === 'string' && id ? _party?.acctOfPeer?.(id) : null; return acctOk(a) ? a : null; };
/** The name a search by `acct` is told by: null for mine; a partymate's seat name (the hub's) - or `fallback` (the
 *  relay's stamp), else "your party". */
export function searchWhoOf(acct, fallback = null) {
  if (searchKinOf(acct) !== 'party') return null;
  const n = _party?.nameOf?.(acct);
  const name = typeof n === 'string' && n ? n : (typeof fallback === 'string' && fallback ? fallback : t('search.yourParty', 'your party'));
  return name.slice(0, SEARCH_WHO_MAX);
}
/** My own character's name (the lens's - the session's issued name, the one the relay stamps), or null. */
export const searchSelfName = () => { const n = _party?.selfName?.(); return typeof n === 'string' && n ? n.slice(0, SEARCH_WHO_MAX) : null; };
/**
 * AUDIT GRAVE-PARTY G5: THE NAME A SEARCH IS TOLD BY, its searcher's account `acct` and the searching character's `name`
 * (the relay's stamp above ground, the word's `bn` below). A partymate's: their seat name (searchWhoOf, `name` the
 * fallback). MY ACCOUNT'S on ANOTHER of its characters: that character's name - the five hours are the account's (one
 * player, whichever character: an alt searching the stone again is the same player's second find), but the character
 * pressing now never searched it, and "You have already searched here." told it it had. Mine, this character's - or a
 * name nobody said, or mine unknown - null: the old words. A stranger's: null (it lands nowhere).
 */
export function searchToldBy(acct, name = null) {
  const kin = searchKinOf(acct);
  if (kin === 'party') return searchWhoOf(acct, name);
  if (kin !== 'me' || typeof name !== 'string' || !name) return null;
  const n = name.slice(0, SEARCH_WHO_MAX), mine = searchSelfName();
  return mine && n !== mine ? n : null;
}

// ── the words ───────────────────────────────────────────────────────
// Daggerfall's own register: second person, past the event, the parchment's short rows. `%s` is the foe's name.
const FOE_GRAVE = Object.freeze({
  coffin: [
    ['You pry the warped lid aside.', 'The stench of the grave rolls out,', 'and something within draws breath', 'it has no right to.', '', 'A %s rises to meet you!'],
    ['The coffin is not empty.', 'Bony fingers close about your wrist', 'before you can pull it back.', '', 'A %s stirs from its rest!'],
  ],
  sarcophagus: [
    ['Stone grinds on stone as the lid gives.', 'Within, the wrappings shift and tear,', 'and dead eyes open in the dark.', '', 'A %s wakes, and it is not pleased.'],
    ['Old wards crumble beneath your hands.', 'Whatever they kept in has been', 'waiting a long time for this.', '', 'A %s claws its way out!'],
  ],
  shelf: [
    ['Behind the moldering tomes your hand', 'finds a skull - and the skull turns', 'to look at you.', '', 'A %s answers the disturbance!'],
    ['A brittle scroll crumbles at your touch.', 'The words upon it were a binding,', 'and you have just broken it.', '', 'A %s is loosed upon you!'],
  ],
  tombstone: [
    ['The earth before the stone is soft.', 'Too soft. It heaves, and a hand', 'breaks through the sod.', '', 'A %s rises from the grave!'],
    ['As you brush the moss from the name,', 'the ground beneath you groans.', 'The dead do not care to be read.', '', 'A %s claws free of its grave!'],
  ],
});
const FOE_PLACE = Object.freeze({
  chest: [
    ['The hinges shriek like a dying man.', 'Somewhere in the dark, footsteps', 'quicken toward the sound.', '', 'A %s has heard you!'],
    ['You have barely raised the lid when', 'you hear it - the scrape of claws', 'and the breathing behind you.', '', 'A %s comes to guard its hoard!'],
  ],
  crate: [
    ['The boards split with a crack that', 'echoes down every passage.', 'You are no longer alone.', '', 'A %s comes looking!'],
    ['Splinters fly as the crate gives way.', 'The din carries far, and something', 'that lairs here answers it.', '', 'A %s is upon you!'],
  ],
});
const ELITE_ROW = 'It burns with a cold, unholy light...';
const MANY_ROW_GRAVE = 'And it does not rise alone.';
const MANY_ROW_PLACE = 'And it has brought company.';
const ELITE_ROW_PLACE = 'It moves with a terrible purpose...';
const LOOT = Object.freeze({
  coffin: [['Beneath the rotted shroud, the dead', 'still clutch what they could not', 'take with them.'], ['The departed were buried with', 'more than their names. You do not', 'think they will miss it.']],
  sarcophagus: [['Grave goods glint amid the wrappings -', 'offerings for a journey', 'their owner never took.'], ['The noble dead keep their wealth', 'close. Not close enough.']],
  shelf: [['Among the dust and the cobwebs,', 'a few things of worth have', 'escaped the years.'], ['Someone hid their valuables', 'behind these old books, and', 'never came back for them.']],
  tombstone: [['Something is buried at the foot of', 'the stone - a mourner\'s offering,', 'or a thief\'s cache.'], ['The earth here was disturbed once', 'before. Whoever dug it left', 'something behind.']],
  chest: [['The chest yields its contents.', 'Whoever stocked it will not', 'be pleased.'], ['Inside, wrapped in oilcloth,', 'lies a small fortune.']],
  crate: [['Amid straw and splinters you', 'find more than provisions.'], ['The crate holds a few things', 'worth the carrying.']],
});
const NOTHING = Object.freeze({
  coffin: [['Nothing but bones and dust.', 'The grave-robbers came before you.'], ['The coffin holds only the dead,', 'and the dead hold nothing of value.']],
  sarcophagus: [['The sarcophagus was plundered long ago.', 'Only scraps of linen remain.'], ['Dust, bone and silence.', 'Nothing worth the taking.']],
  shelf: [['Rotten parchment and empty jars.', 'Nothing of value.'], ['The books crumble at your touch.', 'Whatever was here is long gone.']],
  tombstone: [['The grave keeps its own counsel.', 'You find nothing of value.'], ['Only moss, earth and a name', 'time has nearly taken.'], ['The stone is cold, the ground undisturbed.', 'There is nothing here for you.'], ['Here lies one who took', 'everything with them.']],
  chest: [['The chest is empty.', 'Someone was here before you.'], ['Nothing but cobwebs', 'and the smell of old rope.']],
  crate: [['Rotten straw and broken pottery.', 'Nothing of value.'], ['The crate holds nothing', 'worth carrying.']],
});
const pickRows = (pool, rolls) => [...pool[Math.min(pool.length - 1, Math.floor(rolls() * pool.length))]];
/**
 * THE MESSAGE the player clicks away before anything happens: its rows. `foeName` fills `%s`; `elite` adds the
 * elite's row.
 */
export function searchMessage(kind, outcome, { foeName = 'creature', elite = false, count = 1, rolls = Math.random } = {}) {
  const k = SEARCH_KINDS[kind] ? kind : 'chest';
  if (outcome === 'foe') {
    const grave = SEARCH_KINDS[k].grave;
    const rows = pickRows((grave ? FOE_GRAVE : FOE_PLACE)[k] ?? FOE_PLACE.chest, rolls).map((r) => r.replace('%s', foeName));
    if (elite) rows.push(grave ? ELITE_ROW : ELITE_ROW_PLACE);
    if (count > 1) rows.push(grave ? MANY_ROW_GRAVE : MANY_ROW_PLACE);
    return rows;
  }
  if (outcome === 'loot') return pickRows(LOOT[k], rolls);
  return pickRows(NOTHING[k], rolls);
}

// ── THE ONE CONSTRUCTION SEAM for a find (both hosts call it) ───────
const finish = (raw) => (raw ? mintCondition(setItemFields(raw)) : null);
/** The goods' minters, DFU's ItemBuilder doors (systems/loot/loot.js, systems/books.js). Never ammunition. */
export function searchMinters(gender = 'male') {
  return {
    weapon: (lv, r) => { const w = createRandomWeapon(lv, r); return w && !isAmmunition(w) ? finish(w) : null; },
    armor: (lv, r) => finish(createRandomArmor(lv, r)),
    jewellery: (lv, r) => finish(createRandomJewellery(r)),
    religious: (lv, r) => finish(createRandomReligiousItem(r)),
    gem: (lv, r) => finish(createRandomGem(r)),
    clothing: (lv, r) => finish(createRandomClothing(gender, r)),
    potion: (lv, r) => createRandomPotion(r),
    book: (lv, r) => { try { return createRandomBook(r); } catch { return null; } },
  };
}
/** THE FIND, minted and laddered: rollSearchLoot over searchMinters, then the rarity ladder at the place's pile tier
 *  (lootRarity.js - a no-op with the switch off). */
export function mintSearchFind(kind, { level = 1, gender = 'male', tier = 0, family = null, luck = 50, rolls = Math.random, mint = null } = {}) {
  const items = rollSearchLoot(kind, level, mint ?? searchMinters(gender), rolls);
  rollLootRarity(items, { ...pileSource(tier), family }, { rolls, luck });
  return items;
}
