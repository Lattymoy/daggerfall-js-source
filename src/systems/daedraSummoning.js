// G7 - DAEDRA SUMMONING (DaggerfallQuestPopupWindow.DaedraSummoningService
// :166-300, MIT Daggerfall Workshop). The last of the twenty guild
// services whose destination was null, and the only one that is a
// CALENDAR: fifteen of the sixteen princes answer on exactly one day
// of the year, and on any other day the temple tells you to come back.
//
// THREE SUMMONERS, THREE DIFFERENT SELECTIONS, and they are not
// variations on a theme - they are three separate branches:
//
//   - THE GLENMORIL WITCHES always summon HIRCINE, on any day. DFU's
//     comment says this is "reversed from classic: this is
//     intentional", so the port keeps DFU's behaviour and records
//     that it is a deliberate divergence from the original game.
//   - ANY OTHER WITCHES COVEN summons a RANDOM prince, chosen once
//     per day and remembered: the roll is Range(1, length), which
//     EXCLUDES index 0 - so a coven can never draw Hircine, who is
//     Glenmoril's alone. The stored index and day live on the player.
//   - EVERYONE ELSE (temples, the Mages Guild) summons whoever's
//     summoning day it is, and nobody at all on the other 349.
//
// THE COST IS THE SUMMONER'S REPUTATION, INVERTED: 200000 - rep*1000.
// At rep 0 that is two hundred thousand gold; at the +100 ceiling it
// is a hundred thousand. This is the most expensive service in the
// game by two orders of magnitude and it is meant to be.
//
// SHEOGORATH GATECRASHES. Before the summoning roll, a 5% chance -
// 15% if it is storming - replaces whoever you called with him
// (index 8). You pay for the prince you asked for and get the Mad One
// instead, which is the joke.
//
// THE 30% BONUS IS A WEATHER TERM and reads backwards at first: it
// applies when the prince's `bonusCond` is None (so, most of them,
// always) or when it MATCHES the sky - Sanguine, Peryite, Boethiah
// and Nocturnal want rain, Sheogorath wants thunder. So the four
// rain-lovers and Sheogorath are the only ones the weather can
// PENALISE, by not being their weather.
//
// FLAGGED: the .FLC summoning videos (HIRCINE.FLC and its fifteen
// siblings) are the presentation half - DaggerfallDaedraSummoningWindow
// plays one behind the prince's greeting. The port carries the file
// names so the day that window lands there is nothing to look up.

import { FACTION_FLAGS } from './factionRep.js';
import { FACTION_TYPES, GUILD_GROUPS } from '../formats/factionFile.js';   // the one mirror of FactionFile's enums

/** The sixteen princes, in DFU's own array order - the order is
 *  load-bearing twice: index 0 is Hircine (Glenmoril's, and excluded
 *  from the coven roll) and index 8 is Sheogorath (the gatecrasher). */
export const DAEDRA = Object.freeze([
  { factionId: 4, quest: 'X0C00Y00', dayOfYear: 155, video: 'HIRCINE.FLC', bonusCond: null, name: 'Hircine' },
  { factionId: 1, quest: 'V0C00Y00', dayOfYear: 1, video: 'CLAVICUS.FLC', bonusCond: null, name: 'Clavicus Vile' },
  { factionId: 2, quest: 'Y0C00Y00', dayOfYear: 320, video: 'MEHRUNES.FLC', bonusCond: null, name: 'Mehrunes Dagon' },
  { factionId: 3, quest: '20C00Y00', dayOfYear: 350, video: 'MOLAGBAL.FLC', bonusCond: null, name: 'Molag Bal' },
  { factionId: 5, quest: '70C00Y00', dayOfYear: 46, video: 'SANGUINE.FLC', bonusCond: 'Rain', name: 'Sanguine' },
  { factionId: 6, quest: '50C00Y00', dayOfYear: 99, video: 'PERYITE.FLC', bonusCond: 'Rain', name: 'Peryite' },
  { factionId: 7, quest: '80C0XY00', dayOfYear: 278, video: 'MALACATH.FLC', bonusCond: null, name: 'Malacath' },
  { factionId: 8, quest: 'W0C00Y00', dayOfYear: 65, video: 'HERMAEUS.FLC', bonusCond: null, name: 'Hermaeus Mora' },
  { factionId: 9, quest: '60C00Y00', dayOfYear: 32, video: 'SHEOGRTH.FLC', bonusCond: 'Thunder', name: 'Sheogorath' },
  { factionId: 10, quest: 'U0C00Y00', dayOfYear: 302, video: 'BOETHIAH.FLC', bonusCond: 'Rain', name: 'Boethiah' },
  { factionId: 11, quest: '30C00Y00', dayOfYear: 129, video: 'NAMIRA.FLC', bonusCond: null, name: 'Namira' },
  { factionId: 12, quest: '10C00Y00', dayOfYear: 13, video: 'MERIDIA.FLC', bonusCond: null, name: 'Meridia' },
  { factionId: 13, quest: '90C00Y00', dayOfYear: 190, video: 'VAERNIMA.FLC', bonusCond: null, name: 'Vaernima' },
  { factionId: 14, quest: '40C00Y00', dayOfYear: 248, video: 'NOCTURNA.FLC', bonusCond: 'Rain', name: 'Nocturnal' },
  { factionId: 15, quest: 'Z0C00Y00', dayOfYear: 283, video: 'MEPHALA.FLC', bonusCond: null, name: 'Mephala' },
  { factionId: 16, quest: 'T0C00Y00', dayOfYear: 81, video: 'AZURA.FLC', bonusCond: null, name: 'Azura' },
]);
export const HIRCINE_INDEX = 0;
export const SHEOGORATH_INDEX = 8;
export const GLENMORIL_WITCHES = 419;
/** FactionFile.FactionTypes.WitchesCoven (:542) and
 *  FactionFile.GuildGroups.Witches (:593), from the one mirror of
 *  those enums - the callers pass a FACTION.TXT record's own type and
 *  ggroup, so these have to be the real 8 and 22 (6 is VampireClan,
 *  8 is the placeholder GGroup8). */
export const WITCHES_COVEN_TYPE = FACTION_TYPES.WitchesCoven;
export const WITCHES_GUILD_GROUP = GUILD_GROUPS.Witches;

/** The four TEXT.RSC records the summoner speaks (:28-31). */
export const SUMMON_TEXT = Object.freeze({
  notToday: 480, areYouSure: 481, before: 482, failed: 484,
});

/** The five daedric foes a FAILED coven summoning spawns (:70-72) -
 *  Range(0, 5) over a five-entry array, so every one is reachable. */
export const DAEDRIC_FOES = Object.freeze([
  'DaedraLord', 'DaedraSeducer', 'Daedroth', 'FireDaedra', 'FrostDaedra',
]);

/** FormulaHelper.CalculateDaedraSummoningCost (:1958-1965): the
 *  SUMMONER's reputation, inverted. Two hundred thousand at rep 0. */
export const summoningCost = (npcRep) => 200000 - (npcRep * 1000);
/** CalculateDaedraSummoningChance (:1967-1974): the PRINCE's own
 *  reputation with the player, plus the weather bonus, plus 30. */
export const summoningChance = (daedraRep, bonus) => 30 + daedraRep + bonus;

/**
 * Who answers, if anyone. `state` is the player's remembered coven
 * roll ({ daedraSummonIndex, daedraSummonDay }) and is MUTATED when a
 * coven re-rolls, exactly as DFU writes it onto PlayerEntity.
 *
 * Answers the DAEDRA record, or null for "not a summoning day".
 */
export function daedraForSummoner({
  factionId, factionType = null, dayOfYear = 0, state = null, rolls = Math.random,
} = {}) {
  // Glenmoril is tested by ID before the type test, so its witches
  // never reach the coven's random draw.
  if (factionId === GLENMORIL_WITCHES) return DAEDRA[HIRCINE_INDEX];
  if (factionType === WITCHES_COVEN_TYPE) {
    const s = state ?? {};
    // Range(1, length) EXCLUDES index 0 - a coven can never draw
    // Hircine. `|| index === 0` re-rolls a state that somehow holds
    // one, which is DFU's own guard against an unset field.
    if (s.daedraSummonDay !== dayOfYear || !s.daedraSummonIndex) {
      s.daedraSummonIndex = 1 + Math.floor(rolls() * (DAEDRA.length - 1));
      s.daedraSummonDay = dayOfYear;
    }
    return DAEDRA[s.daedraSummonIndex];
  }
  return DAEDRA.find((d) => d.dayOfYear === dayOfYear) ?? null;
}

/** The 30% weather term (:239-243). None means "always", so most
 *  princes always have it; the five with a condition only get it in
 *  their own sky. */
export function weatherBonus(daedra, { raining = false, storming = false } = {}) {
  if (!daedra?.bonusCond) return 30;
  if (daedra.bonusCond === 'Rain' && raining) return 30;
  if (daedra.bonusCond === 'Thunder' && storming) return 30;
  return 0;
}

/**
 * ConfirmSummon_OnButtonClick (:220-300), as a decision. The caller
 * has already asked "are you sure" and been told yes.
 *
 * Answers one of:
 *   { kind: 'poor', cost }                     - not enough gold, and
 *                                                DFU SAYS the number
 *   { kind: 'failed', cost, spawnFoes }        - the roll missed; a
 *                                                COVEN also spawns
 *                                                daedric foes on you
 *   { kind: 'greeting', daedra, cost, textId } - already summoned this
 *                                                prince before
 *   { kind: 'quest', daedra, cost, quest }     - the offer
 *
 * The gold is spent BEFORE the roll and is not refunded on a failure:
 * you paid for the summoning, not for the prince turning up.
 */
export function attemptSummoning({
  daedra, summonerRep = 0, summonerGuildGroup = null, gold = 0,
  daedraRep = () => 0, hasSummoned = () => false,
  raining = false, storming = false, rolls = Math.random,
} = {}) {
  const cost = summoningCost(summonerRep);
  if (gold < cost) return { kind: 'poor', cost };

  // Sheogorath's 5% (15% storming) hijack, rolled BEFORE the summoning
  // chance - so the chance that follows is HIS, not the one you paid
  // for (:230-237).
  const sheoChance = storming ? 15 : 5;
  const called = (Math.floor(rolls() * 100) + 1) <= sheoChance ? DAEDRA[SHEOGORATH_INDEX] : daedra;

  const bonus = weatherBonus(called, { raining, storming });
  const chance = summoningChance(daedraRep(called.factionId), bonus);
  const roll = Math.floor(rolls() * 100) + 1;   // Dice100.Roll(), 1..100
  if (roll > chance) {
    return {
      kind: 'failed', cost, daedra: called, chance, roll,
      // Only a WITCHES COVEN sets daedra on you for wasting its time.
      spawnFoes: summonerGuildGroup === WITCHES_GUILD_GROUP,
    };
  }
  if (hasSummoned(called.factionId)) {
    return { kind: 'greeting', daedra: called, cost, textId: SUMMON_TEXT.before };
  }
  return { kind: 'quest', daedra: called, cost, quest: called.quest, flag: FACTION_FLAGS.Summoned };
}
