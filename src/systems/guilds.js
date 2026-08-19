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
// ── RANK TITLES, recovered (U23) ──────────────────────────────────
// G1 shipped without them and said so: DFU reads the titles from its
// own localization StringTables, which the sparse clone excluded, so
// getTitle returned the player's name at every rank and %lev could
// not expand. The clone's sparse set now includes Assets/Localization,
// and the six lists are read straight out of
// Internal_Strings{,_en}.asset - "fightersRanks", "magesRanks",
// "thievesRanks", "darkBrotherhoodRanks" here; "templeRanks" and
// "knightlyOrderRanks" with their variants in guildVariants.js.
// GetLocalizedTextList splits the entry on newlines, which is why
// "Master Wizard" and "Knight Brother" are one title each.
import { SKILLS, skillValue } from './skills.js';
import { getReputation } from './factionRep.js';
import { GUILD_GROUPS, FACTION_TYPES } from '../formats/factionFile.js';
import { dayOfYear } from './gameDate.js';   // S28: DaggerfallDateTime.DayOfYear

/** Internal_Strings "nonMember". Guild.GetTitle returns the PLAYER'S
 *  NAME for a non-member; three subclasses override that with this
 *  string instead (Temple.cs :397, DarkBrotherhood.cs :91,
 *  KnightlyOrder.cs :126). */
export const NON_MEMBER_TITLE = 'non-member';

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
    guildGroup: GUILD_GROUPS.FightersGuild,
    factionId: 41,
    skills: [SKILLS.Archery, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Giantish,
      SKILLS.LongBlade, SKILLS.Orcish, SKILLS.ShortBlade],
    rankTitles: ['Apprentice', 'Journeyman', 'Swordsman', 'Protector', 'Defender',
      'Warder', 'Guardian', 'Champion', 'Warrior', 'Master'],
    text: { ineligibleBadRep: 679, ineligibleLowSkill: 680, eligible: 681, welcome: 684, promotion: 686 },
  },
  MagesGuild: {
    name: 'MagesGuild',
    guildGroup: GUILD_GROUPS.MagesGuild,
    factionId: 40,
    skills: [SKILLS.Alteration, SKILLS.Destruction, SKILLS.Illusion,
      SKILLS.Mysticism, SKILLS.Restoration, SKILLS.Thaumaturgy],
    rankTitles: ['Apprentice', 'Journeyman', 'Evoker', 'Conjurer', 'Magician',
      'Enchanter', 'Warlock', 'Wizard', 'Master Wizard', 'Archmage'],
    text: { ineligibleBadRep: 612, ineligibleLowSkill: 611, eligible: 606, welcome: 5293, promotion: 5236 },
    // MagesGuild.GetPromotionMsgId (:92-106) - the message ANNOUNCES
    // the benefit the new rank unlocked, so it is per rank.
    promotionByRank: { 2: 5230, 3: 5231, 6: 5233, 8: 5234 },
  },
  ThievesGuild: {
    name: 'ThievesGuild',
    guildGroup: GUILD_GROUPS.GeneralPopulace,
    factionId: 42,
    skills: [SKILLS.Backstabbing, SKILLS.Climbing, SKILLS.Lockpicking, SKILLS.Pickpocket,
      SKILLS.ShortBlade, SKILLS.Stealth, SKILLS.Streetwise],
    rankTitles: ['Apprentice', 'Journeyman', 'Filcher', 'Crook', 'Robber',
      'Bandit', 'Thief', 'Ringleader', 'Mastermind', 'Master Thief'],
    text: { welcome: 5225, promotion: 5235, bribesJudge: 550 },
    // ThievesGuild.GetPromotionMsgId (:92-106). Ranks 6 and 8 are
    // RevealLocation()-gated in DFU (map1/map2 vs the plain message);
    // that reads quest/map state the port has no source for, so those
    // two ranks take the plain promotion message and the map variants
    // are FLAGGED to the quest slice.
    promotionByRank: { 2: 5226, 4: 5227 },
  },
  DarkBrotherhood: {
    name: 'DarkBrotherhood',
    guildGroup: GUILD_GROUPS.DarkBrotherHood,
    factionId: 108,
    skills: [SKILLS.Archery, SKILLS.Backstabbing, SKILLS.Climbing, SKILLS.CriticalStrike,
      SKILLS.Daedric, SKILLS.Destruction, SKILLS.ShortBlade, SKILLS.Stealth, SKILLS.Streetwise],
    rankTitles: ['Apprentice', 'Journeyman', 'Operator', 'Slayer', 'Executioner',
      'Punisher', 'Terminator', 'Assassin', 'Dark Brother', 'Master Assassin'],
    nonMemberTitle: NON_MEMBER_TITLE,   // DarkBrotherhood.cs :86-92 overrides GetTitle
    text: { welcome: 5292, promotion: 666, bribesJudge: 551 },
    // DarkBrotherhood.GetPromotionMsgId - odd ranks, all pure data.
    promotionByRank: { 1: 6611, 3: 6612, 5: 6613, 7: 6614 },
  },
});

/** CalculateDaySinceZero (:132-135). An ABSOLUTE day number, which is
 *  what makes the 28-day gate survive a year boundary.
 *
 *  DFU reads `DaggerfallUnity.Instance.WorldTime.Now.DayOfYear` - a
 *  DERIVED property, not a field. S28 landed the calendar that derives
 *  it, so a live date arrives as { year, month, day, ... } and its
 *  day-of-year is computed here exactly as DFU's getter does. The
 *  older { year, dayOfYear } shape a test may hand-build is still
 *  accepted, so the ONE law has ONE reader either way. */
export const daySinceZero = (date) =>
  (date.year * DAYS_PER_YEAR) + (date.dayOfYear ?? dayOfYear(date));

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
  return { outcome, rank: newRank, textId: textIdFor(guild, outcome, newRank) };
}

/** TokensPromotion is NOT one record per guild - AUDIT 20 found the
 *  port flattening it. Five of the six guilds switch on the NEW RANK,
 *  because the message ANNOUNCES the benefit that rank just unlocked:
 *  the Mages Guild library at 2, magic items at 3, summoning at 6,
 *  teleport at 8; the Thieves Guild fence at 2 and spymaster at 4; and
 *  so on. A member promoted into a benefit was being told the generic
 *  line instead of what they had earned.
 *
 *  A guild supplies either a `promotionByRank` map or a
 *  `promotionForRank(rank)` function (the Temple's is computed from
 *  its own service-rank columns). Falling through to text.promotion is
 *  DFU's own `default:`. */
export function promotionTextId(guild, rank) {
  if (guild.promotionForRank) {
    const id = guild.promotionForRank(rank);
    if (id != null) return id;
  }
  return guild.promotionByRank?.[rank] ?? guild.text.promotion;
}

const textIdFor = (guild, outcome, rank) => (
  outcome === 'promotion' ? promotionTextId(guild, rank)
    : outcome === 'demotion' ? DEMOTION_TEXT_ID
      : EXPULSION_TEXT_ID
);

/** IsMember (:155-158): rank >= 0. A non-member is rank -1, which is
 *  also what an expulsion leaves behind. */
export const isMember = (membership) => (membership?.rank ?? -1) >= 0;

/** GetTitle (Guild.cs :178-181), now with the titles (see the header).
 *  A NON-MEMBER reads back their own name here - that is Guild.cs's own
 *  return, and it is why the four base guilds do not use the
 *  "non-member" string the Temple, the Dark Brotherhood and the
 *  knightly orders return instead (Temple.cs :397, DarkBrotherhood.cs
 *  :91, KnightlyOrder.cs :126). The three overriding subclasses carry
 *  `nonMemberTitle`; the rest fall through to the name.
 *
 *  The Temple's gendered overrides (Temple.cs :389-397 - "Not calling
 *  female chars 'Patriarch'!") ride `titleFor`, which the guild record
 *  supplies when it has one. */
export function getTitle(membership, entity, guild = null) {
  if (!isMember(membership)) return guild?.nonMemberTitle ?? entity?.name ?? '';
  const rank = membership.rank;
  if (guild?.titleFor) {
    const t = guild.titleFor(rank, entity);
    if (t != null) return t;
  }
  return guild?.rankTitles?.[rank] ?? entity?.name ?? '';
}

/** GuildManager.GetGuild(factionId) (:254-267). Null for a faction that
 *  is not a guild.
 *
 *  `resolveVariant` is how the variant-keyed guilds join in without
 *  this module importing them (guildVariants imports THIS one, so the
 *  other direction would be a cycle). guildVariants exports a ready
 *  resolver; AUDIT 20 found this answering null for all eight temples
 *  and all ten orders after G2 shipped them. */
export function guildOfFaction(factionId, resolveVariant = null) {
  for (const g of Object.values(GUILDS)) if (g.factionId === factionId) return g;
  return resolveVariant ? resolveVariant(factionId) : null;
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
  const f = factionDict?.get(factionId);
  if (!f) return GUILD_GROUPS.None;
  // TEMPLES NESTED UNDER A DEITY (:281-289), which AUDIT 20 found
  // missing. A divine's OWN ggroup is None in the shipped file - all
  // eight of them - and the group lives on its single child, the
  // templar order (HolyOrder). Without this every temple answers
  // "not a guild".
  if (f.type === FACTION_TYPES.God && f.ggroup === GUILD_GROUPS.None && f.children?.length) {
    const first = factionDict.get(f.children[0]);
    if (first) return first.ggroup;
  }
  return f.ggroup;
}

/** THE MEMBERSHIP KEY IS THE GUILD GROUP, not the guild. DFU's
 *  Memberships is Dictionary<GuildGroups, IGuild> and AddMembership
 *  does `Memberships[guildGroup] = guild` - an ASSIGNMENT, so joining
 *  Mara's temple when you are in Arkay's REPLACES it. All eight
 *  temples share HolyOrder and all ten knightly orders share
 *  KnightlyOrder, so a player holds at most one of each.
 *
 *  AUDIT 20: keyed by guild NAME, the port let a player hold all
 *  eight temples and all ten orders at once. */
export const membershipKey = (guild) => guild.guildGroup;

/** Join (:309-313): rank 0, and the 28-day clock starts now. The guild
 *  is stored beside the rank because the KEY no longer identifies it -
 *  one HolyOrder slot has to remember WHICH temple. */
export function joinGuild(memberships, guild, now) {
  const m = { guild: guild.name, rank: 0, lastRankChange: daySinceZero(now) };
  memberships[membershipKey(guild)] = m;
  return m;
}

/** RemoveMembership (:128-144). Leave() is empty in DFU - the guild
 *  object is simply dropped - so this drops the record. */
export function leaveGuild(memberships, guild) {
  const k = membershipKey(guild);
  if (!memberships[k]) return false;
  delete memberships[k];
  return true;
}

/** HasJoined (:146-149) takes a GUILD GROUP, not a guild - the key's
 *  presence, not the rank. An expelled member is removed outright, so
 *  no rank -1 sits in here.
 *
 *  Keeping DFU's signature matters: HasJoined(HolyOrder) is true once
 *  you are in ANY temple, which is exactly the question a temple hall
 *  asks at the door. The port briefly had this taking a guild, which
 *  made it answer "yes" for Arkay's temple while you were in Mara's. */
export const hasJoinedGroup = (memberships, guildGroup) => Object.hasOwn(memberships ?? {}, guildGroup);

/** GetJoinedGuildOfGuildGroup (:151-159): whatever occupies the group's
 *  slot, or null. */
export const joinedGuildOfGroup = (memberships, guildGroup) => (memberships ?? {})[guildGroup] ?? null;

/** OURS, not DFU's: "am I in THIS guild", which the group-keyed pair
 *  above cannot answer alone. A membership in Arkay's temple must not
 *  answer for Mara's, so the stored guild name has to match. */
export function membershipOf(memberships, guild) {
  const m = joinedGuildOfGroup(memberships, membershipKey(guild));
  return m && m.guild === guild.name ? m : null;
}
export const hasJoined = (memberships, guild) => membershipOf(memberships, guild) !== null;

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
