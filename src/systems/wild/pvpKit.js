// @ts-check
// PVP-KIT (the PvP rework, 2026-10-29 - the owner: "they only get to tool kit we give", "flagged has a seperate hot barr",
// "They get to pick damage and its a aoe", "Just our damage formula", "Let them set the icons for these spells", "Goo
// choose make it 15m"): THE PVP SPELL BAR'S LAW. While my flag is up in the open zone, the hotbar's PvP set (PVP-SET,
// systems/wild/pvpSet.js) holds this toolkit and nothing else is cast. Each slot is a classic spell record built here, so the cast engine, the ally frame and
// the referee's path (combat/siegeCombat.js) read it as any spell. Pure. A departure: DFU has no PvP.
import { t } from '../textManager.js';
import { effectSchool } from '../spellcost.js';
import { resurrectionSpell } from '../resurrect.js';
import { PVP_CAST_PER_SKILL } from '../../combat/pvpSpellCrit.js';

/** The old bar's eight slots (keys 3 to 0, carried into the PvP set); a gift goes to the party member under the crosshair within `reachM`, else to me; a buff
 *  runs `rounds` magic rounds (a minute - combat/pvpBuffs.js PVP_BUFF_ROUNDS); scaling runs from skill `lo` to `hi`. */
export const PVP_KIT = Object.freeze({ slots: 8, reachM: 15, rounds: 12, lo: 100, hi: 300 });

/** DFU's elements as the picker lists them: Fire 0, Frost 1, Shock 3, Poison 2, Magic 4. */
export const KIT_ELEMENTS = Object.freeze([0, 1, 3, 2, 4]);
/** DFU's eight attributes, Fortify's subType: Strength 0 .. Luck 7. */
export const KIT_ATTRIBUTES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);
/** The words, each its own key (the extractor reads literal keys alone). */
const ELEMENT_WORDS = Object.freeze([
  () => t('pvp.kit.fire', 'Fire'),
  () => t('pvp.kit.frost', 'Frost'),
  () => t('pvp.kit.poison', 'Poison'),
  () => t('pvp.kit.shock', 'Shock'),
  () => t('pvp.kit.magic', 'Magic'),
]);
const ATTRIBUTE_WORDS = Object.freeze([
  () => t('pvp.kit.strength', 'Strength'),
  () => t('pvp.kit.intelligence', 'Intelligence'),
  () => t('pvp.kit.willpower', 'Willpower'),
  () => t('pvp.kit.agility', 'Agility'),
  () => t('pvp.kit.endurance', 'Endurance'),
  () => t('pvp.kit.personality', 'Personality'),
  () => t('pvp.kit.speedAttr', 'Speed'),
  () => t('pvp.kit.luck', 'Luck'),
]);
export const kitElementName = (el) => (ELEMENT_WORDS[el] ?? ELEMENT_WORDS[4])();
export const kitAttributeName = (a) => (ATTRIBUTE_WORDS[a] ?? ATTRIBUTE_WORDS[0])();

/** The toolkit: cost in per cent of maximum magicka, what the player picks, the scaling's two ends, the default icon. */
export const KIT_SPELLS = Object.freeze({
  damage: Object.freeze({ cost: 8, pick: 'element', icon: 2 }),
  heal: Object.freeze({ cost: 12, scale: Object.freeze([25, 35]), icon: 3 }),
  shield: Object.freeze({ cost: 15, scale: Object.freeze([10, 25]), icon: 47 }),
  resist: Object.freeze({ cost: 12, pick: 'element', scale: Object.freeze([30, 90]), icon: 1 }),
  reflect: Object.freeze({ cost: 12, scale: Object.freeze([10, 30]), icon: 9 }),
  absorb: Object.freeze({ cost: 12, scale: Object.freeze([10, 30]), icon: 25 }),
  fortify: Object.freeze({ cost: 10, pick: 'attribute', scale: Object.freeze([5, 20]), icon: 45 }),
  regen: Object.freeze({ cost: 10, scale: Object.freeze([2, 4]), icon: 1 }), // PVP-KIT-REGEN: in Cure's place, the classic Troll's Blood's icon
  jump: Object.freeze({ cost: 6, icon: 12 }),
  speed: Object.freeze({ cost: 6, scale: Object.freeze([5, 20]), icon: 25 }),
  resurrect: Object.freeze({ cost: 25, icon: 10 }), // PVP-KIT-REZ: the shop's Resurrection, its icon
});
export const KIT_IDS = Object.freeze(Object.keys(KIT_SPELLS));
const NAMES = Object.freeze({
  damage: () => t('pvp.kit.damage', 'Damage'),
  heal: () => t('pvp.kit.heal', 'Heal'),
  shield: () => t('pvp.kit.shield', 'Shield'),
  resist: () => t('pvp.kit.resist', 'Resist'),
  reflect: () => t('pvp.kit.reflect', 'Reflect'),
  absorb: () => t('pvp.kit.absorb', 'Absorb'),
  fortify: () => t('pvp.kit.fortify', 'Fortify'),
  regen: () => t('pvp.kit.regen', 'Regenerate'),
  jump: () => t('pvp.kit.jump', 'Jump'),
  speed: () => t('pvp.kit.speed', 'Speed'),
  resurrect: () => t('pvp.kit.resurrect', 'Resurrect'),
});
/** The spell's word on the bar. */
export const kitBaseName = (id) => (NAMES[id] ?? NAMES.damage)();

/** A slot as saved: the spell, its pick (an element or an attribute), its icon (0..68). Anything else is the default. */
export function kitSlotOf(raw, i = 0) {
  if (raw?.id === 'cure') raw = { ...raw, id: 'regen', icon: raw.icon === 49 ? KIT_SPELLS.regen.icon : raw.icon }; // PVP-KIT-REGEN: a saved Cure is Regenerate
  const def = KIT_DEFAULT_BAR[i % KIT_DEFAULT_BAR.length];
  const id = KIT_IDS.includes(raw?.id) ? raw.id : def.id;
  const kind = KIT_SPELLS[id].pick;
  const choices = kind === 'element' ? KIT_ELEMENTS : kind === 'attribute' ? KIT_ATTRIBUTES : null;
  const pick = choices ? (choices.includes(raw?.pick) ? raw.pick : choices[0]) : null;
  const icon = Number.isInteger(raw?.icon) && raw.icon >= 0 && raw.icon < 69 ? raw.icon : KIT_SPELLS[id].icon;
  return { id, pick, icon };
}
/** The bar a new player starts with. */
export const KIT_DEFAULT_BAR = Object.freeze(
  [
    { id: 'damage', pick: 0, icon: 2 },
    { id: 'heal', pick: null, icon: 3 },
    { id: 'shield', pick: null, icon: 47 },
    { id: 'resist', pick: 0, icon: 1 },
    { id: 'reflect', pick: null, icon: 9 },
    { id: 'absorb', pick: null, icon: 25 },
    { id: 'fortify', pick: 0, icon: 45 },
    { id: 'regen', pick: null, icon: 1 },
  ].map((s) => Object.freeze(s)),
);
/** A whole saved bar, eight slots. */
export const kitBarOf = (raw) =>
  Array.from({ length: PVP_KIT.slots }, (_, i) => kitSlotOf(Array.isArray(raw) ? raw[i] : null, i));

/** A slot's name: "Damage (Frost)", "Fortify Agility", "Heal". */
export function kitSlotName(slot) {
  const s = kitSlotOf(slot);
  if (s.id === 'damage') return `${kitBaseName('damage')} (${kitElementName(s.pick)})`;
  if (s.id === 'resist') return `${kitBaseName('resist')} ${kitElementName(s.pick)}`;
  if (s.id === 'fortify') return `${kitBaseName('fortify')} ${kitAttributeName(s.pick)}`;
  return kitBaseName(s.id);
}

/** The scaling's number at governing skill `skill`: `lo` at 100, `hi` at 300, straight between, held at both ends. */
export function kitScale(id, skill) {
  const sc = KIT_SPELLS[id]?.scale;
  if (!sc) return 0;
  const f = Math.max(0, Math.min(1, ((Number(skill) || 0) - PVP_KIT.lo) / (PVP_KIT.hi - PVP_KIT.lo)));
  return sc[0] + (sc[1] - sc[0]) * f;
}
/** What a cast of `id` costs at `maxMagicka`: its per cent, never under 1. */
export const kitCost = (id, maxMagicka) =>
  Math.max(1, Math.round(((KIT_SPELLS[id]?.cost ?? 0) * (Number(maxMagicka) || 0)) / 100));

/** A classic effect's settings for exactly `n` at caster level `level` (base + plus x level): DFU's own roll, no dice. */
export function kitMagnitude(n, level) {
  const L = Math.max(1, Math.trunc(Number(level) || 1));
  const want = Math.max(0, Math.min(255 * L, Math.round(Number(n) || 0)));
  const plus = Math.floor(want / L),
    base = want - plus * L;
  return {
    magnitudeBaseLow: base,
    magnitudeBaseHigh: base,
    magnitudeLevelBase: plus,
    magnitudeLevelHigh: plus,
    magnitudePerLevel: 1,
  };
}
/** @type {Readonly<Record<string, number>>} */
const NONE = Object.freeze({
  magnitudeBaseLow: 0,
  magnitudeBaseHigh: 0,
  magnitudeLevelBase: 0,
  magnitudeLevelHigh: 0,
  magnitudePerLevel: 1,
});
/** A buff's settings: a minute, and `chance` per cent where it has one. @param {number} type @param {number} subType @param {number} [chance] @param {Readonly<Record<string, number>>} [mag] */
const buff = (type, subType, chance = 0, mag = NONE) => ({
  type,
  subType,
  durationBase: PVP_KIT.rounds,
  durationMod: 0,
  durationPerLevel: 1,
  chanceBase: chance,
  chanceMod: 0,
  chancePerLevel: 1,
  ...mag,
});
/** Damage is the classic Fireball's record (SPELLS.STD 14: Area at Range), its element the pick, its size PVP-CAST-SKILL's. */
const FIREBALL = Object.freeze({
  type: 4,
  subType: 0,
  durationBase: 1,
  durationMod: 1,
  durationPerLevel: 1,
  chanceBase: 1,
  chanceMod: 1,
  chancePerLevel: 1,
  magnitudeBaseLow: 1,
  magnitudeBaseHigh: 1,
  magnitudeLevelBase: 1,
  magnitudeLevelHigh: 7,
  magnitudePerLevel: 1,
});

/** The classic effects a cast of `id` lands: a heal, a shield and a regen a share of `maxHealth`, the rest their own numbers. */
export function kitEffects(id, pick, { skill = 0, level = 1, maxHealth = 0 } = {}) {
  const n = kitScale(id, skill);
  switch (id) {
    case 'damage':
      return [{ ...FIREBALL, ...kitMagnitude(PVP_CAST_PER_SKILL * skill, level) }]; // PVP-CAST-SKILL: sized by live Destruction, no dice
    case 'heal':
      return [buff(10, 8, 0, kitMagnitude((n / 100) * maxHealth, level))];
    case 'shield':
      return [buff(35, -1, 0, kitMagnitude((n / 100) * maxHealth, level))];
    case 'resist':
      return [buff(8, pick, Math.round(n))];
    case 'reflect':
      return [buff(21, -1, Math.round(n))];
    case 'absorb':
      return [buff(20, -1, Math.round(n))];
    case 'fortify':
      return [buff(9, pick, 0, kitMagnitude(n, level))];
    case 'speed':
      return [buff(9, 6, 0, kitMagnitude(n, level))];
    case 'regen':
      return [buff(18, -1, 0, kitMagnitude((n / 100) * maxHealth, level))]; // PVP-KIT-REGEN: a share of health each round
    case 'jump':
      return [buff(27, -1)];
    case 'resurrect':
      return [{ ...resurrectionSpell().effects[0] }]; // PVP-KIT-REZ: the game's own Resurrect (45,255)
    default:
      return [];
  }
}

/** The school a slot's spell scales with: its first effect's (Destruction for Damage, Restoration for Heal, ...). */
export const kitSchool = (id, pick = 0) => effectSchool(kitEffects(id, pick ?? 0)[0] ?? FIREBALL);

/**
 * THE SPELL A SLOT CASTS: a classic record the cast engine readies. `skill` the governing school's live value, `level`
 * the level it lands at (an ally's frame clamps it - systems/allyCast.js allyCastFrame), `maxHealth` the health a heal, a
 * shield or a regen is a share of, `maxMagicka` the caster's. Damage flies as Area at Range; Resurrect is the shop's own, by touch at
 * a fallen party member's body within RESURRECT_REACH (scenes/hostMagic.js fallenInReach); every other spell is CasterOnly,
 * given to the party member under the crosshair within PVP_KIT.reachM (`pvpReach`, scenes/hostMagic.js), else to me.
 */
export function kitSpell(slot, { skill = 0, level = 1, maxHealth = 0, maxMagicka = 0 } = {}) {
  const s = kitSlotOf(slot);
  const damage = s.id === 'damage',
    rez = s.id === 'resurrect';
  return {
    name: kitSlotName(s),
    icon: s.icon,
    index: -1,
    custom: true,
    element: damage ? s.pick : 4,
    rangeType: damage ? 4 : rez ? 1 : 0,
    effects: kitEffects(s.id, s.pick, { skill, level, maxHealth }),
    pvpKit: s.id,
    pvpKitCost: kitCost(s.id, maxMagicka),
    ...(damage || rez ? {} : { pvpReach: PVP_KIT.reachM }),
  };
}

/** Whether `sp` is a toolkit spell. */
export const isKitSpell = (sp) => !!sp && KIT_IDS.includes(sp.pvpKit);
/** The cast engine's word on a spell while the bar is up (`active`): only the toolkit is cast, else the line. */
export const kitRefusal = (sp, active) =>
  active && !isKitSpell(sp) ? t('pvp.kit.only', 'With PvP on, you can cast only the spells on your PvP bar.') : null;
