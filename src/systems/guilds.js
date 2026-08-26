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
// ── RANK TITLES, recovered (U23) - and WHICH ranks gender-swap,
// which AUDIT 21 F7 had already worked out (AUDIT 22 merge) ───────
// G1 shipped without the titles and said so: DFU reads them from its
// own localization StringTables, which the sparse clone excluded. The
// clone's sparse set now includes Assets/Localization, so all six
// lists come straight out of Internal_Strings - "fightersRanks",
// "magesRanks", "thievesRanks", "darkBrotherhoodRanks" here;
// "templeRanks" and "knightlyOrderRanks" in guildVariants.js.
// GetLocalizedTextList splits the entry on newlines, which is why
// "Master Wizard" and "Knight Brother" are one title each.
//
// AUDIT 21 F7 CORRECTED A DOC LIE that this file used to carry: the
// old paragraph said getTitle "falls back to the player's name, which
// is DFU's own non-member return". True for only three of the six.
// Temple.cs:389-398, KnightlyOrder.cs:121-127 and
// DarkBrotherhood.cs:86-92 each OVERRIDE GetTitle and return
// GetLocalizedText("nonMember") - a string, not a name. It also
// worked out the STRUCTURE the strings alone would not give: which
// rank in which guild gender-swaps (Temple 9 and 6, KnightlyOrder 5,
// DarkBrotherhood 8), recorded as `femaleTitleRanks`.
//
// The two halves met at the AUDIT 22 merge. The structure was right
// and U23 had only found two of the four swaps; the strings were
// there to be read all along - "Matriarch", "Sister", "Knight
// Sister", "Dark Sister". Both ship, and the flag is retired.
import { SKILLS, permanentSkillValue } from './skills.js';
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
// AUDIT 24 (wave 24): DaggerfallDateTime's year length, one home.
import { DAYS_PER_YEAR } from './gameDate.js';

export { DAYS_PER_YEAR };
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
    // MagesGuild.cs:67-70 overrides IsSatisfyQuestReqByLevel to true - see
    // questRankFor below. The Mages Guild and the knightly orders are the
    // only two of the six that do.
    questReqByLevel: true,
    text: { ineligibleBadRep: 612, ineligibleLowSkill: 611, eligible: 606, welcome: 5293, promotion: 5236 },
    // MagesGuild.GetPromotionMsgId (:92-106) - the message ANNOUNCES
    // the benefit the new rank unlocked, so it is per rank.
    promotionByRank: { 2: 5230, 3: 5231, 6: 5233, 8: 5234 },
  },
  ThievesGuild: {
    name: 'ThievesGuild',
    neverExpels: true,          // AllowGuildExpulsion (ThievesGuild.cs:128-131)
    guildGroup: GUILD_GROUPS.GeneralPopulace,
    factionId: 42,
    skills: [SKILLS.Backstabbing, SKILLS.Climbing, SKILLS.Lockpicking, SKILLS.Pickpocket,
      SKILLS.ShortBlade, SKILLS.Stealth, SKILLS.Streetwise],
    rankTitles: ['Apprentice', 'Journeyman', 'Filcher', 'Crook', 'Robber',
      'Bandit', 'Thief', 'Ringleader', 'Mastermind', 'Master Thief'],
    text: { welcome: 5225, promotion: 5235, bribesJudge: 550 },
    // ThievesGuild.cs:24 - the ONLY way in. See INVITATION_ONLY below.
    initiationQuest: 'O0A0AL00',
    // ThievesGuild.GetPromotionMsgId (:92-106). G8: ranks 6 and 8
    // gate their map messages (5228/5229) on RevealLocation - a
    // DiscoverRandomLocation in the current region + the readMapTG
    // note; a region with nothing left to find falls to the plain
    // message, DFU's own ternary.
    promotionByRank: { 2: 5226, 4: 5227 },
    promotionReveal: { mapIds: { 6: 5228, 8: 5229 }, noteKey: 'readMapTG' },
  },
  DarkBrotherhood: {
    name: 'DarkBrotherhood',
    neverExpels: true,          // AllowGuildExpulsion (DarkBrotherhood.cs:132-135)
    guildGroup: GUILD_GROUPS.DarkBrotherHood,
    factionId: 108,
    skills: [SKILLS.Archery, SKILLS.Backstabbing, SKILLS.Climbing, SKILLS.CriticalStrike,
      SKILLS.Daedric, SKILLS.Destruction, SKILLS.ShortBlade, SKILLS.Stealth, SKILLS.Streetwise],
    rankTitles: ['Apprentice', 'Journeyman', 'Operator', 'Slayer', 'Executioner',
      'Punisher', 'Terminator', 'Assassin', 'Dark Brother', 'Master Assassin'],
    text: { welcome: 5292, promotion: 666, bribesJudge: 551 },
    // DarkBrotherhood.cs:24.
    initiationQuest: 'L0A01L00',
    // DarkBrotherhood.cs:86-92 - GetTitle is overridden twice over: a
    // non-member reads GetLocalizedText("nonMember") rather than their
    // own name, and rank 8 is gender-swapped. `nonMemberTitle` is the
    // MARKER of which override applies, not a second copy of the string.
    nonMemberTitle: 'nonMember',
    femaleTitleRanks: [8],
    femaleRankTitles: { 8: 'Dark Sister' },   // DarkBrotherhood.cs:88-89
    // DarkBrotherhood.GetPromotionMsgId - odd ranks. G8: every DB
    // promotion fires the DiscoverRandomLocation reveal + the
    // readMapDB note BEFORE its switch (:105-110), whatever the rank
    // - the verbatim unconditional arm.
    promotionByRank: { 1: 6611, 3: 6612, 5: 6613, 7: 6614 },
    promotionReveal: { always: true, noteKey: 'readMapDB' },
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
 *  high" rather than "one high skill counted twice".
 *
 *  The read is GetPermanentSkillValue (:124) - the header's claim, and
 *  now the code's. It used to read the LIVE value, which folds
 *  entity._enchantMods.skillMods, so a worn EnhancesSkill (+15) item
 *  on a guild skill could carry a join or a promotion the permanent
 *  values did not earn (and take it back on unequip). In DFU a worn
 *  enchantment never moves guild rank. */
export function numHighLowSkills(entity, guild, rank) {
  let high = 0, low = 0;
  for (const skill of guild.skills) {
    const v = permanentSkillValue(entity, skill);
    if (v >= RANK_REQ_SKILL_HIGH[rank]) high++;
    else if (v >= RANK_REQ_SKILL_LOW[rank]) low++;
  }
  return { high, low };
}

/** CalculateNewRank (:100-111). Returns -1 for expulsion. */
export function calculateNewRank(entity, guild, store) {
  // AUDIT 21 F1: DFU's shape exactly. Guild.CalculateNewRank is the base
  // computation; ThievesGuild and DarkBrotherhood OVERRIDE it as
  //     AllowGuildExpulsion(player, base.CalculateNewRank(player))
  // so the clamp wraps the WHOLE base call - including its early return
  // for negative reputation, which is the branch that actually fires. A
  // first cut of this fix clamped only the loop's exit and did nothing,
  // because the early return got there first.
  const newRank = baseCalculateNewRank(entity, guild, store);
  return guild?.neverExpels && newRank < 0 ? 0 : newRank;
}

/** Guild.CalculateNewRank (:98-116), the base every guild shares. */
function baseCalculateNewRank(entity, guild, store) {
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
export function updateRank(memberships, guild, entity, store, now, ctx = null) {
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
  return { outcome, rank: newRank, textId: textIdFor(guild, outcome, newRank, ctx) };
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
export function promotionTextId(guild, rank, ctx = null) {
  // G8 (guilds-8): the SIDE-EFFECT arms - NOT pure data in DFU. The
  // DarkBrotherhood fires the map reveal on EVERY promotion before
  // its switch (DarkBrotherhood.cs:105-110); the ThievesGuild's
  // ranks 6/8 gate their map messages on the reveal succeeding
  // (ThievesGuild.cs:100-103). ctx.revealLocation(noteKey) is the
  // host's DiscoverRandomLocation + note seam, returning the
  // revealed name or null when the region is picked clean.
  const pr = guild.promotionReveal;
  if (pr?.always) ctx?.revealLocation?.(pr.noteKey);
  if (pr?.mapIds?.[rank] != null) {
    return ctx?.revealLocation?.(pr.noteKey) ? pr.mapIds[rank] : guild.text.promotion;
  }
  if (guild.promotionForRank) {
    const id = guild.promotionForRank(rank);
    if (id != null) return id;
  }
  return guild.promotionByRank?.[rank] ?? guild.text.promotion;
}

const textIdFor = (guild, outcome, rank, ctx = null) => (
  outcome === 'promotion' ? promotionTextId(guild, rank, ctx)
    : outcome === 'demotion' ? DEMOTION_TEXT_ID
      : EXPULSION_TEXT_ID
);

/** IsMember (:155-158): rank >= 0. A non-member is rank -1, which is
 *  also what an expulsion leaves behind. */
export const isMember = (membership) => (membership?.rank ?? -1) >= 0;

/** GetTitle (Guild.cs:178-181), plus the three subclass overrides
 *  (Temple.cs:389-398, KnightlyOrder.cs:121-127, DarkBrotherhood.cs:86-92).
 *
 *  A MEMBER reads their RANK TITLE - recovered at U23, see the header.
 *  A NON-MEMBER is a different question, and AUDIT 21 F7 found the port
 *  answering it wrong for half the guilds: DFU's base returns the
 *  player's NAME, while the Temple, the knightly orders and the Dark
 *  Brotherhood each return GetLocalizedText("nonMember") instead.
 *  `nonMemberTitle` on the guild record says which.
 *
 *  The gender swap is per GUILD and per RANK - `femaleTitleRanks` is the
 *  structure, `femaleRankTitles` the strings - and DFU annotates every
 *  one of them the same way: "Not calling female chars 'Brother'!". */
export function getTitle(membership, entity, guild = null) {
  if (!isMember(membership)) {
    return guild?.nonMemberTitle === 'nonMember' ? NON_MEMBER_TITLE : (entity?.name ?? '');
  }
  const rank = membership.rank;
  if (entity?.gender === 'female' && guild?.femaleTitleRanks?.includes(rank)) {
    const t = guild.femaleRankTitles?.[rank];
    if (t) return t;
  }
  return guild?.rankTitles?.[rank] ?? entity?.name ?? '';
}

/** IsSatisfyQuestReqByLevel (Guild.cs:51-54, overridden true by
 *  MagesGuild.cs:67-70 and KnightlyOrder.cs:83-86), as its ONE consumer
 *  uses it - DaggerfallGuildServicePopupWindow.cs:564-568:
 *
 *      int rank = guild.Rank;
 *      if (guild.IsSatisfyQuestReqByLevel() && playerEntity.Level > rank)
 *          rank = playerEntity.Level;
 *
 *  For those two guilds a high-level low-rank member draws from the quest
 *  pool of their LEVEL, not their rank; for the other four the rank stands
 *  however high the player has levelled. The flag alone would be inert
 *  data, so the three lines that read it live here with it. */
export function questRankFor(guild, rank, playerLevel) {
  return guild?.questReqByLevel && playerLevel > rank ? playerLevel : rank;
}

/** GetGuildFactionId (GuildManager.cs:74-101) - the group -> faction
 *  inverse, "used for non-member quests". The two VARIANT groups answer
 *  0 on purpose, in DFU's own words, "since they have variants each with
 *  different faction ids": there is no single faction for "a temple".
 *
 *  Derived from GUILDS rather than restated, so the two cannot drift.
 *  DFU's `default:` consults its custom-guild registry, which is a mod
 *  hook and not Daggerfall; the 0 it falls through to is what remains. */
const GUILD_FACTION_BY_GROUP = new Map(Object.values(GUILDS).map((g) => [g.guildGroup, g.factionId]));
export function guildFactionIdOfGroup(guildGroup) {
  if (guildGroup === GUILD_GROUPS.HolyOrder || guildGroup === GUILD_GROUPS.KnightlyOrder) return 0;
  return GUILD_FACTION_BY_GROUP.get(guildGroup) ?? 0;
}

/** GuildManager.GetGuild(factionId) (:254-267). Null for a faction that
 *  is not a guild.
 *
 *  `resolveVariant` is how the variant-keyed guilds join in without
 *  this module importing them (guildVariants imports THIS one, so the
 *  other direction would be a cycle). guildVariants exports a ready
 *  resolver; AUDIT 20 found this answering null for all eight temples
 *  and all ten orders after G2 shipped them. */
export function guildOfFaction(factionId, resolveVariant = null, factionDict = null) {
  // AUDIT 21 F3: DFU resolves by GUILD GROUP, not by a faction id match.
  // GetGuild(factionId) (GuildManager.cs:254-267) calls GetGuildGroup and
  // dispatches on the group; the port matched `g.factionId === factionId`
  // first and answered null for anything else. That is the difference
  // between "the Fighters Guild's own faction record" and "any of the 68
  // faction ids that CARRY a guild group" - and the ids DFU's building and
  // NPC callers pass in are the latter.
  //
  // The id match stays as a fast path (and as the answer when no dict is
  // supplied), because a guild's own record obviously resolves to itself.
  for (const g of Object.values(GUILDS)) if (g.factionId === factionId) return g;

  if (factionDict) {
    const group = guildGroupOfFaction(factionDict, factionId);
    if (group !== GUILD_GROUPS.None) {
      // The variant groups (HolyOrder, KnightlyOrder) need the building
      // faction to pick WHICH temple or order, so they stay with the
      // variant resolver; the fixed groups map straight to their guild.
      for (const g of Object.values(GUILDS)) if (g.guildGroup === group) return g;
    }
  }
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

/** THE SECOND, PARALLEL MEMBERSHIP DICTIONARY (GuildManager.cs:105-112).
 *
 *      private readonly Dictionary<GuildGroups, IGuild> memberships;
 *      private readonly Dictionary<GuildGroups, IGuild> vampMemberships;
 *      private Dictionary<GuildGroups, IGuild> Memberships {
 *          get { return ...HasVampirism() ? vampMemberships : memberships; }
 *      }
 *
 *  Every membership read and write in DFU goes through that ONE property,
 *  so becoming a vampire does not lose your guilds - it swaps the whole
 *  book for an empty one, and a cure swaps it back. The save format keeps
 *  both halves (GetMembershipData(bool vampire), :313-320), and
 *  ClearMembershipData() clears BOTH (:298-302).
 *
 *  Vampirism itself is another slice, so nothing sets `hasVampirism` yet.
 *  The STORE is defined here because it is a property of the membership
 *  model this slice owns, and retrofitting a second book later would mean
 *  touching every call site. A PLAIN OBJECT is still accepted everywhere
 *  and means the mortal book - which is exactly what every current caller
 *  intends - so this adds a shape without breaking one. */
export const newMembershipStore = () => ({ mortal: {}, vampire: {} });
export function membershipsFor(store, hasVampirism = false) {
  if (!store) return {};
  if (!Object.hasOwn(store, 'mortal') || !Object.hasOwn(store, 'vampire')) return store;
  return hasVampirism ? store.vampire : store.mortal;
}
/** ClearMembershipData() (:298-302) clears BOTH books, not the active one. */
export function clearMembershipData(store) {
  if (!store) return;
  if (Object.hasOwn(store, 'mortal') && Object.hasOwn(store, 'vampire')) {
    store.mortal = {};
    store.vampire = {};
    return;
  }
  for (const k of Object.keys(store)) delete store[k];
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

/** Guild.AlterReward (Guild.cs:207-210, base identity) with the ONE
 *  override in DFU: FightersGuild.cs:96-99's fixed-point rank bonus
 *  (((10 + rank) << 8) / 10 * reward) >> 8 - integer division at each
 *  step. The quest gold mint (Q2b-ii) is its consumer. */
export function alterReward(guildGroup, rank, reward) {
  if (guildGroup === GUILD_GROUPS.FightersGuild) {
    return (Math.trunc(((10 + rank) << 8) / 10) * reward) >> 8;
  }
  return reward;
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
export function joinDecision(entity, guild, store, memberships = null) {
  // AUDIT 21 F2: DFU's gate ORDER, which the port skipped the front of.
  // JoinButton_OnMouseClick (DaggerfallGuildServicePopupWindow.cs:498-524)
  // runs three checks and only the third was ported:
  //
  //   1. guildManager.JoinGuild(group, factionId) - which RETURNS THE
  //      GUILD ALREADY IN THAT GROUP SLOT if one is there (:161-162)
  //   2. if (!guild.IsMember())    <- nothing happens at all when it is
  //   3. IsEligibleToJoin          <- the only one the port had
  //
  // So in DFU a rank-7 Fighters Guild member gets NO join dialogue, and a
  // Patriarch of Mara clicking Arkay's temple gets none either - the slot
  // hands back Mara, IsMember is true, and the window closes. The port
  // offered both, and joinGuild ASSIGNS into the slot, so accepting reset
  // a rank-7 member to rank 0 or traded a lifetime in Mara's temple for
  // rank 0 in Arkay's.
  //
  // `memberships` is optional so existing callers that only ask "could
  // this character qualify" keep working; a caller driving the actual
  // join must pass it.
  if (memberships && joinedGuildOfGroup(memberships, membershipKey(guild))) return null;
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
