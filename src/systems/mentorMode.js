// SOFTCAP1 (2026-09-29): MENTOR MODE - playing with lower-level friends.
//
// AUTOMATIC (Mac, 2026-09-29: "higher level players will be automatically a mentor for lower level players
// when partying up"): there is no switch. Join a party whose level is well below yours and you mentor it; leave, or
// let the gap close, and you are yourself again the same frame.
//
// An OVERLAY, never a write. Nothing here changes entity.skills,
// entity.stats, entity.level, entity.maxHealth or a single item: the
// mentor's profile lives on `entity._mentor` (underscore = never saved,
// see systems/save/save.js) and the READERS consult it - skills.js skillValue,
// statMods.js liveStat, formulas.js (the armour term and the blow's
// tail), the dungeon's spawn level. Leave the group, or switch it off,
// and `refreshMentor` clears the field: the real character is simply
// read again. Nothing was lost because nothing was touched.
//
// THE MATH, and why each piece has the shape it has
//
//  1. TARGET LEVEL. The group's reference is the HARMONIC mean of the
//     partners' levels, which leans toward the lowest member (levels
//     3, 5 and 20 give 5.1, not 9.3) - the one who most needs the fight
//     to stay fair. The mentor plays at round(ref) + 1 ("about your
//     group's level"), never above their own. Mentoring engages only
//     when that is at least MENTOR_MIN_GAP levels below the real one.
//
//  2. SKILLS. Daggerfall's cost per use grows with the skill's value and
//     1.04^level, so skill-over-effort is concave; the progress a
//     character made since a chargen-ish baseline B = 30 is scaled by
//     f = sqrt(t / r) (t target level, r real level):
//         mentored = B + (raw - B) * f          (raw above B)
//     then clamped by the group's own ceiling E(t) + 10, where
//     E(L) = 5L + 30 is the game's line for a level-L foe's skills.
//     So a mentor keeps their SHAPE (their best skill is still their
//     best) but at the group's scale. A skill at or under B is untouched.
//
//  3. ATTRIBUTES. Each level-up hands out 4..6 points (5 on average), so
//     r - t levels are worth D = 5 (r - t) points. D is taken back from
//     the eight attributes IN PROPORTION to what each holds above 40
//     (a stat never drops below min(raw, 40)) - exactly the points those
//     levels would, on average, have added, and from where they went.
//
//  4. HEALTH. This character's own average gain per level is read off
//     its sheet: g = (rawMax - 25) / (r - 1). Its mentored maximum is
//     rawMax - g (r - t). Rather than rewrite the health pool (which is
//     live state, saved and synced), incoming blows are multiplied by
//     rawMax / mentoredMax - the same fight as carrying that pool.
//
//  5. GEAR. k = clamp(sqrt(E(t) / E(r)), 0.5, 1). A weapon's blows land
//     at k, and armour keeps k of its protection:
//         armorValue' = 100 - (100 - armorValue) * k   (100 = unarmoured)
//
//  6. REWARDS. The spawn level the dungeon reads is the MENTORED level,
//     so enemies (and so loot tables) are the group's. The skill tallies
//     above 100 are weighed against the REAL skill (skillSoftcap.js), so
//     weak foes teach a mentor nothing, and a mentor's overcap power does
//     not raise the group's enemies either.
//
// PWR3 (2026-10-23, bible/05-Combat/Power-Arc.md section 6; Mac, asked: "Online only, keep a 15% edge"): THE PLACE
// SETS THE PLAYER - the same overlay, a second source. A place's CEILING is the deadliest native its own encounter
// table fields (systems/placeSync.js, off DFU's tables and bestiary); online, a player above it plays at the level
// whose skill line stands PLACE_SYNC_EDGE over the ceiling's (placeEdgeLevel: E(t) = 1.15 E(c), the game's own line),
// and the world is built at the ceiling (effectiveLevel) - so a level-30 hero in a Cemetery plays a level-14 character's
// skills against its level-11 natives, a sixth stronger than one who belongs there. Between the ceiling and that level
// the player plays whole and the world stops at the ceiling, so the edge grows smoothly to its 15% and no further.
// The PARTY's source keeps its own law (the port's powers sleep while mentoring - isMentoring); the PLACE's keeps them
// awake - they are the player's kit, bounded by PWR1 and PWR2, and Renown's by PWR4 - and reads only what a level
// gives: skills, attributes, health, the gear's scale, the level the player's own spells are cast at (playLevel).
// Where both stand, the lower level plays and the lower world is built.

export const MENTOR_LEVEL_ALLOWANCE = 1;
export const MENTOR_MIN_GAP = 3;
export const MENTOR_SKILL_BASELINE = 30;
export const MENTOR_SKILL_CEILING_SLACK = 10;
export const MENTOR_STAT_BASELINE = 40;
export const AVERAGE_LEVEL_UP_POOL = 5;   // FormulaHelper.BonusPool: Range(4, 6+1)
export const MENTOR_HP_BASE = 25;
export const MENTOR_MAX_DAMAGE_MULT = 5;
const STAT_KEYS = ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck'];

/** The game's skill line for a level: SetEnemyCareer's 5L + 30, unclamped. */
const SKILL_LINE_PER_LEVEL = 5, SKILL_LINE_BASE = 30;
export const expectedSkillAt = (level) => SKILL_LINE_PER_LEVEL * Math.max(1, level) + SKILL_LINE_BASE;

/** PWR3: how much stronger than the place's own a synced player stays (Mac: "keep a 15% edge"). */
export const PLACE_SYNC_EDGE = 1.15;
/** PWR3: the level a player plays at above a place's ceiling - the one whose skill line stands PLACE_SYNC_EDGE over the
 *  ceiling's: E(t) = 1.15 E(c), whole (a Cemetery's 11 plays at 14, the bestiary's top 21 at 25). */
export const placeEdgeLevel = (ceiling) => Math.round((PLACE_SYNC_EDGE * expectedSkillAt(ceiling) - SKILL_LINE_BASE) / SKILL_LINE_PER_LEVEL);   // the line inverted
/** PWR3: the level a player plays at in a place of `ceiling`, or null when the place does not bind them (no ceiling, or
 *  a player at or under its edge level). */
export function placeTargetLevel(realLevel, ceiling) {
  if (!Number.isInteger(ceiling) || ceiling < 1 || !(realLevel >= 1)) return null;
  const t = placeEdgeLevel(ceiling);
  return realLevel > t ? t : null;
}

/** Harmonic mean of the partners' levels (null when there are none). */
export function groupReferenceLevel(levels) {
  const ls = (levels ?? []).map(Number).filter((l) => Number.isFinite(l) && l >= 1);
  if (!ls.length) return null;
  return ls.length / ls.reduce((a, l) => a + 1 / l, 0);
}

/** The level a mentor plays at, or null when mentoring would not engage. */
export function mentorTargetLevel(realLevel, partnerLevels) {
  const ref = groupReferenceLevel(partnerLevels);
  if (ref == null || !(realLevel >= 1)) return null;
  const t = Math.max(1, Math.min(realLevel, Math.round(ref) + MENTOR_LEVEL_ALLOWANCE));
  return realLevel - t >= MENTOR_MIN_GAP ? t : null;
}

/** The whole profile (pure). null = neither the party nor the place binds. `ceiling` (PWR3): the place's, online - null
 *  for none. `level` is the level the WORLD is built at before the place's ceiling (the party's, else the real one -
 *  effectiveLevel lays the ceiling over it), `playLevel` the one the player plays at, `source` whose it is. */
export function mentorProfile(entity, partnerLevels, ceiling = null) {
  const r = entity?.level ?? 1;
  const party = mentorTargetLevel(r, partnerLevels);
  const place = placeTargetLevel(r, ceiling);
  if (party == null && place == null) return null;
  const byParty = party != null && (place == null || party <= place);
  const t = byParty ? party : place;
  const skillFactor = Math.sqrt(t / r);
  const skillCeiling = expectedSkillAt(t) + MENTOR_SKILL_CEILING_SLACK;
  // attributes: D points back, in proportion to the excess over the baseline
  const stats = entity.stats ?? {};
  const pool = AVERAGE_LEVEL_UP_POOL * (r - t);
  let excess = 0;
  for (const k of STAT_KEYS) excess += Math.max(0, (stats[k] ?? 0) - MENTOR_STAT_BASELINE);
  const statCut = {};
  for (const k of STAT_KEYS) {
    const ex = Math.max(0, (stats[k] ?? 0) - MENTOR_STAT_BASELINE);
    statCut[k] = excess > 0 ? Math.min(ex, Math.round((pool * ex) / excess)) : 0;
  }
  // health, off this character's own average
  // AUDIT LEVEL-EVEN L2-3: the stored body with the online floor's share on it (renownLayer.js `evenHp`) - the body the
  // blows land on; the stored value alone made an unlucky roller tougher mentored than an average one
  const rawMax = (entity.rawMaxHealth ?? entity.maxHealth ?? 0) + (Number.isFinite(entity.evenHp) && entity.evenHp > 0 ? entity.evenHp : 0);
  const perLevel = r > 1 ? Math.max(1, (rawMax - MENTOR_HP_BASE) / (r - 1)) : 0;
  const mentoredMax = Math.max(1, rawMax - perLevel * (r - t));
  const damageTakenMult = rawMax > 0 ? Math.min(MENTOR_MAX_DAMAGE_MULT, Math.max(1, rawMax / mentoredMax)) : 1;
  const gearScale = Math.min(1, Math.max(0.5, Math.sqrt(expectedSkillAt(t) / expectedSkillAt(r))));
  return {
    level: party ?? r, playLevel: t, realLevel: r, source: party != null ? 'party' : 'place', skillFactor, skillCeiling, statCut,
    mentoredMaxHealth: Math.round(mentoredMax), damageTakenMult, gearScale,
    reference: party != null ? groupReferenceLevel(partnerLevels) : null, ceiling: Number.isInteger(ceiling) ? ceiling : null,
  };
}

/** PWR3: the ceiling of the place the player stands in now, online (the frame's - refreshMentor), or null. */
let _placeCeiling = null;
/** Whose overlay ended last ('party' or 'place') - the chat's line for it (mentorEndedText). */
let _ended = 'party';

/**
 * The host's per-frame door (scenes/world.js partyFrame). `partnerLevels` are
 * the party's other members' levels; mentoring is automatic, so `enabled`
 * exists only for a host that must hold it off (none does today). PWR3:
 * `ceiling` the place's (systems/placeSync.js placeCeilingAt - null offline or
 * where none binds), kept for the world's reads (effectiveLevel). Returns
 * 'on' / 'off' on a change (for the chat line), null otherwise.
 */
export function refreshMentor(entity, partnerLevels, enabled = true, ceiling = null) {
  if (!entity) return null;
  _placeCeiling = Number.isInteger(ceiling) && ceiling >= 1 ? ceiling : null;
  const was = entity._mentor ?? null;
  const next = enabled ? mentorProfile(entity, partnerLevels, _placeCeiling) : null;
  entity._mentor = next;
  if (!was && next) return 'on';
  if (was && !next) { _ended = was.source ?? 'party'; return 'off'; }
  if (was && next && (was.playLevel !== next.playLevel || was.source !== next.source)) return 'on';
  return null;
}

export const isMentored = (entity) => !!entity?._mentor;
/** PWR3: whether the PARTY binds - mentoring's own law (the Firmament, the paths, the climb and the spells' power
 *  sleep; the foes answer no standing). A place that binds alone is no mentoring: the kit stays awake. */
export const isMentoring = (entity) => !!entity?._mentor && entity._mentor.source !== 'place';
/** The level the WORLD should build around (spawns, a foe's loot and gear, its swing, its spells, the hero's threat):
 *  the party's when mentoring, else the real one - PWR3: no higher than the place's ceiling (`ceiling`: a host that
 *  builds a place hands its own - a dungeon's, read at its build before the frame has seen it; else the frame's). */
export function effectiveLevel(entity, ceiling = _placeCeiling) {
  const level = entity?._mentor?.level ?? entity?.level ?? 1;
  return Number.isInteger(ceiling) && ceiling >= 1 && entity?.isPlayer ? Math.min(level, ceiling) : level;
}
/** PWR3: the level the PLAYER plays at - their own spells' caster level: the overlay's (the party's or the place's
 *  edge), else the real one. */
export const playLevel = (entity) => entity?._mentor?.playLevel ?? entity?._mentor?.level ?? entity?.level ?? 1;
/** PWR3: the level the player plays at in a place of `ceiling` - the party's mentoring, else the real level, no higher
 *  than the place's edge (placeTargetLevel). What the hero's threat answers (systems/heroThreat.js): the foes answer the
 *  hero as the hero plays, never the world's level a place's ceiling built them at. A host building a place hands its
 *  own ceiling (the frame's is the default). */
export function playLevelIn(entity, ceiling = _placeCeiling) {
  const level = entity?._mentor?.level ?? entity?.level ?? 1;
  const edge = placeTargetLevel(entity?.level ?? 1, ceiling);
  return edge != null && entity?.isPlayer ? Math.min(level, edge) : level;
}
/** Tests: the frame's place forgotten. */
export function _resetPlaceCeilingForTests() { _placeCeiling = null; }

/** A permanent skill value, as the mentored character holds it. */
export function mentoredSkill(entity, raw) {
  const m = entity?._mentor;
  if (!m || !(raw > MENTOR_SKILL_BASELINE)) return raw;
  const scaled = MENTOR_SKILL_BASELINE + (raw - MENTOR_SKILL_BASELINE) * m.skillFactor;
  return Math.max(Math.min(raw, MENTOR_SKILL_BASELINE), Math.min(raw, m.skillCeiling, Math.floor(scaled)));
}

/** A permanent attribute, as the mentored character holds it. */
export function mentoredStat(entity, statName, raw) {
  const cut = entity?._mentor?.statCut?.[statName];
  return cut ? raw - cut : raw;
}

export const mentorGearScale = (entity) => entity?._mentor?.gearScale ?? 1;

/** The armour term the to-hit roll reads (100 = unarmoured). */
export function mentorArmorValue(entity, raw) {
  const k = entity?._mentor?.gearScale;
  if (!k || k >= 1 || !(raw < 100)) return raw;
  return Math.round(100 - (100 - raw) * k);
}

export const mentorDamageTakenMult = (entity) => entity?._mentor?.damageTakenMult ?? 1;

/** PWR3: whose overlay ended last - 'party' or 'place' (systems/mentorText.js mentorEndedText says it). */
export const mentorEndedSource = () => _ended;

