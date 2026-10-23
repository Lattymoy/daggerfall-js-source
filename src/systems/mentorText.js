// @ts-check
// SOFTCAP1 / PWR3 (bible/05-Combat/Power-Arc.md section 6): MENTOR MODE'S WORDS - the chat's and the sheet's lines for
// the overlay (systems/mentorMode.js), in the player's language. Apart from the law so the law stays import-free (RF1:
// statMods.js and skills.js read it as a leaf's leaf).
import { t } from './textManager.js';
import { MENTOR_MIN_GAP, mentorEndedSource } from './mentorMode.js';

/** One line for the chat and the sheet: the party's mentoring, the place's sync (PWR3), or neither. @param {any} entity */
export function mentorStatusText(entity) {
  const m = entity?._mentor;
  if (!m) return t('mentor.status.none', 'Not mentoring. You mentor automatically in a party at least {gap} levels below you.', { gap: MENTOR_MIN_GAP });
  if (m.source === 'place') return t('mentor.status.place', 'This place\'s foes stand no higher than level {ceiling}: you fight as level {play} (really {real}). Your real progress is kept.', { ceiling: m.ceiling, play: m.playLevel, real: m.realLevel });
  return t('mentor.status.party', 'Mentoring: you fight as level {play} (really {real}). Your real progress is kept.', { play: m.playLevel ?? m.level, real: m.realLevel });
}
/** The chat's line as an overlay ends - the party's, or (PWR3) the place's. */
export const mentorEndedText = () => (mentorEndedSource() === 'place'
  ? t('mentor.ended.place', 'This place no longer holds you back: your real level, skills, attributes and gear are back.')
  : t('mentor.ended.party', 'Mentoring ended. Your real level, skills, attributes and gear are back.'));
