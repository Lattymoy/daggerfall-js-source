// SOFTCAP3 (2026-09-29): MASTER SKILLS - the climb past 100.
//
// A LEAF (it imports nothing), read by skills.js, advancement.js and the
// softcap's enemy law, so none of them grows a cycle.
//
// WHAT IT IS. With Master Skills in force:
//   - skills climb past 100 to 200 on the softcap's ladder (skillSoftcap.js),
//     learning there only from foes tough for the skill;
//   - Daggerfall's 95 lock is lifted (PlayerEntity.RaiseSkills'
//     AlreadyMasteredASkill gate: once a PRIMARY skill is mastered no other
//     skill at 95+ may rise), so every skill can reach 100 and go on;
//   - dangerous dungeons answer with tougher foes (skillSoftcap.js combatEdge).
// Below 100 nothing is different either way.
//
// WHO DECIDES (Mac, 2026-09-29: "no opt-in or opt-out ... only in offline
// mode there should be opt in and out"):
//   ONLINE  - always in force; nobody switches it. The first time a primary
//             skill is mastered, a box EXPLAINS it once, with an OK button.
//   OFFLINE - the player's switch (entity.masterSkills), off by default: the
//             first mastery ASKS once (Yes/No), and the skill screen keeps the
//             switch. Not inside a dungeon - its foes were scaled (or not) as
//             they spawned, so switching on under unscaled foes would be a free
//             lunch; the host's gate says so (setMasterSkillsGate).
//
// SPECIALISING (Mac, 2026-09-29: "lets do 2/2/1 - when a skill reaches 100 the player gets to choose ... this
// decision can not be undone"). Master Skills lets EVERY skill reach 100 (the 95 lock is lifted), but only the
// skills a character MASTERS may pass it: 2 of the 3 primary, 2 of the 3 major, 1 of the 6 minor - five in all
// (MASTERY_SLOTS). Miscellaneous skills never pass 100. The choice is offered the first quiet pass after a skill
// reaches 100 while its group has a slot (and any time after from the skill screen), says how many that group
// allows and how many remain, and is PERMANENT (entity.masteredSkills, saved). A skill not mastered simply stays at
// 100 - classic Daggerfall's ceiling - and teaches nothing more.
//
// NOTHING IS LOST. Off never lowers a stored value: a skill above 100 READS
// as 100 while off (the same overlay shape as mentor mode), and reads its
// real value again when on - offline switched back on, or the same character
// played online.
//
// THE BOXES. Made by scenes/shared.js raisePlayerSkills on a pass that put no
// other window up (no mastery box, no level-up sheet): the OK box online, the
// Yes/No box offline - each DFU's own message box on the classic skin (and so
// in any UI pack's art over it), the skin's card on the enhanced one.

export const MASTER_SKILLS_NAME = 'Master Skills';

/** The offer's rows - short enough for Daggerfall's parchment box as for the enhanced card. */
export const MASTER_SKILLS_OFFER_ROWS = Object.freeze([
  'You have mastered a skill.',
  'Activate Master Skills?',
  '',
  'You can master 2 primary, 2 major and 1 minor',
  'skill once each reaches 100. A mastered skill',
  'can climb past 100, up to 200.',
  'Each point past 100 is much slower to earn',
  'and gives a smaller boost.',
  'Past 100 a skill only learns from tough foes;',
  'weak ones and repeating it will not help.',
  'Below 100, skills rise as before.',
  'Dangerous dungeons send stronger enemies.',
  'Values may change during development.',
  '',
  'You can turn it off in your skill screen.',
  'Your progress is always kept.',
]);

/** The skill screen's description (enhanced pane; the classic box shows it as rows). */
export const MASTER_SKILLS_ABOUT = Object.freeze([
  'Every skill can reach 100. You can master 2 primary, 2 major and 1 minor skill once each reaches 100, and only mastered skills climb past 100, up to 200. A mastery can never be undone. Miscellaneous skills stop at 100.',
  'Each point past 100 is much slower to earn and gives 25% of the boost of a point below 100, with milestone bonuses at 125, 150, 175 and 200.',
  'Past 100 a skill only improves against enemies that are tough for it. Weak enemies and repetition do not help. Below 100, skills rise as before, and mastering a primary skill no longer holds your other skills at 95.',
  'Dangerous dungeons send stronger enemies as your skills pass 100. Easy dungeons, towns and the wilds stay as they are.',
  'It is always on when playing online. Offline you can turn it off and keep your progress: skills above 100 count as 100 until you turn it back on. It cannot be changed inside a dungeon. Values may change during development.',
]);

export const MASTER_SKILLS_ONLINE_TEXT = 'Master Skills is always on when playing online.';
export const MASTER_SKILLS_DUNGEON_TEXT = 'Master Skills cannot be changed inside a dungeon.';
export const MASTER_SKILLS_DECLINED_TEXT = 'You can activate Master Skills later in your skill screen.';
export const MASTER_SKILLS_ON_TEXT = 'Master Skills activated: skills can pass 100.';
export const MASTER_SKILLS_OFF_TEXT = 'Master Skills off. Your progress is kept.';

/** The box that EXPLAINS it online - it is already in force, so it only needs an OK. */
export const MASTER_SKILLS_INFO_ROWS = Object.freeze([
  'You have mastered a skill.',
  'Master Skills',
  '',
  'You can now master 2 primary, 2 major and',
  '1 minor skill once each reaches 100. A mastered',
  'skill can climb past 100, up to 200.',
  'Each point past 100 is much slower to earn',
  'and gives a smaller boost.',
  'Past 100 a skill only learns from tough foes;',
  'weak ones and repeating it will not help.',
  'Below 100, skills rise as before.',
  'Dangerous dungeons send stronger enemies.',
  'Values may change during development.',
]);

/** SOFTCAP4: the short explanation that heads the FIRST mastery choice online (the whole box stays inside the
 *  classic parchment's height; the skill screen has the full text). */
export const MASTER_SKILLS_INTRO_ROWS = Object.freeze([
  'Master Skills',
  'Past 100 a skill learns only from tough foes,',
  'and each point is much slower to earn.',
  'Dangerous dungeons send stronger enemies.',
  '',
]);

/** In force: always online; offline only when the player switched it on. */
export const masterSkillsActive = (entity) => (entity?._online === true ? true : entity?.masterSkills === true);

// ---- specialising: the 2 / 2 / 1 masteries ----------------------------------

/** How many skills of each career group may pass 100. */
export const MASTERY_SLOTS = Object.freeze({ primary: 2, major: 2, minor: 1 });
export const MASTERY_GROUP_NAMES = Object.freeze({ primary: 'Primary', major: 'Major', minor: 'Minor' });

/** 'primary' | 'major' | 'minor' | null (a miscellaneous skill). */
export function careerGroupOf(entity, id) {
  const c = entity?.career;
  if (c?.primarySkills?.includes(id)) return 'primary';
  if (c?.majorSkills?.includes(id)) return 'major';
  if (c?.minorSkills?.includes(id)) return 'minor';
  return null;
}

export const masteredSkills = (entity) => (Array.isArray(entity?.masteredSkills) ? entity.masteredSkills : []);
export const isMasteredSkill = (entity, id) => masteredSkills(entity).includes(id);

/** AUDIT MARTIAL L4 L3: how many of `ids` this character has mastered or can still master - per career group, the ones
 *  mastered and as many more as the group's slots have left (a miscellaneous skill never). What can EVER open a
 *  specialisation (martialPaths.js martialPossible, arcanePaths.js pathPossible). */
export function masterableCount(entity, ids) {
  let n = 0;
  for (const g of /** @type {const} */ (['primary', 'major', 'minor'])) {
    const mine = ids.filter((id) => careerGroupOf(entity, id) === g);
    const have = mine.filter((id) => isMasteredSkill(entity, id)).length;
    n += have + Math.min(masterySlots(entity, g).left, mine.length - have);
  }
  return n;
}
/** A group's slots: { used, max, left }. */
export function masterySlots(entity, group) {
  const max = MASTERY_SLOTS[group] ?? 0;
  const used = masteredSkills(entity).filter((id) => careerGroupOf(entity, id) === group).length;
  return { used, max, left: Math.max(0, max - used) };
}

/** May this skill climb past 100 right now? (Master Skills in force AND the skill mastered) */
export const skillCanPassCap = (entity, id) => masterSkillsActive(entity) && isMasteredSkill(entity, id);

/** Why this skill cannot be mastered now, or null when it can. */
export function masteryRefusal(entity, id) {
  if (!masterSkillsActive(entity)) return 'Master Skills is off.';
  const g = careerGroupOf(entity, id);
  if (!g) return 'Only primary, major and minor skills can be mastered.';
  if (isMasteredSkill(entity, id)) return 'Already mastered.';
  if (!((entity.skills?.[id] ?? 0) >= 100)) return 'A skill can be mastered once it reaches 100.';
  if (masterySlots(entity, g).left <= 0) return `All ${MASTERY_SLOTS[g]} ${g} masteries are chosen.`;
  return null;
}

/** Master it - PERMANENT. Returns { ok, text }. */
export function masterSkill(entity, id, names = null) {
  const why = masteryRefusal(entity, id);
  if (why) return { ok: false, text: why };
  entity.masteredSkills = [...masteredSkills(entity), id];
  const n = names?.[id] ?? 'The skill';
  return { ok: true, text: `${n} mastered: it can now pass 100.` };
}

/** Every skill that could be mastered right now, primary first. */
export function masteryCandidates(entity) {
  const c = entity?.career;
  return [...(c?.primarySkills ?? []), ...(c?.majorSkills ?? []), ...(c?.minorSkills ?? [])]
    .filter((id) => masteryRefusal(entity, id) == null);
}

/** The next skill whose choice the game still owes an ASK (asked once per skill; the skill screen keeps the rest). */
export function nextMasteryChoice(entity) {
  const asked = Array.isArray(entity?.masteryPrompted) ? entity.masteryPrompted : [];
  return masteryCandidates(entity).find((id) => !asked.includes(id)) ?? null;
}

/** The choice box's rows: what it does, that it is permanent, and the group's count before and after. */
export function masteryChoiceRows(entity, id, names = {}) {
  const g = careerGroupOf(entity, id);
  const { max, left } = masterySlots(entity, g);
  const name = names[id] ?? 'this skill';
  const after = left - 1;
  return [
    `Master ${name}?`,
    '',
    `${name} has reached 100. If you master it,`,
    'it can climb past 100, up to 200.',
    '',
    'This decision cannot be undone.',
    `${MASTERY_GROUP_NAMES[g]} skills: you can master ${max}.`,
    after > 0 ? `After this: ${after} ${g} ${after === 1 ? 'mastery' : 'masteries'} left.` : `This would be your last ${g} mastery.`,
  ];
}

/** The value a PLAYER's permanent skill reads with Master Skills as it stands: above 100 only for a MASTERED skill
 *  while Master Skills is in force (enemies are never capped). `id` omitted = the switch alone (no mastery test). */
export function masterCappedSkill(entity, raw, id = null) {
  if (!entity?.isPlayer || !(raw > 100)) return raw;
  if (masterSkillsActive(entity) && (id == null || isMasteredSkill(entity, id))) return raw;
  return 100;
}

let _gate = null;
/** The host's extra refusal (a dungeon): fn(entity) -> reason string or null. */
export function setMasterSkillsGate(fn) { _gate = typeof fn === 'function' ? fn : null; }

/** Whether this character has a switch at all (offline only). */
export const masterSkillsSwitchable = (entity) => entity?._online !== true;

/** Why the switch cannot move right now, or null. */
export function masterSkillsBlockReason(entity) {
  if (!masterSkillsSwitchable(entity)) return MASTER_SKILLS_ONLINE_TEXT;
  try { return _gate?.(entity) ?? null; } catch { return null; }
}

/** Move the switch (offline). Returns { ok, text } - the text is what the UI says either way. */
export function setMasterSkills(entity, on) {
  const reason = masterSkillsBlockReason(entity);
  if (reason) return { ok: false, text: reason };
  entity.masterSkills = !!on;
  entity.masterSkillsAsked = true;
  return { ok: true, text: on ? MASTER_SKILLS_ON_TEXT : MASTER_SKILLS_OFF_TEXT };
}

const masteredPrimary = (entity) => Array.isArray(entity?.skills)
  && (entity.career?.primarySkills ?? []).some((id) => (entity.skills[id] ?? 0) >= 100);

/** Which one-time box is owed now: 'info' (online, never shown), 'offer' (offline, never asked, off, free to
 *  switch), or null. Both wait for a mastered primary skill - the moment Daggerfall would stop you. */
export function masterSkillsBoxDue(entity) {
  if (!entity || !masteredPrimary(entity)) return null;
  if (entity._online === true) return entity.masterSkillsInfoSeen ? null : 'info';
  if (entity.masterSkills === true || entity.masterSkillsAsked) return null;
  return masterSkillsBlockReason(entity) == null ? 'offer' : null;
}

/** The status line every skill screen prints. */
export function masterSkillsStatusText(entity) {
  if (entity?._online === true) return `${MASTER_SKILLS_NAME}: On`;
  return `${MASTER_SKILLS_NAME}: ${entity?.masterSkills === true ? 'On' : 'Off'}`;
}
