// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP1 (2026-10-07) — THE ROLL, AS THE PLAYING TAB KEEPS IT: a realm
// character's standing with Daggerfall's guilds read from the account
// service as it comes online, and what moves claimed back.
//
// Mac: "Server-owned" (bible/11-Multiplayer/Chapters-Arc.md section 3).
// net/npcChapterLaw.js holds the law; server-account/src/npcRoll.js keeps
// the Roll; this file decides WHEN to ask and what to hold. Its audit is
// bible/01-Overview/Audit-Chapters.md (AUDIT CHAP).
//
// ═══ THE SERVICE'S WORD IS THE STANDING ════════════════════════════
//
// The first read carries the save's standing as a seed (taken only if the
// Roll has none) and answers the Roll: its twenty-two reputations are
// written over the entity's. From then on DFU's own law moves them on
// this machine - a quest, a donation, a crime - and what moved since the
// Roll's last word is claimed, at most once a ROLL_CLAIM_MS, and only when
// something did (CHAP2a: at once after a hall writ - `refresh`). The answer is adopted the same way (rollAdopt): the
// service's number, plus whatever moved here and was not sent.
//
// ═══ WHAT WAS NEVER CLAIMED IS KEPT IN THE SAVE ═════════════════════
//
// AUDIT CHAP C1/T1: the page's last claim, sent as it went, never went -
// the realm session gives its lease up first, and the service clears it.
// AUDIT CHAP C2/C4: a first read wrote the Roll over every move the page
// had made before it landed, and a session played while the Roll was shut
// or stopped was reverted the next time. One answer closes all three: each
// adoption is KEPT - the Roll's sequence and its twenty-two (`keep`, the
// host's mod-save record, so it rides every checkpoint) - and the next
// page's first read, finding the Roll still at that sequence, knows that
// whatever the save holds past it was never claimed, and claims it. A
// Roll whose claims moved on since (a claim the save never saw) keeps only what
// moved on this page (`values0`, the standing as the page first saw it):
// nothing is ever claimed twice.
//
// CHAP2a: A HALL WRIT'S CREDIT IS ASKED FOR. A hall writ delivered moves
// the Roll on the service alone (+2 to its guild, professions.js
// deliverWrit), so the host asks `refresh()`: the next tick claims even
// with nothing moved here, and the answer - the Roll's word - is adopted
// as every answer is. Nothing is claimed twice: an empty claim moves
// nothing, and rollAdopt keeps what moved here and was not sent.
//
// AUDIT CHAP2 C1: THE KEPT SEQUENCE IS THE CLAIM SEQUENCE. A hall writ's
// credit and owed paid move the Roll on the service alone, additively; the
// service's `seq` is its CLAIM sequence (npcRoll.js `kseq`), moved only by
// a claim that credits a line, so neither makes the next page drop what its
// save held unclaimed.
//
// A CLAIM THE NETWORK LOST IS SENT AGAIN AS IT WAS - the same id, the same
// lines - so a claim that landed while its answer was lost is answered as
// a repeat and never credited twice; what moved since rides the next one.
// A refusal that names a shape or a shut Roll ends the tracker for the page
// (ROLL_STOPS), a lease's for that lease alone (AUDIT CHAP2 C4; AUDIT CHAP4
// R17); anything else is asked again, waiting longer each time. Shut, the save keeps the standing exactly as before CHAP1.
//
// CHAP4b: AND RANKS 8 AND 9 ARE SEATS. Every adoption holds the book's
// own rank at 7 (`cap`, rollBookCap - said once a hold, `onCapped`), and
// keeps the Roll's word on the character's seats (`seats`, said as they
// stand at the page's first word and as they move, `onSeats`); the host
// seats the book at its chapter's halls (scenes/worldModes.js).
//
// Pure but for `rollEntityDoors`, the host's glue: the clock, the service
// and the entity's standing are arguments.
// ═══════════════════════════════════════════════════════════════════

import {
  ROLL_FACTIONS, ROLL_CLAIM_MS, ROLL_RETRY_MS, ROLL_RETRY_MAX_MS, rollDeltasOf, rollAdopt, rollMembersKey, rollMembersOf, rollRep, rollKeptOf,
  rollBookCap, rollSeatsOf, ROLL_SEATS_MS,
} from './npcChapterLaw.js';
import { setReputation } from '../systems/factionRep.js';

/** The refusals that end the tracker for this page - the Roll shut, the character no longer this tab's, the account
 *  gone, or a shape the service will not take (a build to update). Every other is asked again. */
export const ROLL_STOPS = Object.freeze(['chapters-closed', 'lease', 'no-realm-character', 'no-data', 'dead', 'auth', 'no-session', 'body', 'roll-seed', 'roll-claim']);

/** A claim's own id: twelve random bytes, hex. */
export function rollRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = rand(new Uint8Array(12));
  let out = '';
  for (const x of b) out += x.toString(16).padStart(2, '0');
  return out;
}

/** The twenty-two as a faction store holds them (factionRep.js's `dict`): `{ [id]: rep }`, a faction it has no row for
 *  left out - or null with no store (FACTION.TXT not read yet). */
export function rollValuesOf(/** @type {any} */ store) {
  if (!store?.dict?.get) return null;
  /** @type {Record<number, number>} */
  const out = {};
  for (const f of ROLL_FACTIONS) {
    const row = store.dict.get(f);
    if (row) out[f] = rollRep(row.rep);
  }
  return out;
}

/** THE HOST'S GLUE (AUDIT CHAP T5: the five lines world.js held as text alone): the entity's standing read, the Roll's
 *  word written through DFU's own door (SetReputation), and its memberships - null with no book to read. */
export function rollEntityDoors(/** @type {() => any} */ entityOf) {
  return {
    read: () => rollValuesOf(entityOf()?.factionRep),
    write: (/** @type {Record<number, number>} */ values) => {
      const store = entityOf()?.factionRep;
      if (store) for (const [f, rep] of Object.entries(values)) setReputation(store, Number(f), rep);
    },
    // AUDIT CHAP4 D1: the active book the curse reads (guilds.js activeMemberships' own test) - its lines awake, the other's dormant
    members: () => rollMembersOf(entityOf()?.guildMemberships, rollVampireOf(entityOf())),
    cap: () => rollBookCap(entityOf()?.guildMemberships),   // CHAP4b: the book held at 7
  };
}

/** A Roll's members as a claim carries them: `[{ f, rank, d? }]` (AUDIT CHAP4 D1: a dormant line's mark). */
const membersOf = (/** @type {any} */ list) => (Array.isArray(list) ? list.map((m) => (m.d === 1 ? { f: m.f, rank: m.rank, d: 1 } : { f: m.f, rank: m.rank })) : []);
/** AUDIT CHAP4 D1: whether the entity's ACTIVE book is the vampire's - guilds.js activeMemberships' own reading of the
 *  curse (DFU's GuildManager.Memberships: HasVampirism). */
export const rollVampireOf = (/** @type {any} */ entity) => !!(entity?.racialOverride && !entity.racialOverride.ended && entity.racialOverride.racial === 'vampirism');

/**
 * The tracker. `io` is accountClient.js accountRoll's door (`read`, `claim`); `character()` and `lease()` the realm
 * character this tab plays and its lease (null: not playing - nothing is asked); `read()` the twenty-two as the entity
 * holds them now (rollValuesOf - null before its store stands); `write(values)` puts the Roll's word on the entity;
 * `members()` its memberships (rollMembersOf - null with no book); `kept()` the last adoption as the save keeps it and
 * `keep(k)` the new one (the host's mod-save record). `onCeiling(factions)` hears the lines the day's pace cut;
 * `onStop(error)` the refusal that ended it. CHAP4b: `cap()` holds the book at 7 (rollBookCap - the guild factions it
 * held), `onCapped(factions)` hears them; `onSeats(seats, before)` the character's seats at each adoption (`before` null
 * at the first).
 * @param {{ io: any, character: () => string | null, lease: () => string | null, read: () => Record<number, number> | null,
 *   write: (values: Record<number, number>) => void, members: () => { f: number, rank: number }[] | null,
 *   kept?: () => unknown, keep?: (k: { seq: number, factions: Record<number, number> }) => void, now?: () => number,
 *   rid?: () => string, onCeiling?: (factions: number[]) => void, onStop?: (error: string) => void, cap?: () => number[],
 *   onCapped?: (factions: number[]) => void, onSeats?: (seats: { f: number, region: number, seat: string }[], before: { f: number, region: number, seat: string }[] | null) => void }} o
 */
export function createRollTracker({
  io, character, lease, read, write, members, kept = () => null, keep = () => {}, now = () => Date.now(), rid = () => rollRid(),
  onCeiling = () => {}, onStop = () => {}, cap = () => [], onCapped = () => {}, onSeats = () => {},
}) {
  /** @type {Record<number, number> | null} the Roll's last word, as adopted */
  let base = null;
  /** @type {Record<number, number> | null} the standing as this page first saw it - what moved since is this page's */
  let values0 = null;
  /** @type {{ rid: string, deltas: Record<number, number>, members: { f: number, rank: number }[] | null } | null} */
  let pending = null;
  /** @type {string | null} */
  let stopped = null;
  let busy = false, nextAt = 0, wait = ROLL_RETRY_MS, lastSentAt = -Infinity;
  /** AUDIT CHAP4 C1: when the Roll's word (and its seats) was last heard - every adoption, the first read's too */
  let heardAt = -Infinity;
  // CHAP2a: a refresh asked (askGen) and answered (doneGen) - AUDIT CHAP2 C3: a claim sent before the refresh and
  // answered after it answers the older Roll, and leaves the refresh asked
  let askGen = 0, doneGen = 0;
  /** @type {string | null} */
  let heldKey = null;
  /** @type {string | null} the lease a 'lease' refusal came under (AUDIT CHAP2 C4) */
  let stoppedLease = null;
  /** @type {{ f: number, region: number, seat: string }[] | null} CHAP4b: the character's seats, as the Roll last said */
  let seats = null;

  const fail = (/** @type {string} */ error, /** @type {string | null} */ ls = null) => {
    if (ROLL_STOPS.includes(error)) { stopped = error; stoppedLease = ls; onStop(error); return; }
    if (error === 'roll-unseeded') { base = null; pending = null; }   // no Roll after all: read (and seed) again
    nextAt = now() + wait;
    wait = Math.min(ROLL_RETRY_MAX_MS, wait * 2);
  };
  const adopt = (/** @type {Record<number, number>} */ from, /** @type {Record<number, number>} */ sent, /** @type {any} */ roll) => {
    const a = rollAdopt(read() ?? from, from, sent, roll.factions);
    write(a.local);
    base = a.base;
    keep({ seq: roll.seq, factions: a.base });
    heldKey = rollMembersKey(membersOf(roll.members));
    wait = ROLL_RETRY_MS;
    nextAt = now();
    // CHAP4b: the book held at 7, and the seats kept - each said
    const held = cap();
    if (held.length) onCapped(held);
    const before = seats;
    seats = rollSeatsOf(roll.seats);
    heardAt = now();
    onSeats(seats, before);
  };

  async function first(/** @type {string} */ id, /** @type {string} */ ls, /** @type {Record<number, number>} */ values) {
    const r = await io.read(id, ls, { factions: values, members: members() });
    if (!r.ok) return fail(r.error, ls);
    const roll = r.data?.roll;
    if (!roll) return fail('roll-seed');   // a seed went with it, so the Roll stands - or the service took none
    // the base the answer is adopted over: the seed itself, when this read made the Roll; the kept adoption, when the Roll
    // still stands where the save last saw it (whatever the save holds past it was never claimed); else this page's start
    const k = rollKeptOf(kept());
    const from = r.data.seeded ? values : k && k.seq === r.data.from ? k.factions : /** @type {Record<number, number>} */ (values0);
    adopt(from, {}, roll);
  }

  /** The claim due now, or null: the one still out, or what moved since the Roll's last word. */
  const due = (/** @type {Record<number, number>} */ cur) => {
    if (pending) return pending;
    const deltas = rollDeltasOf(cur, /** @type {Record<number, number>} */ (base));
    const list = members();
    const key = rollMembersKey(list);
    const asked = askGen > doneGen;
    // AUDIT CHAP4 C1: nothing moved - asked again all the same once ROLL_SEATS_MS old, so a Turning's seats reach the page
    // (a seat lost kept its rank at the halls for as long as the page stood; a seat won waited for some claim)
    if (!asked && !Object.keys(deltas).length && (key === null || key === heldKey) && now() - heardAt < ROLL_SEATS_MS) return null;
    if (!asked && now() - lastSentAt < ROLL_CLAIM_MS) return null;   // CHAP2a: a refresh is asked at once (a writ's, three a day)
    pending = { rid: rid(), deltas, members: list };
    return pending;
  };

  async function claim(/** @type {string} */ id, /** @type {string} */ ls, /** @type {Record<number, number>} */ cur) {
    const c = due(cur);
    if (!c) return;
    const from = /** @type {Record<number, number>} */ (base);
    const g = askGen;
    lastSentAt = now();
    const r = await io.claim(id, ls, c.rid, c.deltas, c.members);
    if (!r.ok) return fail(r.error, ls);   // kept: sent again as it was
    pending = null;
    doneGen = Math.max(doneGen, g);
    adopt(from, c.deltas, r.data.roll);
    // AUDIT CHAP2 C2 (= D1): the book as SENT is what the next claim compares with - the Roll records it by its own law
    // (a rank above the Roll's reputation between DFU's reviews, a join under the floor), so comparing with its answer
    // claimed again every minute for as long as the two differed
    if (c.members) heldKey = rollMembersKey(c.members);
    const credited = r.data.credited ?? {};
    const cut = Object.keys(c.deltas).map(Number).filter((f) => c.deltas[f] > 0 && (credited[f] ?? c.deltas[f]) < c.deltas[f]);
    if (cut.length) onCeiling(cut);
  }

  return {
    /** Called every frame: asks when something is due, never two at once. */
    tick() {
      // AUDIT CHAP2 C4: a 'lease' refusal ends the asking for that lease alone - the page gives its lease up as it hides
      // and takes a new one as it shows (scenes/world.js), and a claim caught between the two must not end the page's Roll
      if (stopped === 'lease' && lease() && lease() !== stoppedLease) { stopped = null; nextAt = 0; }
      if (stopped || busy || now() < nextAt) return;
      const id = character(), ls = lease();
      if (!id || !ls) return;
      const values = read();
      if (!values) return;
      values0 ??= values;
      busy = true;
      (base ? claim(id, ls, values) : first(id, ls, values))
        .catch(() => fail('server'))
        .finally(() => { busy = false; });
    },
    /** CHAP2a: the Roll moved on the service (a hall writ's credit) - the next tick claims, and the answer is adopted. */
    refresh() {
      if (stopped || !base) return;   // before the first read the read itself answers the Roll
      askGen++;   // a failure's wait still holds: the claim goes when the service is asked again
    },
    get held() { return base != null; },
    get stopped() { return stopped; },
    /** CHAP4b: the character's seats, `[{ f, region, seat }]` - none before the Roll's first word. */
    get seats() { return seats ?? []; },
  };
}
