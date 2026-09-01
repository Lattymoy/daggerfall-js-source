// ═══════════════════════════════════════════════════════════════════
// U52 — THE ENHANCED CHARACTER SHEET'S MODEL
//
// The first of the port's IN-GAME screens to grow an enhanced twin.
// ui/charSheetDoor.js chooses; the PAUSE WINDOW's Stats page draws
// (ui/enhancedMenu.js), out of the `sheetModel` below.
//
// ── WHAT IS LEFT HERE, AND WHY ───────────────────────────────────
//
// PX27 retired this file's own view: there were two enhanced
// character sheets reading the same four sections out of the same
// model, and the door now hands the host the pause window's Stats
// page instead. AUDIT 39 found that only the CALL SITE had gone -
// mountEnhancedCharSheet, its render, its window-level capture
// keydown claiming F5 and its pointer-lock handler were still
// exported with no caller anywhere in src/, tools/ or test/, which
// is the orphan-listener hazard this file's own tests warn about
// wearing the mask of live code. The view is gone now; the model,
// which both sheets always read, stays.
//
// ── THE DENSITY ARGUMENT, WHICH IS THIS SCREEN'S WHOLE POINT ─────
//
// src/tools/enhancedUI.js's header makes it: Daggerfall has 35 skills
// where Skyrim has 18, and the density IS the game. The classic sheet
// answers that by showing NINE of them - keys 1-4 pop a text panel over
// the art and `_drawSkillPage` slices to `ids.slice(0, 9)`, because a
// 320x200 panel has nowhere else to put them. A player who wants to
// compare a Major against a Miscellaneous presses two keys and
// remembers the first number.
//
// So this screen shows every skill the character HAS a career for, in
// DFU's own three groups, and puts the twenty-odd Miscellaneous ones
// one press away rather than absent. Disclosure, not deletion - which
// is the prototype's rule and the reason it is not simply "Skyrim's
// sheet with Daggerfall's words in it".
//
// ── THE NUMBERS ARE THE CLASSIC SHEET'S ──────────────────────────
//
// Every figure here comes from the same expression
// ui/charsheet.js draws: liveStat for the eight attributes (so a
// magical drain shows), maxFatigue with DFU's /64 display divisor,
// FormulaHelper.MaxEncumbrance over liveStat strength, and
// `carriedWeight` - which was module-private in that file and is
// EXPORTED for this one rather than re-reduced here. `sheetModel` is
// pure and separate precisely so a node test can hold it against the
// classic window's own draw() and prove the two sheets never disagree
// about a number.
//
// ── WHAT THE ENHANCED SHEET DOES NOT DRAW ────────────────────────
//
// THE PAPERDOLL. The classic sheet composes it at DFU's (200,8) and
// the prototype answers the same slot with a 28-node body schematic -
// but that schematic is the INVENTORY's signature, it wants
// tools/enhancedVisuals.js and the three.js tag enhanced.html loads
// from a CDN, and the port's doctrine has exactly one third-party
// request in it already (Ledger A, the web fonts). It belongs to the
// inventory slice with the equip map it explains. Recorded as a real
// loss rather than dropped quietly.
//
// THE LEVEL-UP SCREEN stays classic: it is a different window
// (LevelUpScreen), the hosts push it themselves, and it mutates stats
// through chargen's verbatim clamps. Not this door's business.
// ═══════════════════════════════════════════════════════════════════

import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { liveStat, maxFatigue, FATIGUE_MULTIPLIER } from '../systems/statMods.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';   // AUDIT 26: PlayerEntity.MaxEncumbrance, enchantment allowance and all
import { carriedWeight } from './charsheet.js';
import { totalGoldAmount } from '../systems/court.js';   // PlayerEntity.GetGoldAmount, the figure the classic sheet draws

/** The three career groups, in DFU's own order, plus the remainder.
 *  `_drawSkillPage`'s `names` array, which is what keys 1-4 page. */
export const SKILL_GROUPS = Object.freeze(['Primary', 'Major', 'Minor', 'Miscellaneous']);

/**
 * THE SHEET, as data. Pure: no DOM, no entity mutation, every figure
 * lifted from the expression ui/charsheet.js's draw() uses.
 *
 * Miscellaneous is "every skill in no career group", which is
 * `_drawSkillPage`'s own definition and NOT a fixed list - a career
 * with a different spread moves skills between groups and this follows
 * it.
 */
export function sheetModel(entity) {
  const e = entity ?? {};
  const career = [
    e.career?.primarySkills ?? [],
    e.career?.majorSkills ?? [],
    e.career?.minorSkills ?? [],
  ];
  const inCareer = new Set(career.flat());
  const misc = SKILL_NAMES.map((_, id) => id).filter((id) => !inCareer.has(id));
  const strength = liveStat(e, 'strength');
  return {
    name: e.name ?? '',
    // The classic sheet's own default when an entity carries none.
    race: e.race ?? 'Breton',
    career: e.career?.name ?? '',
    level: e.level ?? 1,
    // The classic sheet's own read: GetGoldAmount, coins plus every
    // letter of credit (DaggerfallCharacterSheetWindow.cs:401).
    gold: totalGoldAmount(e),
    health: { now: e.health ?? 0, max: e.maxHealth ?? 0 },
    magicka: { now: e.magicka ?? 0, max: e.maxMagicka ?? 0 },
    // FatigueMultiplier is the DISPLAY divisor: DFU stores fatigue in
    // points and the sheet draws points/64. The constant is
    // statMods.js's own export, not a fourth copy of the number -
    // ui/charsheet.js had two inline and this would have been the
    // third and fourth.
    fatigue: {
      now: Math.trunc((e.fatigue ?? maxFatigue(e)) / FATIGUE_MULTIPLIER),
      max: Math.trunc(maxFatigue(e) / FATIGUE_MULTIPLIER),
    },
    encumbrance: { now: Math.trunc(carriedWeight(e)), max: entityMaxEncumbrance(e) },
    attributes: STAT_KEYS_ORDER.map((key) => ({ key, value: liveStat(e, key) })),
    groups: SKILL_GROUPS.map((name, i) => ({
      name,
      ids: i < 3 ? career[i] : misc,
      // The three career groups are the character's chosen shape and
      // open; the remainder is the disclosure.
      career: i < 3,
    })),
    skill: (id) => e.skills?.[id] ?? 0,
  };
}
