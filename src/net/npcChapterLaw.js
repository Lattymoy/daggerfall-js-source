// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP1 (2026-10-07, Mac: "how could we split away from DFU, completely
// overhaul the NPC guild system and reputation system"; "This is mostly
// with online in mind"; his call, "Server-owned"; and on the rest, "You
// make the best decisions") — THE ROLL: a realm character's standing with
// Daggerfall's own guilds, kept by the account service. The record is
// bible/11-Multiplayer/Chapters-Arc.md, section 3 (CHAP0), and its audit
// bible/01-Overview/Audit-Chapters.md (AUDIT CHAP).
//
// WHAT IT HOLDS. A realm character's reputation with the twenty-two guild
// factions - the four guilds, the eight temples, the ten knightly orders
// (systems/guildFactions.js, the leaf) - and the guilds it is a member of,
// with its rank (as its client reports it, never past what the Roll's own
// reputation allows) and the moment the service first saw it a member.
// Every other faction stays the save's (CALL 1). Offline is DFU,
// untouched: nothing here is read by an offline character.
//
// WHOSE WORD, AND WHAT BOUNDS IT. A reputation moves on the client, by
// DFU's own law - a quest, a donation, a crime - and nothing a server saw.
// So the client CLAIMS what moved, and the service bounds it:
//   - A LOSS IS ALWAYS BELIEVED. A client that lies against itself is
//     believed (section 3.3).
//   - A GAIN IS PACED BY THE DAY: the day's NET rise of a faction is at
//     most ROLL_GAIN_DAY_MAX for one character, from every claim together
//     - three quests' worth, the spread included (CALL 2). What a claim
//     asks past it is OWED, not lost (AUDIT CHAP D2: S0000106 alone pays
//     +100 to twelve of the twenty-two), and the owed is credited at the
//     same pace on the days that follow, never past DFU's 100. A loss is
//     taken from what is owed first, then from the reputation, and a loss
//     gives its day's room back (D4: a crime and its penance on one day).
//     So the ceiling is a PACE: a lie is paid no faster than an honest
//     claim, and an honest reward arrives whole.
//   - A SEED, ONCE. The first contact carries the character's standing as
//     its save holds it - the client's word, like every claim. A
//     character brought in through customs from ROLL_EPOCH_S is seeded
//     with each faction capped at ROLL_CUSTOMS_CAP (CALL 3) - except a
//     guild it is a member of, which keeps what its rank needs
//     (RANK_REQ_REPUTATION; AUDIT CHAP D1: a cap that demoted the member
//     at its next review took the rank the arc promised it keeps). Every
//     other realm character - born online, or brought in before the epoch
//     - earned its standing online, and is seeded whole (C3).
// A seat (CHAP4) is decided by witnessed Merit (Seats-Arc law 3); what a
// claim can reach is the gate before it - a membership, its tenure, a
// standing - each bounded here.
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/npcRoll.js), which keeps the Roll, and the client
// (net/npcRollTracker.js), which claims and adopts. Pure: no clock, no
// DOM, no network.
// ═══════════════════════════════════════════════════════════════════

import { GUILD_FACTION_IDS, DIVINES, ORDERS, MIN_REPUTATION, MAX_REPUTATION, RANK_REQ_REPUTATION } from '../systems/guildFactions.js';
import { MARKS_RID_RE } from './marksLaw.js';

/** The twenty-two guild factions the Roll keeps, by id, ascending. */
export const ROLL_FACTIONS = Object.freeze([...Object.values(GUILD_FACTION_IDS), ...Object.values(DIVINES), ...Object.values(ORDERS)]
  .sort((a, b) => a - b));
const ROLL_SET = /** @type {Set<number>} */ (new Set(ROLL_FACTIONS));
/** One of the twenty-two. */
export const isRollFaction = (/** @type {unknown} */ id) => typeof id === 'number' && ROLL_SET.has(id);

/** The most a faction's reputation may RISE, net, in one UTC day for one character - three quests at DFU's +5. */
export const ROLL_GAIN_DAY_MAX = 15;
/** A character brought in through customs from the epoch is seeded capped here: rank 4's need (RANK_REQ_REPUTATION). */
export const ROLL_CUSTOMS_CAP = 40;
/** CHAP1's arrival, 2026-10-08 00:00 UTC: a customs crossing before it is seeded whole. Never moved once shipped. */
export const ROLL_EPOCH_S = 1_791_417_600;
/** The largest change one faction's line of a claim may carry - the whole span. */
export const ROLL_DELTA_MAX = MAX_REPUTATION - MIN_REPUTATION;
/** A rank as the Roll records it: Guild.cs's ten rows, 0 to 9. */
export const ROLL_RANK_MAX = RANK_REQ_REPUTATION.length - 1;
/** A client claims at most once in this long - reputation moves rarely, and the database is shared. */
export const ROLL_CLAIM_MS = 60_000;
/** A claim the network lost, or the service could not take, is asked again after this, doubling to the cap. */
export const ROLL_RETRY_MS = 30_000;
export const ROLL_RETRY_MAX_MS = 15 * 60_000;
/** The record of a claim's lines is kept this long, then pruned by the character's next claim (AUDIT CHAP S7). */
export const ROLL_EVENTS_KEEP_S = 90 * 86_400;

/** The mod-save vendor the last adoption rides the save under (AUDIT CHAP C1/C2/C4; systems/modSaveData.js). */
export const ROLL_KEPT_VENDOR = 'ChaptersRoll';

/** The switch (`CHAPTERS_OPEN`): off, dev (the developers alone) or on - as every online arc ships. */
export const CHAPTERS_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const chaptersSwitchOf = (/** @type {unknown} */ v) => (typeof v === 'string' && CHAPTERS_SWITCH.includes(v) ? v : 'off');

/** A claim's own id - the shape every act's request id takes (marksLaw.js MARKS_RID_RE) - or null. */
export const rollRidOf = (/** @type {unknown} */ rid) => (typeof rid === 'string' && MARKS_RID_RE.test(rid) ? rid : null);

const whole = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);
/** A reputation as the Roll holds one: whole, inside DFU's bounds and under `cap`. */
export const rollRep = (/** @type {unknown} */ v, cap = MAX_REPUTATION) => Math.max(MIN_REPUTATION, Math.min(cap, whole(v)));

/** The highest rank whose need (RANK_REQ_REPUTATION) a reputation meets - the most a member's rank can be by the Roll's
 *  own number (DFU's rank law asks the skills too, which are the client's; this is the half the service holds). */
export function rollRankCapOf(/** @type {unknown} */ rep) {
  const r = rollRep(rep);
  let rank = 0;
  for (let i = 0; i < RANK_REQ_REPUTATION.length; i++) if (r >= RANK_REQ_REPUTATION[i]) rank = i;
  return rank;
}

/** THE CAP A SEED IS TAKEN UNDER, from the realm character's own row: `origin` the offline id customs brought it from
 *  (null for one born online), `createdAt` when the realm made it. Only a customs crossing from the epoch is capped. */
export function rollSeedCapOf(/** @type {{ origin?: unknown, createdAt?: unknown }} */ row) {
  const crossed = typeof row?.origin === 'string' && row.origin !== '';
  const at = row?.createdAt;
  return crossed && !(typeof at === 'number' && Number.isSafeInteger(at) && at < ROLL_EPOCH_S) ? ROLL_CUSTOMS_CAP : MAX_REPUTATION;
}

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

/** THE SEED: every one of the twenty-two, as the save held it, under `cap` - and a guild the character is a member of
 *  (`ranks`, faction -> rank) never under what its rank needs. */
export function rollSeedOf(/** @type {Record<string, number>} */ values, cap = MAX_REPUTATION, /** @type {Map<number, number>} */ ranks = new Map()) {
  /** @type {Record<number, number>} */
  const out = {};
  for (const f of ROLL_FACTIONS) {
    const need = ranks.has(f) ? RANK_REQ_REPUTATION[Math.min(ROLL_RANK_MAX, Math.max(0, whole(ranks.get(f))))] : MIN_REPUTATION;
    out[f] = rollRep(values?.[f], Math.max(cap, need));
  }
  return out;
}

/** A Roll row's own day: the net change of `day` so far (0 on a new day), and what is owed (never negative). */
const dayOf = (/** @type {{ gainedDay: number, gained: number }} */ row, /** @type {number} */ day) => (row.gainedDay === day ? whole(row.gained) : 0);
/** What may still be owed over a reputation: never negative, never past DFU's 100. */
const owedUnder = (/** @type {number} */ rep, /** @type {number} */ owed) => (rep >= MAX_REPUTATION ? 0 : Math.max(0, Math.min(MAX_REPUTATION - rep, owed)));

/**
 * ONE FACTION'S LINE OF A CLAIM, credited: `row` the Roll's `{ rep, gainedDay, gained, owed }` (the day's net change so
 * far, on the UTC day `gainedDay`, and what is owed), `delta` what the client says moved, `day` today's UTC day. A loss
 * is taken from what is owed first, then whole from the reputation; a gain is credited what the day's room leaves, and
 * the rest owed. Answers the row after it, and `credited` - what the reputation actually moved.
 * @param {{ rep: number, gainedDay: number, gained: number, owed?: number }} row @param {number} delta @param {number} day
 */
export function rollCredit(row, delta, day) {
  const today = dayOf(row, day);
  const before = rollRep(row.rep);
  const owed = Math.max(0, whole(row.owed));
  if (delta < 0) {
    const fromOwed = Math.min(owed, -delta);
    const rep = rollRep(before + delta + fromOwed);
    return { rep, gainedDay: day, gained: today + (rep - before), owed: owedUnder(rep, owed - fromOwed), credited: rep - before };
  }
  const take = Math.min(delta, Math.max(0, ROLL_GAIN_DAY_MAX - today));
  const rep = rollRep(before + take);
  return { rep, gainedDay: day, gained: today + (rep - before), owed: owedUnder(rep, owed + (delta - take)), credited: rep - before };
}

/** WHAT IS OWED, PAID: as much of a row's owed as the day's room leaves, credited to its reputation. Answers the row
 *  after it and `credited`. */
export function rollDrain(/** @type {{ rep: number, gainedDay: number, gained: number, owed?: number }} */ row, /** @type {number} */ day) {
  const today = dayOf(row, day);
  const before = rollRep(row.rep);
  const owed = Math.max(0, whole(row.owed));
  const take = Math.min(owed, Math.max(0, ROLL_GAIN_DAY_MAX - today));
  const rep = rollRep(before + take);
  return { rep, gainedDay: day, gained: today + (rep - before), owed: owedUnder(rep, owed - take), credited: rep - before };
}

/** WHAT MOVED since the Roll's last word: `{ [faction]: change }`, the changed lines alone - and only for a faction both
 *  sides hold (AUDIT CHAP C5: a faction this client's FACTION.TXT has no row for is no loss of the Roll's number). */
export function rollDeltasOf(/** @type {Record<string, number>} */ current, /** @type {Record<string, number>} */ base) {
  /** @type {Record<number, number>} */
  const out = {};
  if (!current || !base) return out;
  for (const f of ROLL_FACTIONS) {
    if (!Object.hasOwn(current, f) || !Object.hasOwn(base, f)) continue;
    const d = rollRep(current[f]) - rollRep(base[f]);
    if (d !== 0) out[f] = d;
  }
  return out;
}

/**
 * THE SERVICE'S WORD, ADOPTED. `roll` the Roll's reputations as the answer gives them; `base` what the client last
 * adopted (or, for a first read, the standing it last adopted as the save kept it, or what it held when the page began);
 * `sent` the changes the answered claim carried; `current` what the client holds now. Whatever moved on the client
 * since `base` and was not sent is kept on top of the service's number - it is the next claim's. Answers `{ local, base }`:
 * the reputations to hold (only for the factions the client holds), and the new base (all twenty-two).
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
    next[f] = held;
    if (!current || !Object.hasOwn(current, f)) continue;
    const since = base && Object.hasOwn(base, f) ? rollRep(current[f]) - rollRep(base[f]) - whole(sent?.[f]) : 0;
    local[f] = rollRep(held + since);
  }
  return { local, base: next };
}

/** THE STANDING LAST ADOPTED, as the save keeps it (AUDIT CHAP C1/C2/C4): `{ seq, factions }` - the Roll's sequence it
 *  was adopted at and its twenty-two - normalised, or null for anything else. A first read whose Roll still stands at
 *  that sequence knows that whatever the save holds past it was never claimed. */
export function rollKeptOf(/** @type {unknown} */ rec) {
  if (!rec || typeof rec !== 'object') return null;
  const { seq, factions } = /** @type {any} */ (rec);
  if (!Number.isSafeInteger(seq) || seq < 0 || !rollSeedOk(factions)) return null;
  /** @type {Record<number, number>} */
  const out = {};
  for (const [k, v] of Object.entries(factions)) out[Number(k)] = v;
  return { seq, factions: out };
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
 * both books hold one, ascending by faction - or null with no store at all (nothing known: the Roll's stand). A record
 * at rank below 0 is no member (guilds.js isMember).
 * BOTH BOOKS, A RECORDED DEPARTURE (AUDIT CHAP D6): DFU's GuildManager reads the ACTIVE book alone, and a vampire's
 * mortal guilds are dormant there, not lost - a cure swaps them back. The Roll keeps their tenure running through the
 * curse, as the book keeps them; CHAP4's seat asks its own question of an active membership.
 * @param {any} store
 */
export function rollMembersOf(store) {
  if (!store || typeof store !== 'object') return null;
  const books = Object.hasOwn(store, 'mortal') && Object.hasOwn(store, 'vampire') ? [store.mortal, store.vampire] : [store];
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

/** The memberships as one comparable word - a claim is due when it changes; null (no book) is never a change. */
export const rollMembersKey = (/** @type {{ f: number, rank: number }[] | null} */ list) => (list ? list.map((m) => `${m.f}:${m.rank}`).join(',') : null);

/** A faction's name as a sentence carries it: FACTION.TXT's "The Mages Guild" mid-sentence is "the Mages Guild". */
export const rollFactionName = (/** @type {unknown} */ raw) => (typeof raw === 'string' && raw ? raw.replace(/^The /, 'the ') : 'the guild');
/** THE PACE SAID (AUDIT CHAP D2): a gain the day's room cut is owed, not lost - the line says the rest will follow. */
export const rollCeilingLine = (/** @type {unknown} */ raw) => `Your standing with ${rollFactionName(raw)} rises no further today. The rest will follow in the days to come.`;
