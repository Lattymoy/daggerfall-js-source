// THE GUILD FOUNDATION - membership and RANK. 1:1 translation of
// Daggerfall Unity's Guild.cs and the per-guild subclasses (MIT,
// Daggerfall Workshop / Hazelnut). Unity plumbing dropped.
//
// This sits directly on S25. DFU's whole reputation half is one line:
//     GetReputation(player) => player.FactionData.GetReputation(GetFactionId())
// so a guild's standing IS its faction's reputation, and rank is a
// function of that reputation and the player's skills. Nothing here
// keeps a second copy of either.
//
// ── the rank law (Guild.cs :100-130) ──────────────────────────────
// Rank is not stored progress, it is RECOMPUTED. CalculateNewRank
// walks the ten rank rows in order and stops at the first the player
// fails, then returns the row BEFORE it (`return --r`), so a player
// who fails row 0 lands at rank -1 and is expelled. Each row needs:
//   - reputation >= rankReqReputation[r], and
//   - at least ONE guild skill at rankReqSkillHigh[r], and
//   - at least TWO guild skills total counting the lower bar
//     (high + low >= 2, where a skill counts as low ONLY if it missed
//     the high bar - the `else if` matters).
// A NEGATIVE reputation short-circuits to -1 before any skill is read.
//
// The skills are read PERMANENT (GetPermanentSkillValue), not live -
// a Fortify Skill effect cannot buy a promotion.
//
// ── the 28-day gate (UpdateRank :76-96) ───────────────────────────
// Rank only moves when 28 days have passed since the last change, and
// the clock is DAYS SINCE ZERO - year * DaysPerYear + dayOfYear -
// not a delta. Promotion, demotion and expulsion all reset it. The
// gate is checked before the recompute, so an eligible player simply
// waits.
//
// ── what is NOT here ──────────────────────────────────────────────
// Guild SERVICES (training, healing, spell and item making, banking)
// and the guild UI windows are their own slices. So is joining: the
// join flow is a window with an eligibility message, and only the
// rules it consumes live here.
//
// FLAGGED loud - RANK TITLES. DFU reads them from its own
// localization tables (TextManager.GetLocalizedTextList("fightersRanks"
// and friends), resolved through the %lev macro). Those tables are
// DFU's restatement of the classic strings; they are not in ARENA2 and
// not in the sparse clone, so the titles are NOT INVENTED HERE. The
// NATIVE-WINDOW RULE applies to text as much as geometry: if the
// source value is unknown, it does not ship. getTitle falls back to
// the player's name, which is DFU's own non-member return, and the
// window that needs a title lands with them.
import { SKILLS, skillValue } from './skills.js';
import { getReputation } from './factionRep.js';
import { GUILD_GROUPS } from '../formats/factionFile.js';

/** Guild.cs :36-38. Ten rows, one per rank. */
export const RANK_REQ_REPUTATION = Object.freeze([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
export const RANK_REQ_SKILL_HIGH = Object.freeze([22, 23, 31, 39, 47, 55, 63, 71, 79, 87]);
export const RANK_REQ_SKILL_LOW = Object.freeze([4, 5, 9, 13, 17, 21, 25, 29, 33, 37]);

/** Guild.cs :25-30 - the shared constants and the two shared
 *  TEXT.RSC records every guild demotes and expels with. */
export const DEFAULT_TRAINING_MAX = 50;
export const MEMBER_TRAINING_COST = 100;
export const NON_MEMBER_TRAINING_COST = 400;
export const DEMOTION_TEXT_ID = 667;
export const EXPULSION_TEXT_ID = 668;

/** DaggerfallDateTime.DaysPerYear, for CalculateDaySinceZero. */
export const DAYS_PER_YEAR = 360;
/** UpdateRank's gate: 28 days between rank changes. */
export const DAYS_BETWEEN_RANK_CHANGES = 28;

/** The four guilds whose data is fully groundable from the sparse
 *  clone. Each carries its faction id (so reputation resolves through
 *  S25), its GUILD SKILLS (the rank law's input - NOT the training
 *  list, which is a services concern), and the TEXT.RSC records its
 *  own messages use.
 *
 *  Absent on purpose: Temple (eight divines, a variant per deity) and
 *  KnightlyOrder (ten orders, a variant per order). Both are
 *  variant-keyed subclasses whose per-variant faction ids come from
 *  their own lookup tables; they land with the join flow that needs to
 *  pick a variant. */
export const GUILDS = Object.freeze({
  FightersGuild: {
    name: 'FightersGuild',
    factionId: 41,
    skills: [SKILLS.Archery, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Giantish,
      SKILLS.LongBlade, SKILLS.Orcish, SKILLS.ShortBlade],
    text: { ineligibleBadRep: 679, ineligibleLowSkill: 680, eligible: 681, welcome: 684, promotion: 686 },
  },
  MagesGuild: {
    name: 'MagesGuild',
    factionId: 40,
    skills: [SKILLS.Alteration, SKILLS.Destruction, SKILLS.Illusion,
      SKILLS.Mysticism, SKILLS.Restoration, SKILLS.Thaumaturgy],
    text: { ineligibleBadRep: 612, ineligibleLowSkill: 611, eligible: 606, welcome: 5293, promotion: 5236 },
  },
  ThievesGuild: {
    name: 'ThievesGuild',
    factionId: 42,
    skills: [SKILLS.Backstabbing, SKILLS.Climbing, SKILLS.Lockpicking, SKILLS.Pickpocket,
      SKILLS.ShortBlade, SKILLS.Stealth, SKILLS.Streetwise],
    text: { welcome: 5225, promotion: 5235, bribesJudge: 550 },
  },
  DarkBrotherhood: {
    name: 'DarkBrotherhood',
    factionId: 108,
    skills: [SKILLS.Archery, SKILLS.Backstabbing, SKILLS.Climbing, SKILLS.CriticalStrike,
      SKILLS.Daedric, SKILLS.Destruction, SKILLS.ShortBlade, SKILLS.Stealth, SKILLS.Streetwise],
    text: { welcome: 5292, promotion: 666, bribesJudge: 551 },
  },
});

/** CalculateDaySinceZero (:132-135). An ABSOLUTE day number, which is
 *  what makes the 28-day gate survive a year boundary. */
export const daySinceZero = (date) => (date.year * DAYS_PER_YEAR) + date.dayOfYear;

/** CalculateNumHighLowSkills (:113-130). The `else if` is load-bearing:
 *  a skill that cleared the HIGH bar is not also counted low, so
 *  `low + high >= 2` really means "two skills, at least one of them
 *  high" rather than "one high skill counted twice". */
export function numHighLowSkills(entity, guild, rank) {
  let high = 0, low = 0;
  for (const skill of guild.skills) {
    const v = skillValue(entity, skill);
    if (v >= RANK_REQ_SKILL_HIGH[rank]) high++;
    else if (v >= RANK_REQ_SKILL_LOW[rank]) low++;
  }
  return { high, low };
}

/** CalculateNewRank (:100-111). Returns -1 for expulsion. */
export function calculateNewRank(entity, guild, store) {
  const rep = getReputation(store, guild.factionId);
  // DFU's early return. Measured EQUIVALENT over 1809 cases: because
  // rankReqReputation[0] is 0, a negative reputation breaks the loop at
  // row 0 anyway and `return --r` gives the same -1. Kept because it is
  // DFU's line, not because it changes an answer - a mutation removing
  // it survives every pin, and that is honest rather than a gap.
  if (rep < 0) return -1;
  let r = 0;
  for (; r < RANK_REQ_REPUTATION.length; r++) {
    const { high, low } = numHighLowSkills(entity, guild, r);
    if (rep < RANK_REQ_REPUTATION[r] || high < 1 || low + high < 2) break;
  }
  return r - 1;
}

/** UpdateRank (:76-96). Returns what HAPPENED so a caller can show the
 *  right message; DFU returns the message tokens themselves, which is
 *  the same decision made once the port has a text layer.
 *
 *  It takes the MEMBERSHIPS MAP rather than one record, because
 *  expulsion REMOVES the membership - DFU calls
 *  GuildManager.RemoveMembership right there inside this method. An
 *  earlier cut mutated a passed-in record and left removal to the
 *  caller; a mutation run caught it, because that lets the port hold a
 *  state DFU never has - a keyed membership sitting at rank -1, which
 *  hasJoined would answer true for. */
export function updateRank(memberships, guild, entity, store, now) {
  const m = membershipOf(memberships, guild);
  if (!m) return null;
  const today = daySinceZero(now);
  if (today < m.lastRankChange + DAYS_BETWEEN_RANK_CHANGES) return null;

  const newRank = calculateNewRank(entity, guild, store);
  if (newRank === m.rank) return null;

  const outcome = newRank > m.rank ? 'promotion'
    : newRank < 0 ? 'expulsion'
      : 'demotion';
  m.rank = newRank;
  m.lastRankChange = today;
  if (outcome === 'expulsion') leaveGuild(memberships, guild);
  return { outcome, rank: newRank, textId: textIdFor(guild, outcome) };
}

const textIdFor = (guild, outcome) => (
  outcome === 'promotion' ? guild.text.promotion
    : outcome === 'demotion' ? DEMOTION_TEXT_ID
      : EXPULSION_TEXT_ID
);

/** IsMember (:155-158): rank >= 0. A non-member is rank -1, which is
 *  also what an expulsion leaves behind. */
export const isMember = (membership) => (membership?.rank ?? -1) >= 0;

/** GetTitle (:180-183). FLAGGED - see the header: the rank titles live
 *  in DFU's localization tables and are not invented here, so a member
 *  reads back their own name exactly as a non-member does until the
 *  titles are looked up. The RANK is correct and available; only its
 *  NAME is missing. */
export function getTitle(membership, entity) {
  return entity?.name ?? '';
}

/** GuildManager.GetGuild(factionId) (:254-267), narrowed to the four
 *  guilds this slice carries. Null for a faction that is not one. */
export function guildOfFaction(factionId) {
  for (const g of Object.values(GUILDS)) if (g.factionId === factionId) return g;
  return null;
}


// ── membership (GuildManager.cs :122-165) ─────────────────────────
// DFU keys Memberships by GuildGroups, and the group is DATA - read
// off the faction record's ggroup, not hardcoded per subclass.

/** GetGuildGroup (:269-279), with DFU's hardcoded 510 exception.
 *  THE MERCHANTS really do carry ggroup 11 (FightersGuild) in
 *  FACTION.TXT - verified on the corpus - so without this every shop
 *  would answer as a Fighters Guild hall. */
export const MERCHANTS_FACTION_ID = 510;
export function guildGroupOfFaction(factionDict, factionId) {
  if (factionId === MERCHANTS_FACTION_ID) return GUILD_GROUPS.None;
  const f = factionDict.get(factionId);
  return f ? f.ggroup : GUILD_GROUPS.None;
}

/** Join (:309-313): rank 0, and the 28-day clock starts now. */
export function joinGuild(memberships, guild, now) {
  const m = { rank: 0, lastRankChange: daySinceZero(now) };
  memberships[guild.name] = m;
  return m;
}

/** RemoveMembership (:128-144). Leave() is empty in DFU - the guild
 *  object is simply dropped - so this drops the record. */
export function leaveGuild(memberships, guild) {
  if (!memberships[guild.name]) return false;
  delete memberships[guild.name];
  return true;
}

/** HasJoined (:146-149) - the KEY's presence, not the rank. An expelled
 *  member is removed outright, so there is no rank -1 sitting in here. */
export const hasJoined = (memberships, guild) => Object.hasOwn(memberships ?? {}, guild.name);

/** GetJoinedGuildOfGuildGroup (:151-159). */
export const membershipOf = (memberships, guild) => (memberships ?? {})[guild.name] ?? null;

/** IsEligibleToJoin (:319-325). Row 0's bars exactly - DFU writes them
 *  as `high > 0 && low + high > 1`, which is the same test the rank
 *  walk makes at r = 0. */
export function isEligibleToJoin(entity, guild, store) {
  const rep = getReputation(store, guild.factionId);
  const { high, low } = numHighLowSkills(entity, guild, 0);
  return rep >= RANK_REQ_REPUTATION[0] && high > 0 && low + high > 1;
}

/** NOT EVERY GUILD CAN BE ASKED. ThievesGuild.cs :180-187 and
 *  DarkBrotherhood.cs :189-196 both THROW NotImplementedException from
 *  TokensIneligible and TokensEligible - the two are joined by
 *  INVITATION, through a quest, and have no walk-in application at all.
 *  That is a law, not an omission, so it is named rather than left for
 *  a caller to discover as a crash. */
export const INVITATION_ONLY = Object.freeze(['ThievesGuild', 'DarkBrotherhood']);
export const isJoinableByApplication = (guild) => !INVITATION_ONLY.includes(guild.name);

/** TokensIneligible (:111-115) as a decision rather than tokens: a
 *  NEGATIVE reputation is refused FOR reputation, anything else for
 *  skill. The two are different TEXT.RSC records, and a player refused
 *  for the wrong reason has been told to fix the wrong thing.
 *
 *  Null for an invitation-only guild - asking is what DFU throws on. */
export function joinDecision(entity, guild, store) {
  if (!isJoinableByApplication(guild)) return null;
  const rep = getReputation(store, guild.factionId);
  if (isEligibleToJoin(entity, guild, store)) {
    return { eligible: true, textId: guild.text.eligible };
  }
  return {
    eligible: false,
    reason: rep < 0 ? 'reputation' : 'skill',
    textId: rep < 0 ? guild.text.ineligibleBadRep : guild.text.ineligibleLowSkill,
  };
}
