// @ts-check
// LEGACY4 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 7; Mac: "Upon your current characters death, have a
// chance to drop a gear item deemed an heirloom. These heirlooms, along with your characters remains can be acquired by
// completing the death quest on your descendant."): HEIRLOOMS, REMAINS AND THE BLESSING - the law, pure but for the
// two folds it registers with the entity (systems/entityMods.js, as the Loot arc's affixes do) and the one item template
// (the remains), registered at import as the port's own custom items are.
//
//  - THE HEIRLOOM: at a final death, the most valuable weapon or armour the fallen WORE - an heirloom already worn is
//    always the one (an heirloom is handed down, not found again) - never a quest item, an Aetheric or artifact piece,
//    or a sigil's. Marked `heirloom: { line, house, of, from, gen, base }` and named for the house.
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

export const HEIRLOOM_GEN_MAX = 5;
/** A weapon's damage per generation, percent; armour's points per generation on its parts. */
export const HEIRLOOM_DAMAGE_PER_GEN = 5;
export const HEIRLOOM_ARMOR_PER_GEN = 2;
/** The share of the fallen's purse that lies with them (the rest is the estate's - family.js ESTATE_SHARE). */
export const REMAINS_GOLD_SHARE = 0.1;
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
const NEVER_RARITY = new Set(['aetheric', 'artifact']);

/** Whether a worn piece may become an heirloom. */
export function heirloomEligible(it) {
  return !!it && it.equipSlot != null && HEIR_GROUPS.has(it.group) && !it.questItem && !NEVER_RARITY.has(it.rarity)
    && it.sigil == null && it.aetheric == null;
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
 *  fallen's own bag is their save's. Named "Hlaalu's Steel Longsword". */
export function markHeirloom(it, { line, house, of, from }) {
  const base = baseNameOf(it);
  const copy = JSON.parse(JSON.stringify(it));
  delete copy.equipSlot;
  copy.heirloom = { line: String(line), house: String(house), of: of | 0, from: String(from), gen: Math.min(HEIRLOOM_GEN_MAX, it.heirloom?.gen | 0), base };
  copy.name = house ? `${house}'s ${base}` : base;
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
  return `Heirloom of the house of ${it.heirloom.house}, first borne by ${it.heirloom.from} - ${g ? `carried home ${g} ${g === 1 ? 'time' : 'times'}` : 'not yet carried home'}.`;
}
