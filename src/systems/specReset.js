// @ts-check
// SPEC-RESET (2026-10-18, the owner: "Lets allow players to reset their ingame builds for a high cost"; asked, the owner
// chose the specialisations and 200k; bible/10-UI/Growth.md section 10) - A SPECIALISATION GIVEN UP, FOR GOLD. An arcane
// path (systems/arcanePaths.js) or a martial one (systems/martialPaths.js) had been chosen once and for good; this is
// the one way back: the family's path is cleared, so the guide (ui/growth/specGuide.js) offers every path the
// character's masteries open again. The masteries stay - a mastery is still permanent (masterSkills.js) - and so does
// the spellbook: a signature spell whose path is not held is the plain bundle the spell maker could make (arcanePaths.js
// pathCastSchool, arcanePowers.js), and the judge reads no signature spell (pathFindings). A path given up stays given
// up across an older build's carry: the save's arcane mirror says so before the book is read (save.js, AUDIT SPEC-RESET
// L2-1).
//
// THE PRICE is one flat SPEC_RESET_GOLD a family (arcanePaths.js), whatever the level - twenty times the Firmament's
// whole-sky respec (net/firmament/firmamentLaw.js FIRM_RESPEC_GOLD). It is paid as the Firmament's respec is paid
// (AUDIT SPEC-RESET L1-1: 200,000 coins weigh 500 kg, so no purse carries it): the coins, else the letters of credit and
// then the coins (court.js deductGold - DFU's PlayerEntity.DeductGoldAmount), and online what is still owed off the
// Empire's account (court.js payUndoable; net/realm/realmGoldLaw.js accountOfSave - EMPIRE-ACCOUNT, one account for
// every region). Offline a bank account is its region's and the pause window stands in none, so coins and letters pay
// (GetGoldAmount, what a shop or a trainer asks) and the refusal says so. Every one of them is the save's own, and the
// path is the save's alone (no service holds it), so the purse and the path move in one save, together.
//
// A leaf of its own, not the paths' laws: arcanePaths.js is bundled into the account Worker (judge.js), and court.js -
// whose imports the Worker does not bundle - must never reach it.

import { pathOf, SPEC_RESET_GOLD } from './arcanePaths.js';   // the price's one home, where the choice boxes name it
import { martialPathOf } from './martialPaths.js';
import { totalGoldAmount, payUndoable } from './court.js';
import { accountOfSave, REALM_EMPIRE_ACCOUNT } from '../net/realm/realmGoldLaw.js';   // EMPIRE-ACCOUNT: the account online gold pays from
import { computeEntityMods } from './entityMods.js';
import { t } from './textManager.js';

/** Each family's held path, the field that keeps it, and its one ask's flag. */
const LAW = Object.freeze({
  arcane: { held: pathOf, field: 'arcanePath', prompted: 'pathPrompted' },
  martial: { held: martialPathOf, field: 'martialPath', prompted: 'martialPrompted' },
});

/** The path `family` holds on this entity, or null. */
export const resetHeld = (entity, family) => (Object.hasOwn(LAW, family) ? LAW[family].held(entity) : null);
/** The entity field that keeps `family`'s path, or null - the one home the guide reads it from (AUDIT SPEC-RESET L5-9). */
export const resetField = (family) => (Object.hasOwn(LAW, family) ? LAW[family].field : null);

/** The bank account a reset may draw on: online the Empire's, offline none. */
const resetAccount = (entity) => (entity?._online === true ? accountOfSave(entity, REALM_EMPIRE_ACCOUNT) : null);

/** What can pay a reset: the coins and letters (totalGoldAmount), and online the Empire's account. */
export function resetGold(entity) {
  const account = resetAccount(entity);
  return totalGoldAmount(entity) + Math.max(0, Number(account?.accountGold) || 0);
}

/** Why `family`'s path cannot be reset now, or null when it can: no such family, nothing held, or too little gold. */
export function specResetRefusal(entity, family) {
  if (!Object.hasOwn(LAW, family)) return t('schools.refuse.none', 'No such specialization.');
  const held = resetHeld(entity, family);
  if (!held) return t('growth.spec.reset.refuse.nothing', 'You have no specialization of this kind to reset.');
  const have = resetGold(entity);
  if (have >= SPEC_RESET_GOLD) return null;
  const words = { gold: SPEC_RESET_GOLD, have };
  return entity?._online === true
    ? t('growth.spec.reset.refuse.gold', 'Resetting costs {gold, number} gold. You have {have, number}.', words)
    : t('growth.spec.reset.refuse.goldOffline', 'Resetting costs {gold, number} gold, paid in coins or letters of credit. You have {have, number}.', words);
}

/** Reset it: pay SPEC_RESET_GOLD, clear the family's path - its one ask stays made (AUDIT SPEC-RESET L1-2: a path chosen
 *  on the guide had never set it, and the next quiet pass asked the player to choose back the path just paid away) - and
 *  fold the entity's mods now, not at the next round (L1-3: a passive's stats outlived it). Returns { ok, text }. */
export function resetSpec(entity, family) {
  const why = specResetRefusal(entity, family);
  if (why) return { ok: false, text: why };
  const held = resetHeld(entity, family);
  payUndoable(entity, SPEC_RESET_GOLD, resetAccount(entity));
  entity[LAW[family].field] = null;
  entity[LAW[family].prompted] = true;
  computeEntityMods(entity);
  return { ok: true, text: t('growth.spec.reset.done', '{name} is reset.', { name: held.name }) };
}
