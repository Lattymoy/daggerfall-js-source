// @ts-check
// LEGACY2 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 6; Mac: "while I do want the permadeath option, I also want
// an option that isn't permadeath"): PROJECT LEGACY'S QUESTION - the model of the house a new character founds, put by
// the chargen door after the leveling question (systems/chargenSession.js withLevelingChoice), on the leveling
// question's own screen (ui/levelingChoice.js LevelingChoiceScreen: its cursor, its one answer, both faces). Like the
// leveling system it is answered once and never changed: the permanence is the point of one and the safety of the
// other. Enduring is first - the answer a player who presses Enter without reading gets is the one that cannot cost
// them a character.
import { LevelingChoiceScreen } from './levelingChoice.js';
import { MODELS } from '../systems/legacy/family.js';
import { legacySettings } from '../systems/legacy/settings.js';
import { isOnlinePage } from '../systems/onlineLane.js';

export const LEGACY_MODEL_TEXT = Object.freeze({ title: 'HOW WILL YOUR LINE ENDURE?', lines: Object.freeze(['Choose your family’s way with death.', 'It cannot be changed later.']) });
export const LEGACY_MODEL_FACE = Object.freeze({
  eyebrow: 'A new house',
  title: 'How will your line endure?',
  lead: 'Your character founds a family. Choose its way with death. It cannot be changed later.',
  pick: 'Choose',
  hint: 'Click one · up/down and Enter · 1 or 2',
});
export const LEGACY_MODEL_TAGS = Object.freeze({ [MODELS.enduring]: 'Not permadeath', [MODELS.bloodline]: 'Permadeath' });

/** Bloodline's word online, shut: its permadeath has no authority until the realm keeps lineages (LEGACY7). */
export const BLOODLINE_ONLINE_NOTE = 'Online, a house is Enduring until the realm keeps its lineages.';

/** The two answers, Enduring first. AUDIT LEGACY U7: the toll said is the one a death will charge - the Mods pane's
 *  Legacy.Toll as it stands. AUDIT LEGACY B4/F1: ONLINE, Bloodline is shown and SHUT (the leveling question's own
 *  LEVEL-ONLINE shape) - a permadeath the realm cannot hold is no permadeath. */
export function legacyModelOptions({ online = isOnlinePage(), tollShare = legacySettings().tollShare } = {}) {
  const pct = Math.round(tollShare * 100);
  return Object.freeze([
    Object.freeze({ id: MODELS.enduring, title: 'Enduring', locked: false, lockNote: null, lines: Object.freeze([
      'A death is not the end - but it costs years.',
      `Arkay takes ${pct}% of a lifespan for every road back,`,
      'and when the span is spent the mantle passes on',
      'to an heir. Elders may pass it on at any time.',
    ]) }),
    Object.freeze({ id: MODELS.bloodline, title: 'Bloodline', locked: !!online, lockNote: online ? BLOODLINE_ONLINE_NOTE : null, lines: Object.freeze([
      'A death is final. Your heir takes your place -',
      'a sibling, a child, or a newborn of your blood -',
      'and may recover what you lost from your remains.',
      'With no one left, the line ends.',
    ]) }),
  ]);
}

/** The question, answering `onAnswer(model)` once. */
export const legacyModelScreen = (onAnswer) => new LevelingChoiceScreen(onAnswer, {
  options: legacyModelOptions(), text: LEGACY_MODEL_TEXT, faceText: LEGACY_MODEL_FACE, faceTags: LEGACY_MODEL_TAGS,
});
