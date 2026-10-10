// @ts-check
// TECH1 (2026-10-10, the owner: "detailed weapon skill affixes for each weapon type. For example, a bow could roll with
// an attack that allows you to aim and place a telegraph that shoots a volley of arrows, or a sword attack that allows
// you to leap and attack your opponent, etc. This would have its own keybinding"; then "This is your baby. I want you
// to be as detailed as possible and take your time. No exceptions"): THE WEAPON TECHNIQUES, AS DATA - the design and
// its laws are bible/05-Combat/Weapon-Techniques.md.
//
// A technique is a LINE ON THE WEAPON (systems/lootRarity.js AFFIX_KINDS.technique): `{ id: 'technique', param: <a
// technique's id>, value: <+% power> }`, rolled at a loot door's end, read by the card, reforged and honed like every
// line, judged by the item law. The weapon in the hand that swings - or, fighting bare-handed, the gauntlets worn -
// answers the WeaponTechnique key with it (combat/techniques.js, which every host's weapon rig steps).
//
// A LEAF, read by both halves: the ladder asks which techniques a piece may roll (techniquesFor) and the runtime asks
// what one does (TECHNIQUES). A number lives here once.
//
// THE FORMULA DECIDES. Every number below that says what a blow deals is a MULTIPLIER on DFU's own
// CalculateAttackDamage for the weapon in hand (the skill, the material, the to-hit roll, the armour, a backstab, the
// Physical Combat overhaul's model when it is on) - never a flat damage. A miss is still a miss.

import { weaponSkillUsed } from '../characters/weapons.js';
import { THUNDERLOCK_TEMPLATE } from '../characters/thunderlockIds.js';
import { SKILLS } from '../systems/skills.js';
import { RRI_CLASSES } from '../systems/rriItems.js';   // AUDIT TECH1: an RRI class answers its family whatever its switch says

/** DFU's Gauntlets (ItemEnums.Armor.Gauntlets) - the one piece a bare-handed fighter's technique rides. */
export const GAUNTLETS_TEMPLATE = 103;

/** The families a piece belongs to, by the skill it swings with - DaggerfallUnityItem.GetWeaponSkillUsed's answer
 *  (characters/weapons.js weaponSkillUsed, an RRI custom class's own included). The Thunderlock is scored on Archery
 *  (its departure) but is a gun: it has a family of its own, so a volley of pellets never rains. */
export const TECHNIQUE_FAMILIES = Object.freeze(['archery', 'thunderlock', 'longBlade', 'shortBlade', 'axe', 'blunt', 'handToHand']);
const FAMILY_OF_SKILL = new Map([
  [SKILLS.Archery, 'archery'], [SKILLS.LongBlade, 'longBlade'], [SKILLS.ShortBlade, 'shortBlade'],
  [SKILLS.Axe, 'axe'], [SKILLS.BluntWeapon, 'blunt'], [SKILLS.HandToHand, 'handToHand'],
]);

/** A piece's technique family, or null: a weapon by its skill (an arrow or a pellet swings with none), the Gauntlets for
 *  the bare hand. */
export function techniqueFamily(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.group === 'Armor') return item.templateIndex === GAUNTLETS_TEMPLATE ? 'handToHand' : null;
  if (item.group !== 'Weapons' || !Number.isInteger(item.templateIndex)) return null;
  if (item.templateIndex === THUNDERLOCK_TEMPLATE) return 'thunderlock';
  // AUDIT TECH1: a Roleplay & Realism class is its class with its switch off too - the piece in the pack is still that
  // weapon, and a family that came and went with a mod's switch made its line read as a forgery and its Reforge refuse
  const rri = RRI_CLASSES[item.templateIndex];
  const skill = weaponSkillUsed(item.templateIndex) ?? (rri?.group === 'Weapons' && rri.weaponSkillUsed ? SKILLS[rri.weaponSkillUsed] : null);
  return FAMILY_OF_SKILL.get(skill ?? -1) ?? null;
}

/** THE POWER BANDS - the line's value, `+N%` on the technique's own multiplier, per rolled tier ([min, max]
 *  inclusive). One band for every technique, so the ladder's machinery (the band on the card, the reforge, the hone, the
 *  law's value check) reads the line as it reads any other. */
export const TECHNIQUE_BANDS = Object.freeze({ magic: Object.freeze([5, 15]), rare: Object.freeze([15, 30]), legendary: Object.freeze([30, 50]) });

/** Per mille that a weapon (or gauntlets) of a tier, minted at a loot door, takes a technique line - one roll at the
 *  door's END (Loot-II law 9: every draw the door made before is still its seed's). A Rare a bit under one in three; a
 *  Legendary not quite half; a Magic piece one in eight. */
export const TECHNIQUE_PER_MILLE = Object.freeze({ magic: 120, rare: 300, legendary: 450 });

/** The HUD's chip for a technique (ui/enhancedHud.js - a power's chip wears its set's colour): the blue the player's own
 *  marks on the ground wear (combat/techniques.js TECH_COLOR, [0.35, 0.78, 1]). Here, in the leaf, because the HUD never
 *  imports a runtime that reaches half the game. */
export const TECH_CHIP_COLOUR = '#59c7ff';
/** The registry action (systems/inputActions.js) - here, in the leaf, so the card (ui/techniqueCard.js) names the key
 *  without importing the runner; combat/techniques.js answers it and exports it on. */
export const TECHNIQUE_ACTION = 'WeaponTechnique';

/** What a line's `value` makes of the technique's own multiplier: `base * (1 + value/100)`. */
export const techniqueMult = (base, value) => base * (1 + Math.max(0, value | 0) / 100);

// ── the roster ─────────────────────────────────────────────────────
// Each technique: its name, the families that may roll it, its MECHANIC and what it aims, its multiplier (`base`, on
// the formula's damage), its price (`fatigue` in the sheet's points - FATIGUE_MULTIPLIER units each - and `cooldown`
// in seconds of play), and the numbers its mechanic reads. `strike` is the screen weapon's state the swing plays - the
// one CalculateSwingModifiers reads (combat/playerWeapon.js SWING_MODS), so a StrikeDown's +4 damage, -10 to hit
// rides the technique as it rides a click. `toHit` is the technique's own chance-to-hit term, beside it: a technique
// is a committed blow.
//
// The mechanics (combat/techniques.js):
//   rain    - aim a disc on the ground; the bow looses, and `arrows` real shafts fall on it from above, each a shot
//   pierce  - aim a lane; one shot that flies through up to `through` foes, each struck
//   leap    - aim a foe (or the ground); a jump onto it, and a strike at every foe within `radius` of the landing
//   dash    - a low, fast hop - behind the foe aimed (`behind`) or straight along the look (`length`) - and a strike at
//             what it reached or passed
//   swing   - one strike, its reach and arc the technique's: all around (`arc` 'all'), a half-angle (radians) about
//             the look, or DFU's own camera view ('view'); `single` the nearest foe alone
// Speeds never pass TECHNIQUE_MAX_SPEED: a technique moves no body faster than any room's referee believes - the
// arena's 12.5 m/s on the level, measured pose to pose with half a metre of slack (net/arenaLaw.js ARENA_SPEED_MAX; AUDIT
// TECH1: it was 16, and a Lunge or a Shadowstep in an arena bout was refused a pose and its landing measured from the
// stale one), the siege's and the open zone's 18 (net/siegeRef.js).
export const TECHNIQUE_MAX_SPEED = 12;
const DEG = Math.PI / 180;
export const TECHNIQUES = Object.freeze({
  volley: Object.freeze({ name: 'Volley', families: Object.freeze(['archery']), mech: 'rain', aim: 'ground', base: 0.5, fatigue: 6, cooldown: 16,
    arrows: 6, radius: 3.5, range: Object.freeze([6, 28]), height: 16, delay: 0.55, spread: 1.35 }),   // AUDIT TECH1: 0.27 s a shaft - never five in a second (an arena's referee lands four: net/arenaLaw.js ARENA_HIT_HZ_MAX)
  pierce: Object.freeze({ name: 'Piercing Shot', families: Object.freeze(['archery', 'thunderlock']), mech: 'pierce', aim: 'lane', base: 1.2, fatigue: 4, cooldown: 10,
    through: 5, length: 30, speed: 1.6 }),
  leap: Object.freeze({ name: 'Leap Strike', families: Object.freeze(['longBlade']), mech: 'leap', aim: 'target', base: 1.4, fatigue: 5, cooldown: 12,
    range: Object.freeze([3, 9]), apex: 1.6, radius: 2.5, strike: 'StrikeDown', toHit: 20 }),
  whirlwind: Object.freeze({ name: 'Whirlwind', families: Object.freeze(['longBlade']), mech: 'swing', aim: null, base: 1.0, fatigue: 5, cooldown: 10,
    reach: 3.0, arc: 'all', strike: 'StrikeLeft', toHit: 15 }),
  shadowstep: Object.freeze({ name: 'Shadowstep', families: Object.freeze(['shortBlade']), mech: 'dash', aim: 'foe', base: 1.2, fatigue: 4, cooldown: 9,
    range: Object.freeze([2, 8]), behind: 1.0, reach: 2.2, arc: 'view', strike: 'StrikeRight', toHit: 20 }),
  lunge: Object.freeze({ name: 'Lunge', families: Object.freeze(['shortBlade']), mech: 'dash', aim: 'lane', base: 1.1, fatigue: 4, cooldown: 8,
    length: 5, halfW: 0.9, strike: 'StrikeDown', toHit: 15 }),
  cleave: Object.freeze({ name: 'Cleave', families: Object.freeze(['axe']), mech: 'swing', aim: null, base: 1.2, fatigue: 5, cooldown: 9,
    reach: 3.2, arc: 80 * DEG, strike: 'StrikeRight', toHit: 15 }),
  execute: Object.freeze({ name: "Headsman's Chop", families: Object.freeze(['axe']), mech: 'swing', aim: null, base: 1.2, fatigue: 5, cooldown: 11,
    reach: 2.5, arc: 'view', wounded: 1.0, strike: 'StrikeDown', toHit: 20 }),
  slam: Object.freeze({ name: 'Ground Slam', families: Object.freeze(['blunt']), mech: 'swing', aim: null, base: 0.9, fatigue: 6, cooldown: 12,
    reach: 3.5, arc: 'all', strike: 'StrikeDown', toHit: 15 }),
  crush: Object.freeze({ name: 'Skull Crack', families: Object.freeze(['blunt']), mech: 'swing', aim: null, base: 1.6, fatigue: 5, cooldown: 10,
    reach: 2.5, arc: 'view', single: true, strike: 'StrikeDown', toHit: 30 }),
  kick: Object.freeze({ name: 'Flying Kick', families: Object.freeze(['handToHand']), mech: 'leap', aim: 'target', base: 1.3, fatigue: 4, cooldown: 10,
    range: Object.freeze([2, 6]), apex: 1.2, radius: 2.0, strike: 'StrikeDown', toHit: 20 }),
  haymaker: Object.freeze({ name: 'Haymaker', families: Object.freeze(['handToHand']), mech: 'swing', aim: null, base: 1.8, fatigue: 4, cooldown: 9,
    reach: 2.5, arc: 'view', single: true, strike: 'StrikeRight', toHit: 30 }),
});
/** The ids, in the roster's order - the line's params. */
export const TECHNIQUE_IDS = Object.freeze(Object.keys(TECHNIQUES));
export const techniqueById = (id) => (typeof id === 'string' && Object.hasOwn(TECHNIQUES, id) ? TECHNIQUES[id] : null);

/** The techniques a piece may roll - its family's, in the roster's order; [] for a piece with no family. */
export function techniquesFor(item) {
  const fam = techniqueFamily(item);
  return fam ? TECHNIQUE_IDS.filter((id) => TECHNIQUES[id].families.includes(fam)) : [];
}
/** Whether a technique fits a piece (the law's question, and the reforge's). */
export const techniqueFits = (id, item) => techniquesFor(item).includes(id);

/** A percentage as the card prints it. */
const pct = (x) => `${Math.round(x * 100)}%`;
/** TECH-CARD: WHAT A PRESS DOES, in its parts - `what` it does with the line's own numbers, the blow's multiplier
 *  `mult` (the technique's `base` with the line's +%), its `fatigue` and its `cooldown` in seconds, and whether it
 *  `aims` (held to aim, gone on the release). The card's block lays them out (ui/techniqueCard.js); techniqueBrief is
 *  them as one line. Null for a technique the roster does not hold. */
export function techniqueParts(id, value) {
  const t = techniqueById(id);
  if (!t) return null;
  const m = techniqueMult(t.base, value);
  const what = (() => {
    switch (id) {
      case 'volley': return `Aim: ${t.arrows} arrows rain on ${t.radius} m, ${pct(m)} each`;
      case 'pierce': return `Aim: a shot through ${t.through} foes, ${pct(m)} each`;
      case 'leap': return `Aim: leap ${t.range[1]} m, strike all in ${t.radius} m, ${pct(m)}`;
      case 'kick': return `Bare-handed, aim: leap ${t.range[1]} m, strike all in ${t.radius} m, ${pct(m)}`;   // AUDIT TECH1: the Gauntlets' - say they sleep with a weapon drawn
      case 'shadowstep': return `Aim a foe: dash behind it and strike, ${pct(m)}`;
      case 'lunge': return `Dash ${t.length} m, striking all you pass, ${pct(m)}`;
      case 'whirlwind': case 'slam': return `Strike all within ${t.reach} m, ${pct(m)}`;
      case 'cleave': return `Strike all in a wide arc, ${pct(m)}`;
      case 'execute': return `Strike for ${pct(m)}, to ${pct(m + (t.wounded ?? 0))} on the wounded`;
      case 'crush': return `One heavy blow, ${pct(m)}, +${t.toHit} to hit`;   // AUDIT TECH1: never 'sure' - a miss is still a miss (law 1)
      case 'haymaker': return `Bare-handed: one heavy blow, ${pct(m)}, +${t.toHit} to hit`;
      default: return `${pct(m)}`;
    }
  })();
  return { what, mult: m, fatigue: t.fatigue, cooldown: t.cooldown, aims: t.aim != null };
}
/** THE CARD'S SECOND LINE for a technique line of `value`: what a press does, with its numbers, and its price. Kept
 *  short - the classic tooltip, the Reforge and the trade window's strip print it whole; the Enhanced card's block
 *  lays the same parts out (TECH-CARD). */
export function techniqueBrief(id, value) {
  const p = techniqueParts(id, value);
  return p ? `${p.what}. ${p.fatigue} fatigue, ${p.cooldown}s` : '';
}
