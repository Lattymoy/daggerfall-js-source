// SOFTCAP1 (2026-09-29), MENTOR2 (2026-10-27; bible/06-Systems/Mentor-Mode.md): playing with lower-level friends.
// Automatic (Mac, 2026-09-29: no switch), and since MENTOR2 only beside them: a partner counts while their body is in
// my room (outdoors within MENTOR_NEAR_METRES), after MENTOR_JOIN_MS, and for MENTOR_LEAVE_MS after they go.
//
// An OVERLAY, never a write: the profile lives on `entity._mentor` (never saved) and the readers consult it - skills,
// stats, the blow, the spawns (effectiveLevel), the caster (castingLevel), the powers (mentorPowerScale). Leave the
// group and `refreshMentor` clears it. Daggerfall Unity has no mentor system (Port-Ledger section A, MENTOR2).

/** The group's level must stand this many levels under mine... */
export const MENTOR_MIN_GAP = 5;
/** ...and mine at least this many times the group's, before mentoring engages. */
export const MENTOR_MIN_RATIO = 1.5;
/** The world is built at the group's level plus this (SOFTCAP1's own allowance). */
export const MENTOR_WORLD_ALLOWANCE = 1;
/** The mentor fights at the group's level plus this many levels, or plus MENTOR_LEVEL_SHARE of it, whichever is more. */
export const MENTOR_LEVEL_ALLOWANCE = 3;
export const MENTOR_LEVEL_SHARE = 0.25;
export const MENTOR_SKILL_BASELINE = 30;
export const MENTOR_SKILL_CEILING_SLACK = 10;
export const MENTOR_STAT_BASELINE = 40;
export const AVERAGE_LEVEL_UP_POOL = 5; // FormulaHelper.BonusPool: Range(4, 6+1)
export const MENTOR_HP_BASE = 25;
/** A blow on a mentor lands at most this many times harder (SOFTCAP1 had 5: a mentor fell in a few blows). */
export const MENTOR_MAX_DAMAGE_MULT = 2;
/** Presence: a partner counts after this long beside me, and for this long after they leave. */
export const MENTOR_JOIN_MS = 3000;
export const MENTOR_LEAVE_MS = 30000;
/** While I fight, the partners counted stand as they were, for at most this long. */
export const MENTOR_FIGHT_HOLD_MS = 30000;
/** Outdoors a partner counts within this many metres; in a dungeon or a building the room is the bound. */
export const MENTOR_NEAR_METRES = 150;
/** A pupil beside a mentor trains its skills (below 100) this many times as fast. */
export const MENTOR_PUPIL_TALLY = 1.2;
const STAT_KEYS = ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck'];

/** The game's skill line for a level: SetEnemyCareer's 5L + 30, unclamped. */
export const expectedSkillAt = (level) => 5 * Math.max(1, level) + 30;

/** Harmonic mean of the partners' levels (null when there are none) - it leans toward the lowest member. */
export function groupReferenceLevel(levels) {
  const ls = (levels ?? []).map(Number).filter((l) => Number.isFinite(l) && l >= 1);
  if (!ls.length) return null;
  return ls.length / ls.reduce((a, l) => a + 1 / l, 0);
}

/** Whether a character of `realLevel` mentors a group whose reference level is `ref`. */
export function mentorEngages(realLevel, ref) {
  if (!(realLevel >= 1) || !(ref >= 1)) return false;
  return realLevel - Math.round(ref) >= MENTOR_MIN_GAP && realLevel >= ref * MENTOR_MIN_RATIO;
}

/** The level a mentor FIGHTS at, or null when mentoring would not engage. */
export function mentorTargetLevel(realLevel, partnerLevels) {
  const ref = groupReferenceLevel(partnerLevels);
  if (ref == null || !mentorEngages(realLevel, ref)) return null;
  const base = Math.round(ref);
  const lift = Math.max(MENTOR_LEVEL_ALLOWANCE, Math.round(ref * MENTOR_LEVEL_SHARE));
  return Math.max(1, Math.min(realLevel - 1, base + lift));
}

/** The level the WORLD is built at around a mentor (spawns, loot tables), or null when mentoring would not engage. */
export function mentorWorldLevel(realLevel, partnerLevels) {
  const ref = groupReferenceLevel(partnerLevels);
  if (ref == null || !mentorEngages(realLevel, ref)) return null;
  return Math.max(1, Math.min(realLevel, Math.round(ref) + MENTOR_WORLD_ALLOWANCE));
}

/** The whole profile (pure). null = not mentoring. The math is the page's (Mentor-Mode.md section 2). */
export function mentorProfile(entity, partnerLevels) {
  const r = entity?.level ?? 1;
  const t = mentorTargetLevel(r, partnerLevels);
  if (t == null) return null;
  const skillFactor = Math.sqrt(t / r);
  const skillCeiling = expectedSkillAt(t) + MENTOR_SKILL_CEILING_SLACK;
  // attributes: the points r - t levels hand out on average, taken back in proportion to each one's excess over 40
  const stats = entity.stats ?? {};
  const pool = AVERAGE_LEVEL_UP_POOL * (r - t);
  let excess = 0;
  for (const k of STAT_KEYS) excess += Math.max(0, (stats[k] ?? 0) - MENTOR_STAT_BASELINE);
  const statCut = {};
  for (const k of STAT_KEYS) {
    const ex = Math.max(0, (stats[k] ?? 0) - MENTOR_STAT_BASELINE);
    statCut[k] = excess > 0 ? Math.min(ex, Math.round((pool * ex) / excess)) : 0;
  }
  // AUDIT LEVEL-EVEN L2-3: the body the blows land on is the stored maximum with the online floor's share on it
  const rawMax =
    (entity.rawMaxHealth ?? entity.maxHealth ?? 0) +
    (Number.isFinite(entity.evenHp) && entity.evenHp > 0 ? entity.evenHp : 0);
  const perLevel = r > 1 ? Math.max(1, (rawMax - MENTOR_HP_BASE) / (r - 1)) : 0;
  const mentoredMax = Math.max(1, rawMax - perLevel * (r - t));
  const damageTakenMult = rawMax > 0 ? Math.min(MENTOR_MAX_DAMAGE_MULT, Math.max(1, rawMax / mentoredMax)) : 1;
  const gearScale = Math.min(1, Math.max(0.5, Math.sqrt(expectedSkillAt(t) / expectedSkillAt(r))));
  return {
    level: t,
    worldLevel: mentorWorldLevel(r, partnerLevels),
    realLevel: r,
    skillFactor,
    skillCeiling,
    statCut,
    mentoredMaxHealth: Math.round(mentoredMax),
    damageTakenMult,
    gearScale,
    powerScale: gearScale,
    reference: groupReferenceLevel(partnerLevels),
  };
}

/**
 * The host's per-frame door (scenes/mentorHost.js). `partnerLevels` are the levels of the partners beside me
 * (createMentorPresence). Returns 'on' when mentoring starts, 'off' when it ends, 'moved' when the level changes,
 * null otherwise. `enabled` exists only for a host that must hold it off (none does today).
 */
export function refreshMentor(entity, partnerLevels, enabled = true) {
  if (!entity) return null;
  const was = entity._mentor ?? null;
  const next = enabled ? mentorProfile(entity, partnerLevels) : null;
  entity._mentor = next;
  if (!was && next) return 'on';
  if (was && !next) return 'off';
  if (was && next && (was.level !== next.level || was.worldLevel !== next.worldLevel)) return 'moved';
  return null;
}

/** The highest partner level that mentors me - a partner far enough above me to engage on me alone - or null. */
export function pupilMentorLevel(myLevel, partnerLevels) {
  let best = null;
  for (const l of partnerLevels ?? []) if (mentorEngages(l, myLevel) && (best == null || l > best)) best = l;
  return best;
}

/** The host's per-frame door for the pupil's side: `entity._pupil` is `{ mentor }` beside a mentor, else null. */
export function refreshPupil(entity, partnerLevels) {
  if (!entity) return null;
  const was = entity._pupil ?? null;
  const lv = pupilMentorLevel(entity.level ?? 1, partnerLevels);
  entity._pupil = lv == null ? null : { mentor: lv };
  if (!was && lv != null) return 'on';
  if (was && lv == null) return 'off';
  return null;
}

export const isMentored = (entity) => !!entity?._mentor;
/** The level the WORLD should build around (spawns, loot tables, the foes' threat): the group's, else the real one. */
export const effectiveLevel = (entity) => entity?._mentor?.worldLevel ?? entity?.level ?? 1;
/** The level a spell is cast at: the level the mentor fights at, else the real one. */
export const castingLevel = (entity) => entity?._mentor?.level ?? entity?.level ?? 1;
/** The level the loot's rarity gate reads: always the real one - the gate holds back a young character, not a mentor. */
export const lootGateLevel = (entity) => entity?.level ?? 1;
/** What the build's own powers act at (the Firmament, the paths): 1 outside mentoring. */
export const mentorPowerScale = (entity) => entity?._mentor?.powerScale ?? 1;

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

/** A whole share of `n` at the mentor's power scale, never past `n` - for a power's points and percents. */
export function mentorScaled(entity, n) {
  const k = mentorPowerScale(entity);
  return k === 1 || !Number.isFinite(n) ? n : n * k;
}

/**
 * Who stands beside me, steadied: `levels(near, now, { fighting, member })` takes the partners near me this frame
 * (`[{ acct, level }]`) and answers the levels mentoring reads. A partner counts once near MENTOR_JOIN_MS and until
 * MENTOR_LEAVE_MS after they were last near. While I fight, a change waits as long as the fight, at most
 * MENTOR_FIGHT_HOLD_MS. `fighting` (a boolean or a function, asked only while a change waits) and `member(acct)`
 * (false drops a partner who left the party) are optional.
 */
export function createMentorPresence() {
  const seen = new Map();
  let held = [];
  let holdFrom = null;
  return {
    /** @param {{ acct: any, level: number }[]} near @param {number} now
     *  @param {{ fighting?: boolean | (() => boolean), member?: ((acct: any) => boolean) | null }} [opts] */
    levels(near, now, { fighting = false, member = null } = {}) {
      if (member) for (const acct of seen.keys()) if (!member(acct)) seen.delete(acct);
      for (const n of near ?? []) {
        if (!n || n.acct == null || !Number.isInteger(n.level) || n.level < 1) continue;
        const s = seen.get(n.acct);
        if (s) {
          s.last = now;
          s.level = n.level;
        } else seen.set(n.acct, { since: now, last: now, level: n.level });
      }
      const live = [];
      for (const [acct, s] of seen) {
        if (now - s.last > MENTOR_LEAVE_MS) {
          seen.delete(acct);
          continue;
        }
        if (now - s.since >= MENTOR_JOIN_MS) live.push(s.level);
      }
      if (live.length === held.length && live.every((l, i) => l === held[i])) {
        holdFrom = null;
        return held;
      }
      if (typeof fighting === 'function' ? fighting() : fighting) {
        holdFrom ??= now;
        if (now - holdFrom < MENTOR_FIGHT_HOLD_MS) return held;
      }
      holdFrom = null;
      held = live;
      return live;
    },
    reset() {
      seen.clear();
      held = [];
      holdFrom = null;
    },
  };
}
