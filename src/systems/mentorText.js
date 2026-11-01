// MENTOR2 (2026-10-27; bible/06-Systems/Mentor-Mode.md): what mentoring says to the player - the chat, the sheet, the
// party tab, the HUD's tile and its card. Every word through the text core; mentorMode.js stays import-free.

import { t } from './textManager.js';
import { MENTOR_PUPIL_TALLY } from './mentorMode.js';

/** A share as a whole percent ("62"). */
const pct = (k) => Math.round((Number.isFinite(k) ? k : 1) * 100);
/** The pupil's bonus as a whole percent ("20"). */
export const pupilBonusPct = () => Math.round((MENTOR_PUPIL_TALLY - 1) * 100);

/** "Lv 12" - a level, short. */
export const levelShort = (level) => t('mentor.levelShort', 'Lv {level}', { level });

/** One line for the chat, the sheet and the party tab. */
export function mentorStatusText(entity) {
  const m = entity?._mentor;
  if (!m)
    return t(
      'mentor.status.off',
      'Not mentoring. Beside a party member far below your level, you fight closer to their level.',
    );
  return t(
    'mentor.status.on',
    'Mentoring: you fight as level {level} (really {real}). Your gear and powers act at {pct}%. Your real progress is kept.',
    { level: m.level, real: m.realLevel, pct: pct(m.powerScale) },
  );
}

/** The pupil's line, or null for no mentor beside me. */
export function pupilStatusText(entity) {
  if (!entity?._pupil) return null;
  return t('mentor.status.pupil', 'A mentor is beside you: your skills train {pct}% faster.', { pct: pupilBonusPct() });
}

/** The line the chat says when mentoring ends. */
export const mentorEndedText = () =>
  t('mentor.ended', 'Mentoring ended. Your real level, skills, attributes, gear and powers are back.');

/** The HUD's tile (ui/hud/hudStatus.js statusTiles `mentor`): `{ name, foot, pupil }`, or null. */
export function mentorHudTile(entity) {
  const m = entity?._mentor;
  if (m) return { name: t('mentor.tile.mentor', 'Mentoring'), foot: levelShort(m.level), pupil: false };
  if (entity?._pupil) return { name: t('mentor.tile.pupil', 'Mentored'), foot: `+${pupilBonusPct()}%`, pupil: true };
  return null;
}

/** The tile's hover card (ui/hud/statusTips.js): its meta and its lines. */
export function mentorTipCard(entity) {
  const lines = [];
  if (entity?._mentor) lines.push(mentorStatusText(entity));
  const pupil = pupilStatusText(entity);
  if (pupil) lines.push(pupil);
  return { meta: t('mentor.tip.meta', 'Mentor Mode'), lines };
}

/** The party tab's note: what mentoring does for me now, or null. */
export function mentorPartyNote(entity) {
  if (entity?._mentor) return mentorStatusText(entity);
  return pupilStatusText(entity);
}

/** The Firmament window's word while mentoring (firmamentLive.js firmamentStatus 'mentoring'). */
export const firmamentMentoringText = (scale) =>
  t(
    'firmament.status.mentoring',
    'While you mentor a lower-level party, your combat stars act at {pct}%. Your crafting and trade stars act in full.',
    { pct: pct(scale) },
  );

/** The Specialization page's word on a held path while mentoring. */
export const pathMentoringText = (scale) =>
  t(
    'growth.spec.why.chosenMentor',
    'Your specialization. Its powers act at {pct}% while you mentor a lower-level party.',
    { pct: pct(scale) },
  );
