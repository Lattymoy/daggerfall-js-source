// @ts-check
// STAR5 (2026-10-20): WHAT THE COVEN SENDS FOR THE STAR - each wave's roster by the defenders' band, the master by band
// and star, and its circle. Design: bible/11-Multiplayer/Starfall.md section 4.
//
// THE BANDS (net/starfall/starfallLaw.js starBandOf - the defenders' median level: to 8, to 15, from 16). Daggerfall's
// monsters have fixed levels and some want a metal to hurt (ENEMY_BASICS minMetalToHit), so a band stands only foes its
// players can fight: the first none that wants more than iron, the second silver at most, the third the Daedra and the
// dead that want mithril - a band whose players are past level 16, whose spells hurt them whatever their blades are.
//
// THE COVEN'S OWN are women (DFU: a witches' coven's people are always female - systems/quest/person.js), named by their
// coven (systems/starfall/starfallCovens.js `member`). Mephala is the Patroness of the Dark Brotherhood, so her own are
// murderers as well as Daedra. Every pick is the star's own roll (net/starfall/starfallLaw.js starRoll): the owner stands
// what any owner would.
//
// Pure. Not a DFU member. Ledger A (STARFALL).
import { MOBILE_TYPES as M } from '../../characters/mobile/mobileTypes.js';
import { enemyDisplayName } from '../../characters/enemy/enemyBasics.js';
import { starRoll, STAR_WAVES } from '../../net/starfall/starfallLaw.js';
import { getLocalizedEnemyName, t } from '../textManager.js';

/** The coven's members: Mage, Sorcerer, Battlemage, Nightblade - its witches. */
export const STAR_MEMBERS = Object.freeze([M.Mage, M.Sorcerer, M.Battlemage, M.Nightblade]);
/** A roster's place for one of the coven's own members (its career drawn from STAR_MEMBERS). */
export const MEMBER = -1;
/**
 * EACH WAVE'S ROSTER, by band (1..3) and wave (1..4): the coven's hands; what they called; what they made, with members;
 * Mephala's own.
 */
export const STAR_ROSTERS = Object.freeze({
  1: Object.freeze([
    Object.freeze([MEMBER]),
    Object.freeze([M.Spider, M.Spriggan, M.GiantBat]),
    Object.freeze([M.Spider, M.Spriggan, MEMBER]),
    Object.freeze([M.Nightblade, M.Spider]),
  ]),
  2: Object.freeze([
    Object.freeze([MEMBER]),
    Object.freeze([M.Spider, M.SkeletalWarrior, M.Zombie, M.Spriggan]),
    Object.freeze([M.FireAtronach, M.IceAtronach, M.SkeletalWarrior, MEMBER]),
    Object.freeze([M.Nightblade, M.Assassin, M.Spider]),
  ]),
  3: Object.freeze([
    Object.freeze([MEMBER]),
    Object.freeze([M.SkeletalWarrior, M.Wraith, M.IronAtronach, M.FleshAtronach]),
    Object.freeze([M.FireAtronach, M.IceAtronach, M.Daedroth, MEMBER]),
    Object.freeze([M.DaedraSeducer, M.Assassin, M.FireDaedra, M.FrostDaedra]),
  ]),
});

/** A foe the coven stands: its career and whether it stands as a woman (a member, a Seducer). */
export const covenFemale = (career) => STAR_MEMBERS.includes(career) || career === M.DaedraSeducer;
/** A band, clamped to the rosters' (1..3). */
const bandOk = (b) => Math.max(1, Math.min(3, b | 0));
/** A roster's foe by roll `r` - a member's place a member's career, by the roll's next bits. */
const pick = (roster, r) => { const c = roster[r % roster.length]; return c === MEMBER ? STAR_MEMBERS[(r >>> 8) % STAR_MEMBERS.length] : c; };

/**
 * THE WAVE'S FOES: `size` careers for wave `w` (1..STAR_WAVES) of star (n, k) in `band` - each the star's own roll over
 * its roster, a member's place a member's career. Pure.
 * @param {number} n @param {number} k @param {number} w @param {number} size @param {number} band
 * @returns {number[]}
 */
export function starWaveFoes(n, k, w, size, band) {
  const roster = STAR_ROSTERS[bandOk(band)][Math.max(1, Math.min(STAR_WAVES, w | 0)) - 1];
  return Array.from({ length: Math.max(0, size | 0) }, (_, i) => pick(roster, starRoll(n, k, 300 + w * 32 + i)));
}

/** The masters - each its career, whether it stands as a woman, its name, its coming's call and its circle's call (its
 *  own line: a name with its article, "The Daedra Lord calls its circle", never a name dropped into one shared line). */
export const STAR_MASTERS = Object.freeze({
  mother: Object.freeze({ id: 'mother', career: M.Sorcerer, female: true, name: () => t('starfall.master.mother', 'The Coven Mother'), call: () => t('starfall.master.mother.call', 'The Coven Mother comes for the star!'), circle: () => t('starfall.master.mother.circle', 'The Coven Mother calls her circle. Break it!') }),
  flesh: Object.freeze({ id: 'flesh', career: M.FleshAtronach, female: false, name: () => getLocalizedEnemyName(M.FleshAtronach, enemyDisplayName(M.FleshAtronach)), call: () => t('starfall.master.flesh.call', 'A Flesh Atronach rises from the crater!'), circle: () => t('starfall.master.flesh.circle', 'The Flesh Atronach calls its circle. Break it!') }),
  lord: Object.freeze({ id: 'lord', career: M.DaedraLord, female: false, name: () => getLocalizedEnemyName(M.DaedraLord, enemyDisplayName(M.DaedraLord)), call: () => t('starfall.master.lord.call', 'A Daedra Lord answers the coven!'), circle: () => t('starfall.master.lord.circle', 'The Daedra Lord calls its circle. Break it!') }),
  seducer: Object.freeze({ id: 'seducer', career: M.DaedraSeducer, female: true, name: () => getLocalizedEnemyName(M.DaedraSeducer, enemyDisplayName(M.DaedraSeducer)), call: () => t('starfall.master.seducer.call', 'Mephala sends a Daedra Seducer!'), circle: () => t('starfall.master.seducer.circle', 'The Daedra Seducer calls her circle. Break it!') }),
  lich: Object.freeze({ id: 'lich', career: M.AncientLich, female: false, name: () => getLocalizedEnemyName(M.AncientLich, enemyDisplayName(M.AncientLich)), call: () => t('starfall.master.lich.call', 'The chant wakes an Ancient Lich!'), circle: () => t('starfall.master.lich.circle', 'The Ancient Lich calls its circle. Break it!') }),
});
/** Which master comes, by band and star (section 4): the Coven Mother; the second star's, in the second band, what the
 *  coven made; in the third, a Daedra Lord the demonologists bound, Mephala's own Seducer, an Ancient Lich the chant
 *  wakes (Daggerfall's own Mephala incantation wakes one). */
export const STAR_MASTER_TABLE = Object.freeze({
  1: Object.freeze(['mother', 'mother', 'mother']),
  2: Object.freeze(['mother', 'flesh', 'mother']),
  3: Object.freeze(['lord', 'seducer', 'lich']),
});
/** The master of star `k` in `band`. Pure. */
export const starMasterOf = (band, k) => STAR_MASTERS[STAR_MASTER_TABLE[bandOk(band)][Math.max(0, Math.min(2, k | 0))]];
/** The master's circle at its call `call` (0, 1): `size` careers off the fourth wave's roster, its own rolls. Pure. */
export function starCircleFoes(n, k, call, size, band) {
  const roster = STAR_ROSTERS[bandOk(band)][STAR_WAVES - 1];
  return Array.from({ length: Math.max(0, size | 0) }, (_, i) => pick(roster, starRoll(n, k, 500 + call * 16 + i)));
}
