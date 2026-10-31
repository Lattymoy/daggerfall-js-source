// @ts-check
// HUNTERS-MARK and MARKS-OF-MASTERY (2026-10-27; a player, handed on by the owner: "Add more horizontal progression
// please!"; bible/06-Systems/Bounty-Boards.md section 12): THE HUNT'S LAW, both ends'. A paid bounty is reported to the
// account service and kept in its ledger; the hunter's rank is read off a character's clears, and its rewards are
// sideways - titles, a weekly named beast, a trophy, a little seat influence - never gear. Pure: no clock, no DOM.
import {
  BOUNTY_TIERS,
  BOUNTY_FULL_PURSE,
  BOUNTY_LEVEL_MAX,
  bountyTierIndex,
  parseBountyId,
  bountyHash,
  MINUTES_PER_DAY,
} from '../systems/bounty/bountyBoard.js';
import { sharedClassicMinutes, ONLINE_MINUTES_PER_MS, worldPixelOk } from './wire.js'; // SHIP AUDIT: a mark's town the world's pixel, as LAIR-WORLD's board notices
import { seatWeekOf } from './townSeatLaw.js';
import { PROFESSIONS } from './professionLaw.js';

// ─── THE HUNTER'S RANK ───────────────────────────────────────────────

/** The rungs, a character's board clears each needs. Named in the player's language by ui/bounty/huntRank.js. */
export const HUNT_RUNGS = Object.freeze([
  Object.freeze({ id: 'unblooded', at: 0 }),
  Object.freeze({ id: 'tracker', at: 5 }),
  Object.freeze({ id: 'hunter', at: 15 }),
  Object.freeze({ id: 'stalker', at: 40 }),
  Object.freeze({ id: 'slayer', at: 100 }),
  Object.freeze({ id: 'huntmaster', at: 250 }),
]);
const clearsOk = (n) => (Number.isSafeInteger(n) && n > 0 ? n : 0);
/** The rung a count of clears stands on, its index. */
export const huntRungOf = (clears) => HUNT_RUNGS.reduce((r, x, i) => (clearsOk(clears) >= x.at ? i : r), 0);
/** The next rung up, or null at the top. */
export const huntNextRung = (clears) => HUNT_RUNGS[huntRungOf(clears) + 1] ?? null;
/** The rung the board's named marks open at: the middle of the ladder, a Stalker. */
export const HUNT_MARK_RUNG = 3;
export const huntMarksOpen = (clears) => huntRungOf(clears) >= HUNT_MARK_RUNG;

// ─── WHAT THE SERVICE ACCEPTS ────────────────────────────────────────

/** Game days the event clock turns in a UTC day - a day every two real hours (wire.js ONLINE_MINUTES_PER_MS). */
export const GAME_DAYS_PER_UTC_DAY = Math.round((86_400_000 * ONLINE_MINUTES_PER_MS) / MINUTES_PER_DAY);
/** An account's clears a UTC day, every character's together. AUDIT HORIZONTAL F3: MEASURED, not four held a game day - a
 *  hunter clears, takes four more at the next of 410 boards, by horse or carriage. tools/huntPace.mjs walks the game's
 *  map at the fastest legal ride, no time fighting: its best of fourteen UTC days was 706, rounded up to the next fifty. */
export const HUNT_CLEARS_DAY_MAX = 750;
/** A clear reported later than this many game days after its notice was posted is refused (a real day's). */
export const HUNT_CLEAR_LATE_DAYS = GAME_DAYS_PER_UTC_DAY;
/** The event clock's game day at a wall instant - the day a board posts on online. */
export const huntGameDayAt = (nowMs) => Math.floor(sharedClassicMinutes(nowMs) / MINUTES_PER_DAY);
/** The week a named mark runs in: the seats' week, turned at the Turning. */
export const huntWeekAt = (nowMs) => seatWeekOf(nowMs);

/** A named mark's id: `m.<week>.<px>.<py>.<level>` - the week, the board's town and the taker's level. SHIP AUDIT
 *  (2026-10-27): the town's pixel the world's (net/wire.js worldPixelOk), as a board notice's (bountyBoard.js LAIR-WORLD) -
 *  a board past the Bay posted no mark, its id read as none. */
export const HUNT_MARK_ID_RE = /^m\.(\d{1,5})\.(-?\d{1,4})\.(-?\d{1,4})\.(\d{1,2})$/;
const clampLevel = (level) => Math.max(1, Math.min(BOUNTY_LEVEL_MAX, Math.trunc(Number(level) || 1)));
export const huntMarkId = (week, px, py, level) => `m.${week}.${px}.${py}.${clampLevel(level)}`;
/** A mark's id read back, or null. */
export function parseHuntMarkId(id) {
  const m = HUNT_MARK_ID_RE.exec(String(id ?? ''));
  if (!m) return null;
  const [week, px, py, level] = m.slice(1).map(Number);
  if (!worldPixelOk(px) || !worldPixelOk(py) || level < 1) return null;
  return { week, px, py, level };
}

/**
 * A REPORTED CLEAR, read against the clock: `{ kind, id, key, level, tier }` (`key` what one character clears once - a
 * board notice's slot, a mark's week; a mark's `week` too), or `{ why }`: 'id' (no bounty's shape), 'late' or 'early' (out of the clock's
 * window - a board's notice of a day the boards no longer post, a mark of a week gone).
 * @param {unknown} id @param {number} nowMs
 */
export function huntClearOf(id, nowMs) {
  const b = parseBountyId(id);
  if (b) {
    const today = huntGameDayAt(nowMs);
    if (b.day < today - HUNT_CLEAR_LATE_DAYS) return { why: 'late' };
    if (b.day > today + 1) return { why: 'early' };
    return { kind: 'board', id: String(id), key: b.slotKey, level: b.level, tier: bountyTierIndex(b.level) };
  }
  const m = parseHuntMarkId(id);
  if (!m) return { why: 'id' };
  const week = huntWeekAt(nowMs);
  if (m.week < week - 1) return { why: 'late' };
  if (m.week > week) return { why: 'early' };
  return {
    kind: 'mark',
    id: String(id),
    key: `m.${m.week}`,
    level: m.level,
    tier: bountyTierIndex(m.level),
    week: m.week,
  };
}

/** HOW FAR A CLEAR'S LEVEL MAY STAND FROM THE CHARACTER'S: a level the realm trusts (`seen` - realm_characters
 *  level_seen, the save's own), checked a checkpoint behind - a bounty taken at most two levels past it, and its tier
 *  no more than one below the character's. Unknown (no checkpoint judged yet): the shape and the clock bound it. */
export const HUNT_LEVEL_AHEAD = 2;
export function huntTierFits(level, seen) {
  if (!Number.isSafeInteger(seen) || seen < 1) return true;
  return level <= seen + HUNT_LEVEL_AHEAD && bountyTierIndex(level) >= bountyTierIndex(seen) - 1;
}

// ─── THE NAMED MARKS ─────────────────────────────────────────────────

/** The marks' given names - a beast is called "<name> the <beast>". The port's own, never translated (names). */
export const HUNT_MARK_NAMES = Object.freeze([
  'Grimtooth',
  'Ashmaw',
  'Scarneck',
  'Bloodhide',
  'Gorefang',
  'Hollowgut',
  'Nightclaw',
  'Rotmaw',
  'Stonehide',
  'Greymaw',
  'Mudjaw',
  'Ironback',
  'Blackmane',
  'Hookclaw',
  'Soot',
  'Rimefang',
]);
const SALT = Object.freeze({ beast: 0x6d1, name: 0x6d2, site: 0x6d3, traits: 0x6d4 });
/** The week's named beast of a level's tier: `{ tier, foe, name }` - one a tier a week, the same at every board. */
export function huntMarkOf(week, level) {
  const tier = bountyTierIndex(level);
  const foes = BOUNTY_TIERS[tier].foes;
  return {
    tier,
    foe: foes[bountyHash(week, tier, SALT.beast) % foes.length],
    name: HUNT_MARK_NAMES[bountyHash(week, tier, SALT.name) % HUNT_MARK_NAMES.length],
  };
}
/** The seed its traits are drawn from, the same on every client (systems/bossTraits.js rollBossTraits). */
export const huntMarkSeed = (week, tier) => bountyHash(week, tier, SALT.traits);
/** Where a board's mark lairs: one of the board's own open-ground sites (bountySites), the week's - or null. */
export const huntMarkSite = (week, px, py, sites) =>
  Array.isArray(sites) && sites.length ? sites[bountyHash(week, px, py, SALT.site) % sites.length] : null;
/** What a mark pays: three full packs' purse of its tier (BOUNTY-PURSE's), and a trophy - never a piece of kit. */
export const HUNT_MARK_PURSE_X = 3;
export const HUNT_MARK_TOP_PURSE = 200;
export const huntMarkGold = (level) => {
  const tier = bountyTierIndex(level);
  return HUNT_MARK_PURSE_X * (tier < BOUNTY_FULL_PURSE.length ? BOUNTY_FULL_PURSE[tier] : HUNT_MARK_TOP_PURSE);
};

// ─── THE TITLES (MARKS OF MASTERY) ───────────────────────────────────

/** The hunt's titles: the account's board clears, every character's together. */
export const HUNT_TITLES = Object.freeze(
  [
    ['bloodhound', 25],
    ['beastbane', 100],
    ['grandhuntsman', 300],
    ['huntlegend', 750],
  ].map((r) => Object.freeze(r)),
);
/** A title each profession's Master holds (rank 100 on a living character), in the professions' order. */
export const MASTERY_TITLES = Object.freeze(Object.fromEntries(PROFESSIONS.map((p) => [p.id, `master${p.id}`])));
/** Sailing's: the serpents an account helped slay at sea - the relay's own receipts (server-account/src/serpents.js). */
export const SEA_TITLES = Object.freeze(
  [
    ['serpenthunter', 10],
    ['deepbane', 40],
  ].map((r) => Object.freeze(r)),
);
/** WYRM-RIDER (2026-10-30, as the owner asked): a tamed Dwarven Dragon's -
 *  Wyrm Rider while the account holds a brass one, Aether Rider an Aetherbright (server-account dragon_mounts), and each
 *  First for the earliest tame of its look. The owner: "DONT COUNT ADMINS" - a developer's tame is never a First. */
export const DRAGON_TITLES = Object.freeze({
  rider: 'wyrmrider',
  first: 'firstwyrmrider',
  aether: 'aetherrider',
  firstAether: 'firstaetherrider',
});
/** Every title of this law, in TITLES' order (net/identityToken.js). */
export const MASTERY_MARKS = Object.freeze([
  ...HUNT_TITLES.map(([t]) => t),
  ...Object.values(MASTERY_TITLES),
  ...SEA_TITLES.map(([t]) => t),
  ...Object.values(DRAGON_TITLES),
]);

/** The titles an account holds off its counts: `clears` its board clears, `masters` the professions a living character
 *  of it has mastered, `serpents` its serpent kills, `dragons` and `aethers` its tamed brass and Aetherbright dragons, and
 *  `firstTame` and `firstAether` whether it holds the earliest of each (WYRM-RIDER). */
export function masteryMarksOf({
  clears = 0,
  masters = [],
  serpents = 0,
  dragons = 0,
  aethers = 0,
  firstTame = false,
  firstAether = false,
} = {}) {
  const out = [];
  for (const [t, n] of HUNT_TITLES) if (clearsOk(clears) >= n) out.push(t);
  for (const p of PROFESSIONS) if (Array.isArray(masters) && masters.includes(p.id)) out.push(MASTERY_TITLES[p.id]);
  for (const [t, n] of SEA_TITLES) if (clearsOk(serpents) >= n) out.push(t);
  if (clearsOk(dragons) >= 1) out.push(DRAGON_TITLES.rider);
  if (clearsOk(dragons) >= 1 && firstTame === true) out.push(DRAGON_TITLES.first);
  if (clearsOk(aethers) >= 1) out.push(DRAGON_TITLES.aether);
  if (clearsOk(aethers) >= 1 && firstAether === true) out.push(DRAGON_TITLES.firstAether);
  return out;
}
