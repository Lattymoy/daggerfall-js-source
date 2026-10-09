// @ts-check
// THE FLEET (HOLDINGS, 2026-10-03 - bible/03-World/Holdings.md; Mac: "You can also do this with ships instead of relying
// on a deed item ... Ships show their values, current health, and option to repair if theres crew (even if youre away)
// ... Introducing the new ship upgrade system. Allowing you to improve capacity, speed, health, damage, etc. This can
// utilize foraging items used within the world. Loaned ships shouldnt be able to be upgraded until the loan is paid off.
// This also introduces the ability to change your ship name for others to see ... Ship deeds can now be replaced in
// favor of the new enhanced plus UI tabs on the pause menu").
//
// THE LEDGER - every ship the player holds title to, by her number (the UID her deed placed her by, Come Sail Away's
// own; systems/comeSailAway.js GetPlacedBoatWithUID): her hull and rig, her worth, the name her captain gave her, her
// refits, the bank's claim on her while the loan she was bought on stands, and the port she was last laid up at.
//
// THE BOOK - her TITLE. A deed (Come Sail Away's item 1321) no longer rides in the pack: it is entered here, and the mod's
// every law that asks for a deed - a ship's pick-up (PackBoat's deedInPack), her parts placed (takePlaceItem's swap),
// her summoning (the deed's placing) - finds it here as it found it in the pack (the book is a collection of the same
// deed items, by the same UIDs). A deed found in the pack - an older save's, a shelf's, the console's - is entered the
// first time the ledger is asked (`titleDeedsIn`).
//
// WHERE SHE IS is never stored: it is read off the world each time (afloat: a boat of hers stands; packed: her parts are
// in the pack; laid up: neither, her title in the book) - scenes/fleetHost.js. Nothing here touches a host.

import { mintDeed, BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE } from './comeSailAwayItems.js';
import { HULL_NAMES, HULL_PRICES, VARIANT_NAMES, HULL_VARIANT_COUNTS } from './comeSailAwayBoat.js';
import { checkName, textCaught } from '../net/nameFilter.js';

export const FLEET_SAVE_VENDOR = 'Fleet';
export const FLEET_SAVE_VERSION = 1;
/** A ship's name: printable ASCII, this long at most (the wire carries it to every other player). */
export const SHIP_NAME_MAX = 24;

// ── THE NAME ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A name a captain gives her, as it is kept and said: the printable ASCII of it (the wire's own band - net/wire.js
 * sanitizeName's), its runs of spaces closed, trimmed, SHIP_NAME_MAX at most; and allowed by the name filter every
 * player's name passes (net/nameFilter.js checkName) - and AUDIT 657 T4, word by word as a rank's name is (textCaught):
 * a ship's name is words ("Laden Gull"), checkName reads them as one, and a word the lists catch stood in one beside its
 * others - said to every crew that sees her (comeSailAwayWire.js shipNameOf judges her name again by this). An empty name
 * is her hull's again. Answers `{ ok, name, reason }`. Pure.
 */
export function shipNameVerdict(raw) {
  let s = '';
  for (const ch of String(raw ?? '')) { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) s += ch; }
  s = s.replace(/\s+/g, ' ').trim().slice(0, SHIP_NAME_MAX).trim();
  if (!s) return { ok: true, name: '', reason: null };
  const v = checkName(s);
  const caught = v.ok ? textCaught(s) : null;
  if (caught) return { ok: false, name: '', reason: `That name reads as "${caught}". Please pick another.` };
  return v.ok ? { ok: true, name: s, reason: null } : { ok: false, name: '', reason: v.reason ?? 'That name will not do.' };
}
/** What she is called where a line names her: her own name, else her hull's ("Small Ship 'I'"). */
export const shipLabel = (rec) => (rec?.name ? rec.name : `${HULL_NAMES[rec?.hull] ?? 'Boat'} '${VARIANT_NAMES[rec?.variant | 0] ?? 'I'}'`);

// ── THE REFITS ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The materials a refit takes, and what in the world each is: a Foraging find (the Wood-Axe's Wood Bundle), an
 *  alchemist's shelf (Iron, a Pine Branch - DFU's own ingredients, the Sickle's quests' finds), or online a Stores
 *  good withdrawn to the pack (a plank or a log, an ingot, resin - net/professionLaw.js). Each item counts one. */
export const MATERIALS = Object.freeze({
  timber: Object.freeze({ label: 'Timber', hint: 'Wood Bundles - a Wood-Axe gathers them - or planks and logs', templates: Object.freeze([1604, 645, 646, 647, 648, 649, 650, 651, 635, 636, 637, 638, 639, 640, 641]) }),
  iron: Object.freeze({ label: 'Iron', hint: 'Iron from an alchemist, or iron and steel ingots', templates: Object.freeze([71, 620, 621]) }),
  pitch: Object.freeze({ label: 'Pitch', hint: 'Pine Branches for their resin, or Resin itself', templates: Object.freeze([14, 653]) }),
});
/** The four refits, each UPGRADE_TIERS deep: what it betters, by how much a tier, and what it is built of. Guns only on
 *  a hull that carries them. */
export const UPGRADE_LINES = Object.freeze([
  Object.freeze({ id: 'hold', label: 'Hold', what: 'Cargo she carries before she rides low', per: 0.2, effect: 'cargo', mats: Object.freeze(['timber', 'iron']), guns: false }),
  Object.freeze({ id: 'rigging', label: 'Rigging', what: 'Her way under sail', per: 0.04, effect: 'speed', mats: Object.freeze(['timber', 'pitch']), guns: false }),
  Object.freeze({ id: 'hull', label: 'Hull', what: 'Her hull and canvas', per: 0.1, effect: 'hull', mats: Object.freeze(['timber', 'pitch', 'iron']), guns: false }),
  Object.freeze({ id: 'guns', label: 'Guns', what: 'The weight of her broadsides', per: 0.08, effect: 'guns', mats: Object.freeze(['iron', 'pitch']), guns: true }),
]);
export const UPGRADE_TIERS = 3;
/** A tier's gold and each material's count, for a Small Ship - times her hull's share (HULL_UPGRADE_SCALE). */
export const TIER_GOLD = Object.freeze([600, 1500, 3500]);
export const TIER_MATS = Object.freeze([3, 6, 10]);
export const HULL_UPGRADE_SCALE = Object.freeze([0.5, 0.75, 1, 1.75, 2.5]);
const lineOf = (id) => UPGRADE_LINES.find((l) => l.id === id) ?? null;
const tierOf = (rec, id) => Math.max(0, Math.min(UPGRADE_TIERS, rec?.upgrades?.[id] | 0));
/** What her next tier of `line` costs: `{ gold, mats: [{ kind, n }] }`, or null past the last. Pure. */
export function upgradeCost(hull, id, tier) {
  const line = lineOf(id);
  if (!line || !(tier >= 0 && tier < UPGRADE_TIERS)) return null;
  const k = HULL_UPGRADE_SCALE[hull] ?? 1;
  return { gold: Math.round((TIER_GOLD[tier] * k) / 10) * 10, mats: line.mats.map((kind) => ({ kind, n: Math.max(1, Math.round(TIER_MATS[tier] * k)) })) };
}
/** Her refits as the sea and the helm read them - each a multiple of her build's own: `cargo` her hold's threshold,
 *  `speed` her way and its coming on, `hull` her hull's and canvas's whole, `guns` her shot's harm. Pure. */
export function refitOf(rec) {
  const at = (id) => Math.round((1 + tierOf(rec, id) * (lineOf(id)?.per ?? 0)) * 10000) / 10000;
  return { cargo: at('hold'), speed: at('rigging'), hull: at('hull'), guns: at('guns') };
}
/** The words for a line at a tier ("Cargo +40%"). */
export const refitWords = (id, tier) => { const l = lineOf(id); return l ? `${l.label} ${['-', 'I', 'II', 'III'][tier] ?? tier}` : ''; };
/** How many of `kind` stand in `lists` (each item a template of the kind, its stack counted). Pure. */
export function materialCount(lists, kind) {
  const t = MATERIALS[kind]?.templates ?? [];
  let n = 0;
  for (const list of lists) for (const it of list ?? []) if (it && t.includes(it.templateIndex)) n += Math.max(1, it.stackCount | 0 || 1);
  return n;
}
/** `n` of `kind` taken out of `lists`, the first list first (a stack thinned, an item gone at its last) - all or none.
 *  Answers whether they were taken. */
export function takeMaterials(lists, kind, n) {
  if (materialCount(lists, kind) < n) return false;
  const t = MATERIALS[kind].templates;
  let left = n;
  for (const list of lists) {
    for (let i = 0; list && i < list.length && left > 0;) {
      const it = list[i];
      if (!it || !t.includes(it.templateIndex)) { i++; continue; }
      const have = Math.max(1, it.stackCount | 0 || 1);
      if (have > left) { it.stackCount = have - left; left = 0; break; }
      left -= have;
      list.splice(i, 1);
    }
  }
  return true;
}

// ── THE BANK'S CLAIM ─────────────────────────────────────────────────────────────────────────────────────────────────
// SHIP-CREDIT WITHDRAWN (2026-10-08, Mac: "Remove ship buying loan from the bank"): no counter sells a boat on the bank's
// credit any more, so no purchase stamps a claim. A ship bought on it before carries hers in the save (`credit`, read
// back by restoreFleetSaveData) and keeps it - no refit while it stands - until that bank is owed nothing.
/**
 * The loan she was bought on, while it stands: the bank of `credit.region` still owed, by the loan that bought her (its
 * due date the one her purchase set - a loan taken there since for something else is not hers). Answers
 * `{ region, owed }` or null. Pure.
 */
export function loanOwed(rec, accounts) {
  const c = rec?.credit;
  if (!c || !Array.isArray(accounts)) return null;
  const a = accounts[c.region];
  // AUDIT HOLDINGS F4: owed while her region's bank is owed anything at all - its due date is no mark of the loan that
  // bought her (borrowing more puts it later, the Empire calling the debt in sets it to now, and either lifted her claim
  // with the loan unpaid); cleared for good once the Fleet sees nothing owed there (`settleCredit`)
  if (!a || !(a.loanTotal > 0)) return null;
  return { region: c.region, owed: a.loanTotal };
}
/** AUDIT HOLDINGS F4: every claim whose region's bank is owed nothing now cleared for good - the loan that bought her
 *  repaid (a later one is no claim of hers). Answers how many were cleared. */
export function settleCredit(accounts) {
  if (!Array.isArray(accounts)) return 0;
  let n = 0;
  for (const r of _ships.values()) if (r.credit && !(accounts[r.credit.region]?.loanTotal > 0)) { r.credit = null; n++; }
  return n;
}

// ── THE LEDGER ───────────────────────────────────────────────────────────────────────────────────────────────────────
const _ships = new Map();   // uid -> record
const _book = [];           // her title: the deed items, Come Sail Away's own shape (mintDeed)
const upgradesBlank = () => ({ hold: 0, rigging: 0, hull: 0, guns: 0 });
const isUid = (v) => Number.isSafeInteger(v) && v > 0;
const hullOk = (h) => Number.isInteger(h) && h >= 0 && h < HULL_NAMES.length;
/** AUDIT HOLDINGS F7: a variant her hull has - the Large Boat's seven, every other hull's one (SpawnBoat throws on any
 *  other: a hostile save's Large Boat 8 threw from the page's Summon). */
const variantOk = (hull, v) => Number.isInteger(v) && v >= 0 && v < Math.max(1, HULL_VARIANT_COUNTS[hull] ?? 0);
/** AUDIT HOLDINGS F7: the most a save may hold, and her worth's ceiling (gold). */
export const FLEET_MAX = 256;
export const SHIP_VALUE_MAX = 10000000;
/** A deed's hull and variant, read as Come Sail Away reads them (`hull * 10 + variant`). */
const hullOfItem = (it) => Math.floor((it?.message | 0) / 10);
const variantOfItem = (it) => (it?.message | 0) % 10;

/** Her record, made the first time she is named (an older deed's ship, a prize, a purchase). */
function recordFor(uid, hull, variant, value) {
  let r = _ships.get(uid);
  if (!r) {
    r = { uid, hull, variant, value: Number.isFinite(value) ? value : HULL_PRICES[hull] ?? 0, name: '', upgrades: upgradesBlank(), credit: null, port: null };
    _ships.set(uid, r);
  }
  return r;
}
export const fleetShip = (uid) => _ships.get(uid) ?? null;
export const fleetShips = () => [..._ships.values()];
/** The book: the live list of her titles (the collection Come Sail Away places a deed from, and takes it out of). */
export const fleetBook = () => _book;
/** Her title in the book, by her number. */
export const titleOf = (uid) => _book.find((it) => it?.UID === uid) ?? null;
/**
 * A DEED ENTERED: taken out of `from` (the list it lay in - the pack - or none), into the book, her record made or
 * kept; `port` where she waits. A deed already in the book is not entered twice. Answers her record, or null for an
 * item that is no deed.
 */
export function titleDeed(deed, { from = null, port = null } = {}) {
  if (deed?.templateIndex !== BOAT_DEED_TEMPLATE || !isUid(deed.UID) || !hullOk(hullOfItem(deed))) return null;
  if (from) { const i = from.indexOf(deed); if (i >= 0) from.splice(i, 1); }
  if (!titleOf(deed.UID)) _book.push(deed);
  const r = recordFor(deed.UID, hullOfItem(deed), variantOfItem(deed), deed.value);
  if (port) r.port = port;
  return r;
}
/** Every deed in `pack` entered (an older save's, a shelf's, the console's). Answers how many. */
export function titleDeedsIn(pack, opts = {}) {
  let n = 0;
  // AUDIT HOLDINGS F2: never the deed a placing holds (`except`) - entered mid-placing, the placing spent its small
  // boat's deed out of the pack, where it no longer lay, and her title stayed in the book while she stood
  for (const it of [...(pack ?? [])]) if (it?.templateIndex === BOAT_DEED_TEMPLATE && it !== opts.except && titleDeed(it, { ...opts, from: pack })) n++;
  return n;
}
/** A boat of the player's standing with no title (a small boat's parts placed - its deed spent, as the mod spends one;
 *  her parts in the pack) given her record, so her name and her refits are hers. */
export function knowShip(uid, hull, variant, value) {
  if (!isUid(uid) || !hullOk(hull)) return null;
  const r = recordFor(uid, hull, variantOk(hull, variant) ? variant : 0, value);
  // AUDIT HOLDINGS F3: her rig as she stands now (a Large Boat's picked again) - her record and her title with it, so a
  // ship laid up and called back keeps the rig she was sent away in
  if (r.hull === hull && variantOk(hull, variant) && r.variant !== variant) {
    r.variant = variant;
    const t = titleOf(uid);
    if (t) { const fresh = mintDeed(r.hull, variant, uid, t.value); t.message = fresh.message; t.name = fresh.name; }
  }
  return r;
}
/** AUDIT HOLDINGS F8: a record no ship answers (a prize whose claim failed after her title was entered) forgotten. */
export function forgetShip(uid) {
  _ships.delete(uid);
  const i = _book.findIndex((it) => it?.UID === uid);
  if (i >= 0) _book.splice(i, 1);
}
/** Her name given (`shipNameVerdict`'s): answers the verdict. */
export function renameShip(uid, raw) {
  const r = _ships.get(uid);
  if (!r) return { ok: false, name: '', reason: 'No such ship of yours.' };
  const v = shipNameVerdict(raw);
  if (v.ok) r.name = v.name;
  return v;
}
/** A refit's tier added (the caller has paid). */
export function addRefit(uid, id) {
  const r = _ships.get(uid);
  if (!r || !lineOf(id) || tierOf(r, id) >= UPGRADE_TIERS) return false;
  r.upgrades[id] = tierOf(r, id) + 1;
  return true;
}
/** The port she was laid up at (`{ name }`), or null. */
export function setShipPort(uid, port) { const r = _ships.get(uid); if (r) r.port = port ? { name: String(port.name ?? '') } : null; }
/** Her title made again where none is (a crewed ship's parts placed swap back to her deed - the mod's takePlaceItem). */
export function retitle(uid) {
  const r = _ships.get(uid);
  if (!r || titleOf(uid)) return titleOf(uid);
  const d = mintDeed(r.hull, r.variant, uid, r.value);
  _book.push(d);
  return d;
}

// ── THE SAVE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export function newFleetSaveData() { return { v: FLEET_SAVE_VERSION, ships: [] }; }
export function fleetSaveData() {
  return {
    v: FLEET_SAVE_VERSION,
    ships: [..._ships.values()].map((r) => ({ uid: r.uid, hull: r.hull, variant: r.variant, value: r.value, name: r.name, upgrades: { ...r.upgrades },
      credit: r.credit ? { ...r.credit } : null, port: r.port ? { ...r.port } : null, title: !!titleOf(r.uid) })),
  };
}
/** A save's record restored - every field read as it may be (a record made by hand, a newer build's): an unknown
 *  hull, a bad number, a name the filter refuses, left out or put right. */
export function restoreFleetSaveData(data) {
  _ships.clear();
  _book.length = 0;
  // AUDIT HOLDINGS F7: a save read as it may be - FLEET_MAX records at most, one a number (a second of the same uid
  // entered a second title), her variant one her hull has, her worth within [0, SHIP_VALUE_MAX], her port's name the
  // printable text a name keeps
  for (const s of (Array.isArray(data?.ships) ? data.ships : []).slice(0, FLEET_MAX)) {
    if (!s || !isUid(s.uid) || !hullOk(s.hull) || _ships.has(s.uid)) continue;
    const variant = variantOk(s.hull, s.variant) ? s.variant : 0;
    const r = recordFor(s.uid, s.hull, variant, Number.isFinite(s.value) ? Math.max(0, Math.min(SHIP_VALUE_MAX, s.value)) : undefined);
    const v = shipNameVerdict(s.name);
    r.name = v.ok ? v.name : '';
    for (const l of UPGRADE_LINES) r.upgrades[l.id] = Math.max(0, Math.min(UPGRADE_TIERS, Number(s.upgrades?.[l.id]) | 0));
    r.credit = s.credit && Number.isInteger(s.credit.region) && s.credit.region >= 0 ? { region: s.credit.region, due: Number.isFinite(s.credit.due) ? s.credit.due : 0 } : null;
    const port = typeof s.port?.name === 'string' ? printable(s.port.name).slice(0, 64) : '';
    r.port = s.port && typeof s.port.name === 'string' ? { name: port } : null;
    if (s.title) _book.push(mintDeed(r.hull, r.variant, r.uid, r.value));
  }
}
/** Printable ASCII alone (a line break or a tab a space), runs of white space closed. */
const printable = (raw) => { let t = ''; for (const ch of String(raw ?? '')) { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) t += ch; else if (/\s/.test(ch)) t += ' '; } return t.replace(/\s+/g, ' ').trim(); };
/** The ledger as a mod's save slot (systems/modSaveData.js registerModSaveData). */
export const fleetSaveSlot = Object.freeze({ newSaveData: newFleetSaveData, getSaveData: fleetSaveData, restoreSaveData: restoreFleetSaveData });
/** Tests: an empty ledger. */
export function _resetFleetForTests() { _ships.clear(); _book.length = 0; }
export { BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE };
