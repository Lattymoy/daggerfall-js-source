// @ts-check
// REST-WARN (2026-10-08, the owner: "Poison/Disease warning on rest, there should be one for when you attempt to rest"):
// a rest begun while a poison or a disease is working on the player asks first. Neither ends with sleep - a poison keeps
// doing its harm through the hours, a disease keeps its hold (DFU's own travel popup says as much, DaggerfallTravelPopUp
// .cs:419, and nothing said it at the rest) - so the box says what is wrong and asks whether to rest anyway. A curse in
// the blood (vampirism, lycanthropy) is the temple's Heal Curse, not this. Pure: the entity in, the box's lines out.
import { poisonCount } from './poisons.js';

/** The plain diseases running now (never a vampirism or lycanthropy infection). */
const plainDiseases = (entity) => (entity?.activeEffects ?? []).filter((a) => a.kind === 'disease' && !a.ended && !a.infection).length;

/** The warning's lines, or null when nothing ails the player. */
export function restAilmentLines(entity) {
  const p = poisonCount(entity), d = plainDiseases(entity);
  if (!p && !d) return null;
  // REST-WARN2: three short lines - each fits the box on one line, none left dangling
  const what = p && d ? 'You are poisoned and diseased.' : p ? 'You are poisoned.' : 'You are diseased.';
  return [what, 'Resting will not cure it.', 'Rest anyway?'];
}
