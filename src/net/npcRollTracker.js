// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP1 (2026-10-07) — THE ROLL, AS THE PLAYING TAB KEEPS IT: a realm
// character's standing with Daggerfall's guilds read from the account
// service as it comes online, and what moves claimed back.
//
// Mac: "Server-owned" (bible/11-Multiplayer/Chapters-Arc.md section 3).
// net/npcChapterLaw.js holds the law; server-account/src/npcRoll.js keeps
// the Roll; this file decides WHEN to ask and what to hold.
//
// ═══ THE SERVICE'S WORD IS THE STANDING ════════════════════════════
//
// The first read carries the save's standing as a seed (taken only if the
// Roll has none) and answers the Roll: its twenty-two reputations are
// written over the entity's, whatever the save said. From then on DFU's
// own law moves them on this machine - a quest, a donation, a crime - and
// what moved since the Roll's last word is claimed, at most once a
// ROLL_CLAIM_MS, and only when something did. The answer is adopted the
// same way (rollAdopt): the service's number, plus whatever moved here
// while the claim was out, which is the next claim's.
//
// A CLAIM THE NETWORK LOST IS SENT AGAIN AS IT WAS - the same id, the same
// lines - so a claim that landed while its answer was lost is answered as
// a repeat and never credited twice; what moved since rides the next one.
// A refusal that names a shape, a lease or a shut Roll ends the tracker for
// the page (ROLL_STOPS); anything else is asked again, waiting longer each
// time. Shut, the save keeps the standing exactly as before CHAP1.
//
// Pure: the clock, the service and the entity's standing are arguments.
// ═══════════════════════════════════════════════════════════════════

import {
  ROLL_FACTIONS, ROLL_CLAIM_MS, ROLL_RETRY_MS, ROLL_RETRY_MAX_MS, rollDeltasOf, rollAdopt, rollMembersKey, rollRep,
} from './npcChapterLaw.js';

/** The refusals that end the tracker for this page - the Roll shut, the character no longer this tab's, the account
 *  gone, or a shape the service will not take (a build to update). Every other is asked again. */
export const ROLL_STOPS = Object.freeze(['chapters-closed', 'lease', 'no-realm-character', 'dead', 'auth', 'no-session', 'body', 'roll-seed', 'roll-claim']);

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

/** A Roll's members as a claim carries them: `[{ f, rank }]`. */
const membersOf = (/** @type {any} */ list) => (Array.isArray(list) ? list.map((m) => ({ f: m.f, rank: m.rank })) : []);

/**
 * The tracker. `io` is accountClient.js accountRoll's door (`read`, `claim`); `character()` and `lease()` the realm
 * character this tab plays and its lease (null: not playing - nothing is asked); `read()` the twenty-two as the entity
 * holds them now (rollValuesOf - null before its store stands); `write(values)` puts the Roll's word on the entity;
 * `members()` its memberships (npcChapterLaw.js rollMembersOf). `onCeiling(factions)` hears the lines the day's bound
 * cut; `onStop(error)` the refusal that ended it.
 * @param {{ io: any, character: () => string | null, lease: () => string | null, read: () => Record<number, number> | null,
 *   write: (values: Record<number, number>) => void, members: () => { f: number, rank: number }[], now?: () => number,
 *   rid?: () => string, onCeiling?: (factions: number[]) => void, onStop?: (error: string) => void }} o
 */
export function createRollTracker({ io, character, lease, read, write, members, now = () => Date.now(), rid = () => rollRid(), onCeiling = () => {}, onStop = () => {} }) {
  /** @type {Record<number, number> | null} the Roll's last word, as adopted */
  let base = null;
  /** @type {{ rid: string, deltas: Record<number, number>, members: { f: number, rank: number }[] } | null} */
  let pending = null;
  /** @type {string | null} */
  let stopped = null;
  let busy = false, nextAt = 0, wait = ROLL_RETRY_MS, lastSentAt = -Infinity;
  /** @type {string | null} */
  let heldKey = null;

  const fail = (/** @type {string} */ error) => {
    if (ROLL_STOPS.includes(error)) { stopped = error; onStop(error); return; }
    if (error === 'roll-unseeded') { base = null; pending = null; }   // no Roll after all: read (and seed) again
    nextAt = now() + wait;
    wait = Math.min(ROLL_RETRY_MAX_MS, wait * 2);
  };
  const adopt = (/** @type {Record<number, number>} */ from, /** @type {Record<number, number>} */ sent, /** @type {any} */ roll) => {
    const a = rollAdopt(read() ?? from, from, sent, roll.factions);
    write(a.local);
    base = a.base;
    heldKey = rollMembersKey(membersOf(roll.members));
    wait = ROLL_RETRY_MS;
    nextAt = now();
  };

  async function first(/** @type {string} */ id, /** @type {string} */ ls, /** @type {Record<number, number>} */ values) {
    const r = await io.read(id, ls, { factions: values, members: members() });
    if (!r.ok) return fail(r.error);
    if (!r.data?.roll) return fail('roll-seed');   // a seed went with it, so the Roll stands - or the service took none
    adopt(values, {}, r.data.roll);
  }

  /** The claim due now, or null: the one still out, or what moved since the Roll's last word. */
  const due = (/** @type {Record<number, number>} */ cur, /** @type {boolean} */ hurry) => {
    if (pending) return pending;
    const deltas = rollDeltasOf(cur, /** @type {Record<number, number>} */ (base));
    const list = members();
    if (!Object.keys(deltas).length && rollMembersKey(list) === heldKey) return null;
    if (!hurry && now() - lastSentAt < ROLL_CLAIM_MS) return null;
    pending = { rid: rid(), deltas, members: list };
    return pending;
  };

  async function claim(/** @type {string} */ id, /** @type {string} */ ls, /** @type {Record<number, number>} */ cur) {
    const c = due(cur, false);
    if (!c) return;
    const from = /** @type {Record<number, number>} */ (base);
    lastSentAt = now();
    const r = await io.claim(id, ls, c.rid, c.deltas, c.members);
    if (!r.ok) return fail(r.error);   // kept: sent again as it was
    pending = null;
    adopt(from, c.deltas, r.data.roll);
    const credited = r.data.credited ?? {};
    const cut = Object.keys(c.deltas).map(Number).filter((f) => c.deltas[f] > 0 && (credited[f] ?? c.deltas[f]) < c.deltas[f]);
    if (cut.length && !r.data.repeat) onCeiling(cut);
  }

  return {
    /** Called every frame: asks when something is due, never two at once. */
    tick() {
      if (stopped || busy || now() < nextAt) return;
      const id = character(), ls = lease();
      if (!id || !ls) return;
      const values = read();
      if (!values) return;
      busy = true;
      (base ? claim(id, ls, values) : first(id, ls, values))
        .catch(() => fail('server'))
        .finally(() => { busy = false; });
    },
    /** THE PAGE GOES: whatever moved since the last claim, sent now (the door's `leaving` - a browser finishes it after
     *  the page), whatever the minute says. Its answer is nobody's: the next page reads the Roll. */
    leave() {
      if (stopped || !base) return;
      const id = character(), ls = lease(), cur = read();
      if (!id || !ls || !cur) return;
      const c = due(cur, true);
      if (c) io.claim(id, ls, c.rid, c.deltas, c.members, true)?.catch?.(() => {});
    },
    get held() { return base != null; },
    get stopped() { return stopped; },
  };
}
