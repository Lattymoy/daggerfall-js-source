// CG2 - THE CRIME-GUILD TALLY: the road into the Thieves Guild and the
// Dark Brotherhood. PlayerEntity.TallyCrimeGuildRequirements
// (:1271-1299) and HandleStartingCrimeGuildQuests (:1503-1522), 1:1
// from Daggerfall Unity (MIT, Daggerfall Workshop).
//
// Neither guild is joined by asking - G2 pinned that
// (DaggerfallGuild's join arm throws NotImplementedException for both,
// because classic invites you). THIS is how the invitation is earned:
// every theft and every murder the player commits adds to a running
// tally, and crossing the threshold stamps a clock three days out. When
// that clock runs down - and only while the player is OUTSIDE - the
// initiation quest starts and the tally is parked at InviteSent so it
// can never fire twice.
//
// THE READER SHIPPED AND THE CONSUMER NEVER DID. formats/
// characterRecord.js has parsed all four fields since the .SAV work
// (0x211 timeForThievesGuildLetter, 0x21f/0x222 the two tallies) and
// systems/classicSave.js imports every one of them onto the entity - so
// a player importing a classic save at nine thefts arrived carrying a
// tally that nothing in the port would ever read again. Four live crime
// sites carried the missing call by name in their comments.
//
// This module is a LEAF on purpose. talk.js needs it for the pickpocket
// tally, and talk.js deliberately does not import court.js (court.js
// imports talk.js - its own comment says so), so the two faction ids
// live HERE and court.js re-exports them. A second declaration would
// trip the one-home ratchet and, worse, let the two drift.

/** FactionFile.FactionIDs (FactionFile.cs:91/:135). Declared here
 *  rather than in court.js so this module can stay a leaf; court.js
 *  re-exports them, so its public surface is unchanged. */
export const THIEVES_GUILD_FACTION_ID = 42;
export const DARK_BROTHERHOOD_FACTION_ID = 108;

/** ThievesGuild.InitiationQuestName / DarkBrotherhood's (:24 apiece). */
export const THIEVES_GUILD_INITIATION_QUEST = 'O0A0AL00';
export const DARK_BROTHERHOOD_INITIATION_QUEST = 'L0A01L00';

/** PlayerEntity.cs:94 - `private const int InviteSent = 100`. The
 *  tally is PARKED at this value once the quest line starts, and both
 *  gates test `!= InviteSent` rather than a bool, so a member who
 *  keeps stealing never re-arms the letter. */
export const INVITE_SENT = 100;

/** The thresholds (:1279, :1292) - thefts to 10, murders to 15. */
export const THIEVES_GUILD_TALLY_TARGET = 10;
export const DARK_BROTHERHOOD_TALLY_TARGET = 15;

/** :1282/:1295 - `currentMinutes + 4320`, three classic days. */
export const CRIME_GUILD_LETTER_DELAY_MINUTES = 4320;

/** The four entity fields, defaulted the way PlayerEntity.cs:90-93
 *  declares them (all zero). A classic import overwrites them. */
export function crimeGuildDefaults() {
  return {
    timeForThievesGuildLetter: 0,
    timeForDarkBrotherhoodLetter: 0,
    thievesGuildRequirementTally: 0,
    darkBrotherhoodRequirementTally: 0,
  };
}

/**
 * TallyCrimeGuildRequirements (:1271-1299), verbatim.
 *
 * `thievingCrime` picks the guild: true is the Thieves Guild's theft
 * tally, false is the Dark Brotherhood's murder tally. `amount` is the
 * weight DFU's own call sites pass - a murdered civilian is 5, a
 * murdered guard is 1, every theft is 1.
 *
 * BOTH GATES ARE PRE-CONDITIONS ON THE WHOLE BLOCK, not on the stamp:
 * a tally already at InviteSent, or a letter already in flight
 * (`timeFor... == 0` is the "no letter pending" state), takes NOTHING.
 * So the tally freezes the moment the clock is set - a player who
 * steals ten more times while waiting does not shorten or extend the
 * wait, and the threshold test can only fire on the crossing.
 */
export function tallyCrimeGuildRequirements(entity, thievingCrime, amount, nowClassicMinutes = _clock()) {
  if (!entity || nowClassicMinutes == null) return false;
  if (thievingCrime) {
    // The `?? 0` is load-bearing, not defensive noise: the port mints
    // player entities lazily (systems/save.js reads every persistent
    // field with its own `?? 0`), so a fresh character reaches here
    // with these UNDEFINED where PlayerEntity.cs:90-93 declares them
    // zero. A bare `=== 0` gate reads false against undefined and would
    // have frozen the tally at zero for every new game - the guild
    // would have been unreachable except from a classic import.
    if ((entity.timeForThievesGuildLetter ?? 0) === 0
      && entity.thievesGuildRequirementTally !== INVITE_SENT) {
      entity.thievesGuildRequirementTally = (entity.thievesGuildRequirementTally ?? 0) + amount;
      if (entity.thievesGuildRequirementTally >= THIEVES_GUILD_TALLY_TARGET) {
        entity.timeForThievesGuildLetter = nowClassicMinutes + CRIME_GUILD_LETTER_DELAY_MINUTES;
        return true;
      }
    }
    return false;
  }
  if ((entity.timeForDarkBrotherhoodLetter ?? 0) === 0
    && entity.darkBrotherhoodRequirementTally !== INVITE_SENT) {
    entity.darkBrotherhoodRequirementTally = (entity.darkBrotherhoodRequirementTally ?? 0) + amount;
    if (entity.darkBrotherhoodRequirementTally >= DARK_BROTHERHOOD_TALLY_TARGET) {
      entity.timeForDarkBrotherhoodLetter = nowClassicMinutes + CRIME_GUILD_LETTER_DELAY_MINUTES;
      return true;
    }
  }
  return false;
}

// THE CLOCK, registered once. DFU's TallyCrimeGuildRequirements takes
// exactly two arguments and reads the world clock itself
// (`DaggerfallUnity.Instance.WorldTime.DaggerfallDateTime
// .ToClassicDaggerfallTime()`, :1281/:1294), so the port's call sites
// pass (thievingCrime, amount) and nothing else - which matters,
// because the four of them are a guard-kill, a weapon swing, a
// pickpocket window and a lockpick, and not one of them has any
// business holding a clock. Tests pass the minute explicitly through
// the fourth parameter; with no clock registered and no explicit
// minute the tally is INERT rather than stamping a letter at time
// zero, which would land three days into the epoch and never fire.
let _clock = () => null;
/** One call per host at boot: `() => classicMinutes`. */
export function setCrimeGuildClock(fn) { const prev = _clock; _clock = fn ?? (() => null); return prev; }

// The quest host, registered once (racialQuests.js's shape, and for the
// same reason: PlayerEntity.Update starts a quest, and the tick has no
// business carrying a quest machine through its arguments).
let _host = null;
/** One call per host at boot: `{ startQuest(name, factionId) }`. */
export function setCrimeGuildQuestHost(host) { const prev = _host; _host = host ?? null; return prev; }

/**
 * HandleStartingCrimeGuildQuests (:1503-1522), called from the tail of
 * PlayerEntity.Update's per-minute block (:531).
 *
 * Three conditions, all of them DFU's: the tally is not already
 * InviteSent, a letter IS pending (`> 0`), its clock has run down
 * (strictly `<` now), and the player is NOT inside. The inside gate is
 * why the letter never arrives in a dungeon - classic delivers it in
 * the street.
 *
 * WITHOUT A REGISTERED HOST THIS FIRES NOTHING AT ALL, and that is the
 * careful part rather than a shortcut. DFU's three effects are atomic:
 * park the tally, clear the clock, start the quest. A port that did the
 * first two with no quest machine mounted would mark the player
 * permanently invited to a guild whose initiation never ran - strictly
 * worse than waiting. So the pending letter simply stays pending until
 * a host can honour it.
 */
export function handleStartingCrimeGuildQuests(entity, { nowClassicMinutes, inside = false } = {}) {
  if (!entity || !_host?.startQuest || inside) return [];
  const started = [];
  if (entity.thievesGuildRequirementTally !== INVITE_SENT
    && (entity.timeForThievesGuildLetter ?? 0) > 0
    && entity.timeForThievesGuildLetter < nowClassicMinutes) {
    entity.thievesGuildRequirementTally = INVITE_SENT;
    entity.timeForThievesGuildLetter = 0;
    _host.startQuest(THIEVES_GUILD_INITIATION_QUEST, THIEVES_GUILD_FACTION_ID);
    started.push(THIEVES_GUILD_INITIATION_QUEST);
  }
  if (entity.darkBrotherhoodRequirementTally !== INVITE_SENT
    && (entity.timeForDarkBrotherhoodLetter ?? 0) > 0
    && entity.timeForDarkBrotherhoodLetter < nowClassicMinutes) {
    entity.darkBrotherhoodRequirementTally = INVITE_SENT;
    entity.timeForDarkBrotherhoodLetter = 0;
    _host.startQuest(DARK_BROTHERHOOD_INITIATION_QUEST, DARK_BROTHERHOOD_FACTION_ID);
    started.push(DARK_BROTHERHOOD_INITIATION_QUEST);
  }
  return started;
}
