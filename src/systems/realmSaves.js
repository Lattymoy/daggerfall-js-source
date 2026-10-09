// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1.2 — THE REALM'S CHARACTERS, CLIENT SIDE: the calls, and the
// playing tab's session - its lease, its sequence and its checkpoints.
//
// Mac: "A true separation while allowing people to still play offline";
// decision 1, "Account service". The service's half is
// server-account/src/realm.js; the plan is bible/06-Systems/Realm-Arc.md
// section 2.
//
// ═══ THE SERVICE IS THE TRUTH, SO THE SESSION FOLLOWS ITS WORD ════════
//
// A realm character's save is the service's. This tab plays it under a
// LEASE a join minted, and writes it at the NEXT SEQUENCE only. Three
// answers end the session, and the host takes the character offline:
// `lease` (another tab or device joined it), `no-realm-character` (it
// was deleted) and `auth` (signed out). One answer is resynced rather
// than obeyed: `seq` with the service's own sequence one ahead of ours
// is our own last checkpoint, landed with its answer lost - adopted,
// and the save retried at the next. A network failure keeps the newest
// save for the next checkpoint; nothing here throws.
//
// THE SAVE IS THE SNAPSHOT'S JSON - what a local slot holds under its
// data key (saveSlots.js saveSlot), so a copy to offline is a slot like
// any other, and a join's load parses what a slot load parses.
//
// ═══ RESCUE-SAVE: WHAT THE SERVICE HAS NOT TAKEN, THE DEVICE KEEPS ═══
//
// The 2026-09-30 outage (SwordsmanEB's lost progress): a save the
// service did not take lived in this session's memory alone, so a page
// closed, reloaded or exited while the service was away took everything
// since the last checkpoint that landed - and so did an ordinary close,
// whose going cuts the hidden page's put off. Now the newest save the
// session takes is written to the device (the storage a local slot is
// written to) with the sequence it follows - once its put goes
// unanswered past a grace, at once on a hidden page, or when a put is
// refused or unanswered (AUDIT RESCUE-SAVE A6) - and dropped once a put
// lands with nothing newer behind it. A join whose record still stands
// at that sequence - nothing landed after it, from any tab, device,
// trade or act - plays the kept save and checkpoints it; a record that
// moved past it drops it unread. The copy is the save's text; its put
// packs it as every checkpoint rides (REALM-GZIP, below).
//
// REALM-GZIP: IT RIDES PACKED (net/realmSaveCodec.js). A long life's
// JSON grew past the request's 4 MiB and every checkpoint was refused
// for good; a put packs the text when the service said it opens a packed
// save (`gzip` on the join, create and customs answers), and a read asks
// for the save as stored and opens it here.
// ═══════════════════════════════════════════════════════════════════

import { storedSession, serviceBase, forgetSession, accountRefusalText } from '../net/accountClient.js';
import { realmTradeRefusalText } from '../net/realmTradeLaw.js';   // REALM P2.1: a trade the realm settles
import { REALM_DOOR_WORD } from '../net/wire.js';   // REALM-DOOR: the relay's word for a token that names no realm character
import { gzipText, gunzipText, saveTextOf, canGzip, canGunzip } from '../net/realmSaveCodec.js';   // REALM-GZIP: a save rides packed
import { houseLine } from '../net/houseLaw.js';   // LEGACY7: the house on the roster's tile


/**
 * The service, as this device can reach it - or null when nobody is signed in (cloudSaves.js cloudIo's shape).
 * @param {{ fetch: (url: string, init: object) => Promise<any>, storage: any }} io
 */
export function realmIo({ fetch, storage }) {
  const session = storedSession(storage);
  if (!session) return null;
  return { fetch, base: serviceBase(storage), secret: session.secret, storage, player: typeof session.id === 'string' ? session.id : null };
}

/**
 * ONE DOOR, the credential in a header and nowhere else (AUDIT-ACC F13). `raw` sends the save - its text, or its bytes
 * packed (REALM-GZIP); a raw answer comes back as its `bytes` with the service's sequence. Never throws: a network
 * failure is `{ ok: false, error: 'offline' }`.
 * @param {any} io @param {string} path
 * @param {{ method?: string, json?: any, raw?: string | Uint8Array | null, headers?: Record<string, string>, keepalive?: boolean }} [opts]
 * @returns {Promise<any>}
 */
async function realmAsk(io, path, { method = 'GET', json = null, raw = null, headers: extra = {}, keepalive = false } = {}) {
  if (!io) return { ok: false, error: 'signed-out' };
  /** @type {Record<string, string>} */
  const headers = { accept: 'application/json', authorization: `Bearer ${io.secret}`, ...extra };
  if (json) headers['content-type'] = 'application/json';
  if (raw != null) headers['content-type'] = 'application/octet-stream';
  let res;
  try {
    res = await io.fetch(`${io.base}${path}`, {
      method, headers, body: json ? JSON.stringify(json) : (raw ?? undefined), ...(keepalive ? { keepalive: true } : {}),
    });
  } catch {
    return { ok: false, error: 'offline' };
  }
  const type = res.headers?.get?.('content-type') ?? '';
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    const error = typeof data?.error === 'string' ? data.error : 'server';
    if (error === 'auth') forgetSession(io.storage);   // accountClient.js's law: only `auth` signs out
    return { ok: false, error, status: res.status, ...(Number.isSafeInteger(data?.seq) ? { seq: data.seq } : {}), ...(error === 'lineage-stale' && data ? { data } : {}) };   // LEGACY7: a stale line's stored record, to merge into
  }
  if (type.includes('json')) {
    try { return { ok: true, data: await res.json() }; } catch { return { ok: false, error: 'server' }; }
  }
  const seq = Number(res.headers?.get?.('x-realm-seq') ?? NaN);
  let bytes;
  try { bytes = new Uint8Array(await res.arrayBuffer()); } catch { return { ok: false, error: 'offline' }; }   // the body cut off on the way
  return { ok: true, bytes, ...(Number.isSafeInteger(seq) ? { seq } : {}) };
}

const realmSavePath = (/** @type {string} */ id) => `/v1/realm/${encodeURIComponent(id)}/data`;

/** Every realm character of the account, the one played last first. */
export const realmList = async (/** @type {any} */ io) => {
  const r = await realmAsk(io, '/v1/realm');
  return r.ok ? { ok: true, characters: Array.isArray(r.data?.characters) ? r.data.characters : [], max: r.data?.max ?? 0 } : r;
};
/** A character born online: `{ ok, data: { id, lease, seq, gzip } }` - `gzip` the service's word that it opens a packed save.
 *  LEGACY7: `born` - `{ lineage, person }`, born as that living member of the account's own line (Project Legacy). */
export const realmCreate = (/** @type {any} */ io, /** @type {string} */ name, /** @type {any} */ summary = null, /** @type {{ lineage: string, person: number } | null} */ born = null) =>
  realmAsk(io, '/v1/realm/create', { method: 'POST', json: born ? { name, summary, lineage: born.lineage, person: born.person } : { name, summary } });
/** LEGACY7: the account's Project Legacy lines - `{ ok, lineages: [{ id, surname, model, rev, record }] }`. */
export const realmLineages = async (/** @type {any} */ io) => {
  const r = await realmAsk(io, '/v1/realm/lineages', { method: 'POST', json: {} });
  return r.ok ? { ok: true, lineages: Array.isArray(r.data?.lineages) ? r.data.lineages : [] } : r;
};
/** LEGACY7: a line written past its rev - `{ ok, data: { rev } }`, or `{ ok: false, error: 'lineage-stale', data: { rev, record } }`
 *  (the stored record, to merge into and write again). AUDIT LEGACY III A2: `base` the service's rev the record was made
 *  from (the list's, the last write's, the stale answer's) - none for a line founded here. */
export const realmLineagePut = (/** @type {any} */ io, /** @type {string} */ id, /** @type {any} */ record, /** @type {number|null} */ base = null) =>
  realmAsk(io, '/v1/realm/lineage', { method: 'POST', json: base == null ? { id, record } : { id, record, base } });
/** LEGACY7: THE TOMBSTONE - the playing tab's character fallen for good, under its lease. Part three: `why` 'retired' -
 *  an elder's mantle passed, which keeps a union with another player's character (a death ends it). */
export const realmDie = (/** @type {any} */ io, /** @type {string} */ id, /** @type {string} */ lease, /** @type {'fell'|'retired'} */ why = 'fell') =>
  realmAsk(io, '/v1/realm/die', { method: 'POST', json: why === 'retired' ? { id, lease, why } : { id, lease } });
/** LEGACY7 part three: MY HALF OF ONE WEDDING - my character under its lease, the handshake `sid`, the other's account
 *  and realm character as the relay stamped them (AUDIT LEGACY III O1): `{ ok, data: { wed: false } }` (mine waits for
 *  theirs), `{ ok, data: { wed: true, union } }`, or a refusal (server-account/src/legacy.js realmWed). AUDIT LEGACY III
 *  O3: `withdraw` takes it back - answered `wed: true` with the union when it stood first. */
export const realmWedHalf = (/** @type {any} */ io, /** @type {string} */ id, /** @type {string} */ lease, /** @type {string} */ sid, /** @type {string} */ partner,
  /** @type {string} */ partnerChar, { withdraw = false } = {}) =>
  realmAsk(io, '/v1/realm/wed', { method: 'POST', json: { id, lease, sid, partner, partnerChar, ...(withdraw ? { withdraw: true } : {}) } });
/** LEGACY7 part three: every union of the account's characters - `{ ok, unions: [{ sid, mine, partner, at, endedAt, endedWhy }] }`. */
export const realmUnions = async (/** @type {any} */ io) => {
  const r = await realmAsk(io, '/v1/realm/unions', { method: 'POST', json: {} });
  return r.ok ? { ok: true, unions: Array.isArray(r.data?.unions) ? r.data.unions : [] } : r;
};
/** An offline character brought in through customs, once: `{ ok, data: { id, lease, seq, gzip } }`. */
export const realmCustoms = (/** @type {any} */ io, /** @type {string} */ origin, /** @type {string} */ name, /** @type {any} */ summary = null) => realmAsk(io, '/v1/realm/customs', { method: 'POST', json: { origin, name, summary } });
/** A join: a new lease - `{ ok, data: { id, lease, seq, bytes, gzip } }`. */
export const realmJoin = (/** @type {any} */ io, /** @type {string} */ id) => realmAsk(io, '/v1/realm/join', { method: 'POST', json: { id } });
/** A leave: the lease given up. `keepalive` for the page's going. */
export const realmLeave = (/** @type {any} */ io, /** @type {string} */ id, /** @type {string} */ lease, { keepalive = false } = {}) => realmAsk(io, '/v1/realm/leave', { method: 'POST', json: { id, lease }, keepalive });
/** The player's own delete - and the device's copy of an unsent save with it (RESCUE-SAVE). */
export const realmDelete = async (/** @type {any} */ io, /** @type {string} */ id) => {
  const r = await realmAsk(io, '/v1/realm/delete', { method: 'POST', json: { id } });
  if (r.ok) dropUnsent(io?.storage, id);
  return r;
};
/** HOUSE-LOSS: a customs whose first save never landed, undone - its home, guild place and customs given back to the
 *  offline character (server-account/src/realm.js undoRealm). Its own route: an older service answers `not-found`. */
export const realmUndo = (/** @type {any} */ io, /** @type {string} */ id) => realmAsk(io, '/v1/realm/undo', { method: 'POST', json: { id } });
/** The save as it stands: `{ ok, text, seq }` - a join's load, or a copy to offline. REALM-GZIP: asked for as stored
 *  when this tab can open a packed save (a service from before answers the text either way), and opened here; bytes
 *  that will not open are `no-data`, as a save that is not there. */
export const realmFetch = async (/** @type {any} */ io, /** @type {string} */ id) => {
  const r = await realmAsk(io, `${realmSavePath(id)}${canGunzip() ? '?enc=gzip' : ''}`);
  if (!r.ok) return r;
  const text = await saveTextOf(r.bytes, Infinity);
  return text == null ? { ok: false, error: 'no-data' } : { ok: true, text, ...(r.seq != null ? { seq: r.seq } : {}) };
};
/** AUDIT REALM2 C5: A HEADER CARRIES BYTES - a value past U+00FF makes fetch throw (WHATWG: a ByteString), so a tile
 *  whose class name the player typed as Łowca, Маг, an emoji or a smart apostrophe failed every checkpoint as
 *  'offline', for good. Every character past ASCII rides as its JSON escape, which the service's JSON.parse reads back. */
const headerJson = (/** @type {any} */ v) => JSON.stringify(v).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
/** REALM-GZIP: the save as it rides - packed when the service said it opens a packed save (`gzip`, off its join, create
 *  or customs answer) and this runtime can pack; the text otherwise, as every save rode before. */
async function realmBodyOf(/** @type {string} */ text, /** @type {boolean} */ gzip) {
  if (!gzip || !canGzip()) return text;
  try { return await gzipText(text); } catch { return text; }
}
/** A checkpoint: the save's text under the lease at `seq`, the tile beside it. `gzip`: the service opens a packed save. */
export const realmPut = async (/** @type {any} */ io, /** @type {string} */ id, /** @type {{ lease: string, seq: number, summary?: any }} */ { lease, seq, summary = null }, /** @type {string} */ text, { gzip = false } = {}) =>
  realmAsk(io, realmSavePath(id), {
    method: 'PUT', raw: await realmBodyOf(text, gzip),
    headers: { 'x-realm-lease': lease, 'x-realm-seq': String(seq), ...(summary ? { 'x-realm-summary': headerJson(summary) } : {}) },
  });

/** REALM P2.1: a trade's half - `{ id, lease, seq, sid, give, get, pick }`; answers `{ state: 'waiting' | 'done' | 'refused' }`. */
export const realmTradeCall = (/** @type {any} */ io, /** @type {any} */ half) => realmAsk(io, '/v1/realm/trade', { method: 'POST', json: half });

/** The answers that end a session: the character is not this tab's to write any more. */
export const REALM_LOST = Object.freeze(['lease', 'no-realm-character', 'auth', 'signed-out']);

// ── RESCUE-SAVE: THE DEVICE'S COPY OF A SAVE THE SERVICE HAS NOT TAKEN ──

/** The keys: the save's text under the character's id; its record (`{ seq, at, lease?, missed? }` - the sequence it
 *  follows, the lease of the tab that wrote it, and whether a put of it was refused or unanswered) beside it, written
 *  last and removed first, so a page gone between the writes leaves no record - never a text under an older one's
 *  sequence; and (AUDIT RESCUE-SAVE A4) the lease of the tab this device last joined the character in. */
export const REALM_UNSENT_PREFIX = 'dagger.realm.unsent.';
const unsentKey = (/** @type {string} */ id) => `${REALM_UNSENT_PREFIX}${id}`;
const unsentAtKey = (/** @type {string} */ id) => `${REALM_UNSENT_PREFIX}${id}.at`;
const unsentOwnerKey = (/** @type {string} */ id) => `${REALM_UNSENT_PREFIX}${id}.lease`;
/** The losses that keep the device's copy: the record may still stand where the save follows (another tab took the
 *  lease, the account signed out) - the next join's sequence decides. Every other loss drops it: the record moved past
 *  it ('seq'), the character is gone, or the service will never take it ('too-large'). */
const UNSENT_KEPT_ON = Object.freeze(['lease', 'auth', 'signed-out']);
/** AUDIT RESCUE-SAVE A6: how long a put may go unanswered before its save is written to the device. A put that lands
 *  sooner costs the device nothing; a page hidden, a put refused or unanswered, or the session's leave writes at once. */
export const REALM_UNSENT_GRACE_MS = 1_500;
/** SCALE2b (Scale-Arc "Checkpoints: every 120 s, sent even when the save has not changed"): a checkpoint whose save is
 *  the one that last landed, but for its clock and its look, goes at least this often - and otherwise not at all. */
export const REALM_IDLE_CHECKPOINT_MS = 10 * 60 * 1000;
/** SCALE2b: what a save says once its clock and its look are set aside - the character's two minutes (`classicMinutes`,
 *  the world's `worldMinutes`) and where the camera points (`pose.yaw`, `pose.pitch`, `pose.camera`) move every
 *  checkpoint of a player standing still; nothing else does. Null for a text that is not a save's JSON (no skip). */
export function idleKeyOf(text, summary = null) {
  let s;
  try { s = JSON.parse(text); } catch { return null; }
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const { classicMinutes, worldMinutes, ...rest } = s;
  if (rest.pose && typeof rest.pose === 'object') { const { yaw, pitch, camera, ...pose } = rest.pose; rest.pose = pose; }
  return JSON.stringify([rest, summary]);
}

/** RESCUE-PACK (2026-09-30, Mac: "Do it"): A LONG LIFE'S COPY RIDES PACKED. The copy was the save's text, and a save
 *  big enough to need REALM-GZIP's packing on the wire (past 4 MiB) will not fit a browser's storage (5-10 MB an origin)
 *  - so the players with the most to lose kept no copy there. A save past REALM_UNSENT_PACK_OVER characters is kept
 *  gzipped (REALM-GZIP's own codec), as base64 under `REALM_UNSENT_PACKED`, which no JSON text begins with. Packing is
 *  asynchronous (the platform's CompressionStream), so a small save is kept as it stands, at once; a big one is packed
 *  off the frame and written when it is done - unless the copy moved on meanwhile - and on a page going away, where
 *  nothing may wait, it is written as it stands if the device takes it, and packed only when it does not. */
export const REALM_UNSENT_PACK_OVER = 512 * 1024;
export const REALM_UNSENT_PACKED = 'gzip64:';
const B64_CHUNK = 0x8000;
/** A save's text packed for the device: `gzip64:` and its gzip in base64 - or null when this runtime cannot pack. */
export async function packUnsent(/** @type {string} */ text) {
  if (!canGzip()) return null;
  try {
    const bytes = await gzipText(text);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i += B64_CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK));
    return REALM_UNSENT_PACKED + globalThis.btoa(bin);
  } catch { return null; }
}
/** A packed copy opened to its text - or null: not packed, not base64, not whole, or opening past the realm's bound. */
export async function unpackUnsent(/** @type {unknown} */ kept) {
  if (typeof kept !== 'string' || !kept.startsWith(REALM_UNSENT_PACKED) || !canGunzip()) return null;
  try {
    const bin = globalThis.atob(kept.slice(REALM_UNSENT_PACKED.length));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return await gunzipText(bytes);
  } catch { return null; }
}

/** AUDIT RESCUE-SAVE A1: THE SAVE NAMES THE SPOILS ITS PACK HOLDS - the records (scenes/spoilsPool.js heldIds, a gate's
 *  and a town's thanks) it was composed holding, in its own text, so whichever save a join plays - the device's copy or
 *  the service's - tells the crash's door which records its pieces already stand in. */
export const REALM_HELD_FIELD = 'realmHeld';
const REALM_HELD_MAX = 64;
const heldList = (/** @type {unknown} */ v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x && x.length <= 128).slice(-REALM_HELD_MAX) : []);

/** The device's copy of the newest save this session was handed, following sequence `seq`. `lease`: the writing tab's
 *  - a tab the character was since taken from (the device's last join is another's) writes nothing (A4). `missed`: a put
 *  of it was refused or unanswered - the join says so to the player (A8), an ordinary close's restore says nothing. Never
 *  throws: a device with no room keeps what it kept (A5), or nothing, as before RESCUE-SAVE. */
export function keepUnsent(/** @type {any} */ storage, /** @type {string} */ id, /** @type {number} */ seq, /** @type {string} */ text, { lease = /** @type {string | null} */ (null), missed = false, player = /** @type {string | null} */ (null) } = {}) {
  if (!storage || !Number.isSafeInteger(seq) || seq < 1 || typeof text !== 'string' || !text) return false;
  let prev = null;
  try {
    const owner = storage.getItem(unsentOwnerKey(id));
    if (lease && owner && owner !== lease) return false;
    prev = storage.getItem(unsentAtKey(id));
    storage.removeItem(unsentAtKey(id));
    storage.setItem(unsentKey(id), text);
  } catch {
    // AUDIT RESCUE-SAVE A5: the new text did not fit, and a refused write leaves the one before it standing - so does
    // its record: the copy already kept is newer than anything the service holds
    try { if (prev != null) storage.setItem(unsentAtKey(id), prev); else forgetUnsent(storage, id); } catch { forgetUnsent(storage, id); }
    return false;
  }
  try {
    storage.setItem(unsentAtKey(id), JSON.stringify({ seq, at: Date.now(), ...(lease ? { lease } : {}), ...(missed ? { missed: true } : {}), ...(player ? { player } : {}) }));
    return true;
  } catch {
    forgetUnsent(storage, id);   // the text went in and its record would not: nothing half-kept
    return false;
  }
}
/** The device's copy - `{ seq, text, at, missed }` - or null. RESCUE-PACK: a packed copy's `text` is null and its
 *  stored form is `packed` (unpackUnsent opens it); a copy kept as it stands has no `packed`. */
export function readUnsent(/** @type {any} */ storage, /** @type {string} */ id) {
  try {
    const at = JSON.parse(storage?.getItem?.(unsentAtKey(id)) ?? 'null');
    const text = storage?.getItem?.(unsentKey(id)) ?? null;
    if (!Number.isSafeInteger(at?.seq) || typeof text !== 'string' || !text) return null;
    const packed = text.startsWith(REALM_UNSENT_PACKED);
    return { seq: at.seq, text: packed ? null : text, at: Number.isFinite(at.at) ? at.at : null, missed: at.missed === true, ...(packed ? { packed: text } : {}) };
  } catch { return null; }
}
/** The copy's record revised in place - its sequence re-based as this session's own put lands with a newer save
 *  waiting, or a refused or unanswered put marked (`missed`). No copy, nothing to revise. */
function reviseUnsent(/** @type {any} */ storage, /** @type {string} */ id, /** @type {{ seq?: number, missed?: boolean }} */ patch) {
  try {
    const at = JSON.parse(storage?.getItem?.(unsentAtKey(id)) ?? 'null');
    if (!Number.isSafeInteger(at?.seq)) return;
    const { missed: _was, ...rest } = at;
    const missed = patch.missed ?? _was === true;
    storage.setItem(unsentAtKey(id), JSON.stringify({ ...rest, ...(patch.seq != null ? { seq: patch.seq } : {}), ...(missed ? { missed: true } : {}) }));
  } catch { forgetUnsent(storage, id); }
}
/** The copy dropped - the record first. The device's last join stands (A4): a tab the character was taken from stays out. */
export function forgetUnsent(/** @type {any} */ storage, /** @type {string} */ id) {
  try { storage?.removeItem?.(unsentAtKey(id)); storage?.removeItem?.(unsentKey(id)); } catch { /* storage away: nothing to drop */ }
}
/** AUDIT RESCUE-SAVE A4: THE DEVICE'S LAST JOIN of the character - its lease, so a tab of this device the character was
 *  taken from (it learns so at its next put) never writes its older save over the newer tab's copy. */
export function claimUnsent(/** @type {any} */ storage, /** @type {string} */ id, /** @type {unknown} */ lease) {
  if (typeof lease !== 'string' || !lease) return;
  try { storage?.setItem?.(unsentOwnerKey(id), lease); } catch {
    // AUDIT RESCUE-SAVE 2 B7: no room - the older join's lease must not stand in for this one's: the check stands down
    try { storage?.removeItem?.(unsentOwnerKey(id)); } catch { /* storage away */ }
  }
}
/** AUDIT RESCUE-SAVE 2 B1: IS THE COPY THIS TAB'S TO TOUCH - no join recorded on the device, or its own. A tab the
 *  character was taken from hears so only at its next answer, and the route answers some refusals (`too-large`, before
 *  it reads the lease) - so the copy's every change, not only its write, is the device's last join's alone. */
export function ownsUnsent(/** @type {any} */ storage, /** @type {string} */ id, /** @type {unknown} */ lease) {
  try {
    const owner = storage?.getItem?.(unsentOwnerKey(id));
    return !owner || owner === lease;
  } catch { return false; }
}
/** The character gone (its delete, here or elsewhere): the copy and the device's join of it with it. */
function dropUnsent(/** @type {any} */ storage, /** @type {string} */ id) {
  forgetUnsent(storage, id);
  try { storage?.removeItem?.(unsentOwnerKey(id)); } catch { /* storage away */ }
}
/** AUDIT RESCUE-SAVE A7: THE ONLINE DOOR'S SWEEP - a copy of one of the account's characters whose record has moved
 *  past it (played on elsewhere, a trade, an act) can never be played: dropped as the door lists them. Another account's
 *  characters on this device are not listed, and theirs stay. Answers how many went. */
export function sweepUnsent(/** @type {any} */ storage, /** @type {any[]} */ rows, /** @type {string | null} */ player = null) {
  let n = 0;
  const listed = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (typeof row?.id !== 'string' || !REALM_ID_SHAPE.test(row.id) || !Number.isSafeInteger(row.seq)) continue;
    listed.add(row.id);
    if (row.playing) continue;   // AUDIT RESCUE-SAVE 2 B6: a tab is playing it - its put may have landed unanswered yet
    const kept = readUnsent(storage, row.id);
    if (kept && kept.seq !== row.seq) { forgetUnsent(storage, row.id); n++; }
  }
  // AUDIT RESCUE-SAVE 2 B5: the account's own copies of characters it no longer holds (deleted from another device, never
  // joined here again) - found by the account their record names; another account's are not this door's to judge
  if (!player) return n;
  const orphans = [];
  try {
    for (let i = 0; i < (storage?.length ?? 0); i++) {
      const k = storage.key(i);
      if (typeof k !== 'string' || !k.startsWith(REALM_UNSENT_PREFIX) || !k.endsWith('.at')) continue;
      const cid = k.slice(REALM_UNSENT_PREFIX.length, -'.at'.length);
      if (!REALM_ID_SHAPE.test(cid) || listed.has(cid)) continue;
      let at = null;
      try { at = JSON.parse(storage.getItem(k) ?? 'null'); } catch { at = null; }
      if (at?.player === player) orphans.push(cid);
    }
  } catch { /* storage away */ }
  for (const cid of orphans) { dropUnsent(storage, cid); n++; }
  return n;
}
/** AUDIT RESCUE-SAVE A1: a save's text naming the spoils records its pack holds (none: the save as it stands). */
export const realmSaveWithHeld = (/** @type {any} */ snap, /** @type {unknown} */ held) => {
  const ids = heldList(held);
  return JSON.stringify(ids.length ? { ...snap, [REALM_HELD_FIELD]: ids } : snap);
};
/** AUDIT REALM2 C8: a checkpoint's refusal that may clear if the save is sent again - no answer, the service's own
 *  trouble (5xx: its error, its storage or its database away) or the account's request rate. Any other (the save too
 *  big, a request the service cannot read) meets the same save again every time. */
const putMayClear = (/** @type {any} */ r) => REALM_ACT_TRANSIENT.includes(r.error) || r.status >= 500;

/**
 * THE PLAYING TAB'S SESSION over one realm character: the lease a join minted and the sequence it answered. Checkpoints
 * go one at a time, in order; one asked while another is in flight waits, the newest replacing an older one that never
 * left. `onLost(error)` is called once, when the service says the character is no longer this tab's. `gzip`: the join
 * said the service opens a packed save (REALM-GZIP), so every checkpoint rides packed.
 * RESCUE-SAVE: the newest save handed is written to the device (keepUnsent) once its put has gone unanswered past
 * REALM_UNSENT_GRACE_MS (`later`), at once while the page is hidden (`hidden`) and as it hides (`watchHidden`), or when
 * a put is refused or unanswered or the session leaves; a put that lands with nothing newer behind it drops the copy.
 * @param {{ io: any, id: string, lease: string, seq: number, gzip?: boolean, onLost?: (error: string) => void,
 *   later?: (fn: () => void, ms: number) => (() => void), hidden?: () => boolean, watchHidden?: (fn: () => void) => void,
 *   pack?: (text: string) => Promise<string | null>, now?: () => number }} at
 */
export function createRealmSession({
  io, id, lease, seq, gzip = false, onLost = () => {},
  later = (fn, ms) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); },
  hidden = () => globalThis.document?.visibilityState === 'hidden',
  watchHidden = (fn) => whenPageHides(globalThis.document, fn),
  pack = packUnsent,
  now = () => Date.now(),
}) {
  const storage = io?.storage ?? null;   // RESCUE-SAVE: the device's copy of what the service has not taken
  let current = seq;
  /** @type {{ text: string, summary: any, waiters: Array<(r: any) => void> } | null} */
  let pending = null;
  // RESCUE-SAVE, AUDIT A6: the newest save handed that is not yet on the device - written once its put has waited out
  // the grace, or at once where the page may not see its answer; a put that lands first writes nothing at all
  /** @type {string | null} */
  let unkept = null;
  /** @type {(() => void) | null} */
  let unkeptTimer = null;
  let missed = false;   // AUDIT A8: a put refused or unanswered since the last that landed
  let landedKey = null, landedAt = -Infinity;   // SCALE2b: the last landed save's idle key (idleKeyOf), and when it landed
  let idleOk = false;   // SCALE2b: inside `idle` - the periodic checkpoint, the one call that may be answered by the save the service holds
  /** @type {string | null} */
  let latest = null;   // AUDIT RESCUE-SAVE 2 B3: the newest save handed, written or not
  const player = io?.player ?? null;   // AUDIT RESCUE-SAVE 2 B5: the account the copy's record names
  // RESCUE-PACK: every change of the copy is a generation; a packing that finishes after the copy moved on (a landing,
  // a drop, a newer save kept) writes nothing
  let copyGen = 0;
  const keepNow = () => {
    if (unkeptTimer) { unkeptTimer(); unkeptTimer = null; }
    if (unkept == null) return;
    const text = unkept, at = current, gen = ++copyGen, how = { lease, missed, player };
    unkept = null;
    const packLater = () => {
      pack(text).then((packed) => { if (packed && gen === copyGen) keepUnsent(storage, id, at, packed, how); }).catch(() => {});
    };
    if (text.length <= REALM_UNSENT_PACK_OVER) { keepUnsent(storage, id, at, text, how); return; }
    // a long life's save: on a page going away, as it stands if the device takes it - nothing may wait there
    if (hidden() && keepUnsent(storage, id, at, text, how)) return;
    packLater();
  };
  const dropCopy = () => {
    if (unkeptTimer) { unkeptTimer(); unkeptTimer = null; }
    unkept = null;
    copyGen++;   // RESCUE-PACK: a packing still out lands nowhere
    if (ownsUnsent(storage, id, lease)) forgetUnsent(storage, id);   // AUDIT 2 B1: never a newer tab's copy
  };
  /** AUDIT RESCUE-SAVE 2 B1: the copy's record marked (its miss) only while it is this tab's. */
  const revise = (/** @type {{ seq?: number, missed?: boolean }} */ patch) => { if (ownsUnsent(storage, id, lease)) reviseUnsent(storage, id, patch); };
  /** AUDIT RESCUE-SAVE 2 B3: THE RECORD MOVED ON UNDER A SAVE STILL WAITING (this tab's put landed, a newer one behind
   *  it): the copy on the device may be OLDER than what landed - written before the grace let the newer out, or kept
   *  when the newer would not fit - so it is never relabelled at the new sequence, which a join would play over the
   *  landed save. It goes, and the newest save handed is written anew at the sequence now held. */
  const rebaseCopy = () => {
    if (unkeptTimer) { unkeptTimer(); unkeptTimer = null; }
    if (ownsUnsent(storage, id, lease)) forgetUnsent(storage, id);
    unkept = latest;
    keepNow();
  };
  // AUDIT RESCUE-SAVE 2 B2: THE PAGE PUT AWAY writes what waits out its grace, whether or not its own checkpoint was
  // allowed (a duel, the death screen, the seat lost) - a phone may never send the pagehide whose leave would
  watchHidden(() => { keepNow(); });
  /** @type {Promise<any> | null} */
  let running = null;
  /** @type {string | null} */
  let lost = null;
  let holding = false;   // REALM P2: a transaction is in flight - no checkpoint goes until it is answered
  // AUDIT REALM L1-F2 / L2-F1: a put of this session whose answer never came (offline, the service's own error) - it may
  // have landed. Only then is the service one ahead of us our own write: any other move of the record is one this tab
  // does not hold (a settle it read as refused, an act it read as undone), and a checkpoint over it would destroy it.
  let unsure = false;
  const lose = (/** @type {string} */ error) => {
    if (lost) return;
    lost = error;
    try { onLost(error); } catch (e) { console.warn('[realm] the lost handler failed', e); }
  };
  // INT3 (bible/06-Systems/Integrity-Arc.md): THE JUDGE'S HOLD, as the last landed checkpoint said it - null for none,
  // undefined before any answer said (a service from before the judge says nothing). `session.onTradeHeld(prev, now)` is
  // told each time it moves; the answer a checkpoint's callers get stays `{ ok, seq }`.
  /** @type {string | null | undefined} */
  let tradeHeld;
  const heard = (/** @type {unknown} */ v) => {
    if (v === undefined) return;
    const now = typeof v === 'string' ? v : null;
    if (now === tradeHeld) return;
    const prev = tradeHeld;
    tradeHeld = now;
    try { session.onTradeHeld?.(prev ?? null, now); } catch (e) { console.warn('[realm] the hold handler failed', e); }
  };
  /** AUDIT REALM2 C4: a save's callers told how the put that carried it went - once. */
  const answer = (/** @type {{ waiters: Array<(r: any) => void> }} */ job, /** @type {any} */ r) => { for (const settle of job.waiters.splice(0)) settle(r); };
  async function drain() {
    /** @type {any} */
    let last = { ok: true, seq: current };
    try {
      while (pending && !lost) {
        const job = pending;
        pending = null;
        let r = await realmPut(io, id, { lease, seq: current + 1, summary: job.summary }, job.text, { gzip });
        if (!r.ok && r.error === 'seq' && r.seq === current + 1 && unsure) {
          // our own last checkpoint landed and its answer was lost: the service is one ahead - adopt it, and send this one
          current = r.seq;
          unsure = false;
          rebaseCopy();
          r = await realmPut(io, id, { lease, seq: current + 1, summary: job.summary }, job.text, { gzip });
        }
        if (r.ok) {
          unsure = false; current = r.data?.seq ?? current + 1; last = { ok: true, seq: current }; answer(job, last);
          heard(r.data?.tradeHeld);
          landedKey = idleKeyOf(job.text, job.summary); landedAt = now();   // SCALE2b
          // RESCUE-SAVE: the newest save landed - no copy; or a newer one waits, its copy at the sequence now held
          missed = false;
          if (pending) rebaseCopy(); else dropCopy();
          continue;
        }
        // AUDIT REALM2 C8: and a refusal no retry clears (the save too big) ends it too - it was kept and sent again at
        // every checkpoint for good, the host never told and F9 saying "saved"
        if (REALM_LOST.includes(r.error) || r.error === 'seq' || !putMayClear(r)) {
          // RESCUE-SAVE: kept for the next join to decide (another tab took the lease, the account signed out), or a copy
          // no join may play, dropped
          if (UNSENT_KEPT_ON.includes(r.error)) { missed = true; keepNow(); revise({ missed: true }); } else dropCopy();
          lose(r.error); last = { ok: false, error: r.error }; answer(job, last); break;
        }
        // offline, a busy service, the hour's bound: this save waits for the next checkpoint unless a newer one came - and
        // an answer lost on the way (offline, the service's own error) may be a checkpoint that landed
        if (r.error === 'offline' || r.error === 'server') unsure = true;
        missed = true;   // RESCUE-SAVE, AUDIT A6/A8: on the device now, marked - the join says so
        keepNow();
        revise({ missed: true });
        if (!pending) pending = job;
        last = { ok: false, error: r.error };
        answer(job, last);
        break;
      }
    } finally {
      // AUDIT REALM2 C4: a save still waiting never left - answered as the drain ended (the failure it queued behind, or
      // the session lost under it), and the next checkpoint carries it. The drain is over from THIS line: a checkpoint
      // asked a microtask later found it still running, started none, and was never answered
      if (pending) answer(pending, lost ? { ok: false, error: lost } : last);
      running = null;
    }
    return last;
  }
  const session = {
    id,
    get seq() { return current; },
    /** INT3: the judge's hold the last landed checkpoint said - a reason, null for none, undefined before any said. */
    get tradeHeld() { return tradeHeld; },
    /** INT3: told `(prev, now)` each time the hold moves - the host's to set. @type {((prev: string | null, now: string | null) => void) | null} */
    onTradeHeld: null,
    get lost() { return lost; },
    get waiting() { return !!pending; },
    /** A checkpoint of this save text; answers a promise of the outcome - the put that carried it, or a newer one's. */
    checkpoint(/** @type {string} */ text, /** @type {any} */ summary = null) {
      if (lost) return Promise.resolve({ ok: false, error: lost });
      // REALM P2: a save composed while a transaction is in flight holds its goods in flight - never sent; the outcome's
      // own checkpoint (the host's, as it applies the answer) is the next one
      if (holding) return Promise.resolve({ ok: false, error: 'held' });
      // SCALE2b: A SAVE THAT SAYS NOTHING NEW IS NOT SENT. The periodic checkpoint (`idle`) went every two minutes
      // whatever it held - an account write every two minutes for someone standing still. The save the service holds
      // is answered for it: the one that last landed, but for its clock and its look (idleKeyOf), with nothing queued,
      // nothing missed, inside REALM_IDLE_CHECKPOINT_MS - and never on a page going away, whose save the next join reads.
      if (idleOk && landedKey != null && !pending && !running && !missed && !hidden() && now() - landedAt < REALM_IDLE_CHECKPOINT_MS && idleKeyOf(text, summary) === landedKey) return Promise.resolve({ ok: true, seq: current, idle: true });
      // RESCUE-SAVE: NEVER IN THIS PAGE'S MEMORY ALONE - on the device once its put waits out the grace, and at once on a
      // hidden page, whose put the page's going cuts off (a close, a reload, the keepalive leave ahead of it)
      unkept = text;
      latest = text;
      if (hidden()) keepNow(); else if (!unkeptTimer) unkeptTimer = later(keepNow, REALM_UNSENT_GRACE_MS);
      // AUDIT REALM2 C4: EACH CHECKPOINT ANSWERED BY THE PUT THAT CARRIED ITS SAVE - or, replaced before it left, by the
      // newer one's. All were answered with the drain's LAST put: a checkpoint that landed (the spoils it held banked on
      // the service) was told it failed when the one queued behind it did, and the spoils were handed again at a join
      return new Promise((settle) => {
        pending = { text, summary, waiters: [...(pending?.waiters ?? []), settle] };
        if (!running) running = drain();
      });
    },
    /**
     * REALM P2: A TRANSACTION over this character's record, settled by the service (a trade's half). Everything asked
     * before it lands first - the host checkpoints the save it reads just before - and while it runs no checkpoint is
     * sent, so the service moves the record it read and nothing overwrites the move before this tab adopts its sequence.
     * `call({ io, id, lease, seq })` answers `{ ok, seq? }`: a `seq` is the service's move, adopted. An answer that never
     * came (`unknown`) ends the session - this tab cannot know how its record stands, and only a join reads it.
     * @param {(at: { io: any, id: string, lease: string, seq: number }) => Promise<any>} call
     */
    /** SCALE2b: `fn` - the periodic checkpoint - run with the idle skip allowed: its save, if it says nothing the landed
     *  one did not (idleKeyOf), is answered without a put. A checkpoint asked for anything else - an act's before it
     *  runs, an exit's, a load's - always goes. The sink hands the save over synchronously, so the window is exact. */
    idle(/** @type {() => any} */ fn) { idleOk = true; try { return fn(); } finally { idleOk = false; } },
    async transact(call) {
      if (lost) return { ok: false, error: lost };
      if (holding) return { ok: false, error: 'busy', why: 'busy' };
      holding = true;
      landedKey = null;   // SCALE2b: the service moves the record now - no save of ours stands for it until the next lands
      try {
        if (running) await running;
        if (lost) return { ok: false, error: lost };
        if (pending) return { ok: false, error: 'offline', why: 'offline' };   // the save it must read never reached the service: nothing was asked
        const r = await call({ io, id, lease, seq: current });
        if (r?.ok && Number.isSafeInteger(r.seq) && r.seq > current) current = r.seq;
        if (r?.unknown) lose('unknown');
        else if (REALM_LOST.includes(r?.error)) lose(r.error);
        return r;
      } finally {
        holding = false;
      }
    },
    /** AUDIT REALM L2-F6: THE TAB CANNOT HOLD WHAT THE REALM NOW HOLDS (a settle whose goods this game refuses): the
     *  session ends as a lost answer does - to the door, where a join reads the record - never a checkpoint over it. */
    abandon(/** @type {string} */ error = 'unknown') { lose(error); },
    /** LEGACY7: THE CHARACTER FELL FOR GOOD (Project Legacy) - its tombstone under this session's lease
     *  (server-account/src/legacy.js realmDie). The session ends with it, quietly - nothing of the dead is written
     *  again, and the page stays for the Succession. Answers whether the realm took it (a refusal - unheard, offline -
     *  leaves the session as it was, to be asked again). Part three: `why` 'retired' for an elder's mantle passed. */
    async die(/** @type {'fell'|'retired'} */ why = 'fell') {
      if (lost && lost !== 'dead') return false;
      if (lost === 'dead') return true;
      if (running) { try { await running; } catch { /* the last put's answer does not matter now */ } }
      const r = await realmDie(io, id, lease, why);
      if (!r.ok) return false;
      lost = 'dead';
      pending = null;
      dropUnsent(storage, id);   // RESCUE-SAVE: no copy of the dead is offered again
      return true;
    },
    /** LEGACY7 part three: THIS CHARACTER'S HALF OF ONE WEDDING (realmWedHalf), under this session's lease - `{ ok, wed,
     *  union }` or `{ ok: false, error }`. A session that ended weds nobody (and its halves end with its lease's life). */
    async wed(/** @type {string} */ sid, /** @type {string} */ partner, /** @type {string} */ partnerChar, /** @type {{ withdraw?: boolean }} */ opts = {}) {
      if (lost) return { ok: false, error: lost };
      const r = await realmWedHalf(io, id, lease, sid, partner, partnerChar, opts);
      return r.ok ? { ok: true, wed: r.data?.wed === true, union: r.data?.union ?? null } : { ok: false, error: r.error };
    },
    /** The session's end: what is waiting is sent first (unless the page is going - `keepalive` sends the leave alone,
     *  which a browser can finish after the page is gone), then the lease given up. */
    async leave({ keepalive = false } = {}) {
      if (lost) return { ok: false, error: lost };
      if (!keepalive) { if (running) await running; if (pending) await session.checkpoint(pending.text, pending.summary); }
      keepNow();   // RESCUE-SAVE: whatever never landed is on the device before the lease goes
      lost = 'left';
      return realmLeave(io, id, lease, { keepalive });
    },
    /** AUDIT REALM2 C2: THE PAGE CAME BACK from the back-forward cache, its lease given up as it went (pagehide): joined
     *  again - onto the record this tab left alone, at its own sequence (or one on: its own put whose answer was lost).
     *  A record moved meanwhile (another tab, another device) is not this tab's to write over: the session ends, and a
     *  join at the door reads it. */
    async rejoin() {
      if (lost !== 'left') return { ok: false, error: lost ?? 'joined' };
      const j = await realmJoin(io, id);
      const at = j.ok ? j.data?.seq : null;
      lost = null;
      if (!j.ok || !(at === current || (unsure && at === current + 1))) { lose(j.ok ? 'seq' : j.error); return { ok: false, error: lost }; }
      const moved = at !== current;
      lease = j.data.lease;
      gzip = j.data.gzip === true;   // REALM-GZIP: the service that answered this join is the one the checkpoints reach
      current = at;
      unsure = false;
      claimUnsent(storage, id, lease);   // AUDIT RESCUE-SAVE A4: this tab's join is the device's last again
      if (moved) rebaseCopy();   // RESCUE-SAVE, AUDIT 2 B3: one on is this tab's own put, landed - the newest written anew
      return { ok: true, seq: current };
    },
  };
  return session;
}

// ── REALM P1.3: THE DOOR'S AND THE BOOT'S HALVES ──────────────────────

/** The service's id shape (server-account/src/realm.js REALM_ID_RE), so a boot never asks for what no row can be. */
export const REALM_ID_SHAPE = /^r[0-9a-f]{20}$/;

/**
 * THE TILE A CHECKPOINT CARRIES: what the Online door shows of a character - the service keeps these and nothing else
 * (server-account/src/realm.js realmSummaryOf). Read off the live entity, the fields the local save's own tile reads.
 * @param {any} entity
 */
export function realmSummaryOf(entity) {
  return {
    level: Number.isSafeInteger(entity?.level) ? entity.level : null,
    className: typeof entity?.career?.name === 'string' ? entity.career.name : null,
    race: typeof entity?.race === 'string' ? entity.race : null,
    gender: entity?.gender === 'female' ? 'female' : 'male',
    face: Number.isSafeInteger(entity?.faceIndex) ? entity.faceIndex : null,
  };
}

/**
 * A REALM ROW AS A TILE'S SAVE (ui/saveTile.js's row): the name and the summary, with no local key - nothing here loads
 * from this device - and "Playing now" where the service says a lease is fresh.
 * @param {any} row @param {{ dateText?: (sec: number) => string | null }} [at]
 */
export function realmRowAsSave(row, { dateText = () => null } = {}) {
  const s = row?.summary ?? {};
  return {
    realmId: row?.id ?? null,
    name: row?.name || 'Unnamed',
    race: typeof s.race === 'string' ? s.race : null,
    gender: s.gender === 'female' ? 'female' : 'male',
    faceIndex: Number.isInteger(s.face) ? s.face : 0,
    career: typeof s.className === 'string' ? s.className : null,
    level: Number.isInteger(s.level) ? s.level : null,
    when: row?.playing ? 'Playing now' : (Number.isFinite(row?.updatedAt) ? dateText(row.updatedAt) : null),
    hour: null,
    saveName: row?.customs ? 'Brought in' : 'Online',
    unfinished: !(row?.bytes > 0),
    house: houseLine(row?.house) ?? null,   // LEGACY7: the house the realm reads off its line - "☠ Ysolde II of House Hlaalu"
  };
}

/**
 * THE BOOT'S JOIN: a new lease on the character, then its save read from the service - never a local slot - and
 * parsed as a slot load parses. The character's id in the save is the realm's (a customs character's save still names
 * the offline id it came from). Answers `{ ok, snap, lease, seq, origin, gzip }` - `origin` the offline id a customs
 * character came from, from the join (RESTORE); `gzip` the join's word that the service opens a packed save
 * (REALM-GZIP), for the session's checkpoints - or `{ ok: false, error }`. RESCUE-SAVE: `restored: true` when the
 * save is the device's copy of one the service never took, played in place of the service's older one (`missed`: a
 * put of it was refused or unanswered - AUDIT A8, the only restore the world says). AUDIT RESCUE-SAVE A1: `held`, the
 * spoils records the save's pack already holds - the crash's door adopts them and never hands them again.
 * @param {{ io: any, id: string }} at
 */
export async function openRealmBoot(/** @type {{ io: any, id: string }} */ at) { return heldOut(await joinRealmBoot(at)); }
/** AUDIT RESCUE-SAVE A1: THE BOOT'S SAVE GIVES UP THE RECORDS ITS PACK HOLDS - `held`, read out of whichever save the
 *  join plays (the device's copy or the service's: a put that landed with its answer lost cleared no record either),
 *  and taken out of the save the world loads. */
function heldOut(/** @type {any} */ r) {
  if (!r?.ok || !r.snap) return r;
  const held = heldList(r.snap[REALM_HELD_FIELD]);
  delete r.snap[REALM_HELD_FIELD];
  return { ...r, held };
}
/** The join and the save it plays (openRealmBoot's, before the records come out of it). */
async function joinRealmBoot(/** @type {{ io: any, id: string }} */ { io, id }) {
  if (!io) return { ok: false, error: 'signed-out' };
  if (typeof id !== 'string' || !REALM_ID_SHAPE.test(id)) return { ok: false, error: 'no-realm-character' };
  const joined = await realmJoin(io, id);
  if (!joined.ok) {
    if (joined.error === 'no-realm-character') dropUnsent(io.storage, id);   // AUDIT RESCUE-SAVE A2: deleted elsewhere - its copy goes too
    return { ok: false, error: joined.error };
  }
  const { lease, seq, bytes, origin = null } = joined.data ?? {};
  if (!(bytes > 0)) return { ok: false, error: 'no-data' };
  claimUnsent(io.storage, id, lease);   // AUDIT RESCUE-SAVE A4: this join is the device's last - an older tab writes nothing
  // RESCUE-SAVE: the device's copy follows the sequence the record still stands at - nothing landed after it - so it is
  // newer than anything the service holds: played, and the first checkpoint gives it to the service. Past it, dropped.
  const kept = readUnsent(io.storage, id);
  if (kept && kept.seq === seq) {
    const snap = parseSave(kept.packed ? await unpackUnsent(kept.packed) : kept.text);   // RESCUE-PACK: opened first
    if (snap) { snap.characterId = id; return { ok: true, snap, lease, seq, origin: typeof origin === 'string' ? origin : null, restored: true, missed: kept.missed, gzip: joined.data?.gzip === true }; }
  }
  if (kept) forgetUnsent(io.storage, id);
  const got = await realmFetch(io, id);
  if (!got.ok) return { ok: false, error: got.error };
  const snap = parseSave(got.text);
  if (!snap) return { ok: false, error: 'no-data' };
  snap.characterId = id;
  return { ok: true, snap, lease, seq: got.seq ?? seq, origin: typeof origin === 'string' ? origin : null, gzip: joined.data?.gzip === true };   // RESTORE: the offline id it came from
}
/** A save's text as the snapshot a slot load reads, or null. */
function parseSave(/** @type {string | null} */ text) {
  let snap = null;
  try { snap = typeof text === 'string' ? JSON.parse(text) : null; } catch { snap = null; }
  return snap && typeof snap === 'object' && !Array.isArray(snap) ? snap : null;
}

/** A word for the Online door, carried across the page's reload (sessionStorage - this tab's alone). */
export const REALM_NOTICE_KEY = 'dagger.realm.notice';
export function setRealmNotice(/** @type {any} */ storage, /** @type {string} */ text) {
  try { storage?.setItem?.(REALM_NOTICE_KEY, String(text)); return true; } catch { return false; }
}
export function takeRealmNotice(/** @type {any} */ storage) {
  try {
    const t = storage?.getItem?.(REALM_NOTICE_KEY) ?? null;
    if (t != null) storage.removeItem(REALM_NOTICE_KEY);
    return t;
  } catch { return null; }
}

/**
 * THE URL THAT BOOTS A REALM CHARACTER: the online lane, the load door and the character's id - the one online boot
 * there is. Every other door key off it (onlineLane.js BOOT_DOOR_KEYS), so a stale load key never rides in.
 * REALM-BIRTH (FIELD BUGS 2026-09-30, "crashed to the main menu" after online character creation): IT IS THE ONLINE
 * DOOR'S PLAY, KEY FOR KEY, AND IT NAMES ITS HOST. The door boots the world host in its own page with the classic start
 * beside these three (main.js's front door). A born character reaches that host by a reload (scenes/world.js
 * realmBirth), and main.js boots a game only on a scene door: this address had none, so it was the front door's, which
 * clears every door key, the realm id with them, and shows the menu. The make and the save had landed, so the Online
 * door played the character fine. test/fb0930_realmbirth.test.js holds the two boots to each other.
 * @param {string} search @param {string} id @param {readonly string[]} doorKeys
 */
export function realmBootSearch(search, id, doorKeys) {
  const p = new URLSearchParams(search);
  for (const k of doorKeys) p.delete(k);
  p.set('online', '1');
  p.set('load', '1');
  p.set('realm', id);
  p.set('classic', '1');   // REALM-BIRTH: the Online door's classic start - the start cell the load lands over
  p.set('world', '1');   // REALM-BIRTH: the world host's scene door (main.js) - the host the Online door boots
  return `?${p.toString()}`;
}

/** The HUD's word when a save pressed online lands in the realm (scenes/shared.js realmSaveSink). */
export const REALM_SAVED_TEXT = 'Saved to the realm.';
/** AUDIT REALM2 C2: ...and when it does not. */
export const REALM_NOT_SAVED_TEXT = 'Not saved to the realm.';
/** AUDIT REALM2 C2: the HUD's word for a save pressed online, from the realm's answer - "Saved" for a checkpoint that
 *  landed alone, else why not. */
export const realmSaveText = (/** @type {any} */ r) => (r?.ok ? REALM_SAVED_TEXT : `${REALM_NOT_SAVED_TEXT} ${realmRefusalText(r?.error ?? 'server')}`);
/** AUDIT REALM2 C2: THE WORD SAID ONCE THE REALM HAS ANSWERED (the realm's sink answers the checkpoint's outcome). It
 *  was said as the save was handed over, so a save the session refused - the page's leave already given, a trade in
 *  flight, no answer - still said "Saved to the realm." */
export function sayRealmSave(/** @type {any} */ outcome, /** @type {(text: string) => void} */ say) {
  return Promise.resolve(outcome).catch(() => null).then((r) => { try { say(realmSaveText(r)); } catch { /* the HUD went with its host */ } });
}

/** A realm refusal in the Online door's words: the two this side names itself, the service's own through its table. */
export function realmRefusalText(/** @type {string} */ error) {
  if (error === 'signed-out') return 'Sign in - or continue as a guest - to play online.';
  // HOUSE-LOSS: "Delete it and make it again" was said of a character brought in too, and its delete took the home
  // customs had carried. One brought in is finished from its offline tile, or undone - never made again.
  if (error === 'no-data') return 'That online character was never saved. One you brought in: press Bring online on it again, or undo it. One made online: delete it and make it again.';
  if (error === 'left') return 'You left the realm.';
  if (error === 'held') return 'A trade or a purchase is being settled - the save follows it.';   // AUDIT REALM2 C2: F9 mid-transaction
  if (error === 'too-large') return 'This character\'s save is too big for the realm to take. The realm keeps the last save it took.';   // AUDIT REALM2 C8
  if (error === 'customs-load-once') return 'Load this character once offline, then it can be brought online.';
  if (error === 'test-room') return 'A Test Room character plays offline only.';
  if (error === 'no-room') return 'This device has no room for another save. Delete one, then copy again.';
  if (error === 'unknown') return 'The realm did not answer about a trade in flight. Join again - the realm holds how it ended.';   // REALM P2.1
  return accountRefusalText(error);
}
/** RESCUE-SAVE: said once the world stands, when the join played the device's copy of a save the realm never took. */
export const REALM_RESTORED_TEXT = 'Your last save had not reached the realm when you left. This device kept it, and you play on from it.';
/** Said once the world stands, when an online boot carried no realm character (a stale address, a local save). */
export const REALM_OFFLINE_TEXT = 'Online characters live in the realm now, so this one plays offline. The Online door brings it in, once.';

/** REALM-DOOR: HAS THE RELAY SHUT ITS DOOR ON THIS SESSION AS NO REALM CHARACTER'S? - a socket closed for good with the
 *  relay's own word (net/wire.js REALM_DOOR_WORD). The words are written for a build from before the realm, which prints
 *  them as they stand; a realm-era tab meets them only when its character stopped being its account's under it (deleted
 *  elsewhere, the account signed out and another in) - the realm's own end, which goes to the Online door with the
 *  realm's word, never the old build's "out of date". */
export const realmDoorShut = (/** @type {any} */ session) => !!session?.terminal && session.error === REALM_DOOR_WORD;

/** How long the door to the title menu waits for a realm character's last checkpoint and leave (scenes/world.js). */
export const REALM_EXIT_WAIT_MS = 5_000;

/** REALM P1.3: A PAGE PUT AWAY (a phone's home button, another tab) - `fn` runs as it hides, while it still can send.
 *  The realm's own hook, kept here: the world host's frame loop answers to no page-lifecycle timer (AUDIT WORLD7/8). */
export function whenPageHides(/** @type {any} */ doc, /** @type {() => void} */ fn) {
  doc?.addEventListener?.('visibilitychange', () => { if (doc.visibilityState === 'hidden') fn(); });
}
/** AUDIT REALM2 C2: THE PAGE GOING, AND COMING BACK - `gone` as the page is unloaded or put in the back-forward cache
 *  (pagehide: the unload guard's "Leave site?" already answered, so a Stay never reaches it), `back` as a page that
 *  cache kept is shown again (pageshow, persisted). `beforeunload` comes before that answer: no place to leave from. */
export function whenPageGoes(/** @type {any} */ win, /** @type {() => void} */ gone, /** @type {() => void} */ back) {
  win?.addEventListener?.('pagehide', () => { gone(); });
  win?.addEventListener?.('pageshow', (/** @type {any} */ e) => { if (e?.persisted) back(); });
}

// ── REALM P2.1: A TRADE THE REALM SETTLES ─────────────────────────────

/** How long a side asks the service how its trade stands before it calls the answer lost (the first half waits
 *  REALM_TRADE_TTL_S, 60 s, on the service; this is past it). */
export const REALM_TRADE_WAIT_MS = 90_000;
/** How often it asks while the other half has not come. */
export const REALM_TRADE_POLL_MS = 1_500;

/**
 * THIS SIDE'S HALF, sent and asked after until the service says how the trade ended - inside the session's
 * transaction, so no checkpoint goes meanwhile. `half` may be a promise: the transaction - and so the hold - begins at
 * this call, and the half follows once the goods are reserved (a null half abandons it). Answers `{ ok, seq, items,
 * gold }` (what this side received), `{ ok: false, why, text }` (refused: nothing moved) or `{ ok: false, unknown: true }`
 * (no answer - the session ends).
 * @param {{ session: any, half: any, wait?: (ms: number) => Promise<void>, now?: () => number }} at
 */
export async function settleRealmTradeHalf({ session, half, wait = (ms) => new Promise((r) => { setTimeout(r, ms); }), now = () => Date.now() }) {
  const r = await session.transact(async (/** @type {any} */ at) => {
    const h = await half;
    if (!h) return { ok: false, why: 'abandoned' };
    const until = now() + REALM_TRADE_WAIT_MS;
    for (;;) {
      const a = await realmTradeCall(at.io, { id: at.id, lease: at.lease, seq: at.seq, sid: h.sid, give: h.give, get: h.get, pick: h.pick });
      if (a.ok && a.data?.state === 'done') return { ok: true, seq: a.data.seq, items: Array.isArray(a.data.items) ? a.data.items : [], gold: a.data.gold ?? 0 };
      if (a.ok && a.data?.state === 'refused') return { ok: false, why: a.data.why ?? 'refused' };
      if (!a.ok && REALM_LOST.includes(a.error)) return { ok: false, error: a.error, why: a.error };
      // AUDIT REALM L2-F1: a record off the half's sequence - the service answers a settled trade's outcome before it looks
      // at the sequence (server-account/src/realmTrade.js), so this is a move this tab never made: only a join reads it
      if (!a.ok && a.error === 'seq') return { ok: false, unknown: true };
      // a sid another pair spent, a half that is no half: never registered, nothing moved
      if (!a.ok && (a.error === 'trade-spent' || a.status === 400)) return { ok: false, why: 'refused' };
      // waiting, or no answer at all (offline, the service busy): ask again - the half may have landed
      if (now() >= until) return { ok: false, unknown: true };
      await wait(REALM_TRADE_POLL_MS);
    }
  });
  return r.ok || r.unknown ? r : { ...r, text: realmTradeRefusalText(r.why ?? r.error ?? 'refused') };
}

/**
 * REALM P2.1: THE TRADE'S ESCROW over a realm session - what net/tradeSession.js hands its commit to. `hold()` runs
 * while the goods are still in the pack: the host's `checkpoint()` composes the save as it stands - what the service
 * settles against - and the session's hold begins at once, so the checkpoint the pack makes as the goods are reserved
 * (onlineCheckpoint.js checkpointedTradePack), a timer's or a hidden page's never goes: a record with the goods out and
 * nothing received would be what the service read. `settle(half)` sends the half; `release()` abandons a hold whose
 * goods could not be reserved.
 * @param {{ session: any, checkpoint: () => any, wait?: (ms: number) => Promise<void>, now?: () => number }} at
 */
export function realmTradeEscrow({ session, checkpoint, wait, now }) {
  return {
    hold() {
      // AUDIT REALM L1-F1: the service settles against the save composed HERE (its records are what the half picks) - a
      // host that refuses to compose one now (onlineCheckpoint: a duel, out of the seat) answers false, and nothing is held
      if (checkpoint() === false) return null;
      /** @type {(half: any) => void} */
      let hand = () => {};
      const half = new Promise((resolve) => { hand = resolve; });
      const outcome = settleRealmTradeHalf({ session, half, wait, now });   // the session holds from this line
      return {
        settle: (/** @type {any} */ h) => { hand(h); return outcome; },
        release: () => { hand(null); },
        abandon: () => { session.abandon('unknown'); },   // AUDIT REALM L2-F6: a settle this tab cannot hold
      };
    },
  };
}

// ── REALM P2.2: AN ACT THAT MOVES A REALM CHARACTER'S GOLD ON THE SERVICE ──

/** How many times an act asks again when its answer is lost, and how long it waits a time (ms, times the try). */
export const REALM_ACT_TRIES = 4;
export const REALM_ACT_RETRY_MS = 1_000;
/** AUDIT REALM L1-F2: the answers that say nothing about the act - no answer (offline), the service's own error, and the
 *  account's request rate, which the Worker answers before any route: asked again. */
export const REALM_ACT_TRANSIENT = Object.freeze(['offline', 'server', 'rate']);

/**
 * AN ACT THAT MOVES A REALM CHARACTER'S GOLD ON ITS RECORD - a guild's founding, deposit or withdrawal, a home, a piece
 * of decor (server-account/src/realm.js prepareRealmRecord). The save as it stands is checkpointed (`checkpoint`, the
 * host's) and the session's hold begins; `reserve()` then takes the gold out of the purse at once, as the old door did,
 * and answers its undo; `call(at)` asks the service, which moves the record's gold in the act's own batch - both or
 * neither. A refusal (the service's own word) undoes the reserve; an answer gives `apply()` its turn; either way the
 * outcome is checkpointed. A LOST ANSWER IS ASKED AGAIN with the same record: while the hold stands nothing else moves
 * the record, and every realm act answers where the record stands before any other word (AUDIT REALM L1-F2), so a `seq`
 * refusal one ahead, when the act was asked before, is this act, landed - and any other word is the act refused, nothing
 * moved. A `seq` on the first asking is a move this tab never made. Still lost after REALM_ACT_TRIES, the session ends
 * (`unknown`) with the gold where it is - only a join reads how the act ended.
 * `apply(answer)` gets the service's answer; an act whose client needs it (`needsAnswer` - a sale, whose refund the
 * service's price decides) cannot take a landed act without it, and ends the session instead.
 * @param {{ session: any, checkpoint: () => any, reserve?: (() => (() => void)) | null, apply?: ((answer: any) => void) | null,
 *   call: (at: { id: string, lease: string, seq: number }) => Promise<any>, wait?: (ms: number) => Promise<void>, needsAnswer?: boolean }} at
 */
export async function realmGoldAct({ session, checkpoint, reserve = null, apply = null, call, wait = (ms) => new Promise((r) => { setTimeout(r, ms); }), needsAnswer = false }) {
  checkpoint();
  const outcome = session.transact(async (/** @type {any} */ at) => {
    const where = { id: at.id, lease: at.lease, seq: at.seq };
    for (let i = 0; i < REALM_ACT_TRIES; i++) {
      const r = await call(where);
      if (r?.ok) return { ...r, seq: r.data?.realm?.seq ?? at.seq };   // the service says when the record moved; unsaid, it did not
      // AUDIT REALM L1-F2: every realm act answers where the record stands before any other word (server-account/src/
      // realm.js realmActFirst) - so a record one on, when this act was asked before and its answer lost, is this act,
      // landed; on its first asking, or any further on, it is a move nothing this tab sent made: only a join reads it
      if (r?.error === 'seq') return i > 0 && r.seq === at.seq + 1 && !needsAnswer ? { ok: true, landed: true, seq: r.seq } : { ok: false, error: 'offline', unknown: true };
      if (!REALM_ACT_TRANSIENT.includes(r?.error)) return r;   // the service's own word, asked where the record stands: nothing moved
      await wait(REALM_ACT_RETRY_MS * (i + 1));
    }
    return { ok: false, error: 'offline', unknown: true };
  });
  const undo = reserve ? reserve() : null;   // the hold began above: no checkpoint of the purse with it out goes
  const r = await outcome;
  if (r?.ok) apply?.(r);
  else if (!r?.unknown) undo?.();
  if (!r?.unknown) checkpoint();   // the outcome, at the record's next sequence
  return r;
}
