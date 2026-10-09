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
// DFU's own law - a quest, a donation, a crime - and nothing a server saw
// (CHAP2a: but for a hall writ, whose units the Stores gave - the service
// credits HALL_WRIT_REP itself). So the client CLAIMS what moved, and the
// service bounds it:
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
//     at its next review took the rank the arc promised it keeps) and the
//     band above it up to its next rank's line (AUDIT CHAP2 D3: seeded on
//     the line, DFU's own 112-day drift demoted it at the review after),
//     never past ROLL_SEAT_LINE - 1 (CALL 3: the grind buys no seat - a
//     rank 8 or 9 crossing keeps 79, E6). Every
//     other realm character - born online, or brought in before the epoch
//     - earned its standing online, and is seeded whole (C3).
// A seat (CHAP4) is decided by witnessed Merit (Seats-Arc law 3); what a
// claim can reach is the gate before it - a membership, its tenure, a
// standing - each bounded here.
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/npcRoll.js, npcHalls.js, npcReceipts.js, npcMerit.js,
// npcChapters.js, professions.js - AUDIT CHAP3 R14), which
// keeps the Roll, the halls and their writs, and the client
// (net/npcRollTracker.js, npcHallBook.js, chapterSheet.js, the board, the
// halls' service windows), which claims, adopts, witnesses and prices. Pure: no clock, no DOM, no network. Every balance number
// lives here; the stores' own (CHAPTERS_KEPT_MS in npcHalls.js, the hall
// book's key and bound in npcHallBook.js) live with them.
// ═══════════════════════════════════════════════════════════════════

import { GUILD_FACTION_IDS, DIVINES, ORDERS, MIN_REPUTATION, MAX_REPUTATION, RANK_REQ_REPUTATION } from '../systems/guildFactions.js';
import { MARKS_RID_RE } from './marksLaw.js';
import { gateHash } from './gateLaw.js';   // CHAP2a: a hall writ's own dice
import { courtWrits, material, regionOk } from './nodeLaw.js';   // CHAP2a: the Court's writ law, the material families, a region
import { REGION_NAMES } from '../formats/mapsTables.js';   // CHAP4b: a seat's region, named
import { seatWeekOf, chronicleWhen, seatSeasonName } from './townSeatLaw.js';   // CHAP3a: Merit's week is the seats' (the Turning settles both); CHAP4d: the Chronicle's when; CHAP6a: a Season's name
import { GUILD_ID_RE, GUILD_NAME_MAX, GUILD_TAG_RE } from './guildLaw.js';   // CHAP7a: a patron is a player guild
import { MARKS_MAX } from './marksLaw.js';   // CHAP7a: a bid held under the one cap every treasury keeps
import { REALM_CHARACTER_RE } from './identityToken.js';   // CHAP3a: a member's own writ is drawn over its realm id

/** The membership books a character holds (systems/guilds.js: the mortal's and the vampire's), each one temple and one
 *  order at most. */
export const ROLL_BOOKS = 2;
const DIVINE_SET = /** @type {Set<number>} */ (new Set(Object.values(DIVINES)));
const ORDER_SET = /** @type {Set<number>} */ (new Set(Object.values(ORDERS)));
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
/** AUDIT CHAP4 C1: how long the tab holds the Roll's word on its seats with nothing to claim before it asks again - a
 *  Turning that unseats (or seats) the character is heard within it (the sheet's own beat, SHEET_KEPT_MS). */
export const ROLL_SEATS_MS = 10 * 60_000;
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

/** THE SEAT'S LINE: the reputation rank 8 needs - CHAP4's seats begin here, and nothing the Roll takes on a client's word
 *  alone carries a member past the line below it (CALL 3). */
export const ROLL_SEAT_LINE = RANK_REQ_REPUTATION[8];
/** What a member's rank keeps through the seed's cap (AUDIT CHAP D1, AUDIT CHAP2 D3): its rank's band up to the next
 *  rank's line, so DFU's own drift does not demote it at the review after - and never past the seat's line less one
 *  (AUDIT CHAP2 E6, Mac: "You can decide whatever is best"): a rank 8 or 9 crossing keeps 79 and is reviewed to rank 7,
 *  as section 3.5 holds everyone at CHAP4 - an offline grind buys no seat's reputation (CALL 3). */
export function rollRankKeepOf(/** @type {unknown} */ rank) {
  const r = Math.min(ROLL_RANK_MAX, Math.max(0, whole(rank)));
  const top = r < ROLL_RANK_MAX ? RANK_REQ_REPUTATION[r + 1] - 1 : MAX_REPUTATION;
  return Math.min(ROLL_SEAT_LINE - 1, Math.max(RANK_REQ_REPUTATION[r], top));
}
/** THE SEED: every one of the twenty-two, as the save held it, under `cap` - and a guild the character is a member of
 *  (`ranks`, faction -> rank) keeps what its rank keeps (rollRankKeepOf). */
export function rollSeedOf(/** @type {Record<string, number>} */ values, cap = MAX_REPUTATION, /** @type {Map<number, number>} */ ranks = new Map()) {
  /** @type {Record<number, number>} */
  const out = {};
  for (const f of ROLL_FACTIONS) {
    const need = ranks.has(f) ? rollRankKeepOf(ranks.get(f)) : MIN_REPUTATION;
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
 * curse, as the book keeps them. AUDIT CHAP4 D1: and says which are dormant - `d: 1` on a line the ACTIVE book (the
 * vampire's where `vampire`, else the mortal's) does not hold - so the service gives a dormant membership no Merit, no
 * member writ and no seat (the question CHAP4's seat was to ask of an active membership).
 * @param {any} store @param {boolean} [vampire]
 */
export function rollMembersOf(store, vampire = false) {
  if (!store || typeof store !== 'object') return null;
  const both = Object.hasOwn(store, 'mortal') && Object.hasOwn(store, 'vampire');
  const books = both ? [store.mortal, store.vampire] : [store];
  const active = both ? (vampire ? store.vampire : store.mortal) : store;
  /** @type {Map<number, number>} */
  const ranks = new Map();
  /** @type {Set<number>} the factions the active book holds */
  const awake = new Set();
  for (const book of books) {
    if (!book || typeof book !== 'object') continue;
    for (const m of Object.values(book)) {
      const f = rollFactionOfGuild(m?.guild);
      const rank = whole(m?.rank);
      if (f == null || !(rank >= 0)) continue;
      ranks.set(f, Math.max(ranks.get(f) ?? 0, Math.min(ROLL_RANK_MAX, rank)));
      if (book === active) awake.add(f);
    }
  }
  return [...ranks].sort((a, b) => a[0] - b[0]).map(([f, rank]) => (awake.has(f) ? { f, rank } : { f, rank, d: 1 }));
}

/** A memberships list a claim may carry: at most twenty-two lines, each a guild faction once, its rank 0..9. */
export function rollMembersOk(/** @type {unknown} */ v) {
  if (!Array.isArray(v) || v.length > ROLL_FACTIONS.length) return false;
  const seen = new Set();
  let temples = 0, orders = 0;
  for (const m of v) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
    const { f, rank, d } = /** @type {any} */ (m);
    if (!isRollFaction(f) || seen.has(f)) return false;
    if (typeof rank !== 'number' || !Number.isSafeInteger(rank) || rank < 0 || rank > ROLL_RANK_MAX) return false;
    if (d !== undefined && d !== 1) return false;   // AUDIT CHAP4 D1: a dormant line's mark, and only that
    if (DIVINE_SET.has(f)) temples++;
    if (ORDER_SET.has(f)) orders++;
    seen.add(f);
  }
  // AUDIT CHAP2 E3: DFU's book keeps ONE membership a guild group (guilds.js membershipKey) - one temple, one order - and
  // a character holds two books (the mortal's and the vampire's, AUDIT CHAP D6): never more than two of either
  return temples <= ROLL_BOOKS && orders <= ROLL_BOOKS;
}

/** The memberships as one comparable word - a claim is due when it changes; null (no book) is never a change. */
export const rollMembersKey = (/** @type {{ f: number, rank: number, d?: number }[] | null} */ list) => (list ? list.map((m) => `${m.f}:${m.rank}${m.d === 1 ? 'd' : ''}`).join(',') : null);   // AUDIT CHAP4 D1: a book's swap moves it

/** A faction's name as a sentence carries it: FACTION.TXT's "The Mages Guild" mid-sentence is "the Mages Guild". */
export const rollFactionName = (/** @type {unknown} */ raw) => (typeof raw === 'string' && raw ? raw.replace(/^The /, 'the ') : 'the guild');
/** THE PACE SAID (AUDIT CHAP D2): a gain the day's room cut is owed, not lost - the line says the rest will follow. */
export const rollCeilingLine = (/** @type {unknown} */ raw) => `Your standing with ${rollFactionName(raw)} rises no further today. The rest will follow in the days to come.`;

// ═══ CHAP2a - THE HALLS AND THEIR WRITS (Chapters-Arc section 4) ═════
//
// A CHAPTER is one of the twenty-two in one region where it keeps a hall. The servers never hold game data, so a hall
// is WITNESSED as a seat is (Seats-Arc 3.2, nodeLaw.js witnessedFact): a client standing in a town reports the halls it
// read off the town's own buildings - one report a location, `[mapId, region, factions]`, its factions the town's halls
// resolved to the twenty-two - and three registered accounts agreeing confirm it. A chapter's HALL WRITS are the
// Court's writ law (nodeLaw.js courtWrits) drawn from the chapter's own dice over the region's witnessed table, narrowed
// to the guild's own kinds of material; they share the Court's three a day (CALL 8) and pay as a Court writ pays, and a
// delivery credits HALL_WRIT_REP to the posting guild on the deliverer's Roll - a witnessed act, outside the claims' pace.

/** The witnessed fact's kind (world_witness.kind) - not `hall`, which `server-account/src/halls.js` keeps for the
 *  players' own guild halls (GUILD1d). */
export const HALL_WITNESS_KIND = 'npchall';
/** AUDIT CHAP2 E7: THE HALL LAW'S VERSION. A witness's first answer stands for ever, so a later rule (what counts as a
 *  hall, hallFactionsOf) is a new version - its reports a new key, the old ones read by nobody - never a split with them. */
export const HALL_REPORT_V = 1;
/** A town's witness key at this version: `1:<mapId>`. */
export const hallWitnessKey = (/** @type {number} */ mapId) => `${HALL_REPORT_V}:${mapId}`;
/** A hall report an account may send in an hour (the seats' own bound, SEAT_WITNESS_REPORTS_HOUR). */
export const HALL_WITNESS_HOUR = 24;
/** AUDIT CHAP2 E2: the claims a character's Roll takes in an hour - the tab sends one a minute at most, and a hall writ's
 *  refresh three a day; past it the claim is refused `roll-rate` and asked again later. */
export const ROLL_CLAIMS_HOUR = 120;
/** The reputation a delivered hall writ credits to its guild, on the deliverer's Roll. */
export const HALL_WRIT_REP = 2;
/** A chapter's writs a UTC day: two, scaled by the server's active accounts as the Court's are (CHAP2a narrowed the
 *  record's `courtWritCount`: a region can hold a dozen chapters, and six each would bury the Court's six). */
export const hallWritCount = (/** @type {unknown} */ active) => 2 * Math.max(1, Math.ceil(Math.max(0, Number(active) || 0) / 100));
/** A hall writ's own salt for gateHash - never the Court's (nodeLaw.js WRIT_SALT). */
export const HALL_WRIT_SALT = 0x4a11;
/** A hall writ's id: the day, the region, the guild faction and the slot. */
export const hallWritId = (/** @type {number} */ day, /** @type {number} */ region, /** @type {number} */ faction, /** @type {number} */ slot) => `h:${day}:${region}:${faction}:${slot}`;

/** THE KINDS OF MATERIAL A GUILD ASKS FOR (nodeLaw.js material families) - the port's own choice (CHAP2a; AUDIT CHAP4 D5:
 *  DFU's guilds trade in none of it, and its Mages Guild and two temples sell no potions at all): the Fighters Guild and
 *  the knightly orders arms and armour - metal and wood; the Mages Guild reagents - herbs and metal; the temples and the
 *  Dark Brotherhood herbs (remedies, and their poisons); the Thieves Guild whatever its fences can move. */
export function hallFamiliesOf(/** @type {number} */ faction) {
  if (faction === GUILD_FACTION_IDS.FightersGuild) return ['metals', 'wood'];
  if (faction === GUILD_FACTION_IDS.MagesGuild) return ['herbs', 'metals'];
  if (faction === GUILD_FACTION_IDS.ThievesGuild) return ['metals', 'herbs', 'wood', 'stone'];
  if (faction === GUILD_FACTION_IDS.DarkBrotherhood) return ['herbs'];
  if (/** @type {number[]} */ (Object.values(DIVINES)).includes(faction)) return ['herbs'];
  if (/** @type {number[]} */ (Object.values(ORDERS)).includes(faction)) return ['metals', 'wood'];
  return [];
}

/** THE HIDDEN TWO: the Thieves Guild's and the Dark Brotherhood's halls are kept from everyone but their members (DFU's
 *  ThievesGuild.cs/DarkBrotherhood.cs reveal them on joining), so their chapters' writs are posted to their members on
 *  the Roll alone. */
/** The hidden guilds' two factions - the Thieves Guild's and the Dark Brotherhood's (AUDIT CHAP4 S3: a query leaves them
 *  out before it counts, as `hallHidden` does after). */
export const HIDDEN_HALL_FACTIONS = Object.freeze([GUILD_FACTION_IDS.ThievesGuild, GUILD_FACTION_IDS.DarkBrotherhood]);
export const hallHidden = (/** @type {unknown} */ faction) => /** @type {readonly unknown[]} */ (HIDDEN_HALL_FACTIONS).includes(faction);

// ═══ CHAP2b - THE RECEIPTS' STANDING AND THE RECEIPT WRITS (Chapters-Arc 3.3, 4) ═══
//
// A gate closed or a raided town defended is relay-signed - a witnessed act. Where the region it stood in keeps a
// chapter of a guild the character is a member of on the Roll, the guild remembers it: RECEIPT_REP on the Roll (3.3),
// outside the claims' pace. And a chapter whose guild's row of section 4's table asks receipts posts that ask on the
// region's boards - "Hold the gate", "Defend a raided town" - which a member's first such receipt of the UTC day in the
// region fills for that member, HALL_WRIT_REP more: each member its own (AUDIT CHAP2 E4 - never a race), no Marks of
// its own (the receipt struck its silver), outside the three a day (it is the receipt's, bounded by the receipt's own
// day). A serpent's receipt names no region (section 11): no chapter's. The Thieves Guild asks none.

/** The receipt kinds a chapter may ask - a gate closed, a raided town defended. */
export const RECEIPT_KINDS = Object.freeze(['gate', 'raid']);
/** A receipt's standing with each guild of the character's that keeps a chapter where it stood (3.3). */
export const RECEIPT_REP = 1;
/** A guild's receipt asks, by section 4's table: the Fighters a raid and a gate, the Mages a gate, the Brotherhood's
 *  contract at a gate or a raid, the temples a gate, the orders a gate and a raid; the Thieves Guild none. */
export function hallReceiptKindsOf(/** @type {number} */ faction) {
  if (faction === GUILD_FACTION_IDS.FightersGuild) return ['gate', 'raid'];
  if (faction === GUILD_FACTION_IDS.MagesGuild) return ['gate'];
  if (faction === GUILD_FACTION_IDS.DarkBrotherhood) return ['gate', 'raid'];
  if (/** @type {number[]} */ (Object.values(DIVINES)).includes(faction)) return ['gate'];
  if (/** @type {number[]} */ (Object.values(ORDERS)).includes(faction)) return ['gate', 'raid'];
  return [];
}
/** A receipt's own credit's id: `gate:<day>` (a gate is one an account a day) or `raid:<key>` (one a raid an account). */
export const receiptRef = (/** @type {string} */ kind, /** @type {string | number} */ id) => `${kind}:${id}`;
/** A receipt writ's id for a member's UTC day: `wgate:<day>`, `wraid:<day>` - one a guild a member a day. */
export const receiptWritRef = (/** @type {string} */ kind, /** @type {number} */ day) => `w${kind}:${day}`;
/**
 * WHAT ONE RECEIPT CREDITS: `{ kind, id, day, members, chapters }` - the receipt's kind and own id, the UTC day, the
 * guild factions the character is a member of on the Roll and the guilds keeping a chapter in its region. Answers
 * `[{ faction, ref, amount }]`: RECEIPT_REP a member guild with a chapter there, and HALL_WRIT_REP more under the day's
 * writ where that guild asks this kind - each line kept once by its id.
 * @param {{ kind: string, id: string | number, day: number, members: number[], chapters: number[] }} o
 */
export function receiptCreditsOf({ kind, id, day, members, chapters }) {
  if (!RECEIPT_KINDS.includes(kind) || !Number.isSafeInteger(day)) return [];
  const here = new Set(chapters ?? []);
  const out = [];
  for (const f of [...new Set(members ?? [])].filter((x) => isRollFaction(x) && here.has(x)).sort((a, b) => a - b)) {
    out.push({ faction: f, ref: receiptRef(kind, id), amount: RECEIPT_REP });
    if (hallReceiptKindsOf(f).includes(kind)) out.push({ faction: f, ref: receiptWritRef(kind, day), amount: HALL_WRIT_REP });
  }
  return out;
}

/** The orders as DFU captions their halls (Internal_Strings en id 63 - systems/topicTree.js REGIONAL_BUILDING_NAMES). */
const ORDER_NAMES = Object.freeze({
  Raven: 'Order of the Raven', Dragon: 'Knights of the Dragon', Owl: 'Knights of the Owl', Candle: 'Order of the Candle',
  Flame: 'Knights of the Flame', Horn: 'Host of the Horn', Rose: 'Knights of the Rose', Wheel: 'Knights of the Wheel',
  Scarab: 'Order of the Scarab', Hawk: 'Knights of the Hawk',
});
/** A CHAPTER'S NAME on its writs - the guilds and orders as DFU's Talk captions their halls ("Mages Guild", "Knights of
 *  the Dragon"); a temple is the port's own label, its divine's whole name ("Temple of Zenithar" - AUDIT CHAP2 D5: DFU's
 *  caption cuts it to "Zen", and the town map names a temple by its templar order). Null for no guild faction. ORDER_NAMES
 *  repeats systems/topicTree.js REGIONAL_BUILDING_NAMES' ten (that module's graph is the client's, never the service's). */
export function hallPosterName(/** @type {number} */ faction) {
  if (faction === GUILD_FACTION_IDS.FightersGuild) return 'Fighters Guild';
  if (faction === GUILD_FACTION_IDS.MagesGuild) return 'Mages Guild';
  if (faction === GUILD_FACTION_IDS.ThievesGuild) return 'Thieves Guild';
  if (faction === GUILD_FACTION_IDS.DarkBrotherhood) return 'Dark Brotherhood';
  const divine = Object.keys(DIVINES).find((k) => DIVINES[/** @type {keyof typeof DIVINES} */ (k)] === faction);
  if (divine) return `Temple of ${divine}`;
  const order = Object.keys(ORDERS).find((k) => ORDERS[/** @type {keyof typeof ORDERS} */ (k)] === faction);
  return order ? ORDER_NAMES[/** @type {keyof typeof ORDER_NAMES} */ (order)] : null;
}

/** CHAP2b: the line a credited receipt says - "The Fighters Guild and the Knights of the Dragon will remember it." -
 *  or null where no guild is named. AUDIT CHAP3 C8: and the Merit its chapters counted it, where some - "..., 100 Merit
 *  to the chapters here." */
export function hallRememberLine(/** @type {number[]} */ factions, merit = 0) {
  const names = [...new Set(factions ?? [])].map(hallPosterName).filter(Boolean).map((n) => `the ${n}`);
  if (!names.length) return null;
  const said = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const m = Number.isSafeInteger(merit) && merit > 0 ? `, ${merit.toLocaleString('en-US')} Merit to ${names.length === 1 ? 'its chapter' : 'their chapters'} here` : '';
  return `${said.charAt(0).toUpperCase()}${said.slice(1)} will remember it${m}.`;
}

/**
 * A CHAPTER'S WRITS FOR THE DAY: `table` the region's witnessed writ table (nodeLaw.js regionWritTable), narrowed to the
 * guild's own kinds (the whole table where the region yields none of them), drawn by the Court's law from the chapter's
 * own dice. Each `{ slot, material, tier, units, pay, renown }`, as a Court writ is. CHAP4d: `focus` the week's Focus
 * its Master chose (chapterFocusOk) - every other writ, from the first, drawn from that family alone where the table
 * yields it, by the same slot's dice.
 * @param {number} day @param {number} region @param {number} faction @param {number} count @param {any[]} table @param {string | null} [focus]
 */
export function hallWrits(day, region, faction, count, table, focus = null) {
  if (!isRollFaction(faction) || !table?.length) return [];
  const families = hallFamiliesOf(faction);
  const own = table.filter((m) => families.includes(material(m.material)?.family));
  const from = own.length ? own : table;
  // AUDIT CHAP2 E5: the Court's law gives its slot 0 the table's top tier ("one a day of tier 5-6", PROF0 11) - a
  // chapter's two would have made every other hall writ that one, paying a quarter more than a Court writ. The day's top
  // writ stays the Court's: a chapter's writs are the Court's law's slots after it, renumbered from 0
  const dice = (/** @type {number} */ slot, /** @type {number} */ k) => gateHash(HALL_WRIT_SALT, day, region, faction, slot, k) / 4294967296;
  const drawn = courtWrits(day, region, count + 1, from, dice).slice(1);
  const focused = chapterFocusOk(faction, focus) ? table.filter((m) => material(m.material)?.family === focus) : [];
  const fw = focused.length ? courtWrits(day, region, count + 1, focused, dice).slice(1) : null;
  return drawn.map((w, i) => ({ ...(fw && i % 2 === 0 ? fw[i] : w), slot: i }));
}

/** A HALL REPORT, validated and made canonical: `{ key, region, factions }` - the location's map id (an unsigned 32-bit
 *  integer), its region, and its halls' factions, the twenty-two alone, each once, ascending, at least one - or null. */
export function hallReportOf(/** @type {any} */ raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { key, region, factions } = raw;
  if (!Number.isSafeInteger(key) || key < 0 || key > 0xffffffff || !regionOk(region)) return null;
  if (!Array.isArray(factions) || !factions.length || factions.length > ROLL_FACTIONS.length) return null;
  if (!factions.every(isRollFaction)) return null;
  const sorted = [...new Set(factions)].sort((a, b) => a - b);
  if (sorted.length !== factions.length) return null;
  return { key, region, factions: sorted };
}
/** A hall report's canonical bytes - one answer, one text, so witnesses agree byte for byte. */
export const hallReportText = (/** @type {{ key: number, region: number, factions: number[] }} */ h) => JSON.stringify([h.key, h.region, h.factions]);
/** A witnessed hall report read back - its text canonical, or null (witnessedFact's `parse`). */
export function parseHallReport(/** @type {unknown} */ text) {
  if (typeof text !== 'string') return null;
  let v;
  try { v = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(v) || v.length !== 3) return null;
  const h = hallReportOf({ key: v[0], region: v[1], factions: v[2] });
  return h && hallReportText(h) === text ? h : null;
}

/** THE JOIN THE SERVICE RECORDS (AUDIT CHAP R1's line; Mac: "Approved"): a new membership only where the Roll's
 *  standing with the guild meets DFU's join (Guild.cs IsEligibleToJoin: rank 0's need, 0) - `rep` the reputation and
 *  what the Roll owes it (AUDIT CHAP2 S7: an initiation's own reward the day's pace cut is the Roll's already). AUDIT
 *  CHAP2 D2: the Thieves Guild and the Dark Brotherhood join by their initiation quests at ANY standing
 *  (GuildManager.cs:53-66, no eligibility test - ThievesGuild.cs:180-187), so their joins are recorded as DFU makes them. */
export const joinRecordable = (/** @type {unknown} */ rep, /** @type {unknown} */ faction = null) => hallHidden(faction) || rollRep(rep) >= RANK_REQ_REPUTATION[0];


// ─── CHAP3a: MERIT (Chapters-Arc 5.1) ───────────────────────────────
// What a member did for its chapter, a week's: witnessed acts alone - its own writ for the chapter filled with its own
// units, a receipt in the chapter's region - never a quest's claim. Each bound is asked by the line's own write
// (server-account/src/npcMerit.js): the member's tenure on the Roll, the account's one chapter of a guild a week, the
// account's cap a chapter a week. CHAP3b's Turning reads the week's sum.

/** A member's own writ filled whole with its own units: this Merit (bought units earn none - E13, Seats-Arc 4.2). */
export const MERIT_WRIT = 100;
/** A receipt (a gate closed, a raided town defended) in the chapter's region, while a member. */
export const MERIT_RECEIPT = 50;
/** AUDIT CHAP3 E4 (DECIDED): a receipt is one act - its MERIT_RECEIPT shared among the `n` chapters it reached
 *  (the character's guilds keeping one where it stood), rounded down, never MERIT_RECEIPT to each. */
export const meritOfReceipt = (/** @type {unknown} */ n) => Math.floor(MERIT_RECEIPT / Math.max(1, Math.floor(Number(n)) || 1));
/** A member earns Merit after this long in the guild on the Roll (Seats-Arc 4.2's new member). */
export const MERIT_TENURE_S = 7 * 86_400;
/** The Merit an account earns a chapter a week, whatever number of its characters play. */
export const MERIT_CAP_WEEK = 600;
/** Merit's sources - a member's own writ, a gate, a raid. */
export const MERIT_SOURCES = Object.freeze(['writ', ...RECEIPT_KINDS]);
/** Merit's week: the seats' (townSeatLaw.js seatWeekOf), so one Turning settles both. */
export const meritWeekOf = (/** @type {number} */ nowS) => seatWeekOf(nowS * 1000);
/** A member's own writ's Merit: MERIT_WRIT over its units, for the share of them its own (`own`, the units left once the
 *  bought ones are spent - spent first, professions.js spendStatements), rounded down. */
export function meritOfWrit(/** @type {unknown} */ qty, /** @type {unknown} */ own) {
  if (!Number.isSafeInteger(qty) || /** @type {number} */ (qty) < 1 || !Number.isSafeInteger(own)) return 0;
  const q = /** @type {number} */ (qty);
  return Math.floor((MERIT_WRIT * Math.max(0, Math.min(q, /** @type {number} */ (own)))) / q);
}

/** A member's own writ's dice salt - its own, never a hall writ's. */
export const MEMBER_WRIT_SALT = 0x3e17;
/** A member's own writ's id: `m:<day>:<region>:<faction>:<realm id>` - one a member a chapter a day. */
export const memberWritId = (/** @type {number} */ day, /** @type {number} */ region, /** @type {number} */ faction, /** @type {string} */ character) => `m:${day}:${region}:${faction}:${character}`;
/**
 * A MEMBER'S OWN WRIT for the day (AUDIT CHAP2 E4: one a member a chapter a day, never the shared writs' race): the
 * chapter's law (hallWrits - the guild's own kinds, the Court's top slot left the Court's) drawn from the member's own
 * dice, keyed by its realm id. `{ slot: 0, material, tier, units, pay, renown }`, or null for no guild, no realm
 * character or no ground.
 * @param {number} day @param {number} region @param {number} faction @param {unknown} character @param {any[]} table
 */
export function memberWrit(day, region, faction, character, table) {
  if (!isRollFaction(faction) || typeof character !== 'string' || !REALM_CHARACTER_RE.test(character) || !table?.length) return null;
  const families = hallFamiliesOf(faction);
  const own = table.filter((m) => families.includes(material(m.material)?.family));
  const id = [1, 8, 15].map((at) => parseInt(character.slice(at, at + 7), 16));
  const w = courtWrits(day, region, 2, own.length ? own : table, (slot, k) => gateHash(MEMBER_WRIT_SALT, day, region, faction, ...id, slot, k) / 4294967296)[1];
  return w ? { ...w, slot: 0 } : null;
}
/** A chapter's writ - a hall writ, or a member's own: paid as one, its guild's standing too. */
export const isChapterWrit = (/** @type {unknown} */ kind) => kind === 'hall' || kind === 'member';
/**
 * THE BOARD'S MERIT LINE for one of the reader's guilds here (the service's npcMerit.js meritAsks: `{ faction, merit,
 * max, elsewhere, from }`) - "Merit with the Fighters Guild here this week: 150 of 600", or why it earns none here.
 * @param {{ faction: number, merit: number, max: number, elsewhere: boolean, from: number | null }} m @param {number} nowS
 */
export function meritLineOf(m, nowS) {
  const name = hallPosterName(m?.faction) ?? 'guild';
  if (m.from != null && m.from > nowS) {
    const days = Math.ceil((m.from - nowS) / 86_400);
    return `The ${name} counts your Merit after a week in the guild - ${days === 1 ? 'tomorrow' : `in ${days} days`}`;
  }
  if (m.elsewhere) return `Your Merit with the ${name} this week is another chapter's`;
  return `Merit with the ${name} here this week: ${Number(m.merit).toLocaleString('en-US')} of ${Number(m.max).toLocaleString('en-US')}`;
}

// ─── CHAP3b: STRENGTH (Chapters-Arc 5.2) ────────────────────────────
// What a chapter's members did, a week's Merit at a time: each chapter's Strength, 0 to 100 from 50, moved at the
// Turning toward its week's Merit - up to STRENGTH_STEP_MAX for a week whose Merit meets the target ten times over, down
// STRENGTH_IDLE for a week with none, and above 50 STRENGTH_SHORT back toward it for a week short of its target (AUDIT
// CHAP3 E4) - and halfway back toward 50 at a Season's end. Its band is what the chapter's halls
// give (the prices and the shelf, CHAP3c; the writs, here). The service settles it (server-account/src/npcChapters.js).

/** A chapter's Strength before its first Turning. */
export const STRENGTH_START = 50;
/** A chapter's Strength's bounds. */
export const STRENGTH_MIN = 0;
export const STRENGTH_MAX = 100;
/** The most a week's Merit moves a chapter's Strength. */
export const STRENGTH_STEP_MAX = 10;
/** A week with no Merit at all: this much lost. */
export const STRENGTH_IDLE = 3;
/** AUDIT CHAP3 E4 (DECIDED): a week whose Merit falls short of its target, for a chapter above 50 - this much back
 *  toward 50, never past it. A band above Steady is held by meeting the target, never by a single receipt a week. */
export const STRENGTH_SHORT = 3;
/** The Merit a point of Strength costs, for each hundred accounts active in the week (the hall writs' own scale). */
export const STRENGTH_TARGET = 60;
/** A week's target: STRENGTH_TARGET for each hundred active accounts, never under one hundred's. */
export const strengthTarget = (/** @type {unknown} */ active) => STRENGTH_TARGET * Math.max(1, Math.ceil(Math.max(0, Number(active) || 0) / 100));
/**
 * A CHAPTER'S STRENGTH AFTER A WEEK: `prev` its Strength, `merit` the week's Merit of all its members, `target` the
 * week's (strengthTarget) - `+ min(10, floor(merit / target))`, or `- 3` for a week with no Merit at all; inside 0-100.
 * AUDIT CHAP3 E4: a week short of its target moves a chapter above 50 `STRENGTH_SHORT` back toward 50, never past it.
 * @param {number} prev @param {number} merit @param {number} target
 */
export function strengthAfter(prev, merit, target) {
  const s = Number.isFinite(prev) ? Math.round(prev) : STRENGTH_START;
  const m = Number.isFinite(merit) ? Math.max(0, merit) : 0;
  const step = Math.min(STRENGTH_STEP_MAX, Math.floor(m / Math.max(1, target)));
  const moved = m <= 0 ? s - STRENGTH_IDLE : step > 0 ? s + step : s > STRENGTH_START ? Math.max(STRENGTH_START, s - STRENGTH_SHORT) : s;
  return Math.max(STRENGTH_MIN, Math.min(STRENGTH_MAX, moved));
}
/** A Season's end (Seats-Arc 9.1's soft reset): halfway back toward 50, rounded toward 50. */
export const strengthSeasonEnd = (/** @type {number} */ s) => STRENGTH_START + Math.trunc((Number(s) - STRENGTH_START) / 2);
/** THE BANDS (5.2's table), each from its floor: Failing 0-19, Steady 20-69, Thriving 70-89, Ascendant 90-100. */
export const CHAPTER_BANDS = Object.freeze([
  Object.freeze({ band: 'failing', name: 'Failing', from: 0, price: 1.25, writs: 0.5, shelf: -4 }),
  Object.freeze({ band: 'steady', name: 'Steady', from: 20, price: 1, writs: 1, shelf: 0 }),
  Object.freeze({ band: 'thriving', name: 'Thriving', from: 70, price: 0.9, writs: 1.5, shelf: 4 }),
  Object.freeze({ band: 'ascendant', name: 'Ascendant', from: 90, price: 0.9, writs: 1.5, shelf: 4 }),
]);
/** A Strength's band (CHAPTER_BANDS' row) - Steady's for a number that is none. */
export function chapterBandOf(/** @type {unknown} */ strength) {
  if (typeof strength !== 'number' || !Number.isFinite(strength)) return CHAPTER_BANDS[1];
  let at = CHAPTER_BANDS[0];
  for (const b of CHAPTER_BANDS) if (strength >= b.from) at = b;
  return at;
}
/** A chapter's hall writs a day by its band: half (never none) Failing, half again Thriving and Ascendant. */
export const hallWritCountIn = (/** @type {unknown} */ active, /** @type {unknown} */ strength) => Math.max(1, Math.round(hallWritCount(active) * chapterBandOf(strength).writs));
/** The board's line for a chapter - "The chapter of the Fighters Guild here is Thriving (Strength 74)" (AUDIT CHAP4 C4:
 *  the chapter the subject - "The Knights of the Dragon here is" was no sentence). */
export function chapterLineOf(/** @type {{ faction: number, strength: number }} */ c) {
  return `The chapter of the ${hallPosterName(c?.faction) ?? 'guild'} here is ${chapterBandOf(c?.strength).name} (Strength ${Number(c?.strength)})`;
}

// ─── CHAP3c: THE BANDS ON THE HALLS (Chapters-Arc 5.2) ──────────────
// What a chapter's band does to its hall, online: training, a spell bought and a spell made cost a quarter more Failing
// and a tenth less Thriving and Ascendant; the guild's shelf is stocked as a hall four qualities poorer Failing, four
// richer Thriving and Ascendant (DFU's stock law reads a hall's quality for the count alone - more items, never better
// ones; AUDIT CHAP3 D1, AUDIT CHAP4 R16). DFU's own price and
// stock laws stay the base: the band is laid over them, never written into them. A hall whose chapter's Strength is not
// known - offline, or a chapter the sheet does not name - is DFU's own.

/** The building qualities DFU's halls stand at, which a band's shelf moves inside. */
export const HALL_QUALITY_MIN = 1;
export const HALL_QUALITY_MAX = 20;
/** A hall's price factor by its chapter's Strength - 1 where none is known (chapterBandOf reads it as Steady). */
export const chapterPriceFactor = (/** @type {unknown} */ strength) => chapterBandOf(strength).price;
/** A price with a hall's factor laid over it, rounded - never under 1 for a price that was some; DFU's own at 1. */
export const chapterPriced = (/** @type {number} */ price, /** @type {number} */ factor) => (factor === 1 || !(price > 0) ? price : Math.max(1, Math.round(price * factor)));
/** A hall's shelf's quality by its chapter's Strength: DFU's building quality moved by the band, inside 1-20; the hall's
 *  own where no Strength is known (chapterBandOf reads it as Steady, which moves nothing) or the hall has no quality.
 *  AUDIT CHAP3 D2: a band that moves nothing returns the quality untouched (offline is DFU's, whatever a world-data pack
 *  sets - DFU reads a building's quality raw), and a move never takes a hall above 20 below its own quality. */
export function chapterShelfQuality(/** @type {number} */ quality, /** @type {unknown} */ strength, extra = 0) {
  const step = chapterBandOf(strength).shelf + extra;   // CHAP6d: and a doctrine's `extra` qualities beside the band's
  if (!(quality > 0) || step === 0) return quality;
  return Math.max(HALL_QUALITY_MIN, Math.min(Math.max(HALL_QUALITY_MAX, quality), quality + step));
}

// ─── CHAP4a: THE SEATS (Chapters-Arc 3.5, 6) ────────────────────────
// Ranks 8 and 9 are seats: each chapter's one Master (rank 9) and three officers (rank 8), placed at its Turning by
// the Merit its Eligible members earned it over the last four weeks - ties to the sitting holder (AUDIT CHAP4 E1: its
// x 1.2 carry, the seats' own, made a holder near the week's cap unbeatable), then the longer tenure, then the lower
// character id. Eligible is the half of
// the rank law the service holds (AUDIT CHAP R2): a member whose reputation on the Roll meets rank 8's need, fourteen
// days in the guild on the Roll, on an account seven days old. A seat no Eligible member has Merit for stands vacant -
// never filled from below. One seat an account a guild (realm-wide: an account's alts never hold two of one guild's);
// one Master's seat a character. The book's own rank stops at 7 (ROLL_BOOK_RANK_MAX): what DFU's law would make 8 or 9
// is Eligible, until a seat. The service places them (server-account/src/npcChapters.js).

/** A chapter's seats, by kind, Master first; and the rank each gives. */
export const CHAPTER_SEAT_KINDS = Object.freeze(['master', 'officer']);
export const CHAPTER_SEATS = Object.freeze({ master: 1, officer: 3 });
export const SEAT_RANK = Object.freeze({ master: 9, officer: 8 });
/** The highest rank a membership's own book holds - 8 and 9 are the seats' (3.5). */
export const ROLL_BOOK_RANK_MAX = 7;
/** The rank the Roll records for a member: the book's, bounded by its own reputation (3.2), and never a seat's. */
export const rollBookRankOf = (/** @type {unknown} */ reported, /** @type {unknown} */ rep) => Math.max(0, Math.min(whole(reported), rollRankCapOf(rep), ROLL_BOOK_RANK_MAX));
/** Eligible's tenure on the Roll, and its account's age. */
export const SEAT_TENURE_S = 14 * 86_400;
export const SEAT_ACCOUNT_AGE_S = 7 * 86_400;
/** The weeks of Merit a Turning places the seats by - the week it settles and the three before. */
export const SEAT_MERIT_WEEKS = 4;

/** ELIGIBLE at `atS`: a member of the guild on the Roll, its reputation there at the seat's line, its tenure fourteen days,
 *  its account seven days old. */
export function seatEligibleAt(/** @type {{ member?: unknown, rep?: unknown, joinedAt?: unknown, registeredAt?: unknown }} */ row, /** @type {number} */ atS) {
  const at = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isSafeInteger(v);
  return !!row && (row.member === true || row.member === 1) && rollRep(row.rep) >= ROLL_SEAT_LINE
    && at(row.joinedAt) && /** @type {number} */ (row.joinedAt) <= atS - SEAT_TENURE_S
    && at(row.registeredAt) && /** @type {number} */ (row.registeredAt) <= atS - SEAT_ACCOUNT_AGE_S;
}

/** A candidate's standing for a seat, in tenths of Merit. AUDIT CHAP4 E1 (decided): no carry - a sitting holder keeps an
 *  EQUAL standing (chapterSeatPlan's first tie-break), never a larger one. The ×1.2 it carried (Seats-Arc 5.2 step 3's
 *  siege bonus) met the week's cap: no challenger shows more than 4 x 600 Merit, so a holder at 2000 of 2400 could not be
 *  out-earned at all. */
export const seatScoreOf = (/** @type {number} */ merit) => Math.round(Math.max(0, whole(merit)) * 10);

/**
 * THE SEATS A TURNING PLACES: `candidates` `[{ faction, region, char, account, merit, joinedAt }]` - each Eligible
 * member's four weeks' Merit at one chapter - and `sitting` the seats as they stand (`[{ faction, region, char }]`).
 * Every chapter's Master first, realm-wide, then its officers, each in the order of standing (seatScoreOf), the sitting
 * holder at that chapter (AUDIT CHAP4 E1: its carry is the tie, never a larger standing), the longer tenure, the lower
 * character id - the chapter's own key last, so one candidate's chapters are taken in one order. A candidate with no Merit takes none; one seat an account a guild; one Master's seat a character.
 * Answers `[{ faction, region, char, account, seat }]`, by chapter, Master first.
 * @param {Iterable<any>} candidates @param {Iterable<any>} [sitting]
 */
export function chapterSeatPlan(candidates, sitting = []) {
  const key = (/** @type {any} */ c) => `${c.faction}|${c.region}`;
  const sat = new Set([...sitting].map((s) => `${key(s)}|${s.char}`));
  const order = [...candidates]
    .filter((c) => isRollFaction(c?.faction) && regionOk(c?.region) && typeof c?.char === 'string' && typeof c?.account === 'string' && whole(c?.merit) > 0)
    .map((c) => ({ ...c, score: seatScoreOf(c.merit), held: sat.has(`${key(c)}|${c.char}`) ? 1 : 0 }))
    .sort((a, b) => b.score - a.score || b.held - a.held || whole(a.joinedAt) - whole(b.joinedAt) || (a.char < b.char ? -1 : a.char > b.char ? 1 : 0)
      || a.faction - b.faction || a.region - b.region);
  /** @type {Map<string, { master: any[], officer: any[] }>} */
  const seats = new Map();
  const held = new Set();   // account|faction - one seat an account a guild
  const masters = new Set();   // char - one Master's seat a character
  const place = (/** @type {any} */ c, /** @type {'master' | 'officer'} */ seat) => {
    if (!seats.has(key(c))) seats.set(key(c), { master: [], officer: [] });
    /** @type {any} */ (seats.get(key(c)))[seat].push({ faction: c.faction, region: c.region, char: c.char, account: c.account, seat });
    held.add(`${c.account}|${c.faction}`);
    if (seat === 'master') masters.add(c.char);
  };
  for (const seat of CHAPTER_SEAT_KINDS) {
    for (const c of order) {
      if ((seats.get(key(c))?.[/** @type {'master' | 'officer'} */ (seat)].length ?? 0) >= CHAPTER_SEATS[/** @type {'master' | 'officer'} */ (seat)]) continue;
      if (held.has(`${c.account}|${c.faction}`) || (seat === 'master' && masters.has(c.char))) continue;
      place(c, /** @type {'master' | 'officer'} */ (seat));
    }
  }
  return [...seats.entries()].sort(([a], [b]) => {
    const [fa, ra] = a.split('|').map(Number), [fb, rb] = b.split('|').map(Number);
    return fa - fb || ra - rb;
  }).flatMap(([, s]) => [...s.master, ...s.officer]);
}

/** WHAT A TURNING CHANGED: each character whose seat at a chapter moved - `{ faction, region, char, from, to }`, `from`
 *  and `to` a seat or null - by chapter, then character. A seat that stands where it stood is no change. */
export function seatChangesOf(/** @type {Iterable<any>} */ before, /** @type {Iterable<any>} */ after) {
  /** @type {Map<string, { faction: number, region: number, char: string, from: string | null, to: string | null }>} */
  const out = new Map();
  const at = (/** @type {any} */ s) => {
    const k = `${s.faction}|${s.region}|${s.char}`;
    if (!out.has(k)) out.set(k, { faction: s.faction, region: s.region, char: s.char, from: null, to: null });
    return /** @type {any} */ (out.get(k));
  };
  for (const s of before) at(s).from = s.seat;
  for (const s of after) at(s).to = s.seat;
  return [...out.values()].filter((c) => c.from !== c.to)
    .sort((a, b) => a.faction - b.faction || a.region - b.region || (a.char < b.char ? -1 : a.char > b.char ? 1 : 0));
}

// ─── CHAP4b: THE SEATS ON THE PAGE (Chapters-Arc 3.5, 6) ────────────
// What the tab does with the Roll's word on ranks 8 and 9, online: the book's own rank held at 7 - at the Roll's adoption
// (rollBookCap) and at DFU's review (systems/guilds.js updateRank's ceiling, the host's while the Roll holds) - and a
// seat's rank at its own chapter's halls alone: the hall's service window reads the book seated (seatedBook). Offline,
// and wherever the Roll does not hold, every rank is DFU's.

/** A Roll answer's seats as the tab keeps them, `[{ f, region, seat }]` - each a guild's, a region's and a seat's. */
export function rollSeatsOf(/** @type {unknown} */ list) {
  if (!Array.isArray(list)) return [];
  return list.filter((s) => isRollFaction(s?.f) && regionOk(s?.region) && CHAPTER_SEAT_KINDS.includes(s?.seat))
    .map((s) => ({ f: s.f, region: s.region, seat: s.seat }));
}
/** The rank a character's `seats` give it at a hall of `faction` in `region` - null where it holds none there. */
export function seatRankAt(/** @type {unknown} */ seats, /** @type {unknown} */ faction, /** @type {unknown} */ region) {
  const s = rollSeatsOf(seats).find((x) => x.f === faction && x.region === region);
  return s ? SEAT_RANK[/** @type {'master' | 'officer'} */ (s.seat)] : null;
}
/** A BOOK SEATED: a membership book (systems/guilds.js) whose row under `key` reads `rank` where its own is lower -
 *  every other read and every write (a knightly order's gifts, a probation) the row's own. The book itself where it has
 *  no such row or the seat gives no higher rank. AUDIT CHAP5 D1: and only a row DFU's own review holds at 7
 *  (ROLL_BOOK_RANK_MAX) - a seat is Eligible at a reputation of 80 alone, and lifted a rank-2 member past every skill
 *  DFU's ranks 3 to 7 ask (a Mages' Teleport, its Summoning, its magic items); 8 and 9 are the seats' only past DFU's. */
export function seatedBook(/** @type {any} */ book, /** @type {string} */ key, /** @type {unknown} */ rank) {
  const row = book?.[key];
  if (!row || typeof row !== 'object' || whole(row.rank) !== ROLL_BOOK_RANK_MAX || !(typeof rank === 'number' && rank > whole(row.rank))) return book;
  return { ...book, [key]: new Proxy(row, { get: (t, k) => (k === 'rank' ? rank : t[k]) }) };
}
/** THE BOOK HELD AT 7: each row of a Roll guild in `store`'s books (the mortal's and the vampire's) above
 *  ROLL_BOOK_RANK_MAX set to it; answers the guild factions it held. Run at the Roll's adoption. */
export function rollBookCap(/** @type {any} */ store) {
  if (!store || typeof store !== 'object') return [];
  const books = Object.hasOwn(store, 'mortal') && Object.hasOwn(store, 'vampire') ? [store.mortal, store.vampire] : [store];
  const held = new Set();
  for (const book of books) {
    if (!book || typeof book !== 'object') continue;
    for (const m of Object.values(book)) {
      const f = rollFactionOfGuild(m?.guild);
      if (f == null || !(whole(m?.rank) > ROLL_BOOK_RANK_MAX)) continue;
      m.rank = ROLL_BOOK_RANK_MAX;
      held.add(f);
    }
  }
  return [...held].sort((a, b) => a - b);
}

const SEAT_WORDS = Object.freeze({ master: 'the Master\'s seat', officer: 'an officer\'s seat' });
const listed = (/** @type {string[]} */ names) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
/** A seat said - "You hold the Master's seat of the Fighters Guild in Anticlere." - or, `held` false, no longer held.
 *  Worded without gender (Seats-Arc 7.4: nothing about a player is guessed). */
export function seatLineOf(/** @type {{ f: number, region: number, seat: string }} */ s, held = true) {
  const words = /** @type {Record<string, string>} */ (SEAT_WORDS)[s?.seat] ?? 'a seat';
  return `You ${held ? 'hold' : 'no longer hold'} ${words} of the ${hallPosterName(s?.f) ?? 'guild'} in ${REGION_NAMES[s?.region] ?? 'its region'}.`;
}
/** What the tab says of its seats: every seat held at the page's first word (`before` null); after it, each seat newly
 *  held or moved, then each lost. */
export function seatLinesOf(/** @type {unknown} */ before, /** @type {unknown} */ after) {
  const now = rollSeatsOf(after);
  if (before == null) return now.map((s) => seatLineOf(s));
  const was = rollSeatsOf(before);
  const k = (/** @type {{ f: number, region: number }} */ s) => `${s.f}|${s.region}`;
  const wasAt = new Map(was.map((s) => [k(s), s.seat]));
  const nowAt = new Set(now.map(k));
  return [...now.filter((s) => wasAt.get(k(s)) !== s.seat).map((s) => seatLineOf(s)), ...was.filter((s) => !nowAt.has(k(s))).map((s) => seatLineOf(s, false))];
}
/** The book's cap said, once a hold: "The Fighters Guild keeps ranks 8 and 9 as its chapters' seats, won by Merit - your
 *  rank there is 7." Null for no guild. */
export function bookCappedLine(/** @type {unknown} */ factions) {
  const names = [...new Set(Array.isArray(factions) ? factions : [])].map(hallPosterName).filter(Boolean).map((n) => `the ${n}`);
  if (!names.length) return null;
  const one = names.length === 1, said = listed(names);
  return `${said.charAt(0).toUpperCase()}${said.slice(1)} ${one ? 'keeps' : 'keep'} ranks 8 and 9 as ${one ? 'its' : 'their'} chapters' seats, won by Merit - your rank there is 7.`;
}

// ─── CHAP4c: THE CHAPTERS' TITLES (Chapters-Arc 6) ──────────────────
// A seat's title on the token, as the seats' are (Seats-Arc 7.4): a generic id (net/identityToken.js CHAPTER_TITLES) and
// a bounded claim, `ts` [the chapter's key, the Season], worded by the client - worded without gender (nothing about a
// player is guessed), so not the guild's own rank titles (Archmage, Matriarch), which the hall's own window keeps.
// A Master who loses the seat is its Former Master for the rest of the Season. A hidden guild's seat gives no title.
// CHAP6e (Chapters-Arc 7): a Master in its chapter's Ascendancy is its High Master for the Season, and a Master who held
// the seat a whole Season keeps "Master of the Fighters Guild, Anticlere, Season 3" for good.

/** A chapter's key on a title's claim: its guild faction x 100 + its region (both whole, the region under 100). */
export const chapterTitleKey = (/** @type {number} */ f, /** @type {number} */ region) => f * 100 + region;
/** The chapter a title's key names, or null. */
export const chapterOfTitleKey = (/** @type {unknown} */ k) => (typeof k === 'number' && Number.isSafeInteger(k) && k >= 0 ? { f: Math.floor(k / 100), region: k % 100 } : null);
const CHAPTER_TITLE_WORDS = Object.freeze({ chaptermaster: 'Master', chapterofficer: 'Officer', formermaster: 'Former Master', highmaster: 'High Master', seasonmaster: 'Master' });
/** CHAP6e: the Season a kept title names - a counted Season's, never Season 0's (which crowns no one), inside the claim's bound. */
const keptSeasonOk = (/** @type {unknown} */ n) => Number.isSafeInteger(n) && /** @type {number} */ (n) >= 1 && /** @type {number} */ (n) <= 9999;
/** A chapter's title worded off its claim - "Master of the Fighters Guild, Anticlere"; CHAP6e "High Master of the
 *  Fighters Guild, Anticlere", "Master of the Fighters Guild, Anticlere, Season 3" - null for a claim that names no
 *  chapter (or a hidden guild's), or a kept title no Season. */
export function chapterTitleText(/** @type {unknown} */ title, /** @type {unknown} */ ts) {
  const words = typeof title === 'string' ? /** @type {Record<string, string>} */ (CHAPTER_TITLE_WORDS)[title] : null;
  const c = Array.isArray(ts) ? chapterOfTitleKey(ts[0]) : null;
  if (!words || !c || !isRollFaction(c.f) || hallHidden(c.f) || !regionOk(c.region)) return null;
  if (title === 'seasonmaster') return keptSeasonOk(/** @type {any[]} */ (ts)[1]) ? `${words} of the ${hallPosterName(c.f)}, ${REGION_NAMES[c.region]}, Season ${/** @type {any[]} */ (ts)[1]}` : null;
  return `${words} of the ${hallPosterName(c.f)}, ${REGION_NAMES[c.region]}`;
}
/**
 * THE TITLES A CHARACTER'S SEATS GIVE IT: `seats` `[{ f, region, seat, high }]` it holds now, `lost` `[{ f, region }]`
 * the chapters whose Master's seat it lost this Season - `[{ title, ts }]`, best first: a Master's seat's
 * ('chaptermaster'), an officer's ('chapterofficer'), a Master's seat lost and not held again ('formermaster'), each by
 * guild then region; never a hidden guild's. `season` the Season on the claim. CHAP6e: a Master's seat at a chapter in
 * its Ascendancy (`high`) is marked `high` - the mint signs it 'highmaster' in its place - and first among the Masters';
 * `kept` `[{ f, region, season }]` the Seasons it held a Master's seat whole, each 'seasonmaster' with that Season on its
 * claim, last, the newest Season first.
 * @param {Iterable<any>} seats @param {Iterable<any>} lost @param {number} season @param {Iterable<any>} [kept]
 */
export function chapterTitlesOf(seats, lost, season, kept = []) {
  const shown = (/** @type {any} */ s) => isRollFaction(s?.f) && !hallHidden(s.f) && regionOk(s?.region);
  const held = [...seats].filter(shown);
  const masterAt = new Set(held.filter((s) => s.seat === 'master').map((s) => `${s.f}|${s.region}`));
  const by = (/** @type {any} */ a, /** @type {any} */ b) => a.f - b.f || a.region - b.region;
  const rows = (/** @type {any[]} */ list, /** @type {string} */ title) => list.sort(by).map((s) => ({ title, ts: [chapterTitleKey(s.f, s.region), season] }));
  const former = [...lost].filter((s) => shown(s) && !masterAt.has(`${s.f}|${s.region}`));
  const once = new Map(former.map((s) => [`${s.f}|${s.region}`, s]));
  const masters = held.filter((s) => s.seat === 'master');
  const high = masters.filter((s) => s.high === true);
  const seasons = new Map([...kept].filter((s) => shown(s) && keptSeasonOk(s.season)).map((s) => [`${s.f}|${s.region}|${s.season}`, s]));
  return [...rows(high, 'chaptermaster').map((r) => ({ ...r, high: true })), ...rows(masters.filter((s) => s.high !== true), 'chaptermaster'),
    ...rows(held.filter((s) => s.seat === 'officer'), 'chapterofficer'), ...rows([...once.values()], 'formermaster'),
    ...[...seasons.values()].sort((a, b) => b.season - a.season || by(a, b)).map((s) => ({ title: 'seasonmaster', ts: [chapterTitleKey(s.f, s.region), s.season] }))];
}

// ─── CHAP4d: THE FOCUS AND THE CHRONICLE (Chapters-Arc 6) ───────────
// The Master's week: which of its guild's material families its chapter's hall writs ask for more of (every other writ,
// hallWrits), chosen on the board, holding for the week it was chosen in. And the Chronicle's rows in words, read by the
// Hall of Records of a palace in the chapter's region - as the seats' are.

/** The families a chapter's Master may focus its writs on - its guild's own, where it has more than one to choose. */
export function chapterFocusesOf(/** @type {unknown} */ faction) {
  const f = hallFamiliesOf(/** @type {number} */ (faction));
  return f.length > 1 ? f : [];
}
/** Whether `focus` is a family `faction`'s Master may choose. */
export const chapterFocusOk = (/** @type {unknown} */ faction, /** @type {unknown} */ focus) => typeof focus === 'string' && chapterFocusesOf(faction).includes(focus);
/** The board's line for a chapter's Focus: "The Fighters Guild's Master asks for metals this week." - null for none. */
export function chapterFocusLineOf(/** @type {unknown} */ faction, /** @type {unknown} */ focus) {
  return chapterFocusOk(faction, focus) ? `The ${hallPosterName(/** @type {number} */ (faction))}'s Master asks for ${focus} this week.` : null;
}
/** A CHRONICLE ROW IN WORDS: `{ faction, week, kind, data: { from, to }, name }` - "In the third week of the Season of
 *  Morning Star, Alda took the Master's seat of the Fighters Guild." - null for a row it has no words for or a hidden
 *  guild's. A character gone since is "A member since gone". Worded without gender. `zero` the Season's (seasonOf). */
export function chapterChronicleLine(/** @type {any} */ row, /** @type {number | null} */ zero = null) {
  if (row?.kind === 'event' || row?.kind === 'season') return chapterSeasonLine(row);   // CHAP6a: a Season's own lines
  if (row?.kind === 'patron') return chapterPatronLine(row);   // CHAP7a: a Season's patron
  if (row?.kind !== 'seat' || !isRollFaction(row?.faction) || hallHidden(row.faction)) return null;
  const guild = `the ${hallPosterName(row.faction)}`;
  const from = row?.data?.from ?? null, to = row?.data?.to ?? null;
  const words = (/** @type {string} */ s) => /** @type {Record<string, string>} */ (SEAT_WORDS)[s];
  let did = null;
  if (!from && words(to)) did = `took ${words(to)} of ${guild}`;
  else if (from === 'officer' && to === 'master') did = `rose to the Master's seat of ${guild}`;
  else if (from === 'master' && to === 'officer') did = `gave the Master's seat of ${guild} up, and kept an officer's`;
  else if (words(from) && !to) did = `lost ${words(from)} of ${guild}`;
  if (!did) return null;
  const who = typeof row?.name === 'string' && row.name ? row.name : 'A member since gone';
  return `${Number.isSafeInteger(row?.week) ? `${chronicleWhen(row.week, zero)}, ` : ''}${who} ${did}.`;
}

// ─── CHAP5a: THE HALL'S ROLL (Chapters-Arc 9) ───────────────────────
// The seats' holders named inside each hall of the chapter, off the chapter sheet (5.3): the hall's own bookshelf's first
// book, which a stranger to the guild may read too. Worded without gender; never a hidden guild's (the sheet names none).

/** The most of a name the roll writes - the realm's own cap (server-account/src/realm.js REALM_NAME_MAX). */
export const CHAPTER_ROLL_NAME_MAX = 32;
/** A sheet's seats as the roll reads them, `[{ seat, name }]`: the Master's first, then the officers, each a known seat
 *  with a name - never more than the chapter has seats; anything else dropped. */
export function chapterRollSeatsOf(/** @type {unknown} */ seats) {
  if (!Array.isArray(seats)) return [];
  const ok = seats.filter((s) => typeof s?.name === 'string' && s.name.trim())   // a seat of no known kind is neither list's
    .map((s) => ({ seat: String(s.seat), name: String(s.name).trim().slice(0, CHAPTER_ROLL_NAME_MAX) }));
  return [...ok.filter((s) => s.seat === 'master').slice(0, CHAPTER_SEATS.master), ...ok.filter((s) => s.seat === 'officer').slice(0, CHAPTER_SEATS.officer)];
}
/** The roll's title: "The Roll of the Fighters Guild, Anticlere" - null for a hidden guild, no guild, no region. */
export function chapterRollTitle(/** @type {unknown} */ faction, /** @type {unknown} */ region) {
  if (!isRollFaction(faction) || hallHidden(/** @type {number} */ (faction)) || !regionOk(region)) return null;
  return `The Roll of the ${hallPosterName(/** @type {number} */ (faction))}, ${REGION_NAMES[/** @type {number} */ (region)]}`;
}
const namesListed = (/** @type {string[]} */ n) => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`);
/** The roll's lines: the chapter's state (the board's chapterLineOf), its Master, its officers - or the seats empty.
 *  `chapter` `{ strength, seats }` as the sheet holds it. */
export function chapterRollLines(/** @type {unknown} */ faction, /** @type {any} */ chapter) {
  const seats = chapterRollSeatsOf(chapter?.seats);
  const master = seats.find((s) => s.seat === 'master');
  const officers = seats.filter((s) => s.seat === 'officer').map((s) => s.name);
  return [
    ...(Number.isFinite(chapter?.strength) ? [`${chapterLineOf({ faction: /** @type {number} */ (faction), strength: chapter.strength })}.`] : []),
    master ? `Master of the chapter: ${master.name}.` : 'The Master\'s seat stands empty.',
    officers.length ? `${officers.length > 1 ? 'Its officers' : 'Its officer'}: ${namesListed(officers)}.` : 'No officer\'s seat is held.',
  ];
}

// ─── CHAP6a: THE SEASON'S EVENT (Chapters-Arc 7) ────────────────────
// At the Turning that opens a Season every confirmed chapter draws one event - a pure function of the Season, the
// chapter's key and a salt, as a Tide is (tideLaw.js) - from weights its last Season moved. The event holds the whole
// Season: a Decline costs 2 Strength a week unless the week's Merit meets twice the target, a Crackdown's members' own
// writs earn half again Merit (AUDIT CHAP5 E1) and a chapter under 30 at the Season's end shuts its halls for the next, a Rivalry races two chapters of one
// region on the Season's Merit and the winner takes 10 Strength from the loser. The Schism's and the Succession's
// choices are CHAP6b's; what the client shows of every event (an Ascendancy's prices among it) CHAP6c's. No Season
// counted, no event: every chapter is Calm, as every land's Tide is.

/** The events' own salt, beside the hall writs' and the member writs'. */
export const CHAPTER_EVENT_SALT = 0x5ea6;
/** THE EVENTS and their base weights (section 7's table), in the table's order. */
export const CHAPTER_EVENTS = Object.freeze([
  Object.freeze({ id: 'calm', name: 'Calm', weight: 30 }),
  Object.freeze({ id: 'schism', name: 'Schism', weight: 15 }),
  Object.freeze({ id: 'succession', name: 'Succession', weight: 10 }),
  Object.freeze({ id: 'crackdown', name: 'Crackdown', weight: 10 }),
  Object.freeze({ id: 'rivalry', name: 'Rivalry', weight: 15 }),
  Object.freeze({ id: 'decline', name: 'Decline', weight: 10 }),
  Object.freeze({ id: 'ascendancy', name: 'Ascendancy', weight: 10 }),
]);
const EVENT_IDS = CHAPTER_EVENTS.map((e) => e.id);
/** Whether `v` names an event. */
export const chapterEventOk = (/** @type {unknown} */ v) => typeof v === 'string' && /** @type {string[]} */ (EVENT_IDS).includes(v);
/** An event's name ("Schism"), or null. */
export const chapterEventName = (/** @type {unknown} */ id) => CHAPTER_EVENTS.find((e) => e.id === id)?.name ?? null;
/** THE EVENTS' NUMBERS (section 7, Appendix A). */
export const CHAPTER_EVENT_EFFECTS = Object.freeze({
  /** Schism: +10 where the Master's seat changed hands twice last Season. */
  schismMasters: 2, schismMoved: 10,
  /** Succession: +10 where the chapter ended its last Season Ascendant. */
  successionAscendant: 10,
  /** Crackdown: twice the weight for the underworld; +10 where a seat of the region has the Curfew; its members' own writs
   *  earn half again Merit (AUDIT CHAP5 E1 - never Marks: a hall writ any account fills, from units bought, paid half
   *  again was a faucet past PROF0's x1.2); under 30 Strength at the Season's end, the halls shut for the next. */
  crackdownHidden: 2, crackdownCurfew: 10, crackdownMerit: 1.5, crackdownShut: 30,
  /** Rivalry: +10 where a rival chapter of the region is Thriving (or Ascendant); the winner takes 10 from the loser. */
  rivalryThriving: 10, rivalrySwing: 10,
  /** Decline: +15 where Failing; 2 a week unless the week's Merit meets twice the target. */
  declineFailing: 15, declineFall: 2, declineMeets: 2,
  /** Ascendancy: +15 where Ascendant; its halls' prices a further tenth off (CHAP6d, the client's). */
  ascendancyAscendant: 15, ascendancyPrice: 0.9,
});

/** THE RIVALS (section 8, CALL 5 - the port's own table, never FACTION.TXT): each pair is a Rivalry's draw where both
 *  keep a chapter in the region. The watch is no chapter: a Crackdown's hunter alone. */
export const CHAPTER_RIVAL_PAIRS = Object.freeze([
  Object.freeze([GUILD_FACTION_IDS.FightersGuild, GUILD_FACTION_IDS.ThievesGuild]),
  Object.freeze([GUILD_FACTION_IDS.DarkBrotherhood, DIVINES.Arkay]),
  Object.freeze([GUILD_FACTION_IDS.DarkBrotherhood, DIVINES.Stendarr]),
  ...Object.values(ORDERS).map((o) => Object.freeze([GUILD_FACTION_IDS.DarkBrotherhood, o])),
  Object.freeze([GUILD_FACTION_IDS.MagesGuild, DIVINES.Julianos]),
]);
/** A guild faction's rivals, ascending - none for a chapter the table names no rival for. */
export const chapterRivalsOf = (/** @type {unknown} */ faction) => CHAPTER_RIVAL_PAIRS
  .flatMap(([a, b]) => (a === faction ? [b] : b === faction ? [a] : [])).sort((x, y) => x - y);

/**
 * A CHAPTER'S WEIGHTS for the Season it draws (section 7's table), in CHAPTER_EVENTS' order. `c`: the chapter's guild
 * `faction`; `band` its band as its last Season ended (before the Season's halving); `masters` the hands its Master's seat
 * changed into last Season; `rivalBand` the band of the rival it would race (null: no rival keeps a chapter in the
 * region - AUDIT CHAP R9, CALL 5: the Rivalry's weight is then Calm's); `curfew` whether a seat of the region has the
 * Curfew as law.
 * @param {{ faction: number, band?: string, masters?: number, rivalBand?: string | null, curfew?: boolean }} c
 */
export function chapterEventWeights({ faction, band = 'steady', masters = 0, rivalBand = null, curfew = false }) {
  const E = CHAPTER_EVENT_EFFECTS;
  /** @type {Record<string, number>} */
  const w = Object.fromEntries(CHAPTER_EVENTS.map((e) => [e.id, e.weight]));
  if (masters >= E.schismMasters) w.schism += E.schismMoved;
  if (chapterDoctrinesFor(faction).length < 2) { w.calm += w.schism; w.schism = 0; }   // AUDIT CHAP5 D3: no two doctrines, no Schism
  if (band === 'ascendant') { w.succession += E.successionAscendant; w.ascendancy += E.ascendancyAscendant; }
  if (hallHidden(faction)) w.crackdown *= E.crackdownHidden;
  if (curfew) w.crackdown += E.crackdownCurfew;
  if (rivalBand === null) { w.calm += w.rivalry; w.rivalry = 0; }
  else if (rivalBand === 'thriving' || rivalBand === 'ascendant') w.rivalry += E.rivalryThriving;
  if (band === 'failing') w.decline += E.declineFailing;
  return CHAPTER_EVENTS.map((e) => w[e.id]);
}

/** AUDIT CHAP5 E3: a uint32 roll `h` (gateHash's) as a whole below `n` - scaled, never `h % n`: a modifier that moves
 *  the weights' sum moves few chapters' draws (a remainder drew most of them again - a Curfew's edict, a Master's seat
 *  churned, steered a region's events). */
export const drawOf = (/** @type {number} */ h, /** @type {number} */ n) => Math.floor((h / 2 ** 32) * n);
/** THE EVENT chapter `faction` of `region` draws for Season `season` over `weights` (chapterEventWeights') - an event's
 *  id; Calm for a Season that is none or weights that sum to none. */
export function chapterEventOf(/** @type {number} */ season, /** @type {number} */ faction, /** @type {number} */ region, /** @type {number[]} */ weights) {
  const total = Array.isArray(weights) ? weights.reduce((a, b) => a + Math.max(0, whole(b)), 0) : 0;
  if (!Number.isSafeInteger(season) || season < 0 || total <= 0) return 'calm';
  let r = drawOf(gateHash(CHAPTER_EVENT_SALT, season, chapterTitleKey(faction, region)), total);   // AUDIT CHAP5 E3
  for (let i = 0; i < CHAPTER_EVENTS.length; i++) {
    const wt = Math.max(0, whole(weights[i]));
    if (r < wt) return CHAPTER_EVENTS[i].id;
    r -= wt;
  }
  return 'calm';
}

/** The rival a Rivalry races: of `rivals` (`[{ faction, strength }]`, the guild's rivals keeping a chapter in the
 *  region), the strongest, the lower guild id at a tie - null for none. */
export function chapterRivalPick(/** @type {{ faction: number, strength: number }[]} */ rivals) {
  const list = Array.isArray(rivals) ? rivals.filter((r) => Number.isSafeInteger(r?.faction)) : [];
  if (!list.length) return null;
  return list.reduce((a, b) => (b.strength > a.strength || (b.strength === a.strength && b.faction < a.faction) ? b : a)).faction;
}

/** A DECLINE'S WEEK: Strength `s` after the week's own step falls 2 more unless the week's Merit meets twice the target. */
export function declineAfter(/** @type {number} */ s, /** @type {number} */ merit, /** @type {number} */ target) {
  const E = CHAPTER_EVENT_EFFECTS;
  return Number(merit) >= E.declineMeets * Math.max(1, Number(target) || 0) ? s : Math.max(STRENGTH_MIN, s - E.declineFall);
}

/** A RIVALRY'S END: `[a, b]` the two chapters' Strengths, `[ma, mb]` their Season's Merit - the winner (more Merit)
 *  takes 10 Strength from the loser, never past 100 nor below 0; a tie moves neither. Answers `{ a, b, won }` - `won`
 *  'a', 'b' or null. */
export function rivalryEnd(/** @type {[number, number]} */ [a, b], /** @type {[number, number]} */ [ma, mb]) {
  if (!(ma > mb) && !(mb > ma)) return { a, b, won: null };
  const E = CHAPTER_EVENT_EFFECTS;
  const [w, l] = ma > mb ? [a, b] : [b, a];
  const lost = Math.min(E.rivalrySwing, l);   // the loser's sting is whole; the winner's gain stops at 100
  const won = Math.min(STRENGTH_MAX, w + lost);
  return ma > mb ? { a: won, b: l - lost, won: 'a' } : { a: l - lost, b: won, won: 'b' };
}

/** A CRACKDOWN'S MEMBER WRIT MERIT (AUDIT CHAP5 E1): half again, whole - the Marks every writ pays its own. */
export const crackdownMerit = (/** @type {number} */ merit) => Math.round(Math.max(0, Number(merit) || 0) * CHAPTER_EVENT_EFFECTS.crackdownMerit);
/** Whether a Crackdown's chapter at Strength `s` at its Season's end shuts its halls for the next. */
export const crackdownShuts = (/** @type {number} */ s) => Number(s) < CHAPTER_EVENT_EFFECTS.crackdownShut;

/** The guild a Season's line names: "the Thieves Guild" - or, for a hidden guild (a public line naming the underworld's
 *  chapter would say where it keeps its halls), "its rival in the shadows". */
const rivalWords = (/** @type {unknown} */ f) => (isRollFaction(f) && !hallHidden(f) ? `the ${hallPosterName(/** @type {number} */ (f))}` : 'its rival in the shadows');
/** CHAP6a: A SEASON'S LINE IN WORDS - an 'event' row `{ faction, data: { season, event, ... } }` ("At the end of the Season
 *  of Morning Star, the Fighters Guild won its rivalry with the Thieves Guild.") or a 'season' row, the Master who held the
 *  seat the whole Season ("Through the Season of Morning Star, Alda held the Master's seat of the Fighters Guild.") -
 *  null for a row it has no words for or a hidden guild's. CHAP6b: and the Schism's doctrine, the Succession's heir (the
 *  heir's name is the hall's census's, read in its town - CHAP6c). */
export function chapterSeasonLine(/** @type {any} */ row) {
  if (!isRollFaction(row?.faction) || hallHidden(row.faction)) return null;
  const season = seatSeasonName(row?.data?.season);
  if (!season) return null;
  const guild = `the ${hallPosterName(row.faction)}`;
  if (row.kind === 'season') {
    const who = typeof row?.name === 'string' && row.name ? row.name : 'A member since gone';
    return `Through ${season}, ${who} held the Master's seat of ${guild}.`;
  }
  const d = row.data;
  const did = d.event === 'decline' ? (d.fell > 0 ? `${guild}'s decline cost it ${d.fell} Strength` : `${guild} held against its decline`)
    : d.event === 'crackdown' ? (d.shut ? `a crackdown shut the halls of ${guild} for the Season after` : `${guild} weathered a crackdown`)
      : d.event === 'rivalry' ? (d.won === true ? `${guild} won its rivalry with ${rivalWords(d.rival)}` : d.won === false ? `${guild} lost its rivalry with ${rivalWords(d.rival)}`
        : `${guild}'s rivalry with ${rivalWords(d.rival)} ended even`)
        : d.event === 'ascendancy' ? `${guild} stood ascendant`
          : d.event === 'schism' ? (chapterDoctrineOk(d.doctrine) ? `${guild}'s schism ended, and it holds to ${DOCTRINE_WORDS[d.doctrine]} for the Season after`
            : `${guild}'s schism ended with neither side carried`)
            : d.event === 'succession' && Number.isSafeInteger(d.heir) ? `${guild}'s hall took a new head` : null;   // CHAP6b
  return did ? `At the end of ${season}, ${did}.` : null;
}

// ─── CHAP6b: THE SCHISM, THE SUCCESSION, THE DOCTRINE (Chapters-Arc 7) ─
// A Schism's two candidates each stand for a doctrine - two of the three, drawn by the event's own roll - and members
// back one with their Merit: at the Season's end the side whose backers earned the chapter more Merit that Season wins,
// and its doctrine holds the next Season. A Succession's three candidates are the hall's residents (named by the client
// off the hall's census - CHAP6c); the Master names the heir by the Season's third Turning, and with no Master's word
// the choice of the backer who earned the chapter the most Merit stands - none named, the hall's own first. The
// Master's backing is the chapter's VOTE (section 6): a Schism's tie goes to the Master's side.

/** THE DOCTRINES a Schism stands for (section 7's "cheaper training, or a deeper shelf, or more writs"), in order. */
export const CHAPTER_DOCTRINES = Object.freeze(['training', 'shelf', 'writs']);
/** Whether `v` names a doctrine. */
export const chapterDoctrineOk = (/** @type {unknown} */ v) => typeof v === 'string' && /** @type {string[]} */ (CHAPTER_DOCTRINES).includes(v);
/** A doctrine in the Chronicle's words. */
const DOCTRINE_WORDS = Object.freeze({ training: 'cheaper training', shelf: 'a deeper shelf', writs: 'more writs' });
/** WHAT A DOCTRINE DOES for its Season: training a further tenth off the hall's training, two qualities deeper on its
 *  shelf (both the client's - CHAP6c), one hall writ more a day (the service's). */
export const CHAPTER_DOCTRINE_EFFECTS = Object.freeze({ training: 0.9, shelf: 2, writs: 1 });
/** The Schism's own salt, beside the events'. */
export const CHAPTER_SCHISM_SALT = 0x5c15;
/** AUDIT CHAP5 D3: THE DOCTRINES A GUILD'S HALLS CAN HOLD - only what DFU's hall sells: training where it trains, the
 *  shelf where it keeps one, more writs everywhere. A knightly order trains nothing and keeps no shelf (KnightlyOrder.cs
 *  :81 TrainingSkills null; guildServices.js trainingSkills); the Fighters Guild keeps no shelf; Kynareth's temple sells
 *  spells, never a potion, a magic item or a soul gem (guildVariants.js TEMPLE_DATA); a hidden guild's hall is DFU's
 *  own on every sheet (the sheet never names it), so its training and shelf are no doctrine's. */
export function chapterDoctrinesFor(/** @type {unknown} */ faction) {
  if (ORDER_SET.has(/** @type {number} */ (faction)) || hallHidden(faction)) return ['writs'];
  if (faction === GUILD_FACTION_IDS.FightersGuild || faction === DIVINES.Kynareth) return ['training', 'writs'];
  return [...CHAPTER_DOCTRINES];
}
/** A SCHISM'S TWO DOCTRINES `[side 0's, side 1's]` for Season `season` at chapter `faction` of `region` - two of the
 *  three, the one the roll leaves out the third; the two in the doctrines' order. AUDIT CHAP5 D3: of its guild's own -
 *  a guild with two, those two; with one, none (it draws no Schism). */
export function schismDoctrinesOf(/** @type {number} */ season, /** @type {number} */ faction, /** @type {number} */ region) {
  const own = chapterDoctrinesFor(faction);
  if (own.length < 3) return own.length === 2 ? own : [];
  const out = drawOf(gateHash(CHAPTER_SCHISM_SALT, season, chapterTitleKey(faction, region)), own.length);   // AUDIT CHAP5 E3
  return own.filter((_, i) => i !== out);
}
/** A Succession's candidates, the hall's residents its roll names. */
export const SUCCESSION_CANDIDATES = 3;
/** The Season's Turning a Succession is named at - its third (the Turning that closes the Season's third week). */
export const SUCCESSION_TURNING = 3;
/** The sides a member may back in `event`: a Schism's two, a Succession's three candidates - none in any other. */
export const chapterSidesOf = (/** @type {unknown} */ event) => (event === 'schism' ? 2 : event === 'succession' ? SUCCESSION_CANDIDATES : 0);
/** Whether `side` is one a member may back in `event`. */
export const chapterBackOk = (/** @type {unknown} */ event, /** @type {unknown} */ side) => Number.isSafeInteger(side) && /** @type {number} */ (side) >= 0 && /** @type {number} */ (side) < chapterSidesOf(event);
/** A SCHISM'S END: `sums` each side's backers' Merit that Season, `master` the Master's side (or null) - the side with more,
 *  the Master's at a tie (its vote), none where neither is carried. */
export function schismWinner(/** @type {[number, number]} */ sums, /** @type {number | null} */ master = null) {
  const [a, b] = [Number(sums?.[0]) || 0, Number(sums?.[1]) || 0];
  if (a > b) return 0;
  if (b > a) return 1;
  return master === 0 || master === 1 ? master : null;
}
/** A SUCCESSION'S HEIR: the Master's naming, else the most-Merit backer's, else the hall's own first. */
export const successionHeir = (/** @type {number | null} */ master, /** @type {number | null} */ top) => (Number.isSafeInteger(master) ? /** @type {number} */ (master) : Number.isSafeInteger(top) ? /** @type {number} */ (top) : 0);
/** A hall writ's day count under a doctrine: one more for "more writs". */
export const doctrineWritCount = (/** @type {number} */ count, /** @type {unknown} */ doctrine) => count + (doctrine === 'writs' ? CHAPTER_DOCTRINE_EFFECTS.writs : 0);

// ─── CHAP6c: A CHAPTER'S SEASON, AS THE CLIENT READS IT (Chapters-Arc 7, 9) ─
/** A doctrine in words ("cheaper training"), or null. */
export const chapterDoctrineWords = (/** @type {unknown} */ d) => (chapterDoctrineOk(d) ? DOCTRINE_WORDS[/** @type {'training' | 'shelf' | 'writs'} */ (d)] : null);
/**
 * A CHAPTER'S SEASON as the sheet or the board says it - `{ event, season, rival, shut, doctrine, sides, heir }`, each
 * checked and anything else none: the Season's event, the Season's number (its candidates' names are drawn on it), a
 * Rivalry's rival (a hidden one is never sent to a stranger), its halls shut, the doctrine holding, a Schism's two
 * doctrines, a Succession's heir once named.
 * @param {any} c
 */
export function chapterSeasonOf(c) {
  const event = chapterEventOk(c?.event) ? String(c.event) : null;
  return {
    event,
    season: Number.isSafeInteger(c?.season) && c.season >= 0 ? c.season : null,
    rival: event === 'rivalry' && isRollFaction(c?.rival) ? c.rival : null,
    shut: c?.shut === true,
    doctrine: chapterDoctrineOk(c?.doctrine) ? String(c.doctrine) : null,
    sides: event === 'schism' && Array.isArray(c?.sides) && c.sides.length === 2 && c.sides.every(chapterDoctrineOk) ? [String(c.sides[0]), String(c.sides[1])] : null,
    heir: event === 'succession' && chapterBackOk('succession', c?.heir) ? c.heir : null,
  };
}

// ─── CHAP6d: THE SEASON ON THE HALLS (Chapters-Arc 7) ───────────────
// What a chapter's Season does to its halls, online, laid over the band (CHAP3c) as the band is laid over DFU: an
// Ascendancy's halls a further tenth off their training, a spell bought and a spell made; "cheaper training" a further
// tenth off the training; "a deeper shelf" two qualities more on the shelf (DFU's stock law reads a hall's quality for the
// count alone - more items, never better ones). Shut halls serve nothing for the Season. Offline, and for a chapter the
// sheet does not name, the hall is DFU's own.

/** The services a Season prices: training, and a spell bought or made. */
export const CHAPTER_HALL_SERVICES = Object.freeze(['training', 'spells']);
/** A HALL'S PRICE FACTOR for `service` ('training' or 'spells') by its chapter as the sheet says it (`{ strength, event,
 *  doctrine }` - chapterSheet.js chapterOf's), or 1 for none: its band's (chapterPriceFactor), an Ascendancy's tenth, the
 *  training's doctrine's tenth. CHAP7b: `guildId` the reader's player guild - its patron's members pay the Thriving
 *  band's price whatever the chapter's Strength (Chapters-Arc 8), the Season's tenths on it as on anyone's. */
export function chapterHallFactor(/** @type {any} */ chapter, /** @type {string} */ service, /** @type {string | null} */ guildId = null) {
  if (!chapter) return 1;
  const s = chapterSeasonOf(chapter);
  const band = chapterPatronMember(chapter, guildId) ? CHAPTER_PATRON_PRICE : chapterPriceFactor(chapter.strength);
  return band * (s.event === 'ascendancy' ? CHAPTER_EVENT_EFFECTS.ascendancyPrice : 1)
    * (service === 'training' && s.doctrine === 'training' ? CHAPTER_DOCTRINE_EFFECTS.training : 1);
}
/** A HALL'S SHELF QUALITY by its chapter as the sheet says it: its band's step and "a deeper shelf"'s two
 *  (chapterShelfQuality's bounds) - DFU's own quality with no chapter. */
export const chapterHallShelf = (/** @type {number} */ quality, /** @type {any} */ chapter) => (chapter
  ? chapterShelfQuality(quality, chapter.strength, chapterSeasonOf(chapter).doctrine === 'shelf' ? CHAPTER_DOCTRINE_EFFECTS.shelf : 0) : quality);
/** Whether a hall's chapter's halls are shut this Season (a Crackdown's end) - its services refused. */
export const chapterHallShut = (/** @type {any} */ chapter) => chapterSeasonOf(chapter).shut;
/** What a shut hall says. */
export const CHAPTER_HALL_SHUT_LINE = 'The hall is shut this Season, by the watch\'s order.';

// ─── CHAP7a: THE PATRONS (Chapters-Arc 8, CALL 6) ───────────────────
// A player guild (GUILD1) may be a chapter's patron for a Season: its guildmaster bids silver from the guild's treasury
// for the Season after this one, held in escrow; at the Turning that opens that Season the highest bid wins and is
// burnt, every other bid goes home. A patron's banner hangs in the chapter's halls and its members pay the Thriving
// band's prices there (CHAP7b); the Chronicle names it. A patron gains no seat influence (CALL 6). Never a hidden guild's
// chapter: a patron's banner would say where the underworld keeps its halls.

/** The least a guild bids for a chapter's patronage, in Marks (silver) - an eighth of a palace's claim fee. */
export const CHAPTER_PATRON_MIN = 1000;
/** Whether `marks` is a guild's bid, `prev` its standing one for the same chapter and Season (0 for none): whole, at
 *  least the least, more than it stood at, never past the cap a treasury keeps. */
export const patronBidOk = (/** @type {unknown} */ marks, prev = 0) => Number.isSafeInteger(marks) && /** @type {number} */ (marks) >= CHAPTER_PATRON_MIN
  && /** @type {number} */ (marks) > prev && /** @type {number} */ (marks) <= MARKS_MAX;
/** The ledger's escrow id for a guild's bid on a chapter's Season - `patron:<Season>:<chapter's key>:<guild>`. */
export const patronEscrowId = (/** @type {number} */ season, /** @type {number} */ f, /** @type {number} */ region, /** @type {string} */ guild) => `patron:${season}:${chapterTitleKey(f, region)}:${guild}`;
/** THE WINNING BID of `bids` `[{ guild, amount, at }]` - the highest; at a tie the one that stood at it first, then the
 *  lower guild id - or null for none. */
export function patronWinnerOf(/** @type {Iterable<any>} */ bids) {
  let best = null;
  for (const b of bids) {
    if (!b || typeof b.guild !== 'string' || !Number.isSafeInteger(b.amount)) continue;
    if (!best || b.amount > best.amount || (b.amount === best.amount && (b.at < best.at || (b.at === best.at && b.guild < best.guild)))) best = b;
  }
  return best;
}
/** A chapter's patron as the sheet or the board says it - `{ id, name, tag }`, each checked - or null. */
export function chapterPatronOf(/** @type {any} */ p) {
  if (!p || typeof p.id !== 'string' || !GUILD_ID_RE.test(p.id) || typeof p.name !== 'string' || !p.name.trim()) return null;
  return { id: p.id, name: p.name.trim().slice(0, GUILD_NAME_MAX), tag: typeof p.tag === 'string' && GUILD_TAG_RE.test(p.tag) ? p.tag : '' };
}
/** THE CHRONICLE'S PATRON ROW in words: "For the Season of Morning Star, the Iron Wolves took the patronage of the
 *  Fighters Guild." - null for a row it has no words for or a hidden guild's. */
export function chapterPatronLine(/** @type {any} */ row) {
  if (row?.kind !== 'patron' || !isRollFaction(row?.faction) || hallHidden(row.faction)) return null;
  const season = seatSeasonName(row?.data?.season);
  const name = typeof row?.data?.name === 'string' ? row.data.name.trim().slice(0, GUILD_NAME_MAX) : '';
  if (!season || !name) return null;
  return `For ${season}, ${name} took the patronage of the ${hallPosterName(row.faction)}.`;
}

// ─── CHAP7b: THE PATRONS ON THE CLIENT (Chapters-Arc 8, CALL 6) ─────
// A patron's members pay the Thriving band's prices in its chapter's halls, whatever the chapter's Strength; the board
// names a chapter's patron, and offers its own guild's guildmaster the bid for the Season after.

/** The band whose prices a patron's members pay (CALL 6). */
export const CHAPTER_PATRON_BAND = 'thriving';
/** That band's price factor. */
export const CHAPTER_PATRON_PRICE = /** @type {{ price: number }} */ (CHAPTER_BANDS.find((b) => b.band === CHAPTER_PATRON_BAND)).price;
/** Whether the reader's player guild (`guildId`) is the chapter's patron this Season. */
export const chapterPatronMember = (/** @type {any} */ chapter, /** @type {unknown} */ guildId) => typeof guildId === 'string' && guildId !== '' && chapter?.patron?.id === guildId;
/** What a guildmaster's board offers to bid: none standing, the least, twice it and five times it; else its standing bid
 *  raised by 500, 1,000 and 5,000 - each under the cap. */
export const CHAPTER_PATRON_RAISES = Object.freeze([500, 1000, 5000]);
export function chapterPatronBidsOf(/** @type {any} */ bid) {
  const now = Number.isSafeInteger(bid?.marks) && bid.marks > 0 ? bid.marks : 0;
  const offers = now ? CHAPTER_PATRON_RAISES.map((r) => now + r) : [1, 2, 5].map((k) => k * CHAPTER_PATRON_MIN);
  return offers.filter((m) => patronBidOk(m, now));
}
const silverOf = (/** @type {number} */ n) => `${n.toLocaleString('en-US')} silver`;
/** The board's line for a chapter's patron this Season: "Its patron this Season: Grey Lanterns [GLN]." - null for none. */
export function chapterPatronSheetLine(/** @type {any} */ patron) {
  const p = chapterPatronOf(patron);
  return p ? `Its patron this Season: ${p.name}${p.tag ? ` [${p.tag}]` : ''}.` : null;
}
/** The board's line for a guildmaster's own bid: "Your guild bids 1,500 silver for its patronage in the Season of First
 *  Seed." - or that it has not bid; null for no bid to say. */
export function chapterPatronBidLine(/** @type {any} */ bid) {
  const season = seatSeasonName(bid?.season);
  if (!season || !Number.isSafeInteger(bid?.marks) || bid.marks < 0) return null;
  return bid.marks > 0 ? `Your guild bids ${silverOf(bid.marks)} for its patronage in ${season}.` : `Your guild has not bid for its patronage in ${season}.`;
}
/** What a bid made says: "Your guild bids 1,500 silver for the patronage of the Fighters Guild in the Season of First
 *  Seed." - null for a guild or a Season it cannot name. */
export function chapterPatronBidSaid(/** @type {unknown} */ faction, /** @type {unknown} */ season, /** @type {number} */ marks) {
  const name = seatSeasonName(season);
  if (!isRollFaction(faction) || hallHidden(faction) || !name || !Number.isSafeInteger(marks)) return null;
  return `Your guild bids ${silverOf(marks)} for the patronage of the ${hallPosterName(/** @type {number} */ (faction))} in ${name}.`;
}
