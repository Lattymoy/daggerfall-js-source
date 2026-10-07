// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP1 (2026-10-07, Mac: "how could we split away from DFU, completely
// overhaul the NPC guild system and reputation system"; "This is mostly
// with online in mind"; his call, "Server-owned"; and on the rest, "You
// make the best decisions") — THE ROLL: a realm character's standing with
// Daggerfall's own guilds, kept by the account service. The record is
// bible/11-Multiplayer/Chapters-Arc.md, section 3 (CHAP0).
//
// WHAT IT HOLDS. A realm character's reputation with the twenty-two guild
// factions - the four guilds, the eight temples, the ten knightly orders
// (systems/guildFactions.js, the leaf) - and the guilds it is a member of,
// with the rank its client reports and the moment the service first saw
// it a member. Every other faction stays the save's (CALL 1). Offline is
// DFU, untouched: nothing here is read by an offline character.
//
// WHOSE WORD, AND WHAT BOUNDS IT. A reputation moves on the client, by
// DFU's own law - a quest, a donation, a crime - and nothing a server saw.
// So the client CLAIMS what moved, and the service bounds it:
//   - A LOSS IS ALWAYS BELIEVED. A client that lies against itself is
//     believed (section 3.3).
//   - A GAIN IS BOUNDED BY THE DAY: at most ROLL_GAIN_DAY_MAX a faction a
//     character a UTC day, from every claim together - three quests'
//     worth, the spread included (CALL 2). A claim past it is credited
//     what the day has left, and the service's number is the truth.
//   - A SEED, ONCE. The first contact carries the character's standing as
//     its save holds it. A character the realm made before ROLL_EPOCH_S
//     keeps it whole (what it earned online before the Roll); one made
//     since - born, or brought in through customs - keeps it capped at
//     ROLL_CUSTOMS_CAP (CALL 3), so an offline grind buys no seat.
// Nothing a rival loses reads any of it yet (Seats-Arc law 3): a seat
// (CHAP4) will ask the Roll's tenure and Merit, never a claim.
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/npcRoll.js), which keeps the Roll, and the client
// (net/npcRollTracker.js), which claims and adopts. Pure: no clock, no
// DOM, no network.
// ═══════════════════════════════════════════════════════════════════

import { GUILD_FACTION_IDS, DIVINES, ORDERS, MIN_REPUTATION, MAX_REPUTATION } from '../systems/guildFactions.js';
import { MARKS_RID_RE } from './marksLaw.js';

/** The twenty-two guild factions the Roll keeps, by id, ascending. */
export const ROLL_FACTIONS = Object.freeze([...Object.values(GUILD_FACTION_IDS), ...Object.values(DIVINES), ...Object.values(ORDERS)]
  .sort((a, b) => a - b));
const ROLL_SET = /** @type {Set<number>} */ (new Set(ROLL_FACTIONS));
/** One of the twenty-two. */
export const isRollFaction = (/** @type {unknown} */ id) => typeof id === 'number' && ROLL_SET.has(id);

/** The most a faction's reputation may RISE by claims in one UTC day, for one character - three quests at DFU's +5. */
export const ROLL_GAIN_DAY_MAX = 15;
/** A realm character made on or after the epoch is seeded capped here: rank 4's need (RANK_REQ_REPUTATION). */
export const ROLL_CUSTOMS_CAP = 40;
/** CHAP1's arrival, 2026-10-08 00:00 UTC: a realm character made before it is seeded whole. Never moved once shipped. */
export const ROLL_EPOCH_S = 1_791_417_600;
/** The largest change one faction's line of a claim may carry - the whole span. */
export const ROLL_DELTA_MAX = MAX_REPUTATION - MIN_REPUTATION;
/** A rank as the Roll records it: Guild.cs's ten rows, 0 to 9. */
export const ROLL_RANK_MAX = 9;
/** A client claims at most once in this long - reputation moves rarely, and the database is shared. */
export const ROLL_CLAIM_MS = 60_000;
/** A claim the network lost, or the service could not take, is asked again after this, doubling to the cap. */
export const ROLL_RETRY_MS = 30_000;
export const ROLL_RETRY_MAX_MS = 15 * 60_000;

/** The switch (`CHAPTERS_OPEN`): off, dev (the developers alone) or on - as every online arc ships. */
export const CHAPTERS_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const chaptersSwitchOf = (/** @type {unknown} */ v) => (typeof v === 'string' && CHAPTERS_SWITCH.includes(v) ? v : 'off');

/** A claim's own id - the shape every act's request id takes (marksLaw.js MARKS_RID_RE) - or null. */
export const rollRidOf = (/** @type {unknown} */ rid) => (typeof rid === 'string' && MARKS_RID_RE.test(rid) ? rid : null);

const whole = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);
/** A reputation as the Roll holds one: whole, inside DFU's bounds and under `cap`. */
export const rollRep = (/** @type {unknown} */ v, cap = MAX_REPUTATION) => Math.max(MIN_REPUTATION, Math.min(cap, whole(v)));

/** The cap a realm character's seed is taken under, from when the realm made it. */
export const rollSeedCapOf = (/** @type {unknown} */ createdAtS) =>
  (typeof createdAtS === 'number' && Number.isSafeInteger(createdAtS) && createdAtS < ROLL_EPOCH_S ? MAX_REPUTATION : ROLL_CUSTOMS_CAP);

/** A map a claim or a seed may carry: a plain object, every key one of the twenty-two (as its decimal), every value a
 *  safe integer `ok` accepts, at most twenty-two lines. */
function factionMapOk(/** @type {unknown} */ v, /** @type {(n: number) => boolean} */ ok, min = 0) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (keys.length < min || keys.length > ROLL_FACTIONS.length) return false;
  for (const k of keys) {
    const n = Number(k);
    if (String(n) !== k || !isRollFaction(n)) return false;
    const x = /** @type {any} */ (v)[k];
    if (typeof x !== 'number' || !Number.isSafeInteger(x) || !ok(x)) return false;
  }
  return true;
}
/** A seed's standing: any of the twenty-two, each inside DFU's bounds (a faction the save has none of is 0). */
export const rollSeedOk = (/** @type {unknown} */ v) => factionMapOk(v, (x) => x >= MIN_REPUTATION && x <= MAX_REPUTATION);
/** A claim's changes: one to twenty-two lines, none 0, none past the span. */
export const rollDeltasOk = (/** @type {unknown} */ v) => factionMapOk(v, (x) => x !== 0 && Math.abs(x) <= ROLL_DELTA_MAX, 1);

/** THE SEED: every one of the twenty-two, as the save held it, under `cap`. */
export function rollSeedOf(/** @type {Record<string, number>} */ values, cap = MAX_REPUTATION) {
  /** @type {Record<number, number>} */
  const out = {};
  for (const f of ROLL_FACTIONS) out[f] = rollRep(values?.[f], cap);
  return out;
}

/**
 * ONE FACTION'S LINE OF A CLAIM, credited: `row` the Roll's `{ rep, gainedDay, gained }` (the day's gains so far, on the
 * UTC day `gainedDay`), `delta` what the client says moved, `day` today's UTC day. A loss is taken whole; a gain only
 * what the day has left. Answers the row after it, and `credited` - what the reputation actually moved.
 * @param {{ rep: number, gainedDay: number, gained: number }} row @param {number} delta @param {number} day
 */
export function rollCredit(row, delta, day) {
  const today = row.gainedDay === day ? Math.max(0, whole(row.gained)) : 0;
  const before = rollRep(row.rep);
  if (delta < 0) {
    const rep = rollRep(before + delta);
    return { rep, gainedDay: day, gained: today, credited: rep - before };
  }
  const want = Math.min(delta, Math.max(0, ROLL_GAIN_DAY_MAX - today));
  const rep = rollRep(before + want);
  return { rep, gainedDay: day, gained: today + (rep - before), credited: rep - before };
}

/** WHAT MOVED since the Roll's last word: `{ [faction]: change }`, the changed lines alone. */
export function rollDeltasOf(/** @type {Record<string, number>} */ current, /** @type {Record<string, number>} */ base) {
  /** @type {Record<number, number>} */
  const out = {};
  for (const f of ROLL_FACTIONS) {
    const d = rollRep(current?.[f]) - rollRep(base?.[f]);
    if (d !== 0) out[f] = d;
  }
  return out;
}

/**
 * THE SERVICE'S WORD, ADOPTED. `roll` the Roll's reputations as the answer gives them; `base` what the client last
 * adopted (or what it held when it asked, for a first read); `sent` the changes the answered claim carried; `current`
 * what the client holds now. Whatever moved on the client while the claim was out is kept on top of the service's
 * number - it is the next claim's. Answers `{ local, base }`: the reputations to hold, and the new base.
 * @param {Record<string, number>} current @param {Record<string, number>} base @param {Record<string, number>} sent
 * @param {Record<string, number>} roll
 */
export function rollAdopt(current, base, sent, roll) {
  /** @type {Record<number, number>} */
  const local = {};
  /** @type {Record<number, number>} */
  const next = {};
  for (const f of ROLL_FACTIONS) {
    const held = rollRep(roll?.[f]);
    const since = rollRep(current?.[f]) - rollRep(base?.[f]) - whole(sent?.[f]);
    next[f] = held;
    local[f] = rollRep(held + since);
  }
  return { local, base: next };
}

/** The faction a membership record names (guilds.js joinGuild's `guild`: a guild's name, `Temple:<divine>` or
 *  `Order:<order>`), or null. */
export function rollFactionOfGuild(/** @type {unknown} */ name) {
  if (typeof name !== 'string') return null;
  if (Object.hasOwn(GUILD_FACTION_IDS, name)) return /** @type {any} */ (GUILD_FACTION_IDS)[name];
  const m = /^(Temple|Order):([A-Za-z]+)$/.exec(name);
  if (!m) return null;
  const table = m[1] === 'Temple' ? DIVINES : ORDERS;
  return Object.hasOwn(table, m[2]) ? /** @type {any} */ (table)[m[2]] : null;
}

/**
 * THE MEMBERSHIPS A CLAIM CARRIES, off the entity's store (guilds.js newMembershipStore - both books, the mortal and the
 * vampire; a plain object is the mortal book alone): `[{ f, rank }]`, one line a guild faction, the higher rank where
 * both books hold one, ascending by faction. A record at rank below 0 is no member (guilds.js isMember).
 * @param {any} store
 */
export function rollMembersOf(store) {
  const books = store && typeof store === 'object'
    ? (Object.hasOwn(store, 'mortal') && Object.hasOwn(store, 'vampire') ? [store.mortal, store.vampire] : [store]) : [];
  /** @type {Map<number, number>} */
  const ranks = new Map();
  for (const book of books) {
    if (!book || typeof book !== 'object') continue;
    for (const m of Object.values(book)) {
      const f = rollFactionOfGuild(m?.guild);
      const rank = whole(m?.rank);
      if (f == null || !(rank >= 0)) continue;
      ranks.set(f, Math.max(ranks.get(f) ?? 0, Math.min(ROLL_RANK_MAX, rank)));
    }
  }
  return [...ranks].sort((a, b) => a[0] - b[0]).map(([f, rank]) => ({ f, rank }));
}

/** A memberships list a claim may carry: at most twenty-two lines, each a guild faction once, its rank 0..9. */
export function rollMembersOk(/** @type {unknown} */ v) {
  if (!Array.isArray(v) || v.length > ROLL_FACTIONS.length) return false;
  const seen = new Set();
  for (const m of v) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
    const { f, rank } = /** @type {any} */ (m);
    if (!isRollFaction(f) || seen.has(f)) return false;
    if (typeof rank !== 'number' || !Number.isSafeInteger(rank) || rank < 0 || rank > ROLL_RANK_MAX) return false;
    seen.add(f);
  }
  return true;
}

/** The memberships as one comparable word - a claim is due when it changes. */
export const rollMembersKey = (/** @type {{ f: number, rank: number }[]} */ list) => list.map((m) => `${m.f}:${m.rank}`).join(',');
