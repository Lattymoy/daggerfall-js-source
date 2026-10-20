// U23: THE GUILD SERVICE POPUP'S LAW HALF. 1:1 from Daggerfall
// Unity's DaggerfallGuildServicePopupWindow.cs and the routing block
// of PlayerActivate.StaticNPCClick (MIT, Daggerfall Workshop /
// Hazelnut). Unity plumbing dropped; the window itself is
// ui/guildServiceWindow.js.
//
// The split is the one G3 already made: guildServices.js holds WHICH
// service an NPC offers and WHO may use it; this file holds what
// CLICKING that NPC does - the routing that picks the popup at all,
// the popup's own OnPush side effects, and the refusal a locked
// service answers with. All of it is headless, so the window is only
// geometry and hit rects.
//
// ── the routing (PlayerActivate.cs :1512-1607) ────────────────────
// StaticNPCClick is a five-way branch on the NPC's faction record and
// the BUILDING's, in this order: guild service, merchant social
// group, witches coven, everything else talks. The two bug-numbered
// escape hatches in the guild branch are verbatim and are named in
// DFU's own comments (t=1238 and t=2037): a holy-order NPC standing
// in a building that is not a divine's, and the Thieves Guild
// spymaster standing in a building with no faction at all, both fall
// back to TALK rather than opening a service menu they have no guild
// for.
import { GUILD_GROUPS, SOCIAL_GROUPS, FACTION_TYPES } from '../../formats/factionFile.js';
import { hasGuildService, npcServiceKind, canAccessService } from './guildServices.js';
import { isMember, joinedGuildOfGroup, updateRank, rankNeeds, getTitle, membershipOf, reviewDaysLeft, reviewedRank, numHighLowSkills, underworldRuleOf,
  isJoinableByApplication, membershipKey,   // WAY-BACK: a stranger is told the way in where one walks in
  GUILD_EXPEL_BELOW, DAYS_BETWEEN_RANK_CHANGES, RANK_REQ_REPUTATION, RANK_REQ_SKILL_HIGH, RANK_REQ_SKILL_LOW } from './guilds.js';
import { QUEST_SUCCESS_REP } from '../quest/questRepute.js';   // WAY-BACK: what a stranger's quest done pays the guild (the leaf - AUDIT GUIDE O6)
import { RECOVERY_INTERVAL_MINUTES } from '../court.js';   // WAY-BACK: REP4's week, a bad name's point back
import { MINUTES_PER_DAY } from '../gameDate.js';
import { getReputation } from '../faction/factionRep.js';   // AUDIT GUILD-WORDS L1-2: the review's warnings read the standing
import { standingOwedOf } from '../standingOwed.js';   // STANDING-WORDS: what the Roll still owes, online
import { SKILL_NAMES } from '../skills.js';   // PROMO-NOW: the hall's line names the guild's skills
import { isDivine } from './guildVariants.js';
import { localizedText, localizedTable, t } from '../textManager.js';   // L10N3d: the labels and the refusal; PROMO-NOW: the hall's line
import { SEAT_RANK, SEAT_MERIT_WEEKS, SEAT_TENURE_S, SEAT_ACCOUNT_AGE_S, ROLL_GAIN_DAY_MAX, HALL_WRIT_REP } from '../../net/npcChapterLaw.js';   // SEAT-LINE: what a seat asks, the law's own numbers; OWED-PACE: the Roll's day; WAY-BACK: and a chapter writ's credit

/** The four ids the window quotes by name (:29-32), plus the two
 *  OnPush records and the spymaster greeting (:455). */
export const NO_POTION_INGREDIENTS = 34;
export const SORCEROR_MAGICKA_RECHARGE = 465;
export const TEMPLE_RESET_STATS = 403;
export const INSUFFICIENT_RANK_ID = 3100;
export const YOU_ARE_HEALED_ID = 350;          // DaggerfallUI.MessageBox(350)
export const SPYMASTER_GREETING_ID = 402;
/** Internal_Strings "serviceMembersOnly" - the NON-member refusal,
 *  which is a plain string and not a TEXT.RSC record. */
export const SERVICE_MEMBERS_ONLY = 'My services are reserved for members only.';

/** Services.GetServiceLabelText (Services.cs :354-406), from DFU's
 *  Internal_Strings table. The button label is the ONLY text the
 *  popup draws itself - the rest of its art has the words baked in.
 *  Keyed by the service, each label read through its DFU key when the
 *  button is drawn (L10N3d). */
export const SERVICE_LABEL = localizedTable({
  Training: ['serviceTraining', 'Training'],
  Quests: ['serviceQuests', 'Get Quest'],
  Repair: ['serviceRepairs', 'Repairs'],
  Identify: ['serviceIdentify', 'Identify'],
  Donate: ['serviceDonate', 'Make Donation'],
  CureDisease: ['serviceCure', 'Cure Disease'],
  BuyPotions: ['serviceBuyPotions', 'Buy Potions'],
  MakePotions: ['serviceMakePotions', 'Make Potions'],
  BuySpells: ['serviceBuySpells', 'Buy Spells'],
  BuySpellsMages: ['serviceBuySpells', 'Buy Spells'],      // the two share one label (:379-381)
  MakeSpells: ['serviceMakeSpells', 'Make Spells'],
  BuyMagicItems: ['serviceBuyMagicItems', 'Buy Magic Items'],
  MakeMagicItems: ['serviceMakeMagicItems', 'Make Magic Items'],
  SellMagicItems: ['serviceSellMagicItems', 'Sell Magic Items'],
  Teleport: ['serviceTeleport', 'Teleportation'],
  DaedraSummoning: ['serviceDaedraSummon', 'Daedra Summoning'],
  Spymaster: ['serviceSpymaster', 'Spymaster'],
  BuySoulgems: ['serviceBuySoulgems', 'Buy Soulgems'],
  ReceiveArmor: ['serviceReceiveArmor', 'Receive Armor'],
  ReceiveHouse: ['serviceReceiveHouse', 'Receive House'],
});
export const serviceLabel = (service) => SERVICE_LABEL[service] ?? '?';   // DFU's `default: "?"`

/** GuildNpcServices.TG_Spymaster - the id the t=2037 escape tests. */
export const TG_SPYMASTER_FACTION_ID = 806;   // AUDIT 23 (guilds-3): Services.cs:78 TG_Spymaster = 806 (803 is TG_Training)

/** StaticNPCClick's routing (:1512-1607), as a decision.
 *
 *  `npcFaction` and `buildingFaction` are FACTION.TXT records (or
 *  null). DFU's first act is GetFactionData(npc.Data.factionID) - a
 *  MISS talks, which is why an unknown faction id never reaches the
 *  branch table. A player outside a building, or inside one whose
 *  faction does not resolve, gets ggroup None for the building
 *  exactly as DFU's `buildingFactionData.ggroup = None` does.
 *
 *  Returns { kind, ... }:
 *    guildService  { guildGroup, buildingFactionId }
 *    merchant      { service: 'sell' | 'banking' | 'repair' | 'tavern' }
 *    witchesCoven  {}
 *    talk          { spymaster }   - spymaster is DFU's third
 *                    TalkToStaticNPC argument on the t=2037 path
 */
export function staticNpcRoute({
  npcFactionId, npcFaction, buildingFaction = null, buildingType = -1,
  insideBuilding = true, isShop = () => false, isRepairShop = () => false,
  isBank = () => false, isTavern = () => false, hasCustomMerchantService = () => false,
} = {}) {
  if (!npcFaction) return { kind: 'talk', spymaster: false };
  const buildingGroup = (insideBuilding && buildingFaction)
    ? buildingFaction.ggroup : GUILD_GROUPS.None;
  const buildingFactionId = (insideBuilding && buildingFaction) ? buildingFaction.id : 0;

  if (hasGuildService(npcFactionId)) {
    let guildGroup = buildingGroup;
    if (guildGroup === GUILD_GROUPS.None) {
      // "Use NPC guild group if building has none (e.g. Temple
      // buildings of divine faction)"
      guildGroup = npcFaction.ggroup;
      // The two bug-numbered escapes, verbatim.
      if ((guildGroup === GUILD_GROUPS.HolyOrder && !isDivine(buildingFactionId))
        || (npcFactionId === TG_SPYMASTER_FACTION_ID && buildingFactionId === 0)) {
        return { kind: 'talk', spymaster: npcFactionId === TG_SPYMASTER_FACTION_ID };
      }
    }
    return { kind: 'guildService', guildGroup, buildingFactionId };
  }
  if (npcFaction.sgroup === SOCIAL_GROUPS.Merchants) {
    if (hasCustomMerchantService(npcFactionId)) return { kind: 'merchant', service: 'sell' };
    if (isShop(buildingType)) {
      return { kind: 'merchant', service: isRepairShop(buildingType) ? 'repair' : 'sell' };
    }
    if (isBank(buildingType)) return { kind: 'merchant', service: 'banking' };
    if (isTavern(buildingType)) return { kind: 'merchant', service: 'tavern' };
    return { kind: 'talk', spymaster: false };
  }
  if (npcFaction.type === FACTION_TYPES.WitchesCoven) return { kind: 'witchesCoven' };
  return { kind: 'talk', spymaster: false };
}

/** Setup's membership flag (:107-112). It decides ONE thing: which
 *  IMG the popup draws, i.e. whether a Join Guild button exists.
 *  The Dark Brotherhood and the general populace are FORCED member -
 *  "exempt Thieves Guild and Dark Brotherhood since should never find
 *  em until a member", and the Thieves Guild's group IS
 *  GeneralPopulace. Note this reads the GROUP's membership, not this
 *  building's guild: standing in Mara's temple as a member of Arkay's
 *  hides the join button, which is DFU's behaviour. */
export function showsJoinButton(memberships, guildGroup) {
  if (guildGroup === GUILD_GROUPS.DarkBrotherHood || guildGroup === GUILD_GROUPS.GeneralPopulace) return false;
  return !isMember(joinedGuildOfGroup(memberships, guildGroup));
}

/** DoGuildService's access gate (:311-329). A MEMBER of too low a
 *  rank is told 3100 on a click-anywhere box; a non-member gets the
 *  plain "members only" string. The distinction matters: one says
 *  "come back when you are senior", the other "join first".
 *  SEAT-WORDS (Field-Bugs-2026-10-15g): online (the host's `ctx.rankCeiling`, 7 while the Roll holds) a member refused a
 *  service no rank up to the ceiling opens but a seat's rank does (the Mages Guild's Teleport, a temple's summoning at
 *  8) is told the rank, that it is a chapter's seat, and that a seat's services are its own chapter's halls' for a
 *  member at 7 (seatedBook) - at any rank: 3100 promised a review that, online, never reaches it (AUDIT GUILD-WORDS L1-1;
 *  L1-5, L3-3: a seat held elsewhere is told why its rank is not read here). */
export function serviceAccess(guild, membership, service, ctx = null) {
  if (canAccessService(guild, membership, service)) return { allowed: true };
  if (!isMember(membership)) return { allowed: false, text: localizedText('serviceMembersOnly', SERVICE_MEMBERS_ONLY) };   // :325
  const ceiling = ctx?.rankCeiling;
  if (Number.isInteger(ceiling) && !canAccessService(guild, { ...membership, rank: ceiling }, service)) {
    for (let rank = ceiling + 1; rank <= SEAT_RANK.master; rank++) {
      if (canAccessService(guild, { ...membership, rank }, service)) {
        return { allowed: false, text: t('guild.seatService', 'Rank {rank} offers this. Online, ranks {officer} and {master} are chapter chairs won by Merit, and a chair\'s services are at its own chapter\'s halls, for a member at rank {cap}. A notice board explains chapters.', { rank, officer: SEAT_RANK.officer, master: SEAT_RANK.master, cap: ceiling }) };
      }
    }
  }
  return { allowed: false, textId: INSUFFICIENT_RANK_ID };
}

/** Whether any live effect is holding an attribute DOWN -
 *  EntityEffectManager.HasDamagedAttributes (:1570-1582), over the
 *  port's activeEffects shape (statMods.js's readers): a drain or
 *  transfer entry, or a disease/poison carrying a negative statMods
 *  column. DFU asks each live effect whether AllAttributesHealed;
 *  the port has no per-effect statMods array, so the same question is
 *  asked of the contributions themselves. */
export function hasDamagedAttributes(entity) {
  for (const a of entity?.activeEffects ?? []) {
    if (a.kind === 'drainAttribute' || a.kind === 'transferAttribute') {
      if ((a.magnitude ?? 0) > 0) return true;
      continue;
    }
    if (a.kind === 'disease' || a.kind === 'poison') {
      for (const v of Object.values(a.statMods ?? {})) if (v < 0) return true;
    }
  }
  return false;
}

/** CureAllAttributes (:1548-1557) - ConfirmStatReset's Yes branch.
 *  DFU calls CureAttributeDamage on every live effect, which zeroes
 *  that effect's statMods without ending the effect. The port's
 *  equivalent is to drop the attribute contribution: a drain becomes
 *  magnitude 0, a disease's negative columns clear. Returns the number
 *  of contributions cured.
 *  CURE-ENDS (AUDIT 2026-10-01 part four): A CURED DRAIN ENDS, as a
 *  healed-out one does (effects.js healAttributeDamage) - left, the
 *  spell's bundle kept it on the HUD as a debuff that did nothing,
 *  blinking as expiring and never ending (only a Dispel took it), on
 *  the party's cards and in the dispel list, through every save: after
 *  this stat reset, and after a vampire's or a werewolf's turn
 *  (lycanthropy.js endOldLifeEffects). The disease keeps its own end. */
export function cureAllAttributes(entity) {
  let n = 0;
  for (const a of entity?.activeEffects ?? []) {
    if (a.kind === 'drainAttribute' || a.kind === 'transferAttribute') {
      if ((a.magnitude ?? 0) > 0) { a.magnitude = 0; n++; }
      a.ended = true;
      continue;
    }
    if (a.kind === 'disease' || a.kind === 'poison') {
      for (const [k, v] of Object.entries(a.statMods ?? {})) if (v < 0) { a.statMods[k] = 0; n++; }
    }
  }
  return n;
}

/** OnPush (:158-205), as an ORDERED list of what the popup owes the
 *  player the moment it opens. The window renders them as a stack of
 *  message boxes; the SIDE EFFECTS (the rank move, the heal, the
 *  recharge) have already happened when this returns, exactly as
 *  DFU's do - it heals first and shows the box second.
 *
 *  Each step is { textId } for a click-anywhere box, or
 *  { textId, buttons: 'YesNo', onYes } for the stat-reset prompt.
 *
 *  `freeHealing` / `freeMagickaRecharge` are passed in rather than
 *  imported-and-called so the caller keeps guildServices.js's exact
 *  argument list (the magicka one needs the entity's career). */
export function onPushEffects(entity, guild, memberships, store, now, {
  freeHealing = false, freeMagickaRecharge = false, revealLocation = null,
  ownsHouse = null, rankCeiling = null, promoteWhenEarned = false,
} = {}) {
  const steps = [];
  // Check guild advancement. UpdateRank returns tokens only when the
  // rank actually MOVED; the port's returns the outcome + new rank.
  // G8: revealLocation is the host's DiscoverRandomLocation seam -
  // the TG rank-6/8 map gates and the DB every-promotion reveal.
  // F114: ownsHouse is the host's DaggerfallBankManager.OwnsHouse
  // read (current region), for the knightly rank-9 promotion text.
  // CHAP4b: rankCeiling, the host's - online, while the Roll holds, 7 (ranks 8 and 9 are seats, Chapters-Arc 3.5)
  // PROMO-NOW: promoteWhenEarned, the host's - online, a promotion does not wait the 28 days
  // OWED-PACE (FIELD BUGS 2026-10-16c): what the Roll still owes the guild, online (0 offline) - never expelled over it
  const moved = updateRank(memberships, guild, entity, store, now, { revealLocation, ownsHouse, rankCeiling, promoteWhenEarned, owed: standingOwedOf(guild.factionId) });
  if (moved) {
    // RR1: a mod's TokensExpulsion rides as the box's own rows (centred, %pcn the player's name - MacroHelper's), ahead of the record's
    const rows = moved.lines ? moved.lines.map((t) => ({ text: t.replaceAll('%pcn', entity?.name ?? ''), center: true })) : undefined;
    steps.push({ textId: moved.textId, ...(rows ? { rows } : {}), clickAnywhere: true, rankChange: moved });
  }
  if (freeHealing) {
    if ((entity.health ?? 0) < (entity.maxHealth ?? 0)) {
      entity.health = entity.maxHealth;
      steps.push({ textId: YOU_ARE_HEALED_ID, clickAnywhere: true });
    }
    // The stat restoration is a QUESTION, not a gift, and it is asked
    // whether or not the heal above fired.
    if (hasDamagedAttributes(entity)) {
      steps.push({ textId: TEMPLE_RESET_STATS, buttons: 'YesNo', onYes: () => cureAllAttributes(entity) });
    }
  }
  if (freeMagickaRecharge && (entity.magicka ?? 0) < (entity.maxMagicka ?? 0)) {
    steps.push({ textId: SORCEROR_MAGICKA_RECHARGE, clickAnywhere: true });
    entity.magicka = entity.maxMagicka;   // DFU refills AFTER showing the box
  }
  return steps;
}

/** AUDIT GUILD-WORDS II (A-8): when the review is, the `days` every warning's ICU branch reads - the guild's hall at the
 *  next visit (0), or `days` on or later (reviewDaysLeft's, on the character's own date). */
const daysOf = (days) => (Number.isSafeInteger(days) && days > 0 ? days : 0);

/** STANDING-WORDS (Field-Bugs-2026-10-15g; Reign Droid: "Im forever trapped as apprentice and cant grow past -20
 *  reputation"): a probation said with its stakes, as REP6's review (guilds.js updateRank) will rule it. The review runs
 *  at the guild's hall, the first visit `days` on or later (reviewDaysLeft's; 0 or null: the next visit) - AUDIT
 *  GUILD-WORDS L1-7, L3-6. `kind`: 'expel' (below -10 out, below 0 another 28 days, 0 or more ends), 'ends' (a guild that
 *  never expels - its review clamps to rank 0 and ends it, L1-3), 'skills' (the guild skills fail rank 0's bars, so the
 *  review rules -1 whatever the standing: below -10 out, else renewed - it ends only once the skills meet the bars AND
 *  the standing is 0 or more, AUDIT GUILD-WORDS II A-6). `online`: PROMO-NOW's - a member who earns the next rank is
 *  promoted at once, which ends the probation sooner than the days (II C-7). */
export function probationWords(days, kind = 'expel', online = false) {
  if (kind === 'ends') return t('guild.probation.ends', 'On probation: it ends at your next review, at the guild\'s hall.');
  if (kind === 'skills') {
    return t('guild.probation.skills', 'On probation: your guild skills are short of a member\'s. Your review is {days, plural, =0 {at your next visit to the guild\'s hall} one {at the guild\'s hall in # day or later} other {at the guild\'s hall in # days or later}}: below {expel} you are expelled, and it ends only once one skill reaches {high}, a second {low}, and your standing is 0 or more.',
      { days: daysOf(days), high: RANK_REQ_SKILL_HIGH[0], low: RANK_REQ_SKILL_LOW[0], expel: GUILD_EXPEL_BELOW });
  }
  return daysOf(days) > 0
    ? t('guild.probation.in', 'On probation: your review is at the guild\'s hall in {days, plural, one {# day} other {# days}} or later{online, select, yes { - sooner if you earn the next rank} other {}}. Below {expel} you are expelled there, below 0 it runs {renew} days more, and at 0 or more it ends.', { days, online: online ? 'yes' : 'no', expel: GUILD_EXPEL_BELOW, renew: DAYS_BETWEEN_RANK_CHANGES })
    : t('guild.probation.due', 'On probation: your review is at your next visit to the guild\'s hall. Below {expel} you are expelled there, below 0 it runs {renew} days more, and at 0 or more it ends.', { expel: GUILD_EXPEL_BELOW, renew: DAYS_BETWEEN_RANK_CHANGES });
}

/**
 * AUDIT GUILD-WORDS (L1-2, L1-3, L1-4): THE REVIEW'S WARNINGS for a member, read off the book the review reads (never a
 * seat's): its probation with the stakes this member's review would rule (probationWords' kind), a probation the next
 * review would begin (AUDIT GUILD-WORDS II A-7: below 0, or the guild skills short of rank 0's bars), and a demotion said
 * before it lands - the review's own rank (guilds.js reviewedRank) below the member's, with what the rank held asks when
 * it is the standing. Each says when the review is (II A-8). The hall's line puts them first; the Standing page shows
 * them under the guild. `ctx`: the host's `rankCeiling`, the character's own date (`now`), and `online` - PROMO-NOW's
 * early promotion, which ends a probation sooner (II C-7).
 */
export function reviewWarnings(entity, guild, book, store, ctx = null) {
  const m = membershipOf(book, guild);
  if (!isMember(m) || !store) return [];
  const out = [];
  const ruled = reviewedRank(m, guild, entity, store, ctx);
  const days = ctx?.now ? reviewDaysLeft(m, ctx.now) : 0;
  const { high, low } = numHighLowSkills(entity, guild, 0);
  const skillsShort = high < 1 || high + low < 2;
  if (m.probation) {
    const kind = guild.neverExpels && !underworldRuleOf(guild) ? 'ends' : skillsShort ? 'skills' : 'expel';
    out.push(probationWords(days, kind, !!ctx?.online));
  } else if (ruled < 0) {
    out.push(getReputation(store, guild.factionId) < 0
      ? t('guild.probation.comingRep', 'Your review {days, plural, =0 {at your next visit to the guild\'s hall} one {at the guild\'s hall in # day or later} other {at the guild\'s hall in # days or later}} puts you on probation: your standing is below 0.', { days: daysOf(days) })
      : t('guild.probation.comingSkills', 'Your review {days, plural, =0 {at your next visit to the guild\'s hall} one {at the guild\'s hall in # day or later} other {at the guild\'s hall in # days or later}} puts you on probation: your guild skills are short of a member\'s.', { days: daysOf(days) }));
  }
  if (ruled >= 0 && ruled < m.rank) {
    const title = getTitle({ rank: ruled }, entity, guild);
    const need = RANK_REQ_REPUTATION[m.rank];
    out.push(getReputation(store, guild.factionId) < need
      ? t('guild.rankNeeds.fallsRep', 'Your review {days, plural, =0 {at your next visit to the guild\'s hall} one {at the guild\'s hall in # day or later} other {at the guild\'s hall in # days or later}} lowers you to {title}: {current} needs reputation {need}.', { days: daysOf(days), title, current: getTitle({ rank: m.rank }, entity, guild), need })
      : t('guild.rankNeeds.falls', 'Your review {days, plural, =0 {at your next visit to the guild\'s hall} one {at the guild\'s hall in # day or later} other {at the guild\'s hall in # days or later}} lowers you to {title}.', { days: daysOf(days), title }));
  }
  return out;
}

/** STANDING-WORDS: the reputation row of the hall's line - what the Roll still owes the guild said beside it, online.
 *  OWED-PACE (FIELD BUGS 2026-10-16c; slater.mp3: "i get this: (21 more i need) and did few quests and its need 36
 *  more!"): "(21 more to come)" read as 21 more NEEDED, and a quest done the same day grew it - the Roll credits at most
 *  ROLL_GAIN_DAY_MAX a real day and owes the rest (npcChapterLaw.js rollCredit). So the row says the owed is EARNED and
 *  the pace it arrives at. */
const reputationLine = (n, owed) => (owed > 0
  ? t('guild.rankNeeds.reputationOwed', 'Reputation {have} of {need} ({owed} more already earned, arriving at most {max} a real day)', { have: n.reputation, need: n.reputationNeed, owed, max: ROLL_GAIN_DAY_MAX })
  : t('guild.rankNeeds.reputation', 'Reputation {have} of {need}', { have: n.reputation, need: n.reputationNeed }));

/** PROMO-NOW (FIELD BUGS 2026-10-15, "passed 200 days still no promotion i meet the requirements"): the hall's line for
 *  a member - the next rank and what it asks that they do not yet have, as the review reads it (guilds.js rankNeeds):
 *  the guild's reputation, one guild skill at the high bar, a second at the low. The guild's own skills are named when
 *  a skill is short - they are the port's (FGH2H's hand-to-hand), not a wiki's. Null when nothing is short (the review
 *  has just promoted) or no review gives a next rank. */
export function rankNeedsLines(entity, guild, memberships, store, ctx = null) {
  // STANDING-WORDS: the review's warnings first, whatever else the next rank asks - off the book the review reads
  // (`ctx.book`, the host's; the line's own book seats a seat's rank), and said even where no next rank is (L1-4); online
  // while the Roll paces (`ctx.pace`) - exactly when the host's review promotes without the wait (worldModes
  // promoteWhenEarned), so a probation may end sooner (AUDIT GUILD-WORDS II C-7)
  const warnings = reviewWarnings(entity, guild, ctx?.book ?? memberships, store, ctx && { ...ctx, online: !!ctx.pace });
  const n = rankNeeds(memberships, guild, entity, store, ctx);
  if (!n) return warnings.length ? warnings : null;
  const owed = standingOwedOf(guild.factionId);
  const next = t('guild.rankNeeds.next', 'Next rank: {title}', { title: getTitle({ rank: n.rank }, entity, guild) });
  // SEAT-LINE (FIELD BUGS 2026-10-15g: "I was Archmage and now I cant seem to ever get back past the Wizard rank... All
  // the other guilds tell me what the next rank is and what I need but the Mages Guild does not"; Mac: "Explain the
  // seat"): at the Roll's 7 the hall says that 8 and 9 are its chapters' seats and what a seat asks - the reputation
  // (the Roll's seat line), then the Turning's Merit, the tenure and the account's age (npcChapterLaw.js
  // seatEligibleAt). A seat's own hall reads the book seated, and says nothing.
  if (n.seat) {
    return [
      ...warnings,
      next,
      t('guild.rankNeeds.seat', "Ranks {officer} and {master} are each chapter's council and Master, won only by Merit",
        { officer: SEAT_RANK.officer, master: SEAT_RANK.master }),
      ...(n.reputation < n.reputationNeed ? [reputationLine(n, owed)] : []),
      // AUDIT GUILD-WORDS L3-4: the seats' days and weeks are real ones (UTC), the review's the character's - said so
      t('guild.rankNeeds.seatMerit', 'At each Sunday\'s Turning the chairs go to the members with the most Merit over the last {weeks} weeks, with {days} real days in the guild and accounts {age} real days old',
        { weeks: SEAT_MERIT_WEEKS, days: SEAT_TENURE_S / 86_400, age: SEAT_ACCOUNT_AGE_S / 86_400 }),
    ];
  }
  const lines = [];
  if (n.reputation < n.reputationNeed) lines.push(reputationLine(n, owed));
  if (n.high < 1) {
    lines.push(n.best
      ? t('guild.rankNeeds.highBest', 'A guild skill at {bar} - your best, {skill}, is {value}', { bar: n.skillHigh, skill: SKILL_NAMES[n.best.skill], value: n.best.value })
      : t('guild.rankNeeds.high', 'A guild skill at {bar}', { bar: n.skillHigh }));
  }
  if (n.high + n.low < 2) lines.push(t('guild.rankNeeds.second', 'A second guild skill at {bar}', { bar: n.skillLow }));
  if (n.high < 1 || n.high + n.low < 2) lines.push(t('guild.rankNeeds.skills', 'Guild skills: {skills}', { skills: guild.skills.map((s) => SKILL_NAMES[s]).join(', ') }));
  // ROLL-PACE (FIELD BUGS 2026-10-15f): online the Roll pays a rank at its pace since the membership began - when that is
  // what holds the next one, the hall says how long (`ctx.pace`, npcRollTracker.js rollPaceOf)
  const wait = n.rank > (ctx?.pace?.ceiling ?? Infinity) ? ctx.pace.wait(n.rank) : null;
  if (wait > 0) lines.push(t('guild.rankNeeds.paced', '{days, plural, =1 {Earliest promotion: tomorrow} other {Earliest promotion: in # days}}', { days: wait }));
  if (!lines.length) return warnings.length ? warnings : null;
  return [...warnings, next, ...lines];
}

/** WAY-BACK (FIELD BUGS 2026-10-16d; Glade on Discord: "they kicked me out so I can't do any quests to recover. It's
 *  unclear to me whether I'll have to remake my character or wait IRL weeks just to get back to 0"): what the way back
 *  in costs, said to a stranger the guild will not take on their standing - an expelled member, or one who never joined.
 *  Both roads were always open and nothing said either. A stranger may ask the hall's quest-giver for work
 *  (NonMemberGuild.CanAccessService's Quests, guildServices.js baseCanAccessService; QuestList-Classic's `N` rows), and
 *  each one done pays the guild DFU's QUEST_SUCCESS_REP (Quest.cs EndQuest - the guild's faction, a member or not); and a
 *  standing below 0 recovers a point every RECOVERY_INTERVAL_MINUTES of the character's own time (REP4; rests and
 *  journeys count, LIVED1), and online across a log-off too, on the world's clock (worldTick.js normalizeAcross, from
 *  save.js payAbsenceWhenHeard - AUDIT WAY-BACK L1-2/L3-2). Null where the join is not offered (a member of the slot -
 *  this guild, or another temple or order in it, as showsJoinButton reads it - or a guild joined only by invitation),
 *  with no faction store, or at a standing the join already accepts. What the Roll still owes counts toward the line
 *  (`standingOwedOf`, 0 offline, and kept through a lease's stop - AUDIT WAY-BACK L2-3). */
function wayBackOf(guild, memberships, store) {
  if (!guild || !store || !isJoinableByApplication(guild) || isMember(joinedGuildOfGroup(memberships, membershipKey(guild)))) return null;
  const rep = getReputation(store, guild.factionId), need = RANK_REQ_REPUTATION[0];
  if (rep >= need) return null;
  const owed = standingOwedOf(guild.factionId);
  return { rep, need, owed, quests: Math.ceil(Math.max(0, need - rep - owed) / QUEST_SUCCESS_REP) };
}

/** WAY-BACK: the quests line alone - the Standing page's, under the organization's own row. */
const questsLine = (w) => t('guild.wayBack.quests', 'As a stranger you may still ask its quest-giver for work: each quest done raises your standing {per}{n, plural, =0 {} one { - # more quest reaches {need}} other { - # more quests reach {need}}}.',
  { per: QUEST_SUCCESS_REP, n: w.quests, need: w.need });
export function wayBackQuestLine(guild, memberships, store) {
  const w = wayBackOf(guild, memberships, store);
  return w ? questsLine(w) : null;
}

/** WAY-BACK: the hall's lines (the enhanced skin's well) and the classic refusal's. `entity` for the guild skills, which
 *  the join asks beside the standing (AUDIT WAY-BACK L1-4/L3-1: isEligibleToJoin's row-0 bars - a stranger short of them
 *  is told so, or 0 would be a second wall). `ctx`: `online` (the shared clock - a log-off recovers too), `paced` (the
 *  host's rollPace - the Roll's day and its chapter writs, AUDIT WAY-BACK L1-1: the 15 bounds the claims, and a chapter
 *  writ's +2 is credited beyond it, member or not - professions.js, CHAP2a), and `shut` (this hall's chapter shut this
 *  Season, CHAP6d - AUDIT WAY-BACK L1-3/L2-6: its Get Quest refuses, the guild's halls elsewhere do not). */
export function wayBackLines(guild, entity, memberships, store, ctx = null) {
  const w = wayBackOf(guild, memberships, store);
  if (!w) return null;
  const { high, low } = numHighLowSkills(entity, guild, 0);
  return [
    t('guild.wayBack.standing', 'Your standing here is {rep}. It takes members at {need} or more.', { rep: w.rep, need: w.need }),
    ...(high < 1 || high + low < 2 ? [t('guild.wayBack.skills', 'It also asks one of its guild skills at {high} and a second at {low}: {skills}.',
      { high: RANK_REQ_SKILL_HIGH[0], low: RANK_REQ_SKILL_LOW[0], skills: guild.skills.map((s) => SKILL_NAMES[s]).join(', ') })] : []),
    questsLine(w),
    ...(ctx?.shut ? [t('guild.wayBack.shut', 'This hall is shut this Season. The guild\'s halls in other regions still give work.')] : []),
    t('guild.wayBack.drift', 'Below 0 your standing also recovers a point {days, plural, one {every day} other {every # days}} of your own time. Rests and journeys count{online, select, yes {, and so does time logged off} other {}}.',
      { days: RECOVERY_INTERVAL_MINUTES / MINUTES_PER_DAY, online: ctx?.online ? 'yes' : 'no' }),
    ...(ctx?.paced ? [t('guild.wayBack.paced', 'Online, quests and the recovery raise it by at most {max} a real day (days start at midnight UTC){owed, plural, =0 {} other {, with # more standing on the way}}. On top of that, a chapter writ of the guild\'s on a notice board adds {writ}.',
      { max: ROLL_GAIN_DAY_MAX, owed: w.owed, writ: HALL_WRIT_REP })] : []),
  ];
}

/** The service the popup's middle button runs. DoGuildService's switch
 *  (:334-452) has twenty arms, and the table below now names a shipped
 *  window for ALL TWENTY - U24 opened it with three (training,
 *  donation, cure disease), Q4-ii added Quests (quest/offerFlow.js's
 *  offerGuildQuest, the GetQuest override's law), and DR2 closed the
 *  last of them. Nothing waits on a window any more: worldModes.js
 *  routes every destination this table can answer (:2513-:2906), and
 *  its own note at :2436-2438 records that serviceDestination has no
 *  null left to name. The `?? null` on serviceDestination and the
 *  caller's "not available yet" line stay because DFU's own switch
 *  ends in a `default:` arm too (:447-450, CloseWindow then a message
 *  box) - an unknown service string is answered, not thrown at. */
export const SERVICE_DESTINATION = Object.freeze({
  Training: 'guildServiceTraining',
  Donate: 'guildServiceDonation',
  CureDisease: 'guildServiceCureDisease',
  Quests: 'questOffer',    // Q4-ii: QuestOfferFlow.offerGuildQuest
  Identify: 'guildServiceIdentify',   // X7: the trade window's Identify mode
  Repair: 'guildServiceRepair',   // R1: the keyed repair flow (FG rank discount rides it)
  BuyPotions: 'guildServiceBuyPotions',   // G4: Buy mode over the daily potion shelf
  MakePotions: 'guildServicePotionMaker',   // M2: the keyed potion maker
  // U42: BOTH arms are one destination because DFU's switch falls
  // one case into the other (:383-387) - the temples' BuySpells and
  // the Mages Guild's BuySpellsMages push the SAME window with the
  // same `true`, and the only thing that differs is who may ask.
  BuySpells: 'guildServiceSpellbook',        // U42: the spellbook's buy mode
  BuySpellsMages: 'guildServiceSpellbook',   // U42: the spellbook's buy mode
  MakeSpells: 'guildServiceSpellMaker',   // S1: the keyed spell maker
  BuyMagicItems: 'guildServiceBuyMagicItems',   // G4: Buy mode over the daily magic shelf
  MakeMagicItems: 'guildServiceItemMaker',   // M4: the keyed item maker
  SellMagicItems: 'guildServiceSellMagicItems',   // G4: the trade window in SellMagic mode
  BuySoulgems: 'guildServiceBuySoulgems',   // X6: the trade window in Buy mode over the daily soul-gem shelf
  Teleport: 'guildServiceTeleport',   // G5: the travel map, armed for teleportation
  DaedraSummoning: 'guildServiceDaedraSummoning',   // G7: the summoning calendar, the cost and the roll
  Spymaster: 'guildServiceSpymaster',   // G6: the 402 greeting, then the NPC's own talk
  ReceiveArmor: 'guildServiceReceiveArmor',   // G6: KnightlyOrder.ReceiveArmor
  ReceiveHouse: 'guildServiceReceiveHouse',   // H1: KnightlyOrder.ReceiveHouse, over the live house registry
});
export const serviceDestination = (service) => SERVICE_DESTINATION[service] ?? null;

/** STATION-ROWS (2026-09-27, Discord - the crash box: "TypeError: m.rows.map is not a function"): A SERVICE'S ANSWER
 *  IS A BOX - text to stand on the popup that asked - only when its `rows` are a LIST. The spell maker is handed the
 *  host's TEXT.RSC reader as `rows` and keeps it, and the maker arms hand their window back: read as a box by
 *  `rows` being there at all, a home's Spellmaking station mapped the reader as a list and threw on every press, and
 *  the guild popup pushed the whole window onto itself as a message. One test, every reader of the answer. */
export const isServiceBox = (answer) => Array.isArray(answer?.rows);

/** D1: Services.GetServiceShortcutButton (Services.cs:408-459) - the
 *  DaggerfallShortcut button whose binding the popup hangs on its
 *  MIDDLE button, so the service's accelerator changes with the
 *  service. It is a SECOND switch over the same enum as the label
 *  table, and it does not track it: BuySpells and BuySpellsMages fall
 *  into one arm here as they do there (:433-435), but Quests maps to
 *  `GuildsGetQuest` and CureDisease to `GuildsCure`, neither of which
 *  is the enum name. Nineteen arms for twenty services, and the
 *  `default:` answers Buttons.None - which shortcutBinding turns into
 *  HotkeySequence.None, a button with no accelerator at all.
 *
 *  DFU checks `customNpcServiceButtons` first (:411-413), the mod
 *  registry for services a mod added; there is no mod system here
 *  (Ledger C, Not planned), so the switch is the whole function. */
export const SERVICE_SHORTCUT = Object.freeze({
  Training: 'GuildsTraining',
  Quests: 'GuildsGetQuest',
  Repair: 'GuildsRepair',
  Identify: 'GuildsIdentify',
  Donate: 'GuildsDonate',
  CureDisease: 'GuildsCure',
  BuyPotions: 'GuildsBuyPotions',
  MakePotions: 'GuildsMakePotions',
  BuySpells: 'GuildsBuySpells',
  BuySpellsMages: 'GuildsBuySpells',   // the two share one arm (:433-435)
  MakeSpells: 'GuildsMakeSpells',
  BuyMagicItems: 'GuildsBuyMagicItems',
  MakeMagicItems: 'GuildsMakeMagicItems',
  SellMagicItems: 'GuildsSellMagicItems',
  Teleport: 'GuildsTeleport',
  DaedraSummoning: 'GuildsDaedraSummon',
  Spymaster: 'GuildsSpymaster',
  BuySoulgems: 'GuildsBuySoulgems',
  ReceiveArmor: 'GuildsReceiveArmor',
  ReceiveHouse: 'GuildsReceiveHouse',
});
/** `null` is DFU's `Buttons.None` - the caller must not ask the table
 *  for a binding it has no row for. */
export const serviceShortcutButton = (service) => SERVICE_SHORTCUT[service] ?? null;

/** Re-exported so a host wires one import surface (the popup needs
 *  both halves and G3 owns the other one). */
export { hasGuildService, npcServiceKind };
