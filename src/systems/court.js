// G2: arrest + court (DFU PlayerEntity.SurrenderToCityGuards /
// LowerRepForCrime / DaggerfallCourtWindow, MIT Daggerfall Workshop).
// Node-pure verbatim math; the scene owns the windows and the clock.
//
// - Legal reputation is PER REGION (regionData[].LegalRep), init 0;
//   each crime charges reputationLossPerCrime (FALL.EXE values; the
//   People-faction half-delta SHIPPED against the S25 store in this
//   file - AUDIT 23 retired the stale flag).
// - Surrender: health -> 1 first; legalRep < -20 refuses an
//   involuntary surrender; < -20 or > 0 goes straight to court; else
//   a DFRandom coin flip refuses involuntary; voluntary always lands
//   in court when not refused.
// - The court: punishmentType from two FailedRolls against
//   -legalRep (cap 75) and -legalRep/2 (cap 75) - both failed =
//   fine/prison (2), else banishment/execution (0); penalty =
//   base +- perRep*legalRep clamped [min,max], /40; each unit flips
//   a DFRandom coin: heads 40 gold fine, tails 3 days prison; a fine
//   beyond the player's gold converts to days at 40/day.
// - Guilty (type 2): fine >>= 1, days >>= 1, deduct, serve or walk.
//   Not guilty: Debate (Etiquette) or Lie (Streetwise), tally;
//   chance = legalRep + (skill + Personality)/2 clamp 5..95; fail ->
//   guilty with the fine roll (legalRep + Dice100: < 25 fine x2,
//   > 75 fine >>= 1); pass -> free to go.
// - Serving/banishment raise rep by half the crime's loss - 1
//   (RaiseReputationForDoingSentence; the classic double-raise on
//   fine+prison is DFU-noted and kept). Release clears the crime.
//
// NOT A GAP, recorded (closeout): execution (punishmentType 1) is
// unreachable in classic AND IN DFU. DaggerfallCourtWindow.cs assigns
// the field only 2 (:137) or 0 (:139), so its own `punishmentType ==
// 1` arms at :329 and :399 are dead code, and :279 says so in DFU's
// own words - "Seems like an execution sentence can't be given in
// classic. It can't be given here, either." court.js:76, :409 and
// :431 carry the same unreachable arm for the same reason (an arm
// that is absent and an arm that is wrong read alike from the call
// site). The prison time-skip riding the host clock callback is the
// port's seam shape, not a remainder.
// BANISHMENT'S CONSEQUENCES SHIPPED: `SeverePunishmentFlags |= 1` is
// written at scenes/arrestFlow.js:421-424 (severePunishment, off
// OnPop) and read every catch-up minute by encounters.js:220
// passiveGuardSpawns - PlayerEntity.cs:507's 10% banished-player
// guard roll - fed at scenes/world.js:1637-1639. (The guild rescues -
// Thieves/Dark Brotherhood - landed at CR1, guildRescue below.)

import { rand } from '../formats/dfRandom.js';
import { skillValue, tallySkill, SKILLS } from './skills.js';
import { goldPiecesOf, addGoldPieces, LETTER_OF_CREDIT_TEMPLATE } from './inventory.js';   // E4: the counter's two members; B1: letters are tender
import { getPeopleOfCurrentRegion } from './talk.js';   // T3a shipped the lookup
import { changeReputation } from './factionRep.js';     // S25

/** PlayerEntity.CrimeCommitted's SETTER (:2345-2355), the ONE home
 *  every crime write goes through (V4): a transformed lycanthrope is
 *  never tagged - SuppressCrime turns the write into Crimes.None. */
import { racialSuppressCrime } from './lycanthropy.js';
export function setCrimeCommitted(entity, crime) {
  entity.crimeCommitted = racialSuppressCrime(entity) ? 0 : crime;
  return entity.crimeCommitted;
}

export const CRIMES = Object.freeze({
  None: 0, Attempted_Breaking_And_Entering: 1, Trespassing: 2,
  Breaking_And_Entering: 3, Assault: 4, Murder: 5, Tax_Evasion: 6,
  Criminal_Conspiracy: 7, Vagrancy: 8, Smuggling: 9, Piracy: 10,
  High_Treason: 11, Pickpocketing: 12, Theft: 13, Treason: 14,
  LoanDefault: 15,
});
export const CRIME_IDS = Object.freeze({ Pickpocketing: 12 });

// The %cri crime names (MacroHelper.Crime, verbatim strings).
export const CRIME_NAMES = Object.freeze(['None', 'Attempted Breaking and Entering', 'Trespassing', 'Breaking and Entering', 'Assault', 'Murder', 'Tax Evasion', 'Criminal Conspiracy', 'Vagrancy', 'Smuggling', 'Piracy', 'High Treason', 'Pickpocketing', 'Theft', 'Treason', 'Loan Default']);

/** MacroHelper.Penalty (%pen), verbatim: type 2 = the regular
 *  punishment string with %gtp/%dip; 0 = Banishment; 1 = Execution. */
export function penaltyText(court) {
  if (court.punishmentType === 2) return `${court.fine} gold pieces in fines and ${court.daysInPrison} days in prison`;
  if (court.punishmentType === 1) return 'Execution';
  return 'Banishment';
}

// FALL.EXE (index 0 unused; Treason = half High_Treason, DFU's note)
export const REPUTATION_LOSS_PER_CRIME = Object.freeze(
  [0x00, 0x0A, 0x05, 0x0A, 0x08, 0x14, 0x0A, 0x02, 0x01, 0x02, 0x02, 0x4B, 0x02, 0x08, 0x24, 0x0A]);

// Court tables (crimeType = crime - 1)
export const PENALTY_PER_LEGAL_REP_POINT = Object.freeze([0x05, 0x05, 0x06, 0x06, 0x0A, 0x05, 0x05, 0x03, 0x08, 0x08, 0x09, 0x06, 0x00, 0x08, 0x00]);
export const BASE_PENALTY = Object.freeze([0x12C, 0xC8, 0x258, 0x3E8, 0x2710, 0xC8, 0x1F4, 0x64, 0x1F4, 0x1F4, 0x4B0, 0xC8, 0xC8, 0x3E8, 0x64]);
export const MIN_PENALTY = Object.freeze([0x32, 0x0A, 0x50, 0x0A, 0x2328, 0x0A, 0x0A, 0x02, 0x0A, 0x0A, 0xA0, 0x05, 0x05, 0x0A, 0x04]);
export const MAX_PENALTY = Object.freeze([0x3E8, 0x320, 0x4B0, 0x5DC, 0x2EE0, 0x2EE0, 0x5DC, 0x2BC, 0x5DC, 0x5DC, 0x7D0, 0x3E8, 0x3E8, 0x5DC, 0x2BC]);

// TEXT.RSC records
export const TEXT_SURRENDER = 15;            // "Halt! ... do you surrender?"
export const TEXT_COURT_START = 8050;
export const TEXT_FOUND_GUILTY = 8055;
export const TEXT_FREE_TO_GO = 8062;
export const TEXT_BANISHED = 8063;
export const TEXT_HOW_CONVINCE = 8064;
// CR1: the guild rescue records (DaggerfallCourtWindow.cs:33-34)
export const TEXT_RESCUE_TG = 550;           // courtTextTG - "the Thieves Guild has intervened"
export const TEXT_RESCUE_DB = 551;           // courtTextDB - the Dark Brotherhood's
// FactionFile.FactionIDs (FactionFile.cs:91/:135). CG2 moved the two
// DECLARATIONS into systems/crimeGuilds.js and re-exports them here, so
// this file's surface is unchanged: talk.js needs the ids for the
// pickpocket tally and cannot import this module (court.js imports
// talk.js - see the note at its pickpocket arm), so the one home for
// them has to be a leaf.
import { THIEVES_GUILD_FACTION_ID, DARK_BROTHERHOOD_FACTION_ID } from './crimeGuilds.js';
export { THIEVES_GUILD_FACTION_ID, DARK_BROTHERHOOD_FACTION_ID };

/** CR1 - the guild rescue arms (DaggerfallCourtWindow.cs:177-221),
 *  checked AFTER the penalty is computed and BEFORE the plead box.
 *  Assault (4) or murder (3): a Dark Brotherhood member may be
 *  rescued; attempted breaking and entering / trespassing / breaking
 *  and entering (<=2) or pickpocketing (11): a Thieves Guild member.
 *  The gate is `guild.Rank >= Random.Range(0, 20)` - a UnityEngine
 *  draw (the ENGINE-PRNG rule's injectable roll), and it is drawn
 *  ONLY for a member: C#'s IsMember() gate stands outside the roll,
 *  so a non-member consumes nothing from the stream.
 *
 *  `guildRankOf(factionId)` answers the member's rank or null for a
 *  non-member (GuildManager.GetGuild(...).IsMember()/Rank).
 *  Answers { guild, textId } for the flow's release box, or null. */
export function guildRescue(court, { guildRankOf = () => null, roll = Math.random } = {}) {
  const crimeType = court.crime - 1;
  if (crimeType === 4 || crimeType === 3) {
    const rank = guildRankOf(DARK_BROTHERHOOD_FACTION_ID);
    if (rank != null && rank >= Math.floor(roll() * 20)) {
      return { guild: 'DarkBrotherhood', textId: TEXT_RESCUE_DB };
    }
  }
  if (crimeType <= 2 || crimeType === 11) {
    const rank = guildRankOf(THIEVES_GUILD_FACTION_ID);
    if (rank != null && rank >= Math.floor(roll() * 20)) {
      return { guild: 'ThievesGuild', textId: TEXT_RESCUE_TG };
    }
  }
  return null;
}

export const legalRepOf = (player, regionIndex) => player.legalRep?.[regionIndex] ?? 0;
/** ClampLegalReputations' bounds (PlayerEntity.cs:2245-2247). */
export const LEGAL_REP_MIN = -100;
export const LEGAL_REP_MAX = 100;

/** Minutes between NormalizeReputations runs (PlayerEntity.cs:457, 112 days). */
export const NORMALIZE_INTERVAL_MINUTES = 161280;

export function changeLegalRep(player, regionIndex, delta) {
  if (!player.legalRep) player.legalRep = {};
  player.legalRep[regionIndex] = (player.legalRep[regionIndex] ?? 0) + delta;
}

/**
 * ClampLegalReputations (PlayerEntity.cs:2245-2257).
 *
 * AUDIT 21 F3: the port had NO clamp at all, so legal reputation was
 * unbounded - twelve High Treasons drove a region to -900, a number DFU
 * cannot hold. DFU clamps on save load, on the quest LegalRepute action,
 * and inside NormalizeReputations.
 */
export function clampLegalReputations(player) {
  if (!player.legalRep) return;
  for (const key of Object.keys(player.legalRep)) {
    const v = player.legalRep[key];
    if (v < LEGAL_REP_MIN) player.legalRep[key] = LEGAL_REP_MIN;
    else if (v > LEGAL_REP_MAX) player.legalRep[key] = LEGAL_REP_MAX;
  }
}

/**
 * NormalizeReputations (PlayerEntity.cs:2223-2243). Every 112 game days:
 * clamp, then walk EVERY legal reputation and EVERY faction reputation
 * one point TOWARDS ZERO. That drift is the only thing that ever forgives
 * a crime the player did not answer for, and the port had none of it.
 *
 * Note the asymmetry, which is DFU's: legal reputations are nudged by
 * direct increment, faction reputations go through ChangeReputation -
 * NON-propagating on both sides (AUDIT 23 corrected the old claim that
 * the faction half fanned out; DFU's call passes no propagate flag).
 * The asymmetry is only direct-increment vs clamped ChangeReputation.
 */
export function normalizeReputations(player, store) {
  clampLegalReputations(player);
  for (const key of Object.keys(player.legalRep ?? {})) {
    const v = player.legalRep[key];
    if (v < 0) player.legalRep[key] = v + 1;
    else if (v > 0) player.legalRep[key] = v - 1;
  }
  if (!store?.dict) return;
  for (const id of [...store.dict.keys()]) {
    const f = store.dict.get(id);
    if (!f) continue;
    if (f.rep < 0) changeReputation(store, f.id, 1);
    else if (f.rep > 0) changeReputation(store, f.id, -1);
  }
}

export function lowerRepForCrime(player, regionIndex, crime) {
  changeLegalRep(player, regionIndex, -REPUTATION_LOSS_PER_CRIME[crime]);
  // PlayerEntity.cs:2294-2298 - the region's People faction takes HALF
  // the legal loss, propagating out to its allies and enemies. The
  // negation sits OUTSIDE the division in DFU, `-(loss / 2)`, and the
  // division truncates toward zero, so an odd loss rounds toward the
  // player's favour by one point. Silent when the store is absent
  // (a host that never ran chargen) rather than throwing on a crime.
  const store = player?.factionRep;
  if (!store) return;
  const people = getPeopleOfCurrentRegion(store.dict, regionIndex);
  if (people) {
    changeReputation(store, people.id, -Math.trunc(REPUTATION_LOSS_PER_CRIME[crime] / 2), true);
  }
}

/** PlayerEntity.GoldPieces (:158). E4: THE COUNTER, not a bag stack -
 *  the port's collection can no longer hold Currency at all
 *  (systems/inventory.js's header carries the whole law). */
export function goldAmount(player) {
  return goldPiecesOf(player);
}
/** ItemCollection.GetCreditAmount (ItemCollection.cs:108-118): every
 *  letter of credit in the pack, by VALUE. U41: the travel popup's
 *  gold gate is DFU's GetGoldAmount, which is coins PLUS paper. */
export function creditAmount(player) {
  return (player.items ?? []).reduce(
    (sum, it) => (it.templateIndex === LETTER_OF_CREDIT_TEMPLATE ? sum + (it.value ?? 0) : sum), 0);
}
/** PlayerEntity.GetGoldAmount (:1313-1316) - what a purchase is
 *  tested against, where goldAmount alone is DFU's `goldPieces`. */
export function totalGoldAmount(player) {
  return goldAmount(player) + creditAmount(player);
}
/** `GoldPieces -= amount` (DeductFastTravelGold's first half,
 *  DaggerfallTravelPopUp.cs:471). Coins only, no letters: DFU's
 *  setter is unclamped and every caller gates on the amount first,
 *  so this mirrors it and floors at zero rather than minting a
 *  negative purse the port has no other way to hold. */
export function deductGoldPieces(player, amount) {
  if (!player) return;
  player.goldPieces = Math.max(0, goldPiecesOf(player) - amount);
}
/** PlayerEntity.DeductGoldAmount (:1324-1354), which the port had
 *  been standing in for with a clamp. Two halves were missing, and B1
 *  needed both:
 *
 *  - A LETTER OF CREDIT IS LEGAL TENDER. When the purse cannot cover
 *    a payment, DFU spends letters - whole ones first, then part of
 *    the last, writing the remainder back onto it (:1331-1341). So a
 *    character holding a 5000-gold letter and ten coins can pay a
 *    100-gold fine, which the clamp made impossible. Every caller in
 *    the tree is more correct for this: fines, guild donations,
 *    training, the tavern's room, the trade window's basket.
 *
 *  - IT RETURNS THE SHORTFALL, not nothing. An underpayment answers
 *    what it could not cover and leaves the purse at zero (:1347-1349);
 *    a full payment answers 0. B1's loan repayment is the first caller
 *    that reads it - the bank takes the remainder off the ACCOUNT, so
 *    one repayment can span purse, letters and account.
 *
 *  Note the ORDER, which is DFU's and is not the obvious one: the
 *  purse is tried first ONLY if it can cover the whole amount. If it
 *  cannot, the letters are spent FIRST and the purse is raided for
 *  what is left - so a small payment never breaks a large letter, but
 *  a large one takes the letters before the coins. */
export function deductGold(player, amount) {
  const purse = goldPiecesOf(player);
  if (amount <= purse) {
    player.goldPieces = purse - amount;
    return 0;
  }
  let owed = amount;
  const items = player.items ?? [];
  for (;;) {
    const loc = items.find((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE);
    if (!loc) break;
    if (owed < (loc.value ?? 0)) { loc.value -= owed; owed = 0; break; }
    owed -= loc.value ?? 0;
    items.splice(items.indexOf(loc), 1);
  }
  if (owed > 0) {
    if (owed <= purse) {
      player.goldPieces = purse - owed;
      return 0;
    }
    owed -= purse;
    player.goldPieces = 0;
    return owed;   // underpaid - the caller decides what covers the rest
  }
  return 0;
}
/** `playerEntity.GoldPieces += amount` - E3's sale proceeds and every
 *  other credit. E4 made it the counter's write; nothing lands in the
 *  pack, so a purse that grows past MaxEncumbrance is DFU's own
 *  outcome (the trade window weighs the coin BEFORE it pays and mints
 *  a letter of credit instead - tradeModes.sellProceeds). */
export function addGold(player, amount) {
  addGoldPieces(player, amount);
}

/** SurrenderToCityGuards, verbatim. setHealth1 is the host's vitals
 *  write. Returns true when the arrest goes to court. */
export function surrenderToCityGuards(player, regionIndex, voluntary, { setHealth1 = () => { player.health = Math.max(1, Math.min(player.health, 1)); }, dfRand = rand } = {}) {
  const legalRep = legalRepOf(player, regionIndex);
  if (player.health <= 0) return false;
  setHealth1();
  if (legalRep < -20 && !voluntary) return false;
  else if (legalRep < -20 || legalRep > 0) return true;
  else if ((dfRand() & 1) !== 0 && !voluntary) return false;
  return true;
}

/** The court's state-0 math. Returns { punishmentType, fine,
 *  daysInPrison } - the guild rescue arms (guildRescue above) run on
 *  this record before any plea. */
export function startCourt(player, regionIndex, crime, { rolls = Math.random, dfRand = rand } = {}) {
  // AUDIT 21 F6: HandleCourtLogic's FIRST statement, on every state -
  // "Close immediately if no crime assigned to player"
  // (DaggerfallCourtWindow.cs:109-114). Without it `crime - 1` is -1, the
  // penalty tables index undefined, the fine becomes NaN, and the player
  // is tried for nothing - then credited -1 legal reputation for serving
  // a sentence for a crime that never happened.
  if (!crime) return null;
  const crimeType = crime - 1;
  const legalRep = legalRepOf(player, regionIndex);
  let threshold1 = 0, threshold2 = 0;
  if (legalRep < 0) {
    threshold1 = Math.min(75, -legalRep);
    threshold2 = Math.min(75, Math.trunc(-legalRep / 2));
  }
  // Dice100.FailedRoll(t) = roll >= t.
  //
  // AUDIT 21 F5: C#'s `&&` SHORT-CIRCUITS. DFU writes
  //     if (Dice100.FailedRoll(threshold2) && Dice100.FailedRoll(threshold1))
  // so the second roll is drawn ONLY when the first fails. Drawing both
  // unconditionally consumed an extra number from the generator on every
  // court appearance, which shifts every later roll in the session - the
  // classic way a port stays "correct" per-expression and still desyncs.
  const failed2 = Math.floor(rolls() * 100) >= threshold2;
  const punishmentType = failed2 && Math.floor(rolls() * 100) >= threshold1 ? 2 : 0;

  let penaltyAmount = legalRep >= 0
    ? PENALTY_PER_LEGAL_REP_POINT[crimeType] * legalRep + BASE_PENALTY[crimeType]
    : BASE_PENALTY[crimeType] - PENALTY_PER_LEGAL_REP_POINT[crimeType] * legalRep;
  penaltyAmount = Math.min(MAX_PENALTY[crimeType], Math.max(MIN_PENALTY[crimeType], penaltyAmount));
  penaltyAmount = Math.trunc(penaltyAmount / 40);

  let fine = 0, daysInPrison = 0;
  for (let i = 0; i < penaltyAmount; i++) {
    if ((dfRand() & 1) !== 0) fine += 40;
    else daysInPrison += 3;
  }
  // AUDIT 26 F178: the fine clamp is GetGoldAmount - coins PLUS
  // letters (DaggerfallCourtWindow.cs:169) - and the payment spends
  // letters through deductGold, so the two agree. A defendant holding
  // a 5000-gold letter and ten coins pays the whole 400 fine instead
  // of ten coins and nine extra days.
  const gold = totalGoldAmount(player);
  if (gold < fine) {
    daysInPrison += Math.trunc((fine - gold) / 40);
    fine = gold;
  }
  return { punishmentType, fine, daysInPrison, crime, regionIndex };
}

/**
 * RaiseReputationForDoingSentence (PlayerEntity.cs:2301-2311).
 *
 * AUDIT 21 F1: this credited only the LEGAL channel. DFU credits BOTH -
 * legalRep by `half - 1`, and the region's People faction by
 * `(half - 1) / 2` - and lowerRepForCrime above already debits both. A
 * one-sided refund makes the faction channel a RATCHET: serve the
 * sentence for Murder and the People faction keeps the whole -10 where
 * DFU hands back +4, so a law-abiding player's standing only ever falls.
 *
 * DFU's own comment marks the second line as a probable classic bug
 * ("Classic changes reputation here by (1 - half) / 2"), and ports it
 * anyway. So do we: the sign is DFU's, not classic's.
 */
export function raiseRepForSentence(player, court) {
  const half = Math.trunc(REPUTATION_LOSS_PER_CRIME[court.crime] / 2);
  changeLegalRep(player, court.regionIndex, half - 1);

  const store = player?.factionRep;
  if (!store) return;                       // no store: same silence as the debit
  const people = getPeopleOfCurrentRegion(store.dict, court.regionIndex);
  if (people) {
    // `(half - 1) / 2`, truncating - the division is OUTSIDE the credit
    // exactly as the debit's negation is outside its own division.
    changeReputation(store, people.id, Math.trunc((half - 1) / 2), true);
  }
}

/** TEXT.RSC 8060, courtTextExecuted (DaggerfallCourtWindow.cs:37). */
export const TEXT_EXECUTED = 8060;

/** The Guilty plea (punishmentType 2): halve both, pay, serve or
 *  walk. Returns { outcome: 'prison'|'released'|'banished'|'executed', ... }.
 *
 *  AUDIT 21 F7: DFU's cascade is THREE-WAY, not two
 *  (GuiltyNotGuilty_OnButtonClick, :327-331):
 *      if (punishmentType != 0) { if (punishmentType == 1) state = 5;   // Execution
 *                                 else { fine >>= 1; ... } }
 *      else state = 4;                                                 // Banished
 *  The port tested only `=== 0` and let a 1 fall into the fine/prison arm,
 *  so an execution sentence would have been halved, charged and served.
 *
 *  It is unreachable: startCourt can only ever produce 0 or 2, which is
 *  DFU's own note at :279 ("Seems like an execution sentence can't be given
 *  in classic. It can't be given here, either."). Ported anyway, because an
 *  arm that is absent and an arm that is wrong read the same from the call
 *  site and only one of them is safe to build on. */
export function pleaGuilty(court, player) {
  if (court.punishmentType === 0) return { outcome: 'banished' };
  if (court.punishmentType === 1) return { outcome: 'executed' };
  court.fine >>= 1;
  court.daysInPrison >>= 1;
  deductGold(player, court.fine);
  if (court.daysInPrison > 0) return { outcome: 'prison', days: court.daysInPrison };
  raiseRepForSentence(player, court);
  return { outcome: 'released' };
}

/** The Not Guilty plea: Debate (Etiquette) or Lie (Streetwise).
 *  Returns { outcome: 'free'|'guilty' } - 'guilty' re-enters
 *  pleaGuilty-style resolution with the adjusted fine. */
export function pleaNotGuilty(court, player, useDebate, { rolls = Math.random } = {}) {
  const skillId = useDebate ? SKILLS.Etiquette : SKILLS.Streetwise;
  const playerSkill = skillValue(player, skillId);
  tallySkill(player, skillId, 1);
  const legalRep = legalRepOf(player, court.regionIndex);
  let chance = legalRep + Math.trunc((playerSkill + (player.stats?.personality ?? 50)) / 2);
  chance = Math.max(5, Math.min(95, chance));
  if (Math.floor(rolls() * 100) >= chance) {   // FailedRoll
    // The same three-way cascade, on the failed defense (:394-402).
    if (court.punishmentType === 0) return { outcome: 'banished' };
    if (court.punishmentType === 1) return { outcome: 'executed' };
    const roll = legalRep + (Math.floor(rolls() * 100) + 1);   // Dice100.Roll 1..100
    if (roll < 25) court.fine *= 2;
    else if (roll > 75) court.fine >>= 1;
    return { outcome: 'guilty' };
  }
  return { outcome: 'free' };
}

/** The found-guilty resolution AFTER a failed not-guilty plea (the
 *  state-2 path). VERBATIM QUIRK: classic/DFU deduct the fine ONLY on
 *  the guilty PLEA (DeductGoldAmount appears once, in that branch) -
 *  a failed not-guilty defense adjusts the fine but never charges it;
 *  the full days still serve. Preserved 1:1. */
export function resolveGuiltyVerdict(court, player) {
  if (court.daysInPrison > 0) return { outcome: 'prison', days: court.daysInPrison };
  raiseRepForSentence(player, court);
  return { outcome: 'released' };
}

/** AUDIT 17e F6 - PlayerGPS_OnExitLocationRect
 *  (PlayerEntity.cs:2449-2453): leaving the location rect clears the
 *  active crime. Nothing but the court cleared it before, so a player
 *  who simply walked out of town stayed "wanted" forever - the watch
 *  kept respawning and cityGuards' despawn law (gated on
 *  crimeCommitted) could never fire. */
export function clearCrimeOnLocationExit(entity) {
  // AUDIT 26 F062: the verbatim handler (PlayerEntity.cs:2449-2453) -
  // the EDGE detection moved to the host's PlayerLocationRectCheck
  // twin, exactly as DFU splits them: PlayerGPS raises exit once on
  // the rect transition, and this handler only clears.
  entity.crimeCommitted = 0;
}
