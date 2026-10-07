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
// The ladder's TOP rung (systems/lootRarity.js RARITIES: rank 6, over
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
// felled it (systems/lootPowers.js, kind 'toll'). Measured beside the
// best of the rest (bible/06-Systems/Gilded.md, "The numbers"): about
// twice The Last Lock a shot and level with a Legendary Daedric
// dai-katana a second - the gun's 1.7 s reload and its ammunition are
// still the price, and in a duel it is a plain Thunderlock (a power
// sleeps there, as a set does).
//
// ═══ THE DROP ══════════════════════════════════════════════════════
//
// The Brass Remnant's spoils (systems/sdSpoils.js) roll ONE MORE THING
// after everything they rolled before - so every earlier spoils, gold to
// the last Numidium piece, stays exactly what it was for its seed: the
// Hourlock GILDED_CHANCE of the time. Online alone, because the Hour is.
// ═══════════════════════════════════════════════════════════════════

import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { THUNDERLOCK_TEMPLATE } from '../characters/thunderlockIds.js';
import { createThunderlock } from './thunderlock.js';
import { itemBaseValue } from './itemTemplates.js';
import { affixesWorth, validAffix, registerGildedRecords } from './lootRarity.js';
import { SKILLS } from './skills.js';

/** The tier's id, as `item.rarity` wears it. */
export const GILDED = 'gilded';
/** What a Gilded piece adds to its price, over its make and its affixes - the Aetheric's 2500 five times over. */
export const GILDED_WORTH = 12500;
/** The share of the Brass Remnant's earned receipts whose spoils carry the Hourlock: one in fifty. */
export const GILDED_CHANCE = 1 / 50;

/** THE HOUR TOLLS - the Hourlock's power (systems/lootPowers.js does it, kind 'toll'). `every` landed shots, the last
 *  strikes `pct`% harder; `refund`: a foe it fells gives its pellet back. Read once at import, frozen. */
export const HOUR_TOLLS = Object.freeze({
  name: 'The Hour Tolls', kind: 'toll', every: 3, pct: 100, refund: true,
  brief: 'Every 3rd hit x2; kills refund',   // inside the card's row (sigilSets.js BRIEF_MAX)
  text: 'Every third of its shots that lands tolls the Hour and strikes for double, and a foe it fells gives back the pellet that felled it',
});

/** A record's line, frozen. */
const line = (id, value, param) => Object.freeze(param === undefined ? { id, value } : { id, param, value });

/** THE HOURLOCK - the Gilded rung's one record. Its make the gun's own Dwarven brass, gilded; its lines the Legendary
 *  band's top (lootRarity.js AFFIX_RANGES); its power HOUR_TOLLS. */
export const HOURLOCK = Object.freeze({
  id: 'the-hourlock',
  name: 'The Hourlock',
  group: 'Weapons',
  templateIndex: THUNDERLOCK_TEMPLATE,
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

/** EVERY GILDED RECORD - one, today; the one list every reader asks. */
export const GILDED_RECORDS = Object.freeze([HOURLOCK]);
export const gildedById = (id) => GILDED_RECORDS.find((r) => r.id === id) ?? null;
/** Is this a Gilded piece (its tier's own field)? */
export const isGilded = (item) => item?.rarity === GILDED;
// the ladder reads a Gilded piece's power and lore through these (it imports nothing of this file - this file imports it)
registerGildedRecords({ powerOf: (id) => gildedById(id)?.power ?? null, loreOf: (item) => gildedById(item?.gilded)?.lore ?? null });

/**
 * Mint a record as an item: the Thunderlock's own mint (systems/thunderlock.js createThunderlock - its condition from the
 * weapons' one pool at its make), its name, its tier, its lines (a copy), KNOWN, and its price. A fresh item every call.
 * @param {typeof HOURLOCK} r
 */
export function mintGilded(r) {
  const item = createThunderlock({ material: r.material });
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

/** The fields a static roll keeps off itself: every mark another door lays on a piece (a sigil, a Legendary's or an
 *  Aetheric's record, the Reforge's line, imprint, hones and socket, a curse, an Exalted's line) - each would make it
 *  something its record is not. */
const NEVER_ON_GILDED = Object.freeze(['sigil', 'legendary', 'aetheric', 'imprint', 'cursed', 'socket', 'reforged', 'honed', 'exalted']);

/**
 * THE MARKS AGREE WITH THE ITEM (the wire's check - systems/loot.js validLootItem, beside the Aetheric's validSetMarks):
 * a Gilded piece only as its record mints it - a record that exists, its group, its template and its make, its lines
 * EXACTLY its record's (a static roll has no band to sit inside: one number off is a forgery), and nothing else laid on
 * it, no DFU enchantment among it. A piece that names no Gilded record and wears no Gilded tier passes untouched.
 * Answers the item or null.
 * @param {any} item an item whose fields are each their declared kind (itemFields.js validItemFields)
 */
export function validGildedMarks(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.rarity !== GILDED && item.gilded == null) return item;
  const r = gildedById(item.gilded);
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
