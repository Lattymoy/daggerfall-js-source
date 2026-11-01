// @ts-check
// PVP-EVADE (2026-10-30): MY EVASION, AS THE RELAY READS IT. My live Dodging and a worn gear power's evade ride my health
// report (net/siege/refereeHealthMirror.js); the referee rolls them with the level gap after a player's swing or shaft hit
// (net/siege/refereeHealthShare.js pvpEvadeChance), and its word on an evaded blow is said here.
import { VIT_DODGE_MAX, VIT_EVADE_MAX } from '../net/wire.js';
import { SKILLS, skillValue } from '../systems/skills.js';
import { powerKind } from '../systems/loot/lootPowers.js';
import { reportPlayerAttack } from './formulas.js';
import { hudText } from '../systems/notify.js';
import { t } from '../systems/textManager.js';

/** My live Dodging, gear counted - 0.05% evade a point, to 25%. */
export const pvpDodging = (entity) =>
  Math.max(0, Math.min(VIT_DODGE_MAX, Math.round(Number(skillValue(entity, SKILLS.Dodging)) || 0)));
/** A worn gear power's evade, per cent (the Raven's) - the referee holds it, Dodging and the level gap to 40%. */
export const pvpGearEvade = (entity) =>
  Math.max(0, Math.min(VIT_EVADE_MAX, Math.round(Number(powerKind(entity, 'evade')?.chance) || 0)));

/** The referee's word that a blow was evaded (`wref` `hp` with `ev`): `mine` my own blow - a miss on my HUD; else my line.
 *  True: the word is said. */
export function pvpEvadeHeard(mine) {
  if (mine) reportPlayerAttack({ hit: false, damage: 0, critical: false, backstab: false, ineffective: false });
  else hudText(t('pvp.evade', 'You evade the blow.'));
  return true;
}
