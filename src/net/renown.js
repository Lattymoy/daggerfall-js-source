// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RENOWN1 (2026-09-24) — RENOWN: online's own level, kept beside
// Daggerfall's and never in its place.
//
// Mac, bringing a friend's MMORPG pillars ("The Hybrid Leveling System
// ... a traditional EverQuest-style Adventuring Level ... which dictates
// total health, magicka"): "What if the leveling system was something
// seperate unique to online but compatible". Asked three things, Mac
// answered: the online health and magicka go "On top" of Daggerfall's,
// the curve is a long "Grind", and offline play earns "No" XP - "Plus
// having their level appear on the left side of character name and
// profile main menu + ingame profile". Then Mac named it: "Lets
// officially call this Renown" - it was built as the Adventuring Level,
// and every name in the code, on the wire and on screen says Renown.
// A player's Renown is a level ("Renown 12" in words), and beside a
// name it is the number alone, in a box (Mac: "Just have it read 12
// inside a box").
//
// ═══ WHAT IT IS, AND WHAT IT NEVER TOUCHES ═════════════════════════
//
// A TRACK PER CHARACTER, kept by the account service
// (server-account/src/renownTracks.js) and never in the save. RENOWN1
// kept a track a character; RENOWN-ACCOUNT (2026-09-28, Mac: "can you
// make sure renown is account based and not character based?") made it
// the account's for a day; RENOWN-CHAR (2026-09-29, Mac: "Can we make
// renown per character again") gave each character its own back -
// migration 0035: each track at what it held when Renown became the
// account's, plus everything the account earned while it was (Mac's
// choice, "Own + recent gains"), and a realm character with no track yet
// at those gains alone. RENOWN-ACCOUNT's slower grind stays (below).
// The Daggerfall character - its level, its skills, its health and magicka,
// the save file itself - is exactly what it was, offline and online, so
// a character can go back and forth between the two forever.
//
// Online, and only online, the level adds `renownBonus(level)` to the
// character's maximum health and magicka: a layer put on when
// the character comes online, taken off when it leaves, and never
// written to a save (systems/renownLayer.js).
//
// ═══ WHOSE WORD IT IS ══════════════════════════════════════════════
//
// XP is earned by the player's own client - a kill, a quest - because
// every kill online is already the client's own call. So the SERVICE
// holds the bounds: at most RENOWN_XP_REPORT_MAX a report and
// RENOWN_XP_HOUR_MAX an hour per ACCOUNT, across all its characters - a
// second character is not a second allowance. The LEVEL is the service's
// alone: it derives it from the character's total, signs it into the
// identity token (`lv`, net/identityToken.js), and the relay stamps it
// beside the name, so nobody's level over their head is their own word
// about themselves.
//
// PURE, and both ends import it: the account Worker bundles this file
// (account-deploy.yml's path filter is held to its import graph), and
// the client reads the same numbers. No clock, no DOM, no network.
// ═══════════════════════════════════════════════════════════════════

import { RENOWN_MAX } from './identityToken.js';

export { RENOWN_MAX };

/* ═══ THE CURVE ═══════════════════════════════════════════════════════
 *
 * EverQuest's shape: for a character new to Daggerfall the first levels
 * come in minutes, level 10 in an evening, level 20 in a few weeks of
 * evenings, and level 50 in hundreds of hours. The XP follows the level
 * of what was fought, and a class foe stands at the character's OWN
 * Daggerfall level (characters/enemy/enemyEntity.js), as does a quest's pay -
 * so a character that levelled offline climbed ten times faster online
 * (AUDIT RENOWN1 DATA-6), until RENOWN3 read every foe and quest against
 * the character's Renown (below), and RENOWN-ACCOUNT paid every source three
 * quarters of it (RENOWN_RATE_PCT): at Daggerfall level 30, Renown 10 is 79
 * kills and Renown 20 is 531 - 59 and 398 at the full rate, 19 and 228
 * before the ceiling. Offline play itself still earns nothing. THE CURVE
 * DID NOT MOVE: the grind is slower because every source pays less, never
 * because a level costs more. The total to reach level L, with n = L - 1:
 *
 *     10 * floor((n^3 * (n + 10) + 300 * n) / 30)
 *
 * INTEGER ARITHMETIC ONLY, and that is the reason for the shape rather
 * than a tidier `n ** 3.6`: a fractional power is rounded differently by
 * different engines, and the service, the relay and three browsers must
 * agree on every boundary to the unit. The largest intermediate is
 * about seven million, far inside a double's exact range.
 *
 *     level  2       100      level 20     68,200
 *     level  5       690      level 30    319,950
 *     level 10     5,510      level 40    972,770
 *     level 15    23,350      level 50  2,318,660
 */

/** The total XP a character needs to BE at `level` (level 1 needs none). */
export function renownXpFor(level) {
  const L = Math.max(1, Math.min(RENOWN_MAX, Math.trunc(Number(level) || 1)));
  const n = L - 1;
  return 10 * Math.floor((n * n * n * (n + 10) + 300 * n) / 30);
}

/** The most XP a track may hold: the total at the cap. Past it nothing
 *  more is kept, so the bar reads full rather than counting on forever. */
export const RENOWN_XP_MAX = renownXpFor(RENOWN_MAX);

/** The level a total makes: the highest level whose total it has reached. */
export function renownForXp(xp) {
  const x = Number.isFinite(xp) ? Math.max(0, Math.trunc(xp)) : 0;
  let L = 1;
  while (L < RENOWN_MAX && renownXpFor(L + 1) <= x) L++;
  return L;
}

/**
 * Where a total stands: its level, how far into that level it is, and
 * how much the level spans - what a bar draws. At the cap, `need` is 0
 * and `frac` is 1.
 */
export function renownProgress(xp) {
  const total = Number.isFinite(xp) ? Math.max(0, Math.min(RENOWN_XP_MAX, Math.trunc(xp))) : 0;
  const level = renownForXp(total);
  if (level >= RENOWN_MAX) return { level, xp: total, into: 0, need: 0, frac: 1 };
  const from = renownXpFor(level);
  const need = renownXpFor(level + 1) - from;
  const into = total - from;
  return { level, xp: total, into, need, frac: need > 0 ? into / need : 0 };
}

/* ═══ WHAT EARNS IT ═══════════════════════════════════════════════════
 *
 * A KILL is worth its foe's own level: RENOWN_KILL_XP_PER_LEVEL to the
 * level at the full rate, a rat 10 and a lich 200 - 7 and 150 at
 * RENOWN_RATE_PCT (below). The level is the one the game already rolled
 * for that foe (a monster's fixed level, a career foe's level off the
 * player's), so the XP follows what the fight really was. No "con"
 * colours: the curve already makes a small foe worth less and less of a
 * level.
 *
 * A QUEST is worth what its giver scaled it to: Daggerfall sizes a quest
 * to the character's own level, so the XP does too.
 *
 * RENOWN3 (2026-09-25, Mac: "a high level character shouldnt blow through
 * online levels"): BOTH ARE READ AGAINST THE CHARACTER'S RENOWN (the account's
 * while RENOWN-ACCOUNT stood, the character's again since RENOWN-CHAR). A career foe stands at the character's own
 * Daggerfall level, and a quest is sized to it, so a character that
 * levelled offline fought level-30 foes from its first minute online -
 * Renown 10 in 19 kills, Renown 20 in 228. Now a foe, and a quest, is read
 * at most RENOWN_OVER_MAX levels above the Renown: at Renown 1 a level-30
 * knight pays like a level-4 foe, and the ceiling rises with every level. A
 * character new to Daggerfall fights foes at or under the ceiling almost
 * from its first kill and earns what it did (fighting level-5 foes, one
 * kill more in 150 to Renown 10 and none in 1,844 to Renown 20: a level-5
 * foe is one over the ceiling at Renown 1); a Daggerfall level-30 character
 * takes 79 kills to Renown 10 and 531 to Renown 20. It still climbs faster
 * than one fighting level-5 foes (150 and 1,844) - a harder fight is worth
 * more, up to the ceiling - but not ten times faster. (Every count here is
 * at RENOWN-ACCOUNT's rate; at RENOWN3's full rate they were 59 and 398,
 * and 111 and 1,365.)
 *
 * RENOWN-ACCOUNT (2026-09-28, Mac: "reducing the accumulation of renown
 * from resources a bit. Want some more oomph to the grind"): EVERY SOURCE
 * PAYS RENOWN_RATE_PCT - three quarters - of what it paid. The rate is
 * taken in ONE place, `renownRate`, floored to a whole XP there and nowhere
 * else, so the client, the service and the relay agree to the unit
 * (INTEGER ARITHMETIC ONLY, the curve's own law): a kill's ten a level is
 * 7.5, so a level-3 foe pays 22 and a level-30 foe 225; a quest's 100 and
 * 40 a level are 75 and 30, whole already; a raid is three quests, so it
 * follows; the party's bonus rides on the kill's rated XP, so its base
 * follows too. A gate pays no Renown of its own - its foes are kills.
 *
 * A PARTY earns MORE per head, never a share: every partymate in the
 * room earns the whole kill, plus RENOWN_PARTY_BONUS_PCT a head beyond the
 * first - group play is where the big numbers are (the pillar's own
 * words: "Group play is the prime source for farming huge chunks").
 */
/** A kill's XP a foe level, at the full rate - RENOWN_RATE_PCT is taken after (renownKillXp). */
export const RENOWN_KILL_XP_PER_LEVEL = 10;
/** A foe's level is read up to here - Daggerfall's own foes stop near 21 and a career foe follows the player. */
export const RENOWN_KILL_LEVEL_MAX = 30;
/** A quest's XP, 100 and 40 a character level, at the full rate - RENOWN_RATE_PCT is taken after (renownQuestXp). */
export const RENOWN_QUEST_XP_BASE = 100;
export const RENOWN_QUEST_XP_PER_LEVEL = 40;
/** A quest's character level is read up to here, as a foe's is. */
export const RENOWN_QUEST_LEVEL_MAX = 30;
/** RENOWN3: a foe or a quest is read at most this many levels above the character's Renown. */
export const RENOWN_OVER_MAX = 3;
/** Each partymate in the room beyond the first adds this much to every kill, per cent. */
export const RENOWN_PARTY_BONUS_PCT = 10;
/** The most partymates the bonus counts - the party's own seats. */
export const RENOWN_PARTY_COUNT_MAX = 8;
/** RENOWN-ACCOUNT: what every source pays, per cent of its full rate - three quarters, a slower grind. */
export const RENOWN_RATE_PCT = 75;

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/** RENOWN-ACCOUNT: THE RATE, TAKEN ONCE - a source's full-rate XP (a whole number) at RENOWN_RATE_PCT, FLOORED to a
 *  whole XP. The one rounding the rate makes, in the one place every source passes through, so every end agrees. */
export const renownRate = (fullXp) => Math.floor((Math.max(0, Math.trunc(Number(fullXp) || 0)) * RENOWN_RATE_PCT) / 100);

/** RENOWN3: the highest level a foe or a quest is read at for a character of Renown `renown` - RENOWN_OVER_MAX above it.
 *  A Renown not known yet (null) is Renown 1, the strictest: nothing is read higher than the service has said. */
export const renownCeiling = (renown) => clampInt(renown ?? 1, 1, RENOWN_MAX) + RENOWN_OVER_MAX;

/** A kill's XP, by the foe's level - read no higher than the Renown allows (RENOWN3), at the rate (RENOWN-ACCOUNT). */
export const renownKillXp = (foeLevel, renown = null) => renownRate(RENOWN_KILL_XP_PER_LEVEL * Math.min(clampInt(foeLevel, 1, RENOWN_KILL_LEVEL_MAX), renownCeiling(renown)));

/** A quest's XP, by the character's Daggerfall level when it was done - read no higher than the Renown allows (RENOWN3),
 *  at the rate (RENOWN-ACCOUNT): 75 and 30 a level. */
export const renownQuestXp = (characterLevel, renown = null) => renownRate(RENOWN_QUEST_XP_BASE + RENOWN_QUEST_XP_PER_LEVEL * Math.min(clampInt(characterLevel, 1, RENOWN_QUEST_LEVEL_MAX), renownCeiling(renown)));

/** RAID4 (2026-09-28, Mac on World Events - Raiding Parties online: "3. We can also add renown and it's own atheric +
 *  armor sets"): A TOWN DEFENDED - a raid's cleanse the relay signed for this account (net/raid/raidReceipt.js) - is worth
 *  RENOWN_RAID_QUESTS quests at the ladder's top quest level, read no higher than the Renown allows (RENOWN3's
 *  ceiling), at the quests' rate (RENOWN-ACCOUNT): Renown 1 takes 585, Renown 10 1,395, Renown 27 and up 2,925 (780,
 *  1,860 and 3,900 at the full rate). The account service credits it once a raid an account, to the Renown of the character that fought it,
 *  charged to the account's hour as a report is (AUDIT RAID R5, server-account/src/raids.js). */
export const RENOWN_RAID_QUESTS = 3;
export const renownRaidXp = (renown = null) => RENOWN_RAID_QUESTS * renownQuestXp(RENOWN_QUEST_LEVEL_MAX, renown);
/** SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): A SERPENT SLAIN - Sethrakul's kill the relay
 *  signed for this account (net/serpent/serpentReceipt.js) - is worth RENOWN_SERPENT_QUESTS quests at the ladder's top quest
 *  level, read no higher than the Renown allows, at the quests' rate: twice a town defended, for the Bay's rarest fight
 *  (one every four real hours). Credited once a serpent an account, to the character that fought it, charged to the
 *  account's hour (server-account/src/serpents.js). */
export const RENOWN_SERPENT_QUESTS = 6;
export const renownSerpentXp = (renown = null) => RENOWN_SERPENT_QUESTS * renownQuestXp(RENOWN_QUEST_LEVEL_MAX, renown);

/** A kill's XP with the party in the room counted: `present` is how many
 *  of the party are in the room, the player included (1 is alone). `xp`
 *  is the kill's own, already at the rate (renownKillXp) - the bonus's
 *  base, so the party's XP is at the rate too. */
export function renownPartyXp(xp, present) {
  const n = clampInt(present, 1, RENOWN_PARTY_COUNT_MAX);
  return Math.round((Math.max(0, Math.trunc(Number(xp) || 0)) * (100 + RENOWN_PARTY_BONUS_PCT * (n - 1))) / 100);
}

/* ═══ WHAT IT GIVES, ONLINE ═══════════════════════════════════════════
 *
 * "On top" (Mac): Daggerfall's own maximum health and magicka are what
 * they always were, and online the level ADDS to both. Level 1 adds
 * nothing, so a character with no track yet plays online exactly as it
 * plays offline; level 50 adds 147 health and 98 magicka.
 */
export const RENOWN_HP_PER_LEVEL = 3;
export const RENOWN_MP_PER_LEVEL = 2;

/** The health and magicka a level adds online. */
export function renownBonus(level) {
  const L = clampInt(level, 1, RENOWN_MAX);
  return { hp: RENOWN_HP_PER_LEVEL * (L - 1), mp: RENOWN_MP_PER_LEVEL * (L - 1) };
}

/* ═══ THE SERVICE'S BOUNDS ════════════════════════════════════════════
 *
 * THE CLIENT ASSERTS A NUMBER HERE, which ACC4 refused to let it do for
 * time played - and there is no clock that could measure a kill. So the
 * service bounds what a lying client can do with it instead: one report
 * carries at most RENOWN_XP_REPORT_MAX (a minute of the fiercest fighting a
 * group does, several times over), and an ACCOUNT earns at most
 * RENOWN_XP_HOUR_MAX in a clock hour - RENOWN-ACCOUNT took it from 20,000
 * to 15,000, a quarter off as every source is. A solo character or a small
 * party never meets that bound; a full party of eight against the fiercest
 * foes can (383 XP a kill at level 30 with the whole party's bonus - about
 * forty kills an hour), and that is the bound's price, paid by the
 * strongest play alone (AUDIT RENOWN1 DATA-6). A client that lies every
 * hour of every day still takes 155 hours (2,318,660 / 15,000) - about six
 * and a half days - of doing nothing else to reach the cap, because the
 * hour's window only moves FORWARD (renownTracks.js: a report stamped with
 * an hour already past is charged to the window that is open, never given
 * a fresh one - AUDIT RENOWN1 SEC-1/DATA-1).
 *
 * AN ACCOUNT HOLDS AT MOST RENOWN_TRACKS_MAX TRACKS, one a character
 * (RENOWN-CHAR brought the bound back with the tracks; RENOWN-ACCOUNT had
 * taken it, one track an account needing none).
 */
export const RENOWN_XP_REPORT_MAX = 5_000;
export const RENOWN_XP_HOUR_MAX = 15_000;
/** Tracks per account - one a character; a new character past this is refused (SAVES_MAX's reason: a bound on rows). */
export const RENOWN_TRACKS_MAX = 60;
/** A character's name as the service keeps it for the account card - display only, bounded. */
export const RENOWN_NAME_MAX = 32;
/** How often the client sends what it has earned - while its answer would say something the page cannot (SCALE4h,
 *  net/renownTracker.js renownReportSoon: a rise, the hour's bound, a total or a room not yet said). */
export const RENOWN_REPORT_MS = 60_000;
/** SCALE4h (2026-10-11, the plan's "10k writes"; bible/11-Multiplayer/Scale-Arc.md SCALE4h): HOW OFTEN IT GOES
 *  OTHERWISE. A fighter's report every minute was half the statements and half the rows a fighting player-hour wrote to
 *  the one primary (tools/hotWritesBench.mjs), and most of its answers said nothing the page did not know: the bar draws
 *  what is earned and not yet answered (ui/hud/hudRenown.js, the ghost), so the answer only moves the ghost into the fill. */
export const RENOWN_COALESCE_MS = 5 * 60_000;
/** AUDIT RENOWN1 DATA-4/GAME-9: A REPORT'S OWN NAME - sixteen hex digits the client draws once per report and sends
 *  again, unchanged, with every retry of that same report, so a report the service took whose answer was lost is
 *  answered again rather than credited twice. */
export const RENOWN_RID_RE = /^[0-9a-f]{16}$/;
/** A report id in its shape, or null (a client before the audit sends none, and is answered as it always was). */
export const renownRidOf = (rid) => (typeof rid === 'string' && RENOWN_RID_RE.test(rid) ? rid : null);

/* ═══ THE WORDS ═══════════════════════════════════════════════════════ */

/** The level as it sits left of a name - the number alone, which every face puts in a box (Mac: "Just have it read
 *  12 inside a box"): "12". Null for none. */
export function renownText(level) {
  if (!Number.isSafeInteger(level) || level < 1 || level > RENOWN_MAX) return null;
  return String(level);
}

/** A count with its thousands marked ("12,500") - the profile's row and the HUD's bar (ui/hud/hudRenown.js) alike. */
export const groupedXp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A track's progress in words: "1,234 / 5,510 XP to Renown 10", or "the highest there is" at the cap (AUDIT RENOWN1
 *  UI-6: the account card's row names the level before it - "Old Hand - Renown 50, Renown 50 - the highest" said it
 *  twice). */
export function renownProgressText(xp) {
  const p = renownProgress(xp);
  if (p.level >= RENOWN_MAX) return 'the highest there is';
  return `${groupedXp(p.into)} / ${groupedXp(p.need)} XP to Renown ${p.level + 1}`;
}
