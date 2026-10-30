// @ts-check
// FIXED-PVE stage 3 (bible/05-Combat/Fixed-PvE.md section 4): THE COMBAT PROFILE - what a build can do, in five
// dimensions, and one Combat Score for convenience. The score is the square root of damage a second times health it
// can lose: a fight's length goes with the first and how long one survives with the second, so their product is the
// fight it can win, with no weight to tune. It is ADVISORY: no template, spawn, loot or door reads it - the test holds
// pveCategories.js and pveTemplates.js clear of this module. Ledger A (FIXED-PVE).

import { templateStats } from './pveTemplates.js';
import { FOE_BLOW_S } from './pveCategories.js';
import { COMBAT_ROLES } from './pveRoles.js';
import { CURB_SHARE, WARD_SHARE, WRATH_AFTER_S, WRATH_X, RESIST_SHARE, WEAPON_RESIST_SHARE, THORN_SHARE } from '../bossTraits.js';

/** Vigil's heal: this share of health once below VIGIL_BELOW, once a VIGIL_S (systems/loot/lootPowers.js). */
export const VIGIL_SHARE = 0.2;
export const VIGIL_BELOW = 0.33;
export const VIGIL_S = 60;
/** The spell elements the proof traits answer. */
const ELEMENT_PROOF = Object.freeze({ fire: 'flameproof', frost: 'frostproof', poison: 'venomproof', shock: 'stormproof', magic: 'spellproof' });

/** @typedef {ReturnType<typeof import('./pveBuilds.js').buildAt>} Build */

/** The five dimensions of `b`. Offense and defense are a second's damage and the health it can lose; sustain is
 *  health back a second; control the interrupts and slows a minute; mobility its range and Speed's step. */
export function combatProfile(b) {
  const offense = (b.blow * b.hit) / b.actionS;
  const defense = b.health / (b.taken * (1 - b.evade) * (1 - b.block));
  const sustain = b.health * b.regen + (b.vigil ? (VIGIL_SHARE * b.health) / VIGIL_S : 0);
  return { offense, defense, sustain, control: b.control, mobility: b.range ? 'ranged' : 'melee' };
}

/** The Combat Score of `b`: whole, never a gate. */
export const combatScore = (b) => { const p = combatProfile(b); return Math.round(Math.sqrt(p.offense * p.defense)); };

/** What a template's traits do to this build's damage a second against it. */
function dealtAgainst(b, t, hp, traits) {
  let blow = b.blow;
  const spell = b.spellShare, weapon = 1 - spell;
  let shareWeapon = 1, shareSpell = 1;
  if (traits.includes('bladeturning') && b.blade) shareWeapon = WEAPON_RESIST_SHARE;
  if (traits.includes('stoneskin') && !b.blade && b.family === 'melee') shareWeapon = WEAPON_RESIST_SHARE;
  if (b.element && traits.includes(ELEMENT_PROOF[b.element])) shareSpell = RESIST_SHARE;
  blow *= weapon * shareWeapon + spell * shareSpell;
  if (traits.includes('curbing')) blow = Math.min(blow, CURB_SHARE * hp);
  return (blow * b.hit) / b.actionS;
}

/** Notes the estimate cannot count, so a word on it can say it is unsure. */
function unsure(t) {
  const out = ['armour', 'magicka'];
  if ((t.abilities ?? []).some((a) => !['rage', 'curbing', 'warded', 'wrathful', 'stoneskin', 'bladeturning', 'thorned'].includes(a))) out.push('abilities');
  if ((t.roles ?? []).some((r) => COMBAT_ROLES[r]?.complex)) out.push('a complex role');
  return out;
}

/**
 * One build against one template, alone: seconds to kill it, seconds it takes to fell the build, and their ratio -
 * the margin. 1.2 is the planned 20% edge over a Normal foe of one's level. Pure.
 * @param {Build} b @param {import('./pveTemplates.js').MobTemplate} t
 */
export function encounterEval(b, t) {
  const s = templateStats(t), traits = t.abilities ?? [];
  const hp = s.health * (traits.includes('warded') ? 1 + WARD_SHARE : 1);
  const dps = dealtAgainst(b, t, s.health, traits);
  const killS = hp / dps;
  const p = combatProfile(b);
  let foeDps = ((s.damage[0] + s.damage[1]) / 2) / FOE_BLOW_S;
  if (traits.includes('wrathful') && killS > WRATH_AFTER_S) foeDps *= 1 + (WRATH_X - 1) * (1 - WRATH_AFTER_S / killS);
  if (traits.includes('thorned') && b.family !== 'spell') foeDps += THORN_SHARE * dps * (1 - b.spellShare);
  const perBlow = b.hitCap ? Math.min(b.taken, (b.hitCap * b.health) / ((s.damage[0] + s.damage[1]) / 2)) : b.taken;   // Unyielding
  const felt = foeDps * perBlow * (1 - b.evade) * (1 - b.block) - p.sustain;
  const dieS = felt > 0 ? b.health / felt : Infinity;
  return { killS, dieS, margin: dieS / killS, unsure: unsure(t) };
}

/** The advisory words, by margin floor. */
export const DANGER_WORDS = Object.freeze([[3, 'trivial'], [1.8, 'easy'], [1.1, 'appropriate'], [0.8, 'challenging'], [0.5, 'dangerous'], [0, 'overwhelming']]);

/** The word for a margin - advice only; nothing reads it but a label. */
export const dangerWord = (margin) => (DANGER_WORDS.find(([floor]) => margin >= floor) ?? DANGER_WORDS[DANGER_WORDS.length - 1])[1];
