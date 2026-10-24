// @ts-check
// OUTDOOR-LOOT (2026-10-17, the report: "I can still click on an 'Empty' body and wipe out loot for a party member"; DESIGN.md
// section 3, DESIGN-REVIEW D-1/R-1/R-2): THE WIRE OF A PEER'S FOE'S BODY - the street's and a building's, one pool
// (scenes/exteriorFoes.js). A foe is its spawner's (WORLD6b); its body is the owner's roll, and everyone else stands a puppet
// of it that carries none of the reader's. A body used to be taken as a blind grab: a puppet's press asked the owner
// (`take: 1`) and the owner handed over as much of the WHOLE pile as one frame carries - the clicker chose nothing, the
// plaque read "Empty" over a full body, and a grant more than TAKE_WINDOW_MS late was refused with nothing sent back, the
// loot gone. Now the body is ONE LIST, and what rides is its TAKES:
//   - THE DIGEST (`bw`, on the owner's foes frame beside each dead body's record): the body's places - the pieces that may
//     ride a peer's word, in pile order, append-only - how many there are (`l`), which are gone (`x`, a hex bitset, bit p
//     the place p) and which stack is drawn down (`c`, [place, count] - a count that only falls). It only grows: two words
//     merge the same in any order (max `l`, OR of `x`, min of `c`). A generation (`g`) tells one body from another under
//     the same number. Each pool seeds its counter from a random base (GENERATION_SPACE), so it tells apart too a body of
//     the same owner and number minted by an earlier page load of his: the peer id outlives a reload, while the pool's seq
//     and counters start again (S1-2).
//   - THE PEEK (`bp`/`br`): a piece's record is its immutable description, said once, fetched by place - directed, budgeted,
//     in pages under GRANT_FRAME_MAX - by a reader that stands near the body and lacks them. Until it has them the body is
//     UNBORN to it: no target, no plaque, no press (the dungeon's UNBORN law). An older owner's body (no digest) is
//     LEGACY: the name alone, and the legacy `take: 1`.
//   - THE CLAIM (`bq`) and THE VERDICT (`bv`): a take by ANY door - the window, Take all, the quick door's row and its lot -
//     is a claim by place, in one frame per body per settle; the OWNER judges it first come (systems/roomLoot.js
//     judgeRoomClaim) the moment it arrives, never on a frame tick, and says its verdict with the digest AFTER the
//     judgment. The verdict is final (DESIGN-REVIEW D-1): there is no void for a verdict that never left - a claimer that is
//     still present recovers a lost one by its re-ask, answered from the owner's ledger (R-2) wherever the claimer stands
//     (S1-1: the owner's pose list is not the roster), and one that has left kept its piece (systems/loot/claimLedger.js).
//     The claim frame names the generation of the body it was made on, a top-level `g` beside the routing (S1-2): the owner
//     judges a NEW claim only against that body - a claim of an earlier page's body, whose (owner, seq) a new pool has
//     reused, is silence - and answers a claim it already judged from its ledger whatever `g` it names.
// This file is PURE: the digest (encode, validate, merge), the frames' projection, a record's reading, the owner's verdict
// ledger and the constants. The block that runs it is scenes/bodyLootHost.js. It reaches NOTHING the relay does and is never
// imported by anything in the relay's graph (test/importGraph.mjs; net/wire.js is not edited - a digest is a top-level frame
// field, the `qf`/`dz` pattern, never a field of validFoeRecord). Not a DFU member: Daggerfall has one player.
import { validLootList, LOOT_STACK_MAX } from '../systems/loot/loot.js';
import { neverPeerHanded, peerHanded } from '../systems/peerWord.js';
import { ROOM_BASE_MAX, ROOM_CLAIMS_MAX, validRoomId, claimOf } from '../systems/roomLoot.js';
import { FOE_SEQ_MAX } from './wire.js';

/** WORLD6b-iii(c): a grant frame's ceiling, under the wire's MAX_FRAME_BYTES with the envelope's room (the relay refuses a larger one whole). */
export const GRANT_FRAME_MAX = 12 * 1024;
/** A piece's record must fit one frame with the envelope round it: one that cannot is the owner's alone (it never rides). */
export const RECORD_BYTES_MAX = GRANT_FRAME_MAX - 1024;
/** How near the reader stands to ask for a body's records (m); the owner answers within this and two pose slacks. */
export const BODY_PEEK_REACH = 12;
/** A peek unanswered is asked again after this (ms), and names at most this many places. */
export const PEEK_RETRY_MS = 1500;
export const PEEK_PLACES_MAX = 64;
/** The owner's answer budget: FRAMES a second from one peer, never pieces - a Take all of thirty is one frame. Over it: silence, and the asker asks again. */
export const BODY_ASKS_PER_S = 4;
/** The owner's verdict ledger: how long it keeps a verdict (longer than a claim is kept, so a re-ask is always answered) and how many. */
export const VERDICT_KEEP_MS = 600_000;
export const VERDICTS_MAX = 256;
/** The legacy take (an older taker's, or a new taker's at an older owner): a take answered per peer a second. AUDIT WORLD6b-iii(c) A2/B3/C4. */
export const TAKES_PER_S = 3;
/** AUDIT WORLD6b-iii(c) B1/C1: how long one legacy ask stands as the only one in flight at the taker (B8). */
export const TAKE_WINDOW_MS = 3000;
/** AUDIT ONLINE2 F4: how long an owner keeps a legacy grant's pieces for the taker's "I cannot read it" (`back`), ms. */
export const GRANT_BACK_MS = 2 * TAKE_WINDOW_MS;
/** The hex characters of a digest's bitset: ROOM_BASE_MAX places, four to a character. */
export const DIGEST_HEX_MAX = Math.ceil(ROOM_BASE_MAX / 4);
/** S1-2: a pool seeds its bodies' generation counter from a random base below this (30 bits) - a body is (owner, seq, g), and a
 *  reloaded owner's new pool numbers its foes from one again under the same peer id, so a counter started at one named two
 *  bodies. The digest's `g` stays a whole number (validDigest): the base plus the bodies of a page is far inside 2^53. */
export const GENERATION_SPACE = 2 ** 30;

/** The keys of the frames this file speaks, none of them an old applyHit arm's (an older build falls to its blow arm and refuses: no `dmg`). */
export const BODY_KEYS = Object.freeze(['bw', 'bp', 'br', 'bq', 'bv']);

// ---- the digest ---------------------------------------------------------------------------------------------------------

/** @typedef {{ g: number, l: number, x: bigint, c: Map<number, number> }} Digest  a body's takes as a reader holds them */
/** @typedef {{ g: number, l: number, x: string, c?: [number, number][] }} DigestWord  the same on the wire (`x` lowercase hex) */

const HEX_RE = /^[0-9a-f]*$/;

/** A set of places gone as a lowercase hex bitset (bit p is place p; nothing gone: "0"). */
export function hexOfPlaces(/** @type {Iterable<number>} */ places) {
  let x = 0n;
  for (const p of places) if (Number.isInteger(p) && p >= 0 && p < ROOM_BASE_MAX) x |= 1n << BigInt(p);
  return x.toString(16);
}
/** Whether place `p` is gone in a reader's digest. */
export const placeGone = (/** @type {Digest} */ d, /** @type {number} */ p) => ((d.x >> BigInt(p)) & 1n) === 1n;

/**
 * The owner's word of a body's takes - `{ g, l, x, c? }` - from its state: `generation`, the places there are (`length`),
 * the set gone (`taken`) and the stacks drawn down (`counts`, a place gone carries none).
 */
export function digestWord(/** @type {number} */ generation, /** @type {number} */ length, /** @type {Set<number>} */ taken, /** @type {Map<number, number>} */ counts) {
  /** @type {[number, number][]} */
  const c = [...counts].filter(([p]) => !taken.has(p)).sort((a, b) => a[0] - b[0]);
  return { g: generation, l: length, x: hexOfPlaces(taken), ...(c.length ? { c } : {}) };
}
/** A digest word as the foes frame's entry: `[i, g, l, x, c?]`. */
export const digestEntry = (/** @type {number} */ i, /** @type {DigestWord} */ d) => (d.c ? [i, d.g, d.l, d.x, d.c] : [i, d.g, d.l, d.x]);
/** A digest word's text, for the foes frame's dedupe key: a take re-sends the record. */
export const digestKey = (/** @type {DigestWord} */ d) => `${d.g}.${d.l}.${d.x}${d.c ? `.${d.c.map(([p, n]) => `${p}:${n}`).join(',')}` : ''}`;

/**
 * A digest word off the wire, projected: `g` a whole number, `l` in [0, ROOM_BASE_MAX], `x` lowercase hex of at most
 * ceil(l/4) characters, `c` pairs `[place < l, count in 1..LOOT_STACK_MAX]`. Anything else is null - that body's digest is
 * ignored, never half landed.
 */
export function validDigest(/** @type {any} */ w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
  const { g, l, x, c } = w;
  if (!Number.isSafeInteger(g) || g < 0 || !Number.isInteger(l) || l < 0 || l > ROOM_BASE_MAX) return null;
  if (typeof x !== 'string' || !HEX_RE.test(x) || x.length > Math.max(1, Math.ceil(l / 4))) return null;
  /** @type {Map<number, number>} */
  const counts = new Map();
  if (c !== undefined) {
    if (!Array.isArray(c) || c.length > ROOM_BASE_MAX) return null;
    for (const pair of c) {
      if (!Array.isArray(pair) || pair.length !== 2) return null;
      const [p, n] = pair;
      if (!Number.isInteger(p) || p < 0 || p >= l || !Number.isInteger(n) || n < 1 || n > LOOT_STACK_MAX) return null;
      counts.set(p, n);
    }
  }
  return /** @type {Digest} */ ({ g, l, x: x === '' ? 0n : BigInt(`0x${x}`), c: counts });
}
/** One entry of the foes frame's `bw`: `[i, g, l, x, c?]` - `{ i, digest }`, or null. */
export function validDigestEntry(/** @type {any} */ e) {
  if (!Array.isArray(e) || (e.length !== 4 && e.length !== 5)) return null;
  const [i, g, l, x, c] = e;
  if (!Number.isInteger(i) || i < 0 || i > FOE_SEQ_MAX) return null;
  const digest = validDigest({ g, l, x, ...(c !== undefined ? { c } : {}) });
  return digest ? { i, digest } : null;
}
/**
 * THE MERGE, monotone: into what a reader already holds of THIS generation - the larger `l`, the union of the places gone,
 * the smaller count of a drawn-down stack - so two words land the same in either order and a stale frame never brings a
 * taken place back. A word of another generation is another body under the same number: the caller starts anew. Answers
 * whether anything changed.
 */
export function mergeDigest(/** @type {Digest} */ into, /** @type {Digest} */ d) {
  let changed = false;
  if (d.l > into.l) { into.l = d.l; changed = true; }
  const x = into.x | d.x;
  if (x !== into.x) { into.x = x; changed = true; }
  for (const [p, n] of d.c) { const was = into.c.get(p); if (was === undefined || n < was) { into.c.set(p, n); changed = true; } }
  return changed;
}

// ---- a record ---------------------------------------------------------------------------------------------------------

/** A record this build cannot read (a newer build's piece - AUDIT SETS M2) and one it must not show (the item law refused it). */
export const BAD = Symbol('bad');
export const HIDDEN = Symbol('hidden');
/** A piece the owner offers as a place: its record (WORLD4's projection, once), frozen - or null when it never rides (a bound piece, a letter of credit, a piece the projection refuses, a piece larger than a frame). */
export function shareableRecord(/** @type {any} */ piece) {
  if (!piece || neverPeerHanded(piece)) return null;
  const list = validLootList([piece]);
  if (!list || list.length !== 1) return null;
  if (JSON.stringify(list[0]).length > RECORD_BYTES_MAX) return null;
  return Object.freeze(list[0]);
}
/** A record off a peek answer, read as THIS build reads a piece: the piece (a copy - nothing from the wire reaches the pack), BAD or HIDDEN. */
export function readRecord(/** @type {any} */ rec) {
  const list = validLootList([rec]);
  if (!list) return BAD;
  const kept = peerHanded(list);
  return kept && kept.length === 1 ? kept[0] : HIDDEN;
}
/**
 * What a reader makes of a body: 'legacy' (no digest ever heard - an older owner: the name alone, the legacy take),
 * 'unreadable' (a present place's record is one this build cannot read), 'unborn' (a present place has no record yet: no
 * target, no plaque) or 'born' (every present place has one, or is hidden for this reader).
 */
export function bodyStateOf(/** @type {Digest | null} */ digest, /** @type {any[]} */ items) {
  if (!digest) return 'legacy';
  let missing = false;
  for (let p = 0; p < digest.l; p++) {
    if (placeGone(digest, p)) continue;
    const it = items[p];
    if (it === BAD) return 'unreadable';
    if (it === undefined) missing = true;
  }
  return missing ? 'unborn' : 'born';
}
/** The places a reader still lacks a record for (not gone), at most `max`, in order. */
export function placesLacking(/** @type {Digest} */ digest, /** @type {any[]} */ items, max = PEEK_PLACES_MAX) {
  /** @type {number[]} */
  const out = [];
  for (let p = 0; p < digest.l && out.length < max; p++) if (!placeGone(digest, p) && items[p] === undefined) out.push(p);
  return out;
}

// ---- the frames ---------------------------------------------------------------------------------------------------------

/** A peek's places: whole numbers in [0, ROOM_BASE_MAX), each once, at most PEEK_PLACES_MAX - or null when `bp` is no list. */
export function validPeek(/** @type {any} */ bp) {
  if (!Array.isArray(bp)) return null;
  /** @type {number[]} */
  const out = [];
  for (const p of bp.slice(0, PEEK_PLACES_MAX)) if (Number.isInteger(p) && p >= 0 && p < ROOM_BASE_MAX && !out.includes(p)) out.push(p);
  return out;
}
/** The claims of a frame sent by `from`: `{ id, p, n }`, the id naming its claimer (no peer claims in another's name), the place and the count in range, each id once, at most ROOM_CLAIMS_MAX. */
export function validClaims(/** @type {any} */ bq, /** @type {string} */ from) {
  if (!Array.isArray(bq)) return null;
  /** @type {{ id: string, p: number, n: number }[]} */
  const out = [];
  for (const c of bq.slice(0, ROOM_CLAIMS_MAX)) {
    if (!c || typeof c !== 'object' || !validRoomId(c.id) || !claimOf(c.id, from)) continue;
    if (!Number.isInteger(c.p) || c.p < 0 || c.p >= ROOM_BASE_MAX || !Number.isInteger(c.n) || c.n < 1 || c.n > LOOT_STACK_MAX) continue;
    if (out.some((o) => o.id === c.id)) continue;
    out.push({ id: c.id, p: c.p, n: c.n });
  }
  return out;
}
/** The verdicts of a frame: `[id, granted]`, or `[id, 0, 1]` withdrawn (a build that voids; none sends it today). */
export function validVerdicts(/** @type {any} */ bv) {
  if (!Array.isArray(bv)) return null;
  /** @type {{ id: string, g: number, withdrawn: boolean }[]} */
  const out = [];
  for (const v of bv.slice(0, ROOM_CLAIMS_MAX * 2)) {
    if (!Array.isArray(v) || (v.length !== 2 && v.length !== 3) || !validRoomId(v[0]) || !Number.isInteger(v[1]) || v[1] < 0 || v[1] > LOOT_STACK_MAX) continue;
    out.push({ id: v[0], g: v[1], withdrawn: v[2] === 1 });
  }
  return out;
}
/** A peek answer's records: `[place, record]` pairs, at most PEEK_PLACES_MAX, a place in range and a record an object. */
export function validRecords(/** @type {any} */ br) {
  if (!Array.isArray(br)) return null;
  /** @type {[number, any][]} */
  const out = [];
  for (const e of br.slice(0, PEEK_PLACES_MAX)) if (Array.isArray(e) && e.length === 2 && Number.isInteger(e[0]) && e[0] >= 0 && e[0] < ROOM_BASE_MAX && e[1] && typeof e[1] === 'object') out.push([e[0], e[1]]);
  return out;
}
/** As many of the asked places' records as fit one frame, in the asked order (a page: the reader asks for the rest). */
export function pageOfRecords(/** @type {number[]} */ places, /** @type {readonly any[]} */ records, /** @type {number} */ room = GRANT_FRAME_MAX - 1024) {
  /** @type {[number, any][]} */
  const out = [];
  let bytes = 2;
  for (const p of places) {
    const rec = records[p];
    if (!rec) continue;
    const n = JSON.stringify(rec).length + String(p).length + 4;
    if (out.length && bytes + n > room) break;
    out.push([p, rec]);
    bytes += n;
  }
  return out;
}
export const peekFrame = (/** @type {string} */ to, /** @type {string | null} */ k, /** @type {number} */ i, /** @type {number[]} */ places) => ({ to, k, i, bp: places });
/** A claim frame: `g` the generation of the body the claims were made on (the digest's own - S1-2), the entries `{ id, p, n }` as ever. */
export const claimsFrame = (/** @type {string} */ to, /** @type {string | null} */ k, /** @type {number} */ i, /** @type {number} */ g, /** @type {{ id: string, p: number, n: number }[]} */ claims) => ({ to, k, i, g, bq: claims.map(({ id, p, n }) => ({ id, p, n })) });
export const answerFrame = (/** @type {string} */ to, /** @type {string | null} */ k, /** @type {number} */ i, /** @type {DigestWord} */ digest, /** @type {[number, any][]} */ records) => ({ to, k, i, bw: digest, br: records });
export const verdictFrame = (/** @type {string} */ to, /** @type {string | null} */ k, /** @type {number} */ i, /** @type {DigestWord | null} */ digest, /** @type {[string, number][]} */ verdicts) => ({ to, k, i, ...(digest ? { bw: digest } : {}), bv: verdicts });

// ---- the owner's verdict ledger ---------------------------------------------------------------------------------------

/**
 * THE OWNER'S VERDICT LEDGER (DESIGN 3.7, R-2): a claim id -> what the owner judged, kept VERDICT_KEEP_MS to VERDICTS_MAX
 * - longer than a claim is kept, so a re-ask is always answered, and OUTLIVING the body (a re-ask after the body is gone
 * is still answered; the judgment was made) and the claimer's place in the owner's pose list (S1-1: the roster is the one
 * check left, at the session's `sendHit`). `inFlight` counts the verdict frames for the claim still waiting in the owner's
 * hit queue: at most one at a time.
 * @param {{ keepMs?: number, max?: number }} [o]
 */
export function makeVerdictLedger({ keepMs = VERDICT_KEEP_MS, max = VERDICTS_MAX } = {}) {
  /** @type {Map<string, { to: string, i: number, bg: number, p: number, g: number, at: number, inFlight: number, flightAt: number }>} */
  const byId = new Map();
  /** The entry for `id` unless it has aged out. */
  function get(/** @type {string} */ id, /** @type {number} */ now) {
    const e = byId.get(id);
    if (!e) return null;
    if (now - e.at > keepMs) { byId.delete(id); return null; }
    return e;
  }
  function set(/** @type {string} */ id, /** @type {{ to: string, i: number, bg: number, p: number, g: number }} */ v, /** @type {number} */ now) {
    byId.delete(id);
    const e = { ...v, at: now, inFlight: 0, flightAt: 0 };
    byId.set(id, e);
    while (byId.size > max) byId.delete(/** @type {string} */ (byId.keys().next().value));
    return e;
  }
  return { get, set, clear: () => byId.clear(), get size() { return byId.size; } };
}
