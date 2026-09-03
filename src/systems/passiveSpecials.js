// V2c - PASSIVE SPECIALS + THE SUNLIGHT SEAM: PassiveSpecialsEffect.cs
// and PlayerEnterExit's two state flags (MIT, Daggerfall Workshop).
// The one key that was holding three doors: the vampire's actual sun
// and holy burn (V2b shipped the FLAGS and this ships the FIRE), the
// custom-class careers whose regeneration / sun damage / light-and-
// darkness magery have been mintable since chargen and read by
// nothing, and the enchantment conditions' inSunlight/inHolyPlace ctx
// arms, which had stood open since E1 and are answered here: the two
// readers below are wired into the enchant ctx at world.js:2024-2025
// off the host seam that worldModes.js:769 and dungeonContext.js:2093
// register (bible/01-Overview/Port-Ledger.md:576 strikes the pair
// through as closed, V2c 2026-08-27).
//
// THE TWO FLAGS ARE SMALL LAWS, verbatim:
//   IsPlayerInSunlight  = IsDay && !IsPlayerInside && !InPrison
//                         (PlayerEnterExit.cs:371 - no weather term)
//   IsPlayerInHolyPlace = inside a building whose type is Temple, or
//                         whose faction is Fighter_Trainers (849) -
//                         DFU's own quirky pair (:1424-1431)
// The day half is the clock's (gameDate); the inside/prison/temple
// halves are the HOST's, registered once per scene like the infection
// videos and the enchant ctx.
//
// CADENCE. DFU's %4 gates run on MagicRoundsSinceStartup (session-
// phase); the port passes the absolute classic minute - the same
// substitution enchantments.js records for its own %4/%60 gates.
// LightPoweredMagery/DarknessPoweredMagery are CONSTANT effects in
// DFU (per frame); folded to the round here, where the modifier they
// write is re-derived anyway.
//
// THE MODIFIER IS A SUM. ChangeMaxMagickaModifier accumulates from
// every producer and clears per round; the port has two producers -
// the enchantment fold (ExtraSpellPts) and this magery pass - so this
// pass, running AFTER the fold in worldTick's round, writes
// enchantMods.maxMagicka + its own delta into the one field the
// maxMagicka accessor reads.

import { isDayFromMinutes } from './gameDate.js';
import { SPECIAL_ABILITY_BITS, REGENERATION_FLAGS } from './specialAdvantages.js';

// PassiveSpecialsEffect.cs:35-40, verbatim.
export const SUN_DAMAGE_AMOUNT = 12;
export const HOLY_DAMAGE_AMOUNT = 12;
export const REGENERATE_AMOUNT = 1;
export const SUN_DAMAGE_PER_ROUNDS = 4;
export const HOLY_DAMAGE_PER_ROUNDS = 4;
export const REGENERATE_PER_ROUNDS = 4;
/** The two magery penalties (:143-166): a third of the RAW pool, or
 *  all of it (DFU writes -10000000 and the accessor floors at 0). */
export const MAGERY_REDUCED_FRACTION = -0.33;
export const MAGERY_UNABLE = -10000000;
/** FactionFile.FactionIDs.Fighter_Trainers (:521) - the holy pair's
 *  second member. */
export const FIGHTER_TRAINERS_FACTION = 849;

// ── THE HOST SEAM ────────────────────────────────────────────────
// { now(), isInside(), inPrison(), isHolyPlace(), isSwimming(),
//   inDungeon() } - every member optional; an absent member idles its
// arm (the headless charter). Registered once per scene boot.
// Answers the PREVIOUS host (the setDeathPresenter shape), so a
// nested mount - worldModes' dungeon branch building a dungeonContext
// - can restore the outer registration on destroy.
let _host = null;
export function setPassiveSpecialsHost(host) { const prev = _host; _host = host ?? null; return prev; }

/** PlayerEnterExit.cs:371, with the clock passed or read from the
 *  registered host. */
export function playerInSunlight(nowMinutes = null) {
  const now = nowMinutes ?? _host?.now?.() ?? 0;
  return isDayFromMinutes(now) && !(_host?.isInside?.() ?? false) && !(_host?.inPrison?.() ?? false);
}
/** PlayerEnterExit.cs:1424-1431, the host's answer. */
export const playerInHolyPlace = () => !!(_host?.isHolyPlace?.() ?? false);

// ── THE CAREER READS (the CFG bitfields the port's careers carry) ─
const bitfield = (career) => career?.abilityFlagsAndSpellPointsBitfield ?? 0;
export const careerSunDamage = (career) => !!(bitfield(career) & SPECIAL_ABILITY_BITS.sunDamage);
export const careerHolyDamage = (career) => !!(bitfield(career) & SPECIAL_ABILITY_BITS.holyDamage);
/** SetLightMagery at bits 6-7, SetDarknessMagery at bits 8-9
 *  (specialAdvantages.js:270-281's own writes): 1 = unable, 2 =
 *  reduced, 0 = none. */
export const careerLightMagery = (career) => (bitfield(career) >> 6) & 3;
export const careerDarknessMagery = (career) => (bitfield(career) >> 8) & 3;

/**
 * The per-round pass, riding worldTick's one round AFTER the
 * enchantment fold. Player only: the career flags this reads are the
 * player's CLASSES.DAT/custom-class bitfields, and the racial arms
 * read the player's own override - DFU's enemy entities never carry
 * either (ConstantEffect's race arm is explicitly IsPlayerEntity).
 */
export function passiveSpecialsMagicRound(entity, { nowMinutes = 0, sinks = null } = {}) {
  if (!entity?.isPlayer) return;
  const career = entity.career ?? null;
  const override = (entity.racialOverride && !entity.racialOverride.ended) ? entity.racialOverride : null;

  // RegenerateHealth (:81-105): the career's own flag, every 4th round
  if (nowMinutes % REGENERATE_PER_ROUNDS === 0 && career?.regeneration) {
    const day = isDayFromMinutes(nowMinutes);
    const dungeon = !!(_host?.inDungeon?.() ?? false);
    let regenerate = false;
    if (career.regeneration === REGENERATION_FLAGS.general) regenerate = true;
    else if (career.regeneration === REGENERATION_FLAGS.inDarkness) regenerate = !day || dungeon;
    else if (career.regeneration === REGENERATION_FLAGS.inLight) regenerate = day && !dungeon;
    else if (career.regeneration === REGENERATION_FLAGS.whileImmersed) regenerate = !!(_host?.isSwimming?.() ?? false);
    if (regenerate) sinks?.heal?.(REGENERATE_AMOUNT);
  }

  // DamageFromSunlight (:107-121): career flag OR the racial
  // override's (the vampire's compound race), every 4th round in
  // sunlight
  if (nowMinutes % SUN_DAMAGE_PER_ROUNDS === 0
    && (careerSunDamage(career) || override?.sunDamage)
    && playerInSunlight(nowMinutes)) {
    sinks?.hurt?.(SUN_DAMAGE_AMOUNT);
  }

  // DamageFromHolyPlaces (:123-137): the same shape over the temple
  if (nowMinutes % HOLY_DAMAGE_PER_ROUNDS === 0
    && (careerHolyDamage(career) || override?.holyDamage)
    && playerInHolyPlace()) {
    sinks?.hurt?.(HOLY_DAMAGE_AMOUNT);
  }

  // Light & Darkness Powered Magery (:139-166): the modifier is the
  // SUM of the enchant fold and this pass (see header). RawMaxMagicka
  // is the accessor with the modifier ZEROED for the read - never
  // backed out by subtraction, because the accessor FLOORS at 0 and an
  // unable write (-10000000) would poison the back-out forever. A
  // plain headless maxMagicka reads the same either way.
  let magery = 0;
  const _mod = entity.maxMagickaModifier ?? 0;
  entity.maxMagickaModifier = 0;
  const raw = entity.maxMagicka ?? 0;
  entity.maxMagickaModifier = _mod;
  const dark = !isDayFromMinutes(nowMinutes) || (_host?.isInside?.() ?? false);
  if (dark) {
    const light = careerLightMagery(career);
    if (light === 2) magery += Math.trunc(raw * MAGERY_REDUCED_FRACTION);
    else if (light === 1) magery += MAGERY_UNABLE;
  }
  if (playerInSunlight(nowMinutes)) {
    const darkness = careerDarknessMagery(career);
    if (darkness === 2) magery += Math.trunc(raw * MAGERY_REDUCED_FRACTION);
    else if (darkness === 1) magery += MAGERY_UNABLE;
  }
  entity.maxMagickaModifier = (entity._enchantMods?.maxMagicka ?? 0) + magery;
  if ((entity.magicka ?? 0) > (entity.maxMagicka ?? 0)) entity.magicka = entity.maxMagicka;
}
