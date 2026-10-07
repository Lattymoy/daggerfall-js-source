// REP (2026-09-29) - THE REPUTATION OVERHAUL: THE LAW'S TERMS, ONE HOME. Mac: "So I want to talk about overhauling the
// reputation system. Something just much better and not as punishing, but still punishing." His four calls, from the
// options put to him: the watch "Challenged on sight", a sentence "The charge, with a mark", banishment "Timed or
// pardoned", a bad name "Earn it + faster drift". A declared departure from Daggerfall Unity's crime law (Port-Doctrine
// lists crime/legal as ported 1:1): Port-Ledger A, REP1-REP6; bible/06-Systems/Standing-Arc.md.
//
// What each of DFU's laws became:
//   - PlayerEntity.cs:498-511 rolled a 5% Criminal Conspiracy EVERY GAME MINUTE for a legal standing under -10 (10% more
//     when banished): in a town the watch came about every hundred real seconds at the 12x clock, each arrest cost -2
//     and the sentence gave nothing back - a spiral with one exit, a point every 112 days. REP1: a guard who SEES a
//     known criminal stops them - pay a fine on the spot, come quietly, or refuse - with two game hours between stops in
//     a region and a game day's grace once the law has been answered (a fine paid, a sentence served, an acquittal).
//   - RaiseReputationForDoingSentence gave back half the loss less one. REP2 (court.js sentenceRefund): the charge comes
//     back; an Assault, a Murder or a Treason keeps half as a mark. A crime is charged once per chase, and a surrender is
//     taken unless a watchman fell to the player in it.
//   - Banishment could follow any sentence below zero, for ever. REP3: a Murder's or a Treason's alone (court.js
//     BANISHABLE_CRIMES), lifting after thirty days of the world's calendar or with a pardon bought at a temple - a
//     sanctuary the watch does not enter.
//   - NormalizeReputations: a point toward zero every 112 days. REP4: a standing below zero recovers a point every seven
//     (court.js RECOVERY_INTERVAL_MINUTES); a temple's penance buys back five points of a region's law at a price that
//     rises with every one bought there; a bounty contract finished pays two.
//
// Node-pure: every clock read is the caller's `now` - the character's own minutes for the watch's stops and graces
// (LIVED1: the standing is the character's), the WORLD's for a banishment's term (a sentence of the realm, on its
// calendar, whether or not the player plays). BANISH-SKY: the term is thirty days of the calendar the player SEES -
// online the sky's (about thirty real hours since SKY-SLOW), stamped on the world's event clock as every term is, and
// measured across with the sky's own law (skyCalendar.js, which the shared clock switches on with the sky it installs).
import { CRIMES } from './crimes.js';
import {
  legalRepOf, changeLegalRep, LEGAL_REP_MAX, BASE_PENALTY, PENALTY_PER_LEGAL_REP_POINT, MIN_PENALTY, MAX_PENALTY,
} from './court.js';
import { SEVERE_PUNISHMENT_BANISHED } from './encounters.js';
import { skyMinuteOfEvent, eventMinuteOfSky } from './skyCalendar.js';   // BANISH-SKY: the calendar the player sees, against the event clock's stamps

/** DFU's own line (PlayerEntity.cs:500, `LegalRep < -10`): below it the watch knows your face. */
export const KNOWN_CRIMINAL_BELOW = -10;
/** Two game hours between the watch's stops in one region - ten real minutes at the 12x clock. */
export const CHALLENGE_COOLDOWN_MINUTES = 120;
/** A game day's grace once the law has been answered: nobody stops a criminal on the courthouse steps. */
export const CHALLENGE_GRACE_MINUTES = 1440;
/** A banishment's term: thirty days of the world's calendar - offline DFU's one clock; online the days of the sky the
 *  player sees (BANISH-SKY, banishmentEnd below). */
export const BANISHMENT_MINUTES = 30 * 1440;
/**
 * BANISH-SKY (2026-10-07, bible/06-Systems/Online-Waits.md WAIT4; Mac: "Take care of this", over the sweep of the waits
 * still long online). REP3's thirty days were counted on the world's event clock (TimeScale 12): sixty real hours. But
 * the calendar every menu shows online is the sky's (TIME1), whose day is one real hour since SKY-SLOW - so a player told
 * "banished for 28 more days" watched twenty-eight days go by on the calendar and was still banished for as long again.
 * The term is now thirty days of the calendar the player sees: stamped, as every term, in the event clock's minutes
 * (TIME's rule - no stamp is taken on the sky), at the event minute the sky reads thirty days on - measured with the
 * sky's own law (skyCalendar.js), so it is exact across any change of the sky's rate (AUDIT WAITS B4: a rate read at
 * the stamp would have sized a term begun near a switch on the wrong rate). With no sky standing - offline, or a shared
 * clock installed without one - the calendar is the one clock: REP3's thirty days whole.
 */
export const banishmentEnd = (worldNow) => eventMinuteOfSky(skyMinuteOfEvent(worldNow) + BANISHMENT_MINUTES);
/** BANISH-SKY: a thousandth of a game minute - the two laws' round trip is exact to a few millionths, and a days-left
 *  count must not read 31 at the stamp for the float's sake. */
const CALENDAR_EPSILON_MINUTES = 1e-3;
/** A temple's penance: five points of a region's law back toward zero, never past it. */
export const PENANCE_POINTS = 5;
/** The first penance's price in a region; the nth costs n times it. */
export const PENANCE_BASE_PRICE = 200;
/** The first pardon's price in a region; the nth costs n times it. */
export const PARDON_BASE_PRICE = 2500;
/** A bounty contract finished for a region's board: its law thinks two points better of the hunter. */
export const CONTRACT_LEGAL_GAIN = 2;

/** The character's standing book - the watch's clocks and the prices paid, per region (saved: save.js); WATCH-KNOWS: and
 *  the minute the watch warned them for a first minor offence. */
export function standingOf(player) {
  if (!player.standing || typeof player.standing !== 'object') player.standing = {};
  const s = player.standing;
  for (const k of ['challengeAt', 'graceUntil', 'penance', 'pardons', 'warned']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  return s;
}
/** The save's copy: five plain maps. A pre-REP save restores empty; a pre-WATCH-KNOWS one, never warned. */
export function snapshotStanding(player) {
  const s = standingOf(player);
  return { challengeAt: { ...s.challengeAt }, graceUntil: { ...s.graceUntil }, penance: { ...s.penance }, pardons: { ...s.pardons }, warned: { ...s.warned } };
}
export function restoreStanding(player, snap) {
  player.standing = {};
  const s = standingOf(player);
  const num = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => Number.isFinite(v)));
  Object.assign(s.challengeAt, num(snap?.challengeAt));
  Object.assign(s.graceUntil, num(snap?.graceUntil));
  Object.assign(s.penance, num(snap?.penance));
  Object.assign(s.pardons, num(snap?.pardons));
  Object.assign(s.warned, num(snap?.warned));
  return s;
}

// ---- REP3: banishment, timed or pardoned ------------------------------------------------------------------------

/** Banish the character from a region for the calendar's thirty days (banishmentEnd; the court's state 4). The flag
 *  bit is DFU's own field (`SeverePunishmentFlags |= 1`), kept for the classic save and every reader of it. */
export function banish(player, regionIndex, worldNow) {
  const r = player.regionConditions?.[regionIndex];
  if (!r) return false;
  r.severePunishmentFlags |= SEVERE_PUNISHMENT_BANISHED;
  // AUDIT REP F2: an untrusted clock (worldTick.js trustedWorldMinutes' NaN) stamps nothing - the first trusted read does
  r.banishedUntil = Number.isFinite(worldNow) ? banishmentEnd(worldNow) : null;   // BANISH-SKY: the calendar's thirty days
  return true;
}
/** Lift a region's banishment (its term run out, or a pardon). */
export function liftBanishment(player, regionIndex) {
  const r = player.regionConditions?.[regionIndex];
  if (!r) return;
  r.severePunishmentFlags &= ~SEVERE_PUNISHMENT_BANISHED;
  r.banishedUntil = null;
}
/** Whether the character is banished from a region NOW (the world's minutes). A term that has run out is lifted here,
 *  on the first read past it. A banishment from before REP carries no term: it is given its thirty days from the first
 *  read, so a character banished for ever is free a month on. */
export function isBanished(player, regionIndex, worldNow) {
  const r = player.regionConditions?.[regionIndex];
  if (!r || (r.severePunishmentFlags & SEVERE_PUNISHMENT_BANISHED) === 0) return false;
  // AUDIT REP F2: the world's calendar not yet trusted (online, the relay unheard): banished, and nothing stamped or lifted
  if (!Number.isFinite(worldNow)) return true;
  if (!Number.isFinite(r.banishedUntil)) r.banishedUntil = banishmentEnd(worldNow);   // BANISH-SKY: the calendar's thirty days
  if (worldNow >= r.banishedUntil) { liftBanishment(player, regionIndex); return false; }
  return true;
}
/** The world's minutes a banishment has left, or 0. */
export function banishmentLeft(player, regionIndex, worldNow) {
  if (!isBanished(player, regionIndex, worldNow)) return 0;
  if (!Number.isFinite(worldNow)) return NaN;   // AUDIT REP F2: not known until the world's calendar is trusted
  return player.regionConditions[regionIndex].banishedUntil - worldNow;
}
/** BANISH-SKY: the days a banishment has left in the calendar the player sees (the sky's, online), rounded up - its last
 *  hour is still a day - 0 when none, NaN while the term is not known (AUDIT REP F2). The priest and the Standing page
 *  say these; the span is measured with the sky's law, end against now. */
export function banishmentDaysLeft(player, regionIndex, worldNow) {
  const left = banishmentLeft(player, regionIndex, worldNow);
  if (!Number.isFinite(left) || left <= 0) return left;
  const span = skyMinuteOfEvent(worldNow + left) - skyMinuteOfEvent(worldNow);
  return Math.max(1, Math.ceil((span - CALENDAR_EPSILON_MINUTES) / 1440));
}
export function pardonPrice(player, regionIndex) {
  return PARDON_BASE_PRICE * ((standingOf(player).pardons[regionIndex] ?? 0) + 1);
}
/** A pardon bought: the banishment lifted, the price's step taken, and the grace a sentence served gives. The caller
 *  takes the gold (the temple's counter). */
export function grantPardon(player, regionIndex, ownNow) {
  liftBanishment(player, regionIndex);
  const s = standingOf(player);
  s.pardons[regionIndex] = (s.pardons[regionIndex] ?? 0) + 1;
  grantGrace(player, regionIndex, ownNow);
}

// ---- REP1: the watch stops a known criminal ---------------------------------------------------------------------

/** A known criminal in a region: a standing under DFU's line, or a banishment standing. */
export function knownCriminal(player, regionIndex, { ownNow = 0, worldNow = ownNow } = {}) {
  return legalRepOf(player, regionIndex) < KNOWN_CRIMINAL_BELOW || isBanished(player, regionIndex, worldNow);
}
/** Whether the watch may stop the character now: a known criminal, no stop in the last two game hours, no grace
 *  standing. The host asks it before it looks for a guard who can see them. */
export function challengeDue(player, regionIndex, { ownNow, worldNow = ownNow }) {
  if (!knownCriminal(player, regionIndex, { ownNow, worldNow })) return false;
  const s = standingOf(player);
  if (ownNow < (s.challengeAt[regionIndex] ?? -Infinity) + CHALLENGE_COOLDOWN_MINUTES) return false;
  return ownNow >= (s.graceUntil[regionIndex] ?? -Infinity);
}
export function noteChallenge(player, regionIndex, ownNow) { standingOf(player).challengeAt[regionIndex] = ownNow; }
export function grantGrace(player, regionIndex, ownNow) { standingOf(player).graceUntil[regionIndex] = ownNow + CHALLENGE_GRACE_MINUTES; }
/** The fine the watch asks on the spot: the court's own Criminal Conspiracy penalty at this standing, every unit in coin
 *  and no days (the court would split it between both, and halve it for a guilty plea) - double for a banished one. */
export function challengeFine(player, regionIndex, { ownNow = 0, worldNow = ownNow } = {}) {
  const t = CRIMES.Criminal_Conspiracy - 1;
  const rep = Math.min(0, legalRepOf(player, regionIndex));
  const amount = Math.min(MAX_PENALTY[t], Math.max(MIN_PENALTY[t], BASE_PENALTY[t] - PENALTY_PER_LEGAL_REP_POINT[t] * rep));
  const fine = 40 * Math.trunc(amount / 40);
  return isBanished(player, regionIndex, worldNow) ? fine * 2 : fine;
}

// ---- WATCH-KNOWS: a first minor offence warned -------------------------------------------------------------------

/** WATCH-KNOWS: the minor offences the living world's watch warns a first offender for rather than arrests - a door tried,
 *  a trespass, a night in the street, a pocket picked: the court's least (BASE_PENALTY 100-300), none marked or
 *  banishable, the Thieves Guild's own petty three among them (court.js guildRescue). */
export const WARNABLE_CRIMES = Object.freeze([CRIMES.Attempted_Breaking_And_Entering, CRIMES.Trespassing, CRIMES.Vagrancy, CRIMES.Pickpocketing]);
/** Whether the watch warns rather than arrests for `crime` in a region: a minor offence, the character's first warned
 *  there, and no known criminal (whose face the watch knows - REP1). */
export function warningDue(player, regionIndex, crime, { ownNow = 0, worldNow = ownNow } = {}) {
  if (!WARNABLE_CRIMES.includes(crime)) return false;
  if (knownCriminal(player, regionIndex, { ownNow, worldNow })) return false;
  return !Number.isFinite(standingOf(player).warned[regionIndex]);
}
export function noteWarning(player, regionIndex, ownNow) { standingOf(player).warned[regionIndex] = ownNow; }

// ---- REP4: the road back ----------------------------------------------------------------------------------------

export function penancePrice(player, regionIndex) {
  return PENANCE_BASE_PRICE * ((standingOf(player).penance[regionIndex] ?? 0) + 1);
}
/** Whether a region's law has anything for a penance to mend. */
export const penanceHelps = (player, regionIndex) => legalRepOf(player, regionIndex) < 0;
/** A penance done: up to PENANCE_POINTS of a region's law back toward zero, and the price's step. The caller takes the
 *  gold. Answers the points given back. */
export function doPenance(player, regionIndex) {
  const rep = legalRepOf(player, regionIndex);
  const points = rep < 0 ? Math.min(PENANCE_POINTS, -rep) : 0;
  if (points) changeLegalRep(player, regionIndex, points, { kind: 'penance' });
  const s = standingOf(player);
  s.penance[regionIndex] = (s.penance[regionIndex] ?? 0) + 1;
  return points;
}
/** A bounty contract finished for a region's board: two points of its law, up to the band's top. Answers them. */
export function rewardContract(player, regionIndex) {
  const rep = legalRepOf(player, regionIndex);
  const points = Math.max(0, Math.min(CONTRACT_LEGAL_GAIN, LEGAL_REP_MAX - rep));
  if (points) changeLegalRep(player, regionIndex, points, { kind: 'contract' });
  return points;
}
