// @ts-check
// LEGACY4 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 7; Mac: "Upon your current characters death, have a
// chance to drop a gear item deemed an heirloom. These heirlooms, along with your characters remains can be acquired by
// completing the death quest on your descendant."): HEIRLOOMS, REMAINS AND THE BLESSING - the law, pure but for the
// two folds it registers with the entity (systems/entityMods.js, as the Loot arc's affixes do) and the one item template
// (the remains), registered at import as the port's own custom items are.
//
//  - THE HEIRLOOM: at a final death, the most valuable weapon or armour the fallen WORE - an heirloom already worn is
//    always the one (an heirloom is handed down, not found again) - never a quest item, an Aetheric or artifact piece
//    (AUDIT LEGACY H5: an artifact is minted `artifact: true` with no `rarity` - rarityOf reads both), a sigil's or a
//    summoned piece (its timer would take the copy the moment it was picked up). Marked
//    `heirloom: { line, house, of, from, gen, base }`; its long name carries the house (systems/itemInfo.js
//    itemNameParts: "Hlaalu's Dwarven Longsword", the maker's mark's shape).
//  - IT GROWS: each generation that carries it home counts (`gen`, at most HEIRLOOM_GEN_MAX): a weapon +5% damage a
//    generation, armour +2 on the parts it covers a generation - folded onto whoever wears it.
//  - THE REMAINS: what lies where the fallen fell - the heirloom, the remains themselves (an item of the port's own,
//    "The remains of Ysolde Hlaalu"), and a share of their purse.
//  - THE BLESSING: remains laid to rest give the one who laid them +3 to the fallen's best skill, for good - at most +9
//    on any one skill (BLESSING_SKILL_MAX).
import { registerCustomTemplates, setItemFields, mintCondition, itemValueOf, templateByIndex } from '../itemTemplates.js';
import { registerEntityFold, registerWeaponDamageMod, newMods, EMPTY_MODS } from '../entityMods.js';
import { armorBodyParts } from '../equip.js';
import { SKILL_COUNT } from '../skills.js';
import { rarityOf } from '../lootRarity.js';
import { isSummoned } from '../inventory.js';
import { houseWord } from './houseName.js';   // LEGACY-NAME: a seat's house says itself once

export const HEIRLOOM_GEN_MAX = 5;
/** A weapon's damage per generation, percent; armour's points per generation on its parts. */
export const HEIRLOOM_DAMAGE_PER_GEN = 5;
export const HEIRLOOM_ARMOR_PER_GEN = 2;
/** The share of the fallen's purse that lies with them - a tenth, at most REMAINS_GOLD_MAX (AUDIT LEGACY H7: it had
 *  no ceiling). A quarter more is the estate (family.js ESTATE_SHARE); the rest is the fallen's save's, and the past's. */
export const REMAINS_GOLD_SHARE = 0.1;
export const REMAINS_GOLD_MAX = 2_500;
/** The gold lying with the fallen, of the purse they carried. */
export const remainsGoldOf = (gold) => Math.min(REMAINS_GOLD_MAX, Math.max(0, Math.floor((Number(gold) || 0) * REMAINS_GOLD_SHARE)));
/** The blessing: points on the fallen's best skill. */
export const BLESSING_POINTS = 3;
/** ...and the most the house's blessings give one skill, however many ancestors are laid to rest: three blessings'
 *  worth. A long line is honoured, never a build - a skill the whole house shared does not climb without end. */
export const BLESSING_SKILL_MAX = 9;

/** The remains' template - free after the keepsake (1800). */
export const REMAINS_TEMPLATE = 1810;
export const REMAINS_GROUP = 'UselessItems2';
export const REMAINS_ROW = Object.freeze({
  index: REMAINS_TEMPLATE, name: 'Remains', baseWeight: 2, hitPoints: 100, capacityOrTarget: 0, basePrice: 0,
  enchantmentPoints: 0, rarity: 0, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 254, worldTextureRecord: 56, playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: false,
});
registerCustomTemplates([REMAINS_ROW]);

const HEIR_GROUPS = new Set(['Weapons', 'Armor']);
const NEVER_RARITY = new Set(['aetheric', 'artifact', 'gilded']);

/** Whether a worn piece may become an heirloom. */
export function heirloomEligible(it) {
  return !!it && it.equipSlot != null && HEIR_GROUPS.has(it.group) && !it.questItem
    && !NEVER_RARITY.has(it.rarity) && !NEVER_RARITY.has(rarityOf(it)) && it.sigil == null && it.aetheric == null && !isSummoned(it);
}

/** THE PIECE: an heirloom already worn, else the most valuable eligible worn piece (value, then condition). */
export function pickHeirloom(items) {
  const worn = (items ?? []).filter(heirloomEligible);
  const handed = worn.find((it) => it.heirloom);
  if (handed) return handed;
  let best = null;
  for (const it of worn) {
    if (!best) { best = it; continue; }
    const dv = itemValueOf(it) - itemValueOf(best);
    if (dv > 0 || (dv === 0 && (it.currentCondition ?? 0) > (best.currentCondition ?? 0))) best = it;
  }
  return best;
}

/** The piece's own name, before any house's. */
const baseNameOf = (it) => it.heirloom?.base ?? it.name ?? templateByIndex(it.templateIndex)?.name ?? 'heirloom';

/** Mark a piece as the line's heirloom (keeping its generation if it is one already) - a COPY, for the remains; the
 *  fallen's own bag is their save's. Its own name is kept: the long name puts the house before it (itemNameParts). */
export function markHeirloom(it, { line, house, of, from }) {
  const base = baseNameOf(it);
  const copy = JSON.parse(JSON.stringify(it));
  delete copy.equipSlot;
  copy.heirloom = { line: String(line), house: String(house), of: of | 0, from: String(from), gen: Math.min(HEIRLOOM_GEN_MAX, it.heirloom?.gen | 0), base };
  return copy;
}

/** A generation carried home: the heirloom's power one step stronger (at most HEIRLOOM_GEN_MAX). */
export function attuneHeirloom(it) {
  if (!it?.heirloom) return it;
  it.heirloom.gen = Math.min(HEIRLOOM_GEN_MAX, (it.heirloom.gen | 0) + 1);
  return it;
}
export const isHeirloom = (it) => !!it?.heirloom && typeof it.heirloom.line === 'string';

/** The remains item: "The remains of Ysolde Hlaalu", marking whose and which line. */
export function mintRemainsItem({ line, of, name }) {
  const item = mintCondition(setItemFields({ group: REMAINS_GROUP, templateIndex: REMAINS_TEMPLATE, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
  return { ...item, name: `The remains of ${name}`, legacyRemains: { line: String(line), of: of | 0, name: String(name) } };
}
export const isRemainsItem = (it) => it?.templateIndex === REMAINS_TEMPLATE && !!it?.legacyRemains;
/** AUDIT LEGACY II H4: the mark a remains' list wears while it is open - the fallen's person id, under a symbol (never
 *  saved: JSON skips it). The bones go back into the list that bears their own mark, and into nothing else outside the
 *  character's keeping (systems/itemTransfer.js planStore): put in a chest or on the ground, they were in no list the
 *  quest reads, lay again in the list, and two sets of bones were carried home. */
export const REMAINS_LIST = Symbol.for('dagger.legacy.remainsList');

/** The fallen's best skill (the blessing's) - the highest, the first of equals. */
export function bestSkillOf(person) {
  const s = person?.skills;
  if (!Array.isArray(s)) return null;
  let best = 0;
  for (let i = 1; i < Math.min(SKILL_COUNT, s.length); i++) if ((s[i] | 0) > (s[best] | 0)) best = i;
  return best;
}
/** The blessing a laying to rest gives: `{ of, name, skill, value }`. */
export const blessingOf = (person, name) => ({ of: person.id | 0, name: String(name), skill: bestSkillOf(person) ?? 0, value: BLESSING_POINTS });
/** AUDIT LEGACY III F11a: what the house's blessings give `skill` on `entity` now - the fold's own sum, to its cap. */
export const blessedIn = (entity, skill) => Math.min(BLESSING_SKILL_MAX, (Array.isArray(entity?.legacyBlessings) ? entity.legacyBlessings : [])
  .filter((b) => (b?.skill | 0) === (skill | 0)).reduce((n, b) => n + Math.max(0, Math.min(BLESSING_POINTS, b.value | 0)), 0));

// ---- the folds -------------------------------------------------------------------------------------------------

function wornHeirlooms(entity) {
  const slots = entity?.equip?.slots;
  const list = slots ? slots : (entity?.items ?? []).filter((it) => it?.equipSlot != null);
  return list.filter((it) => it && isHeirloom(it));
}
/** THE FOLD: worn heirlooms' armour on their parts, and the blessings on the entity (`legacyBlessings`). */
export function legacyFold(entity) {
  const worn = wornHeirlooms(entity);
  const blessings = Array.isArray(entity?.legacyBlessings) ? entity.legacyBlessings : [];
  if (!worn.length && !blessings.length) return EMPTY_MODS;
  const mods = newMods();
  for (const it of worn) {
    if (it.group !== 'Armor') continue;
    const v = HEIRLOOM_ARMOR_PER_GEN * Math.min(HEIRLOOM_GEN_MAX, it.heirloom.gen | 0);
    if (v) for (const part of armorBodyParts(it)) mods.armorParts[part] += v;
  }
  for (const b of blessings) {
    const k = b?.skill | 0;
    if (k >= 0 && k < SKILL_COUNT) mods.skills[k] = Math.min(BLESSING_SKILL_MAX, (mods.skills[k] ?? 0) + Math.max(0, Math.min(BLESSING_POINTS, b.value | 0)));
  }
  return mods;
}
/** A worn heirloom weapon's damage, its generations' percent on the roll, truncated. */
export function heirloomWeaponDamage(weapon, damage) {
  if (!isHeirloom(weapon)) return damage;
  const pct = HEIRLOOM_DAMAGE_PER_GEN * Math.min(HEIRLOOM_GEN_MAX, weapon.heirloom.gen | 0);
  return pct ? Math.trunc(damage * (1 + pct / 100)) : damage;
}
export const LEGACY_FOLD = 'projectLegacy';
registerEntityFold(LEGACY_FOLD, legacyFold);
registerWeaponDamageMod(LEGACY_FOLD, heirloomWeaponDamage);

/** The heirloom's line in an item's card: its house and how many generations have carried it. */
export function heirloomLine(it) {
  if (!isHeirloom(it)) return null;
  const g = it.heirloom.gen | 0;
  const house = houseWord(it.heirloom.house);
  return `Heirloom of the house${house ? ` of ${house}` : ''}, first borne by ${it.heirloom.from} - ${g ? `carried home ${g} ${g === 1 ? 'time' : 'times'}` : 'not yet carried home'}.`;
}
