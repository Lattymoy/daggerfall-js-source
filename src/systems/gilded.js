// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GILDED1 (2026-10-07) — THE GILDED RUNG, AND THE HOURLOCK.
//
// Mac: "I want to add a new weapon of a new rarity. The thunderlock of
// rarity above atheric. The most rare and gilded item in the entire game
// with a static role. Ensure its powerful but not overpowered." Design
// and record: bible/06-Systems/Gilded.md.
//
// ═══ GILDED ════════════════════════════════════════════════════════
//
// The ladder's TOP rung (systems/loot/lootRarity.js RARITIES: rank 6, over
// the Artifact's 5): a colour of its own - gold leaf, warm and bright -
// two stars for pips, a frame, a price. "The most rare ... in the entire
// game" puts it over DFU's artifacts too: an artifact is a Daedra's gift
// for a quest done, there to be had by anyone who asks the right Prince;
// this is one roll in fifty off the hardest fight the port has. NOTHING
// ROLLS IT: the ladder's roll (applyRarity) takes the rolled tiers alone,
// so no drop, pile, shelf, Broker or Reforge ever lands on it.
//
// ═══ THE HOURLOCK ══════════════════════════════════════════════════
//
// One record, and it is a Thunderlock (the port's own weapon, template
// 560 - systems/thunderlock.js): what the Warp kept of a Dwemer smith's
// last commission, gilded in the Hour that never ended. A STATIC ROLL -
// every number is its record's, minted whole and KNOWN, never rolled,
// reforged, honed, socketed, imprinted, cursed or enchanted - so the
// wire holds it to its record EXACTLY (validGildedMarks), as no other
// tier can be held.
//
// POWERFUL, NOT OVERPOWERED. Its lines stand at the Legendary band's
// TOP and no higher (+40% damage, +15 Agility, +30 Archery, +10 shock a
// shot - the Brass of Numidium's own ceiling), and its power is the one
// thing nothing else has: THE HOUR TOLLS - every third of its shots that
// LANDS strikes for double, and a foe it fells gives back the pellet that
// felled it (systems/loot/lootPowers.js, kind 'toll'). Measured beside the
// best of the rest (bible/06-Systems/Gilded.md, "The numbers"): about
// twice The Last Lock a shot and level with a Legendary Daedric
// dai-katana a second - the gun's 1.7 s reload and its ammunition are
// still the price, and in a duel it is a plain Thunderlock (a power
// sleeps there, as a set does).
//
// ═══ THE DROP ══════════════════════════════════════════════════════
//
// The Brass Remnant's spoils (systems/superDungeon/sdSpoils.js) roll ONE MORE THING
// after everything they rolled before - so every earlier spoils, gold to
// the last Numidium piece, stays exactly what it was for its seed: the
// Hourlock GILDED_CHANCE of the time. Online alone, because the Hour is.
//
// ═══ GILDED2: THE WORLD'S TWO ═══════════════════════════════════════
//
// GILDED2 (2026-10-15, Mac: "With the introduction of elite dungeons
// soon. I want to enhance the rewards for each world activety. We need to
// add a rare gilded weapon to the oblivion gates. A gilded weapon to the
// serpent"): the rung's second and third records, each the last roll of a
// world boss's spoils - THE DRAGONFIRE OATH off the gate's Warden
// (systems/gate/gateSpoils.js), THE SUNKEN SOVEREIGN off the Old Coil's hoard
// for a ship that dealt (systems/serpent/serpentSpoils.js), each one fight in a
// hundred (a gate opens every two hours and a serpent rises every four,
// where an Hour is a few a week). DFU weapons both, minted by the game's
// own CreateWeapon (combat/enemyEquipment.js createWeapon) - the Hourlock
// keeps its gun's own mint, so its record and every gift of it stay what
// they were. Each a STATIC ROLL, its lines the Legendary band's top, and
// its power the one thing nothing else has (DRAGONFIRE, UNDERTOW below;
// systems/loot/lootPowers.js does them). Measured: bible/06-Systems/Gilded.md
// section 7.
//
// ═══ GUNS-UNFOUND (2026-10-23) ══════════════════════════════════════
//
// The owner: "remove the thunderlock and pistolet from the loot pool and
// revert the gilded weapon from the serpent. Dont remove them from players
// who have them, but it should no longer be able to drop" - and of the
// Hourlock, "Replace it", with a Dwarven Long Bow. So no record mints a gun
// now: the Hourlock is a gilded Dwarven Long Bow (its id, lines, power and
// lore kept) and the Sunken Sovereign the Ebony Saber GILDED2 made it. A gun
// minted under either before stays LAWFUL as its record's era
// (HOURLOCK_GUN_ERA, SOVEREIGN_PISTOLET_ERA), read through gildedRecordOf as
// AUDIT PISTOLET's saber era was. bible/06-Systems/Gilded.md section 9.
// ═══════════════════════════════════════════════════════════════════

import { WEAPON_MATERIALS, WEAPONS } from '../characters/weapons.js';
import { THUNDERLOCK_TEMPLATE, PISTOLET_TEMPLATE } from '../characters/thunderlockIds.js';
import { createThunderlock } from './thunderlock.js';
import { createPistolet } from './pistolet.js';   // PISTOLET: the Sunken Sovereign's pistolet era's mint
import { createWeapon } from '../combat/enemyEquipment.js';   // GILDED2: a DFU weapon's own mint (CreateWeapon)
import { itemBaseValue } from './item/itemTemplates.js';
import { affixesWorth, validAffix, registerGildedRecords } from './loot/lootRarity.js';
import { SKILLS } from './skills.js';

/** The tier's id, as `item.rarity` wears it. */
export const GILDED = 'gilded';
/** What a Gilded piece adds to its price, over its make and its affixes - the Aetheric's 2500 five times over. */
export const GILDED_WORTH = 12500;
/** The share of the Brass Remnant's earned receipts whose spoils carry the Hourlock: one in fifty. */
export const GILDED_CHANCE = 1 / 50;
/** GILDED2: the share of the gate Warden's spoils that carry the Dragonfire Oath - one in a hundred (a gate every two hours). */
export const GATE_GILDED_CHANCE = 1 / 100;
/** GILDED2: the share of a dealing ship's serpent hoards that carry the Sunken Sovereign - one in a hundred (a serpent every
 *  four hours, a ship that stood never). */
export const SERPENT_GILDED_CHANCE = 1 / 100;

/** THE HOUR TOLLS - the Hourlock's power (systems/loot/lootPowers.js does it, kind 'toll'). `every` landed shots, the last
 *  strikes `pct`% harder; `refund`: a foe it fells gives its shot back (GUNS-UNFOUND: an arrow off the bow, a pellet off
 *  the gun era's). Read once at import, frozen. */
export const HOUR_TOLLS = Object.freeze({
  name: 'The Hour Tolls', kind: 'toll', every: 3, pct: 100, refund: true,
  brief: 'Every 3rd hit x2; kills refund',   // inside the card's row (sigilSets.js BRIEF_MAX)
  text: 'Every third shot that lands tolls the Hour and deals double damage. A kill returns the shot',
});

/** GILDED2: DRAGONFIRE - the Dragonfire Oath's power (systems/loot/lootPowers.js, kind 'dragonfire'). A landed blow on a foe of
 *  `group` burns it again for `share`% of the blow, and every OTHER foe of it within `metres` for as much - Akatosh's fire,
 *  which no Daedra resists (no element's share is taken of it). AUDIT WORLD-REWARDS B1: the struck one's burn is what
 *  reaches a body the relay runs (the gate's Warden and his host, an Elite Gate's legion) - owed to its blow's own claim,
 *  as Open Hand's second blow is (playerDoor.js oweFoe); the burst on the others reaches only the foes the world runs.
 *  Read once at import, frozen. */
export const DRAGONFIRE = Object.freeze({
  name: 'Dragonfire', kind: 'dragonfire', group: 'daedra', share: 33, metres: 3,
  brief: 'Daedra burn +33%, and all in 3m',   // inside the card's row (sigilSets.js BRIEF_MAX)
  text: 'Each hit on a Daedra burns it with Dragonfire for a third of the damage, and burns every other Daedra within 3 m for the same. No Daedra resists it',
});
/** GILDED2: UNDERTOW - the Sunken Sovereign's power (systems/loot/lootPowers.js, kind 'undertow'). Each of its blows that LANDS on
 *  a foe drags it deeper: its next blows on that foe strike `pct`% harder for each landed before, up to `max`, while the
 *  tide holds - a foe it has not struck for `seconds` is let go (AUDIT WORLD-REWARDS B4: a body kept for a whole fight, a
 *  crystal of the next Reckoning, kept its stacks for good); a foe it fells gives `heal`% of my health back. Read once at
 *  import, frozen. */
export const UNDERTOW = Object.freeze({
  name: 'Undertow', kind: 'undertow', pct: 10, max: 5, seconds: 6, heal: 10,
  brief: '+10%/hit on a foe; kills heal',   // inside the card's row (sigilSets.js BRIEF_MAX)
  text: 'Each hit drags the foe deeper: +10% damage to your next hits on it for 6 s, up to +50%. A kill heals you for 10% of your health',
});

/** A record's line, frozen. */
const line = (id, value, param) => Object.freeze(param === undefined ? { id, value } : { id, param, value });

/** THE HOURLOCK - the Gilded rung's first record (GILDED2: the world's two after it). Its make Dwarven brass, gilded; its
 *  lines the Legendary band's top (lootRarity.js AFFIX_RANGES); its power HOUR_TOLLS. GUNS-UNFOUND (2026-10-23, the
 *  owner, of the Thunderlock's Gilded: "Replace it"): a Dwarven LONG BOW, where it was a Thunderlock - the same record
 *  otherwise, its id (the Remnant's spoils, the codex and every save read it), its lines, its power and its lore. */
export const HOURLOCK = Object.freeze({
  id: 'the-hourlock',
  name: 'The Hourlock',
  group: 'Weapons',
  templateIndex: WEAPONS.Long_Bow,
  material: WEAPON_MATERIALS.Dwarven,
  affixes: Object.freeze([
    line('damage', 40),
    line('stat', 15, 'agility'),
    line('skill', 30, SKILLS.Archery),
    line('elemental', 10, 'shock'),
  ]),
  power: HOUR_TOLLS,
  lore: 'Struck in the Hour that never ended, from the brass of a god that walked. Its gilding has never dulled.',
});
/** GUNS-UNFOUND: THE HOURLOCK'S GUN ERA - the Thunderlock GILDED1 minted it as. A save's item keeps its template, so an
 *  Hourlock found before is a gun still, lawful as it was minted (the Sovereign's eras' way, below); never minted again. */
export const HOURLOCK_GUN_ERA = Object.freeze({ ...HOURLOCK, templateIndex: THUNDERLOCK_TEMPLATE });

/** GILDED2: THE DRAGONFIRE OATH - the gate Warden's. A Daedric Dai-Katana (two hands, Long Blade): an Akaviri Dragonguard's
 *  blade, carried through the first gate and never carried back. Its lines the Legendary band's top; its power DRAGONFIRE
 *  (AUDIT WORLD-REWARDS B1: its fourth line Endurance, no longer a slayer of the Daedra - the power's burn on the struck
 *  Daedra is its edge there now, and the two together were three quarters over the best of the melee). */
export const DRAGONFIRE_OATH = Object.freeze({
  id: 'the-dragonfire-oath',
  name: 'The Dragonfire Oath',
  group: 'Weapons',
  templateIndex: WEAPONS.Dai_Katana,
  material: WEAPON_MATERIALS.Daedric,
  affixes: Object.freeze([
    line('damage', 40),
    line('stat', 15, 'strength'),
    line('skill', 30, SKILLS.LongBlade),
    line('stat', 15, 'endurance'),
  ]),
  power: DRAGONFIRE,
  lore: 'A Dragonguard carried it through the first gate and never carried it back. The Deadlands blackened its steel; the Dragonfire in its gilding never went out.',
  hint: 'Said to fall from the Warden of the Burning Gate, once in a long while',
});
/** GILDED2: THE SUNKEN SOVEREIGN - the Old Coil's. An Ebony Saber (one hand, Long Blade - a shield beside it): a Sentinel
 *  admiral's, swallowed with her flagship. PISTOLET (2026-10-21) re-pointed it at the Dwarven Pistolet; GUNS-UNFOUND
 *  (2026-10-23, the owner: "revert the gilded weapon from the serpent") points it back - GILDED2's saber, its id (the
 *  serpent's hoard and every save that holds one read it), its make, its lines, its power UNDERTOW and its lore. A
 *  Pistolet minted between reads its template off the item, as every save's does (SOVEREIGN_PISTOLET_ERA, below). */
export const SUNKEN_SOVEREIGN = Object.freeze({
  id: 'the-sunken-sovereign',
  name: 'The Sunken Sovereign',
  group: 'Weapons',
  templateIndex: WEAPONS.Saber,
  material: WEAPON_MATERIALS.Ebony,
  affixes: Object.freeze([
    line('damage', 40),
    line('stat', 15, 'agility'),
    line('skill', 30, SKILLS.LongBlade),
    line('leech', 10),
  ]),
  power: UNDERTOW,
  lore: 'A Sentinel admiral\'s saber, swallowed with her flagship off Stros M\'kai. The Old Coil gave back only the blade, and the sea never touched its gilding.',
  hint: 'Said to lie in the Old Coil\'s belly, once in a long while',
});

/** THE SOVEREIGN'S PISTOLET ERA (GUNS-UNFOUND; AUDIT PISTOLET A7, C1, D8 named the shape, as the saber era). PISTOLET
 *  minted the Sunken Sovereign an Ebony Dwarven Pistolet with an Archery line; GUNS-UNFOUND points the record back at
 *  the Saber. A save's item keeps its template, so a Sovereign minted between is a Pistolet still - and held to the
 *  saber record it would read as a forgery: the item law would find it 'gilded' (the account judge's trade hold, the
 *  market's refusal), and every peer route would drop it off the wire. It is the record's PISTOLET ERA: lawful as it was
 *  minted, reading its own lore; never re-minted (MAKER-KEPT's way: an era's piece keeps what it was given). */
export const SOVEREIGN_PISTOLET_ERA = Object.freeze({
  ...SUNKEN_SOVEREIGN,
  templateIndex: PISTOLET_TEMPLATE,
  affixes: Object.freeze(SUNKEN_SOVEREIGN.affixes.map((a) => (a.id === 'skill' ? Object.freeze({ ...a, param: SKILLS.Archery }) : a))),
  lore: 'A Sentinel admiral\'s pistolet, swallowed with her flagship off Stros M\'kai. The Old Coil gave back only the pistol, and the sea never touched its gilding, nor wet its powder.',
});

/** EVERY GILDED RECORD - the Hourlock, then (GILDED2) the gate's and the serpent's; the one list every reader asks. */
/** @type {readonly GildedRecord[]} */
export const GILDED_RECORDS = Object.freeze([HOURLOCK, DRAGONFIRE_OATH, SUNKEN_SOVEREIGN]);
export const gildedById = (id) => GILDED_RECORDS.find((r) => r.id === id) ?? null;
/** GUNS-UNFOUND: the eras a record's id was minted under before its record moved - each lawful as minted, none minted now. */
export const GILDED_ERAS = Object.freeze([HOURLOCK_GUN_ERA, SOVEREIGN_PISTOLET_ERA]);
/** The record AN ITEM was minted to: its record, or the era of that record its template was minted under (GUNS-UNFOUND:
 *  an Hourlock minted a Thunderlock, a Sovereign minted a Pistolet). */
export function gildedRecordOf(item) {
  const r = gildedById(item?.gilded);
  return GILDED_ERAS.find((e) => e.id === r?.id && e.templateIndex === item?.templateIndex) ?? r;
}
/** Is this a Gilded piece (its tier's own field)? */
export const isGilded = (item) => item?.rarity === GILDED;
// the ladder reads a Gilded piece's power and lore through these (it imports nothing of this file - this file imports it)
registerGildedRecords({ powerOf: (id) => gildedById(id)?.power ?? null, loreOf: (item) => gildedRecordOf(item)?.lore ?? null });   // AUDIT PISTOLET, GUNS-UNFOUND: an era's piece reads its own lore

/** @typedef {{ id: string, name: string, group: string, templateIndex: number, material: number, affixes: readonly any[], power: any, lore: string, hint?: string }} GildedRecord */
/**
 * Mint a record as an item: a DFU weapon's own mint (CreateWeapon - its make's value, its span and its condition) -
 * GUNS-UNFOUND: every record's now; a gun era's piece by its gun's own (systems/thunderlock.js createThunderlock,
 * systems/pistolet.js createPistolet - its condition from the weapons' one pool at its make), the shape a save holds -
 * its name, its tier, its lines (a copy), KNOWN, and its price. A fresh item every call.
 * @param {GildedRecord} r
 */
export function mintGilded(r) {
  const item = r.templateIndex === THUNDERLOCK_TEMPLATE ? createThunderlock({ material: r.material })
    : r.templateIndex === PISTOLET_TEMPLATE ? createPistolet({ material: r.material })   // PISTOLET: the Sunken Sovereign's pistolet era
    : createWeapon(r.templateIndex, r.material);
  const affixes = r.affixes.filter(validAffix).map((a) => ({ ...a }));
  item.name = r.name;
  item.rarity = GILDED;
  item.gilded = r.id;
  item.affixes = affixes;
  item.isIdentified = true;
  item.value = itemBaseValue(item) + affixesWorth(affixes) + GILDED_WORTH;
  return item;
}
/** The Hourlock, minted. */
export const mintHourlock = () => mintGilded(HOURLOCK);

/** THE DROP'S ROLL, the Brass Remnant's spoils' last: null most times; else the Hourlock. One draw, always. */
export function rollHourlock(rolls = Math.random) {
  return rolls() < GILDED_CHANCE ? mintHourlock() : null;
}
/** GILDED2: the gate Warden's spoils' last roll - null most times; else the Dragonfire Oath. One draw, always. */
export function rollDragonfireOath(rolls = Math.random) {
  return rolls() < GATE_GILDED_CHANCE ? mintGilded(DRAGONFIRE_OATH) : null;
}
/** GILDED2: a dealing ship's serpent hoard's last roll - null most times; else the Sunken Sovereign. One draw, always. */
export function rollSunkenSovereign(rolls = Math.random) {
  return rolls() < SERPENT_GILDED_CHANCE ? mintGilded(SUNKEN_SOVEREIGN) : null;
}

/** The fields a static roll keeps off itself: every mark another door lays on a piece (a sigil, a Legendary's or an
 *  Aetheric's record, the Reforge's line, imprint, hones and socket, a curse, an Exalted's line) - each would make it
 *  something its record is not. */
const NEVER_ON_GILDED = Object.freeze(['sigil', 'legendary', 'aetheric', 'imprint', 'cursed', 'socket', 'sockets', 'reforged', 'honed', 'exalted']);   // GEM1: nor a socket list

/**
 * THE MARKS AGREE WITH THE ITEM (the wire's check - systems/loot/loot.js validLootItem, beside the Aetheric's validSetMarks):
 * a Gilded piece only as its record mints it - a record that exists, its group, its template and its make, its lines
 * EXACTLY its record's (a static roll has no band to sit inside: one number off is a forgery), and nothing else laid on
 * it, no DFU enchantment among it. A piece that names no Gilded record and wears no Gilded tier passes untouched.
 * Answers the item or null.
 * @param {any} item an item whose fields are each their declared kind (itemFields.js validItemFields)
 */
export function validGildedMarks(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.rarity !== GILDED && item.gilded == null) return item;
  const r = gildedRecordOf(item);   // AUDIT PISTOLET, GUNS-UNFOUND: the record it was minted to - an era's for an old gun
  if (!r || item.rarity !== GILDED || r.group !== item.group || r.templateIndex !== item.templateIndex || item.material !== r.material) return null;
  const want = r.affixes, have = Array.isArray(item.affixes) ? item.affixes : [];
  if (have.length !== want.length) return null;
  for (let i = 0; i < want.length; i++) {
    const a = have[i], w = want[i];
    if (a?.id !== w.id || (a.param ?? null) !== (w.param ?? null) || a.value !== w.value) return null;
  }
  for (const k of NEVER_ON_GILDED) if (item[k] != null) return null;
  if (item.enchantments?.length || item.customEnchantments?.length) return null;
  return item;
}
