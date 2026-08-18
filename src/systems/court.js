// G2: arrest + court (DFU PlayerEntity.SurrenderToCityGuards /
// LowerRepForCrime / DaggerfallCourtWindow, MIT Daggerfall Workshop).
// Node-pure verbatim math; the scene owns the windows and the clock.
//
// - Legal reputation is PER REGION (regionData[].LegalRep), init 0;
//   each crime charges reputationLossPerCrime (FALL.EXE values; the
//   People-faction half-delta FLAGGED to the save-side clone).
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
// FLAGGED loud: guild rescues (Thieves/Dark Brotherhood) pend the
// guilds arc; execution (punishmentType 1) is unreachable in classic
// and here; the prison time-skip rides the host clock callback;
// banishment's SeverePunishmentFlags consequences pend.

import { rand } from '../formats/dfRandom.js';
import { skillValue, tallySkill, SKILLS } from './skills.js';

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

export const legalRepOf = (player, regionIndex) => player.legalRep?.[regionIndex] ?? 0;
export function changeLegalRep(player, regionIndex, delta) {
  if (!player.legalRep) player.legalRep = {};
  player.legalRep[regionIndex] = (player.legalRep[regionIndex] ?? 0) + delta;
}

export function lowerRepForCrime(player, regionIndex, crime) {
  changeLegalRep(player, regionIndex, -REPUTATION_LOSS_PER_CRIME[crime]);
  // ChangeReputation(peopleFaction, -loss/2) FLAGGED: the save-side
  // faction clone pends; the regional LegalRep is the live state.
}

export function goldAmount(player) {
  return player.items?.find((it) => it.group === 'Currency')?.stackCount ?? 0;
}
export function deductGold(player, amount) {
  const stack = player.items?.find((it) => it.group === 'Currency');
  if (stack) stack.stackCount = Math.max(0, stack.stackCount - amount);
}
export function addGold(player, amount) {   // E3: sale proceeds
  player.items = player.items || [];
  const stack = player.items.find((it) => it.group === 'Currency');
  if (stack) stack.stackCount = (stack.stackCount ?? 0) + amount;
  else player.items.push({ group: 'Currency', name: 'Gold pieces', stackCount: amount });
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
 *  daysInPrison } (guild rescues FLAGGED). */
export function startCourt(player, regionIndex, crime, { rolls = Math.random, dfRand = rand } = {}) {
  const crimeType = crime - 1;
  const legalRep = legalRepOf(player, regionIndex);
  let threshold1 = 0, threshold2 = 0;
  if (legalRep < 0) {
    threshold1 = Math.min(75, -legalRep);
    threshold2 = Math.min(75, Math.trunc(-legalRep / 2));
  }
  // Dice100.FailedRoll(t) = roll >= t
  const failed2 = Math.floor(rolls() * 100) >= threshold2;
  const failed1 = Math.floor(rolls() * 100) >= threshold1;
  const punishmentType = failed2 && failed1 ? 2 : 0;

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
  const gold = goldAmount(player);
  if (gold < fine) {
    daysInPrison += Math.trunc((fine - gold) / 40);
    fine = gold;
  }
  return { punishmentType, fine, daysInPrison, crime, regionIndex };
}

/** RaiseReputationForDoingSentence, verbatim: +half the loss - 1. */
export function raiseRepForSentence(player, court) {
  const half = Math.trunc(REPUTATION_LOSS_PER_CRIME[court.crime] / 2);
  changeLegalRep(player, court.regionIndex, half - 1);
}

/** The Guilty plea (punishmentType 2): halve both, pay, serve or
 *  walk. Returns { outcome: 'prison'|'released'|'banished', ... }. */
export function pleaGuilty(court, player) {
  if (court.punishmentType === 0) return { outcome: 'banished' };
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
    if (court.punishmentType === 0) return { outcome: 'banished' };
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

/** AUDIT 17e F6 - PlayerGPS_OnExitLocationRect verbatim
 *  (PlayerEntity.cs:2449-2453): leaving the location rect clears the
 *  active crime. Nothing but the court cleared it before, so a player
 *  who simply walked out of town stayed "wanted" forever - the watch
 *  kept respawning and cityGuards' despawn law (gated on
 *  crimeCommitted) could never fire. Pass the previous and current
 *  location keys (null = wilderness, false = never synced).
 *  Returns true when the crime was cleared. */
export function clearCrimeOnLocationExit(entity, prevKey, nextKey) {
  if (prevKey === false || prevKey == null || nextKey === prevKey) return false;
  entity.crimeCommitted = 0;
  return true;
}
