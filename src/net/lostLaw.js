// @ts-check
// LOST-SPOILS (2026-10-22, the owner: "I want to utilize the mailbox as a way to obtain lost items/loot if not picked up
// from a boss. For example, the oblivion gates. Abyss dungeons, elite breaches, etc"; asked whether the floor's leftovers
// should go to the mailbox in place of the pack, or the mailbox stand behind the pack as a safety net: "Mail the
// leftovers"; asked whether a Reliquary death throws away should be mailed too: "No, keep the risk"): THE LOST AND
// FOUND - ITS LAW, the one file the service (server-account/src/lostSpoils.js) and the client (net/lostSpoils.js,
// scenes/spoilsPool.js) both read. The words a piece is written with are the service's (lostSpoils.js LOST_WORDS), as
// the Spire's letters' are (eg.js EG_STAKE_POST): the service writes them, and the client reads them off the box.
//
// A boss's spoils lie on the floor where he fell - the Oblivion Gate's court (scenes/gate/gateCourt.js), the Brass
// Remnant's arena and an Elite Breach's Redoubt (both the Hour's pool, scenes/superDungeon/sdSpoils.js and
// egSpoilsPaid) - and a piece is taken by pressing it (GATE-UX). Leaving with pieces still on the floor had GATHERED
// them into the pack (World-Bosses.md section 7); now each ITEM left there is sent to the server's post (net/postLaw.js,
// the mailbox beside the hourglass) as a piece of its own, from the Lost and Found, and claimed from there into the
// online character being played. Gold still goes to the purse.
//
// THE KILL IS THE SERVICE'S, NOT THE CLIENT'S WORD. A piece is written only under a kill the service itself recorded for
// the asking account off a receipt the relay signed - a gate's `gate_kills` row, an Hour's `sd_kills` row, a Redoubt's
// `eg_redoubts` row that PAID (a Redoubt taken twice in a week pays its gold alone) - within LOST_WINDOW_S of it; and
// each once (a batch a piece: `lost-<kill>-<i>`, `i` the piece's place in the spoils as rolled, under server_post's own
// one-a-batch index), so a send asked again after its answer was lost sends nothing twice. The roll is the client's (it
// reads the player's world as well as the seed - systems/gate/gateSpoils.js), so what a piece holds is the client's
// word, judged by the item law as every checkpoint's pieces are; and its claim is charged to the wealth budget as a
// piece taken off the floor is (post.js claimPost - never `witnessed`), so the mailbox is no road past it.
//
// Not a DFU member: Daggerfall Unity has no boss spoils and no post. Ledger A row (ONLINE).
import { postItemHead, POST_BATCH_RE } from './postLaw.js';
import { sdSpoilsSlot } from '../systems/superDungeon/sdSpoils.js';
import { egSpoilsOf } from '../systems/eliteGates/egSpoils.js';

/** Every batch the Lost and Found writes begins so - and none the operator's workflow or the Spire's letters write. */
export const LOST_BATCH = 'lost-';
/** A piece's place in its spoils is under this: so a kill can never hold more pieces in the post than this, whatever is
 *  asked (the largest spoils rolled - a Valkynaz's Redoubt, twice the passes - stand well under it). */
export const LOST_INDEX_MAX = 32;
/** An item's record, as JSON, is no longer than this - and a send's whole body no longer than LOST_BODY_MAX (the service
 *  reads it to that, past its 4 KiB for every other route - service.js MAX_BODY_BYTES): the largest spoils rolled send
 *  4.4 KB, each piece at most 0.6 KB (test/scenes/lostspoils_pool.test.js measures them). */
export const LOST_ITEM_BYTES = 4096;
export const LOST_BODY_MAX = 32 * 1024;
/** A kill's leftovers are taken this long after the service recorded it, and no longer - a day past a receipt's week
 *  (net/gate/gateReceipt.js RECEIPT_TTL_S), its last chance to be claimed. */
export const LOST_WINDOW_S = 8 * 24 * 3600;
/** The most Lost and Found pieces an account may have waiting unclaimed: past it a floor's leftovers go to the pack. */
export const LOST_WAITING_MAX = 150;
/** The device gives up asking after this long, and gives the pieces to the pack: past the window the service never takes
 *  them. */
export const LOST_OWED_MAX_MS = LOST_WINDOW_S * 1000;
/** The refusals that will never become a yes, asked again - the client gives those pieces to the pack at once. Every other
 *  answer (no session, offline, the service's own failure, a kill not yet recorded) is asked again later. `body`: a send
 *  past LOST_BODY_MAX; `not-found` and `method`: a service from before LOST-SPOILS. */
export const LOST_FINAL = Object.freeze(['post-needs-account', 'lost-pieces', 'lost-item', 'lost-spent', 'lost-full', 'body', 'not-found', 'method']);

/**
 * THE KILL A FLOOR'S DAY NAMES - the spoils pool's own key for a receipt (scenes/spoilsPool.js `rec.day`): a gate's day
 * (a number), an Hour's slot (`sd:<slot>`, systems/superDungeon/sdSpoils.js sdSpoilsDay) or a breach's Redoubt
 * (`eg:<breach>:<w>`, systems/eliteGates/egSpoils.js egSpoilsDay). `key` is its part of a batch. Null for any other.
 * @param {unknown} day
 * @returns {{ kind: 'gate', day: number, key: string } | { kind: 'sd', slot: number, key: string } | { kind: 'eg', b: string, w: number, key: string } | null}
 */
export function lostKillOf(day) {
  if (Number.isSafeInteger(day)) return /** @type {number} */ (day) >= 1 ? { kind: 'gate', day: /** @type {number} */ (day), key: `gate-${day}` } : null;
  const slot = sdSpoilsSlot(day);
  if (slot != null) return { kind: 'sd', slot, key: `sd-${slot}` };
  const eg = egSpoilsOf(day);
  return eg ? { kind: 'eg', b: eg.b, w: eg.w, key: `eg-${eg.b}-${eg.w}` } : null;
}

/** A piece's batch: its kill and its place - one a piece an account (0093's ux_server_post_batch). */
export const lostBatchOf = (/** @type {{ key: string }} */ kill, /** @type {number} */ i) => `${LOST_BATCH}${kill.key}-${i}`;
/** Whether a batch is the Lost and Found's. */
export const isLostBatch = (/** @type {unknown} */ batch) => typeof batch === 'string' && batch.startsWith(LOST_BATCH);

/**
 * A SEND'S PIECES, checked for their shape (the item law is the service's): one to LOST_INDEX_MAX of them, each a place
 * under LOST_INDEX_MAX - no place twice - and an item the box can name, within LOST_ITEM_BYTES, carrying no service-made
 * identity: a crafted piece's `provenance` is refused, and a `uid` (a checkpoint's stamp - systems/item/itemIds.js) is
 * dropped, so the piece the post holds is a new one to the ledger. Answers `{ pieces }` or `{ error: 'lost-pieces' }`.
 * @param {unknown} pieces
 * @returns {{ pieces: Array<{ i: number, item: any }> } | { error: 'lost-pieces' }}
 */
export function lostPiecesOf(pieces) {
  if (!Array.isArray(pieces) || pieces.length < 1 || pieces.length > LOST_INDEX_MAX) return { error: 'lost-pieces' };
  const seen = new Set(), out = [];
  for (const p of pieces) {
    const i = p?.i, item = p?.item;
    if (!Number.isSafeInteger(i) || i < 0 || i >= LOST_INDEX_MAX || seen.has(i)) return { error: 'lost-pieces' };
    if (!item || typeof item !== 'object' || Array.isArray(item) || item.provenance != null || !postItemHead(item)) return { error: 'lost-pieces' };
    const { uid: _uid, ...kept } = item;
    let bytes = 0;
    try { bytes = new TextEncoder().encode(JSON.stringify(kept)).byteLength; } catch { return { error: 'lost-pieces' }; }
    if (bytes > LOST_ITEM_BYTES) return { error: 'lost-pieces' };
    seen.add(i);
    out.push({ i, item: kept });
  }
  return { pieces: out };
}

// The batches fit the post's own shape, for the longest kill and place a send can name.
if (!POST_BATCH_RE.test(lostBatchOf({ key: `eg-${'f'.repeat(16)}-99999` }, LOST_INDEX_MAX - 1))) throw new Error('LOST-SPOILS: a batch past the post\'s shape');
