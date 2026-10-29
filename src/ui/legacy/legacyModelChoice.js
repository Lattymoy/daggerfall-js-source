// @ts-check
// LEGACY2 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 6; Mac: "while I do want the permadeath option, I also want
// an option that isn't permadeath"): PROJECT LEGACY'S QUESTION - the model of the house a new character founds, put by
// the chargen door after the leveling question (systems/chargenSession.js withLevelingChoice), on the leveling
// question's own screen (ui/levelingChoice.js LevelingChoiceScreen: its cursor, its one answer, both faces). Like the
// leveling system it is answered once and never changed: the permanence is the point of one and the safety of the
// other. Enduring is first - the answer a player who presses Enter without reading gets is the one that cannot cost
// them a character.
//
// LEGACY-CHOICE (2026-10-06, Mac: "I want to add a enhanced plus UI popup for online when creating a character. Perma
// Death, the regular option, or the option that skips the liniage system entirely"): ONLINE THE QUESTION HAS A THIRD
// ANSWER - no lineage (systems/legacy/family.js NO_LINEAGE): the character founds no house, and Project Legacy sits
// them out for good (legacyHost.js found). Its own words on the Plus face (the popup), the three side by side.
// Offline the mod's own switch in Features does that for every character, and the question keeps its two.
import { LevelingChoiceScreen } from '../levelingChoice.js';
import { MODELS, NO_LINEAGE } from '../../systems/legacy/family.js';
import { legacySettings } from '../../systems/legacy/settings.js';
import { isOnlinePage } from '../../systems/online/onlineLane.js';
import { t } from '../../systems/textManager.js';   // CASUAL-LIFE: the new words through the text core

export const LEGACY_MODEL_TEXT = Object.freeze({ title: 'HOW WILL YOUR LINE ENDURE?', lines: Object.freeze(['Choose your family’s way with death.', 'It cannot be changed later.']) });
export const LEGACY_MODEL_FACE = Object.freeze({
  eyebrow: 'A new house',
  title: 'How will your line endure?',
  lead: 'Your character founds a family. Choose its way with death. It cannot be changed later.',
  pick: 'Choose',
  hint: 'Click one · up/down and Enter · 1 or 2',
});
/** LEGACY-CHOICE: the popup's words online, where a character may found no house at all. */
export const LEGACY_CHOICE_FACE = Object.freeze({
  eyebrow: 'A new character',
  title: 'Will your line endure?',
  lead: 'Found a family line and choose how it meets death, or play Casual without one. It cannot be changed later.',   // CASUAL-LIFE
  pick: 'Choose',
  hint: 'Click one · up/down and Enter · 1, 2 or 3',
});
/** ...and the classic face's two lines over the options, online. */
export const LEGACY_CHOICE_TEXT = Object.freeze({ title: 'WILL YOUR LINE ENDURE?', lines: Object.freeze(['Found a line and choose its way with death,', 'or play Casual. It cannot be changed later.']) });   // CASUAL-LIFE
/** Each answer's short tag on the Plus face. LEGACY-CHOICE: no lineage is the game's own death, tagged with the word the
 *  leveling question gives the game as it always was (LEVELING_FACE_TAGS) - not its title said twice. */
export const LEGACY_MODEL_TAGS = Object.freeze({ [MODELS.enduring]: 'Not permadeath', [MODELS.bloodline]: 'Permadeath', [NO_LINEAGE]: 'No death cost' });   // CASUAL-LIFE

/** LEGACY7: Bloodline's word online - the realm holds the line, so the death is final on every device. */
export const BLOODLINE_ONLINE_LINE = 'Online, a death is final on every device.';

/** The two answers, Enduring first. AUDIT LEGACY U7: the toll said is the one a death will charge - its Features tile's
 *  Legacy.Toll as it stands. AUDIT LEGACY B4/F1 shut Bloodline online while a permadeath had no authority there;
 *  LEGACY7 gave it one (the realm's tombstone, server-account/src/legacy.js), and it is open online, said so. */
export function legacyModelOptions({ online = isOnlinePage(), tollShare = legacySettings().tollShare } = {}) {
  const pct = Math.round(tollShare * 100);
  // CASUAL-LIFE: online the two models say three lines each, so Casual's four fit the classic face's 200
  return Object.freeze([
    Object.freeze({ id: MODELS.enduring, title: 'Enduring', locked: false, lockNote: null, lines: Object.freeze(online ? [
      t('legacy.choice.enduringOnline.cost', 'A death is not the end, but it costs years.'),
      t('legacy.choice.enduringOnline.toll', 'Arkay takes {pct}% of a lifespan for every road back.', { pct }),
      t('legacy.choice.enduringOnline.heir', 'When the span is spent, an heir takes over.'),
    ] : [
      'A death is not the end, but it costs years.',
      `Arkay takes ${pct}% of a lifespan for every road back,`,
      'and when the span is spent the mantle passes on',
      'to an heir. Elders may pass it on at any time.',
    ]) }),
    Object.freeze({ id: MODELS.bloodline, title: 'Bloodline', locked: false, lockNote: null, lines: Object.freeze(online ? [
      t('legacy.choice.bloodlineOnline.final', 'A death is final. An heir takes your place.'),
      'With no one left, the line ends.',
      // AUDIT LEGACY III U8: online says where the line is kept BESIDE that - it replaced it, and the end went unsaid
      BLOODLINE_ONLINE_LINE,
    ] : [
      'A death is final. An heir takes your place:',
      'a sibling, a child or a newborn of your blood.',
      'They may recover what you lost from your remains.',
      'With no one left, the line ends.',
    ]) }),
    // LEGACY-CHOICE: online, a character may found no house at all. CASUAL-LIFE: it is Casual, and says what it does
    ...(online ? [Object.freeze({ id: NO_LINEAGE, title: t('legacy.choice.casual.title', 'Casual'), locked: false, lockNote: null, lines: Object.freeze([
      t('legacy.choice.casual.what', 'No family line, no heirs and no permadeath.'),
      t('legacy.choice.casual.cost', 'A death costs no gold, no years and no gear.'),
      t('legacy.choice.casual.rise', 'You rise again at half health.'),
      t('legacy.choice.casual.wild', 'In the Wild, a player\'s kill still takes a share.'),
    ]) })] : []),
  ]);
}

/** The question, answering `onAnswer(model)` once - online a model or no lineage (LEGACY-CHOICE), offline a model. Its
 *  three online answers stack on the classic face by their own heights (LevelingChoiceScreen `stacked`). */
export const legacyModelScreen = (onAnswer, { online = isOnlinePage() } = {}) => new LevelingChoiceScreen(onAnswer, {
  options: legacyModelOptions({ online }), text: online ? LEGACY_CHOICE_TEXT : LEGACY_MODEL_TEXT,
  faceText: online ? LEGACY_CHOICE_FACE : LEGACY_MODEL_FACE, faceTags: LEGACY_MODEL_TAGS, stacked: online,
});
