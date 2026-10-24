// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-1 (2026-10-14) - THE POI STORE: WHO MAY BUILD, WHO APPROVES, AND WHAT THE WORLD STANDS.
//
// Mac: "POI Tool (General Map Editor) - Realtime editor ... a tool my developers can use without having to access the
// codebase"; asked how a POI reaches players, "I need to be able to approve changes"; asked who uses it, "Developers +
// Builders" (bible/06-Systems/POI-Editor-Arc.md).
//
// THE ROLES, DERIVED AS EVERY GRANT HERE IS (titles.js): an APPROVER is a handle in APPROVER_HANDLES; a BUILDER is an
// approver, a developer (DEVELOPER_HANDLES) or a handle in BUILDER_HANDLES. A guest is neither. Read fresh at every call,
// so a handle taken off a list loses the door at its next request.
//
// THE FLOW (migration 0116): a builder uploads assets (content-addressed: the bytes' sha256 is the name, checked here) and
// saves a DRAFT revision of a POI - one open draft per author per POI, saved over until it is SUBMITTED. An approver
// APPROVES a submitted revision, as the approver saw it (it becomes the POI's live one, its assets readable by anyone
// while a live revision names them) or REJECTS it with a word. Taking a POI out of the world is a submitted 'retire'
// revision, approved the same way. A ROLLBACK points the POI at an earlier approved revision, and is a revision of its
// own. Every approval, rollback and retirement moves the feed's version - the game's one cheap question, "anything new?"
// (`poiLiveFeed`). AUDIT POI (2026-10-15) held every write here to what it says: a write that changed nothing is never
// answered as one that did, two writes at once meet in the database, and every count is counted where it is written.
//
// NOTHING A BUILDER WRITES REACHES A PLAYER BEFORE AN APPROVER SAYS SO: the feed is live revisions only, and an asset no
// live revision names is readable only by a builder.
//
// THE LIBRARY'S SHELF (POI-4b): the models builders keep to stand again, shared by them all - an entry is checked by the
// same law a POI is (poiLaw.js poiShelfProblems, its assets stored), changed only by its author or an approver, taken off
// the shelf and never deleted. A shelf is the builders' business: it reaches no player, and its assets stay a builder's
// until a live POI names them.
// ═══════════════════════════════════════════════════════════════════

import { poiDocProblems, poiShelfProblems, poiAssetProblems, poiAssetsOf, POI_ID_RE, POI_SHELF_ID_RE, POI_SHA_RE, POI_LIMITS } from '../../src/poi/poiLaw.js';
import { decodePoiMesh, poiMeshFacts, POI_MESH_LIMITS } from '../../src/poi/poiMesh.js';
import { poiImageMetaOf, POI_IMAGE_LIMITS, POI_IMAGE_TYPES } from '../../src/poi/poiImage.js';
import { developerHandles } from './titles.js';

/** A handle list from the config, as titles.js reads its own - trimmed, case-folded, empty ones dropped. */
function handleList(raw) {
  if (typeof raw !== 'string' || !raw) return new Set();
  return new Set(raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));
}

/** What this player may do with POIs - `{ builder, approver }`. @param {any} player @param {any} env */
export function poiRolesOf(player, env) {
  const h = typeof player?.handle === 'string' && player.handle ? player.handle.toLowerCase() : null;
  if (!h) return { builder: false, approver: false };
  const approver = handleList(env?.APPROVER_HANDLES).has(h);
  const builder = approver || developerHandles(env).has(h) || handleList(env?.BUILDER_HANDLES).has(h);
  return { builder, approver };
}

/** Where an asset's bytes live in the bucket. */
export const poiAssetKey = (/** @type {string} */ sha) => `poi/a/${sha}`;
/** The bytes one account may upload in a UTC day - a builder is trusted, and a day's bound keeps a slip from filling R2. */
export const POI_UPLOAD_DAY_BYTES = 1024 * 1024 * 1024;
/** The bounds a request's raw body is read to: a mesh, a texture, a draft. */
export const POI_ASSET_MAX = Object.freeze({ mesh: POI_MESH_LIMITS.bytes, texture: POI_IMAGE_LIMITS.bytes });
export const POI_DRAFT_BODY_MAX = POI_LIMITS.docBytes + 1024;
/** AUDIT POI S10: the revisions one builder may hold open at once - drafts and submissions waiting, every POI's (a new
 *  POI is founded by its first draft, so this bounds those too) - a bound on a slip, not on a builder's work. */
export const POI_OPEN_REVS = 200;
/** AUDIT POI S10: the submissions one queue answer carries (each with its document and the live one, up to 96 KiB each)
 *  - the oldest first, `more` saying others wait. */
export const POI_QUEUE_MAX = 50;
/** AUDIT POI S10: the revisions the list carries of each POI, the newest - the history (`/doc/<id>`) has them all. */
export const POI_LIST_REVS = 20;
/** AUDIT POI S4: how long a live asset's bytes may be kept by a cache - a day. Content-addressed bytes never change, but
 *  an asset can stop being public (a revision that replaced it approved, its POI retired - someone else's model, say):
 *  "immutable for a year" had made that impossible to take back; a day bounds how long a copy outlives it. */
export const POI_LIVE_ASSET_MAX_AGE_S = 86400;
/** D1's bound on one statement's parameters (test/accountDb.mjs D1_MAX_BOUND, Cloudflare's limit) - lists go in chunks under it. */
const BOUND_CHUNK = 90;

const hex = (/** @type {ArrayBuffer} */ buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const chunks = (/** @type {any[]} */ list, n = BOUND_CHUNK) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const parsed = (/** @type {any} */ text) => { try { return typeof text === 'string' ? JSON.parse(text) : null; } catch { return null; } };
/** AUDIT POI S1: a stored document's name - the sha256 of its text, as the queue gives it and an approver's word names it. */
export const poiDocSha = async (/** @type {any} */ subtle, /** @type {string} */ text) => hex(await subtle.digest('SHA-256', new TextEncoder().encode(text)));
/** AUDIT POI S1: a decision's own mark, fresh for every request that decides (`ctx.rand`, the service's CSPRNG). */
const decisionMark = (/** @type {any} */ ctx) => {
  const b = new Uint8Array(16);
  if (ctx.rand) ctx.rand(b); else globalThis.crypto.getRandomValues(b);
  return hex(b.buffer);
};

/** Every stored fact of these assets - a Map of sha to `{ kind, live, bytes, ...meta }`. @param {any} db @param {string[]} shas */
async function assetFactsOf(db, shas) {
  const out = new Map();
  for (const part of chunks([...new Set(shas)])) {
    if (!part.length) continue;
    const rows = (await db.prepare(`SELECT sha, kind, bytes, meta, live FROM poi_assets WHERE sha IN (${part.map(() => '?').join(', ')})`).bind(...part).all()).results ?? [];
    for (const r of rows) out.set(r.sha, { kind: r.kind, live: r.live === 1, bytes: r.bytes, ...(parsed(r.meta) ?? {}) });   // AUDIT POI S6: its bytes, for the budget
  }
  return out;
}

/** AUDIT POI S4: recompute `live` for every asset any revision of this POI was approved naming - live while a POI's live
 *  revision names it, whichever POI's - after `when` (an SQL condition on ?1 the POI's id and the step's own binds). */
const liveRecomputed = (/** @type {string} */ when) => `UPDATE poi_assets SET live = EXISTS (SELECT 1 FROM poi_rev_assets ra JOIN poi_docs d ON d.id = ra.poi_id AND d.live_rev = ra.rev WHERE ra.sha = poi_assets.sha)
  WHERE sha IN (SELECT sha FROM poi_rev_assets WHERE poi_id = ?1) AND ${when}`;

// ─── ASSETS ─────────────────────────────────────────────────────────

/**
 * A builder's upload: the bytes named by their own sha256 (checked), read as the kind they claim (a mesh decoded whole,
 * a texture by its header), stored once. A second upload of the same bytes is the first's answer.
 * @param {any} ctx `{ db, bucket, subtle, nowS }` @param {any} player @param {any} env
 * @param {{ sha: string, kind: string, bytes: ArrayBuffer }} a
 */
export async function putPoiAsset(ctx, player, env, { sha, kind, bytes }) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  if (typeof sha !== 'string' || !POI_SHA_RE.test(sha)) return { error: 'poi-sha' };
  if (kind !== 'mesh' && kind !== 'texture') return { error: 'poi-kind' };
  if (!ctx.bucket) return { error: 'no-storage' };
  const got = hex(await ctx.subtle.digest('SHA-256', bytes));
  if (got !== sha) return { error: 'poi-sha-mismatch' };
  let meta, type = 'application/octet-stream';
  if (kind === 'mesh') {
    const d = decodePoiMesh(bytes);
    if ('error' in d) return { error: 'poi-bad-mesh', why: d.error };
    meta = poiMeshFacts(d.mesh);
  } else {
    const m = poiImageMetaOf(bytes);
    if ('error' in m) return { error: 'poi-bad-texture', why: m.error };
    meta = { format: m.format, w: m.w, h: m.h };
    type = m.type;
  }
  const existed = async () => {
    const had = await ctx.db.prepare('SELECT kind, meta FROM poi_assets WHERE sha = ?').bind(sha).first();
    return had && (had.kind === kind ? { sha, kind, meta: parsed(had.meta), existed: true } : { error: 'poi-kind' });
  };
  const had = await existed();
  if (had) return had;
  // AUDIT POI S9: THE DAY'S BYTES RESERVED BEFORE THE BYTES ARE STORED, in the one statement that counts them - the
  // bound had been a SUM read, then the R2 put, then the row: eight uploads at once each read room for one, and all
  // eight were stored past it. Given back if the bytes are not stored after all.
  const day = Math.floor(ctx.nowS / 86400), n = bytes.byteLength;
  const held = n <= POI_UPLOAD_DAY_BYTES && (await ctx.db.prepare(`INSERT INTO poi_upload_days (by, day, bytes) VALUES (?1, ?2, ?3)
    ON CONFLICT (by, day) DO UPDATE SET bytes = bytes + excluded.bytes WHERE bytes + excluded.bytes <= ?4`).bind(player.id, day, n, POI_UPLOAD_DAY_BYTES).run()).meta?.changes;
  if (!held) return { error: 'poi-quota' };
  const giveBack = () => ctx.db.prepare('UPDATE poi_upload_days SET bytes = MAX(0, bytes - ?) WHERE by = ? AND day = ?').bind(n, player.id, day).run();
  try {
    await ctx.bucket.put(poiAssetKey(sha), bytes, { httpMetadata: { contentType: type } });
  } catch (e) {
    await giveBack();
    throw e;
  }
  const stored = await ctx.db.prepare('INSERT OR IGNORE INTO poi_assets (sha, kind, bytes, meta, by, at, live) VALUES (?, ?, ?, ?, ?, ?, 0)')
    .bind(sha, kind, n, JSON.stringify(meta), player.id, ctx.nowS).run();
  if (!stored.meta?.changes) {
    // the same bytes stored by an upload at the same moment: that one's, and these bytes not this builder's to count
    await giveBack();
    return (await existed()) ?? { error: 'poi-state' };
  }
  return { sha, kind, meta, existed: false };
}

/**
 * An asset's bytes for a reader - anyone's when a live revision names it, else only a builder's (a draft's model is
 * the builders' business until it is approved). `{ object, kind }` or `{ error }`.
 * @param {any} ctx @param {string} sha @param {{ builder: boolean }} roles
 */
export async function getPoiAsset(ctx, sha, roles) {
  if (typeof sha !== 'string' || !POI_SHA_RE.test(sha)) return { error: 'not-found' };
  const row = await ctx.db.prepare('SELECT kind, meta, live FROM poi_assets WHERE sha = ?').bind(sha).first();
  if (!row || (row.live !== 1 && !roles.builder)) return { error: 'not-found' };
  if (!ctx.bucket) return { error: 'no-storage' };
  const object = await ctx.bucket.get(poiAssetKey(sha));
  if (!object) return { error: 'not-found' };
  // its type from the facts stored at its upload - read off its header then - never from the bucket's say
  const type = row.kind === 'texture' ? (POI_IMAGE_TYPES[parsed(row.meta)?.format] ?? 'application/octet-stream') : 'application/octet-stream';
  return { object, kind: row.kind, type, live: row.live === 1 };
}

// ─── DRAFTS AND SUBMISSIONS ─────────────────────────────────────────

/** A document's problems, its own shape's and its assets' - empty for one the realm takes. @param {any} db @param {any} doc */
async function docProblems(db, doc) {
  const own = poiDocProblems(doc);
  if (own.length) return own;
  const { meshes, textures } = poiAssetsOf(doc);
  const facts = await assetFactsOf(db, [...meshes, ...textures]);
  return poiAssetProblems(doc, (sha) => facts.get(sha) ?? null);
}

/**
 * A builder saves a draft of `doc` (its id the POI's - a new id founds the POI). Saved over the author's own open draft
 * of this POI, else a new revision (`base` the revision the editor started from). `{ id, rev, state }` or `{ error, problems? }`.
 * @param {any} ctx @param {any} player @param {any} env @param {{ doc: any, base?: any }} body
 */
export async function savePoiDraft(ctx, player, env, { doc, base = null }) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  const problems = await docProblems(ctx.db, doc);
  if (problems.length) return { error: 'poi-doc', problems };
  const id = doc.id;
  if (base !== null && !(Number.isSafeInteger(base) && base > 0)) return { error: 'body' };
  const poi = await ctx.db.prepare('SELECT id FROM poi_docs WHERE id = ?').bind(id).first();
  if (!poi && base !== null) return { error: 'not-found' };
  if (poi && base !== null && !(await ctx.db.prepare('SELECT 1 FROM poi_revs WHERE poi_id = ? AND rev = ?').bind(id, base).first())) return { error: 'not-found' };
  const text = JSON.stringify(doc);
  // AUDIT POI S1: its name written with it; AUDIT POI S3: its name and pixel beside it, for the list (no JSON read there)
  const binds = [id, text, await poiDocSha(ctx.subtle, text), doc.name, doc.place.px, doc.place.py, base, player.id, player.handle, ctx.nowS];
  // AUDIT POI S10: room for one more open revision of this builder's - counted in the statement that writes it
  const room = `(SELECT COUNT(*) FROM poi_revs WHERE author = ?8 AND state IN ('draft', 'submitted')) < ${POI_OPEN_REVS}`;
  for (let pass = 0; pass < 2; pass++) {
    // AUDIT POI S7: OVER THE AUTHOR'S OWN OPEN DRAFT, in the one statement that finds it. Found, then written, a draft
    // submitted between the two had been answered "saved" and stored nowhere; now a draft gone to the queue is simply not
    // found, and the save is the next revision - as a save after a submission always was.
    const over = await ctx.db.prepare(`UPDATE poi_revs SET doc = ?2, doc_sha = ?3, name = ?4, px = ?5, py = ?6, at = ?10, base_rev = COALESCE(?7, base_rev)
      WHERE poi_id = ?1 AND author = ?8 AND state = 'draft' AND kind = 'doc' RETURNING rev`).bind(...binds).first();
    if (over) return { id, rev: over.rev, state: 'draft' };
    // else a new revision (a new id founds the POI), its number taken in the write itself, so two builders saving at once
    // never collide - AUDIT POI S8: and one author's two saves at once meet at poi_revs_one_draft, the second saved over
    // the first's draft on the next pass rather than beside it
    const steps = [];
    if (!poi) steps.push(ctx.db.prepare(`INSERT INTO poi_docs (id, created_by, created_at) SELECT ?1, ?8, ?10 WHERE ${room} ON CONFLICT (id) DO NOTHING`).bind(...binds));
    steps.push(ctx.db.prepare(`INSERT INTO poi_revs (poi_id, rev, kind, doc, doc_sha, name, px, py, base_rev, author, author_name, at, state)
      SELECT ?1, n.next, 'doc', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'draft' FROM (SELECT COALESCE(MAX(rev), 0) + 1 AS next FROM poi_revs WHERE poi_id = ?1) n
      WHERE ${room} AND EXISTS (SELECT 1 FROM poi_docs WHERE id = ?1) ON CONFLICT DO NOTHING RETURNING rev`).bind(...binds));
    const made = (await ctx.db.batch(steps)).at(-1)?.results?.[0];
    if (made) return { id, rev: made.rev, state: 'draft' };
    const open = await ctx.db.prepare("SELECT 1 FROM poi_revs WHERE poi_id = ? AND author = ? AND state = 'draft' AND kind = 'doc'").bind(id, player.id).first();
    if (!open) return { error: 'poi-drafts-full', max: POI_OPEN_REVS };
  }
  return { error: 'poi-state' };
}

/** The author's draft, submitted for approval - checked again, so a submission is always a document the realm takes. */
export async function submitPoi(ctx, player, env, { id, rev }) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  if (!POI_ID_RE.test(String(id)) || !Number.isSafeInteger(rev)) return { error: 'body' };
  const row = await ctx.db.prepare('SELECT doc, doc_sha, author, state, kind FROM poi_revs WHERE poi_id = ? AND rev = ?').bind(id, rev).first();
  if (!row) return { error: 'not-found' };
  if (row.author !== player.id) return { error: 'poi-not-author' };
  if (row.state !== 'draft') return { error: 'poi-state', state: row.state };
  const problems = await docProblems(ctx.db, parsed(row.doc));
  if (problems.length) return { error: 'poi-doc', problems };
  // AUDIT POI S1: the document checked is the document submitted - a save over the draft between the two is not sent
  const r = await ctx.db.prepare("UPDATE poi_revs SET state = 'submitted', submitted_at = ? WHERE poi_id = ? AND rev = ? AND state = 'draft' AND doc_sha = ?").bind(ctx.nowS, id, rev, row.doc_sha).run();
  if (!r.meta?.changes) return stateNow(ctx.db, id, rev, 'poi-state');
  return { id, rev, state: 'submitted' };
}

/** A write that changed nothing, answered by what the revision is now (AUDIT POI S7) - `{ error, state }`. */
async function stateNow(db, id, rev, error) {
  const now = await db.prepare('SELECT state FROM poi_revs WHERE poi_id = ? AND rev = ?').bind(id, rev).first();
  return { error, state: now?.state ?? null };
}

/**
 * The author takes a submission back, before it is decided: a document to a draft again - or, when the author has
 * another open draft of that POI (one open draft each, poi_revs_one_draft), 'withdrawn', out of the queue and kept in the
 * history; a retirement, which has no draft to go back to, 'withdrawn' (AUDIT POI S14: its own state, not a rejection
 * with an English note no builder's language says).
 */
export async function withdrawPoi(ctx, player, env, { id, rev }) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  if (!POI_ID_RE.test(String(id)) || !Number.isSafeInteger(rev)) return { error: 'body' };
  const row = await ctx.db.prepare('SELECT author, state, kind FROM poi_revs WHERE poi_id = ? AND rev = ?').bind(id, rev).first();
  if (!row) return { error: 'not-found' };
  if (row.author !== player.id) return { error: 'poi-not-author' };
  if (row.state !== 'submitted') return { error: 'poi-state', state: row.state };
  // AUDIT POI S7: decided in the one statement that writes it, and a withdrawal an approval beat told so - it had been
  // answered 'draft' while the revision stood approved in the world
  const r = await ctx.db.prepare(`UPDATE poi_revs SET submitted_at = NULL, state = CASE WHEN kind = 'doc' AND NOT EXISTS
    (SELECT 1 FROM poi_revs o WHERE o.poi_id = ?1 AND o.author = ?3 AND o.state = 'draft' AND o.kind = 'doc') THEN 'draft' ELSE 'withdrawn' END
    WHERE poi_id = ?1 AND rev = ?2 AND author = ?3 AND state = 'submitted' RETURNING state`).bind(id, rev, player.id).first();
  if (!r) return stateNow(ctx.db, id, rev, 'poi-state');
  return { id, rev, state: r.state };
}

/** A builder asks for a live POI to be taken out of the world - a 'retire' revision, submitted, for an approver. */
export async function requestRetire(ctx, player, env, { id }) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  if (!POI_ID_RE.test(String(id))) return { error: 'body' };
  // AUDIT POI S8: ONE WAITING AT A TIME, held by poi_revs_one_retire in the write itself - asked, then written, two
  // builders asking at once had both been told the same revision while two retirements waited; its base the revision
  // live as it is written
  const made = await ctx.db.prepare(`INSERT INTO poi_revs (poi_id, rev, kind, doc, base_rev, author, author_name, at, state, submitted_at)
    SELECT ?1, n.next, 'retire', NULL, d.live_rev, ?2, ?3, ?4, 'submitted', ?4 FROM (SELECT COALESCE(MAX(rev), 0) + 1 AS next FROM poi_revs WHERE poi_id = ?1) n
    JOIN poi_docs d ON d.id = ?1 WHERE d.live_rev IS NOT NULL ON CONFLICT DO NOTHING RETURNING rev`).bind(id, player.id, player.handle, ctx.nowS).first();
  if (made) return { id, rev: made.rev, state: 'submitted' };
  const poi = await ctx.db.prepare('SELECT live_rev FROM poi_docs WHERE id = ?').bind(id).first();
  if (!poi) return { error: 'not-found' };
  return { error: poi.live_rev == null ? 'poi-not-live' : 'poi-pending' };
}

// ─── THE APPROVER'S WORD ────────────────────────────────────────────

/**
 * An approver decides a submitted revision: `approve` stands it in the world (a retirement takes the POI out), `reject`
 * sends it back with a word. One batch - the decision, the live pointer, the assets made public and the feed's version -
 * every write after the first conditional on the first having been THIS request's decision, so a decision raced is
 * made once.
 *
 * AUDIT POI S1: A SUBMISSION IS APPROVED ONLY AS THE APPROVER SAW IT. `docSha` is the name of the document the approver
 * looked at (the queue's `docSha`, poiDocSha); approved by (id, rev) alone, a submission withdrawn, saved over and sent
 * again under the same revision had stood a document no approver saw, its models made public. A document's approval
 * names it (`body` without), and a revision whose document is not that one is refused `poi-changed`, nothing decided.
 * The decision itself is conditioned on the document READ here - so the assets made public are the ones of the
 * document decided, never one swapped in between the read and the batch.
 * The later writes are conditioned on `decision`, a mark this request alone wrote: on "decided by this approver this
 * second" a retry in the same second - refused - had put its live pointer back over a rollback made since.
 */
export async function reviewPoi(ctx, player, env, { id, rev, verdict, note = null, docSha = null }) {
  if (!poiRolesOf(player, env).approver) return { error: 'poi-not-approver' };
  if (!POI_ID_RE.test(String(id)) || !Number.isSafeInteger(rev) || (verdict !== 'approve' && verdict !== 'reject')) return { error: 'body' };
  if (note !== null && !(typeof note === 'string' && note.length <= POI_LIMITS.note)) return { error: 'body' };
  if (docSha !== null && !(typeof docSha === 'string' && POI_SHA_RE.test(docSha))) return { error: 'body' };
  const row = await ctx.db.prepare('SELECT kind, doc, doc_sha, state FROM poi_revs WHERE poi_id = ? AND rev = ?').bind(id, rev).first();
  if (!row) return { error: 'not-found' };
  if (row.state !== 'submitted') return { error: 'poi-state', state: row.state };
  if (verdict === 'approve' && row.kind === 'doc' && docSha === null) return { error: 'body' };
  if (docSha !== null && docSha !== row.doc_sha) return { error: 'poi-changed' };
  const now = ctx.nowS;
  const state = verdict === 'approve' ? 'approved' : 'rejected';
  const doc = parsed(row.doc);
  if (verdict === 'approve' && row.kind === 'doc') {
    // checked once more at the moment it goes live: an asset the document names must be stored, and of its kind
    const problems = await docProblems(ctx.db, doc);
    if (problems.length) return { error: 'poi-doc', problems };
  }
  const mark = decisionMark(ctx);
  const decided = 'EXISTS (SELECT 1 FROM poi_revs WHERE poi_id = ?1 AND rev = ?2 AND decision = ?3)';
  const steps = [
    ctx.db.prepare(`UPDATE poi_revs SET state = ?5, reviewer = ?4, reviewer_name = ?6, reviewed_at = ?7, note = ?8, decision = ?3
      WHERE poi_id = ?1 AND rev = ?2 AND state = 'submitted' AND doc_sha IS ?9`).bind(id, rev, mark, player.id, state, player.handle, now, note, row.doc_sha),
  ];
  if (verdict === 'approve') {
    if (row.kind === 'doc') {
      // AUDIT POI S4: the assets this revision names, kept beside it - whether an asset is live is asked of them
      const { meshes, textures } = poiAssetsOf(doc);
      steps.push(ctx.db.prepare(`INSERT OR IGNORE INTO poi_rev_assets (poi_id, rev, sha) SELECT ?1, ?2, value FROM json_each(?4) WHERE ${decided}`).bind(id, rev, mark, JSON.stringify([...meshes, ...textures])));
    }
    steps.push(ctx.db.prepare(`UPDATE poi_docs SET live_rev = ${row.kind === 'retire' ? 'NULL' : '?2'}, live_at = ?5, live_by = ?4 WHERE id = ?1 AND ${decided}`).bind(id, rev, mark, player.id, now));
    // AUDIT POI S4: and live recomputed for every asset any revision of this POI named - the ones this revision no longer
    // names (a replaced model, a retired POI's) a builder's again, unless another live POI names them
    steps.push(ctx.db.prepare(liveRecomputed(decided)).bind(id, rev, mark));
    steps.push(ctx.db.prepare(`UPDATE poi_feed SET v = v + 1, at = ?4 WHERE k = 'feed' AND ${decided}`).bind(id, rev, mark, now));
  }
  const res = await ctx.db.batch(steps);
  if (!res[0]?.meta?.changes) {
    const after = await ctx.db.prepare('SELECT state FROM poi_revs WHERE poi_id = ? AND rev = ?').bind(id, rev).first();
    return after?.state === 'submitted' ? { error: 'poi-changed' } : { error: 'poi-state', state: after?.state ?? null };
  }
  if (verdict === 'approve') forgetPoiFeed();
  return { id, rev, state };
}

/**
 * An approver points a POI at an earlier approved revision (a rollback - or a retired POI stood again). AUDIT POI S14:
 * RECORDED AS A REVISION of its own (kind 'rollback': no document, `base_rev` the revision put back, the approver its
 * author and its reviewer) - the history is the record of who changed what, and a rollback's actor had lived only in
 * `poi_docs.live_by`, written over at the next approval. AUDIT POI S4: the assets' `live` recomputed with it.
 */
export async function rollbackPoi(ctx, player, env, { id, rev }) {
  if (!poiRolesOf(player, env).approver) return { error: 'poi-not-approver' };
  if (!POI_ID_RE.test(String(id)) || !Number.isSafeInteger(rev)) return { error: 'body' };
  const row = await ctx.db.prepare('SELECT kind, state, doc FROM poi_revs WHERE poi_id = ? AND rev = ?').bind(id, rev).first();
  if (!row) return { error: 'not-found' };
  if (row.state !== 'approved' || row.kind !== 'doc') return { error: 'poi-state', state: row.state };
  const doc = parsed(row.doc);
  const problems = await docProblems(ctx.db, doc);
  if (problems.length) return { error: 'poi-doc', problems };
  const { meshes, textures } = poiAssetsOf(doc);
  const now = ctx.nowS;
  // an approved revision is approved for good, so the read above holds at the batch: its writes need no condition
  await ctx.db.batch([
    ctx.db.prepare(`INSERT INTO poi_revs (poi_id, rev, kind, doc, base_rev, author, author_name, at, state, reviewer, reviewer_name, reviewed_at)
      SELECT ?1, n.next, 'rollback', NULL, ?2, ?3, ?4, ?5, 'approved', ?3, ?4, ?5 FROM (SELECT COALESCE(MAX(rev), 0) + 1 AS next FROM poi_revs WHERE poi_id = ?1) n`).bind(id, rev, player.id, player.handle, now),
    ctx.db.prepare('INSERT OR IGNORE INTO poi_rev_assets (poi_id, rev, sha) SELECT ?1, ?2, value FROM json_each(?3)').bind(id, rev, JSON.stringify([...meshes, ...textures])),
    ctx.db.prepare('UPDATE poi_docs SET live_rev = ?2, live_at = ?3, live_by = ?4 WHERE id = ?1').bind(id, rev, now, player.id),
    ctx.db.prepare(liveRecomputed('1')).bind(id),
    ctx.db.prepare("UPDATE poi_feed SET v = v + 1, at = ? WHERE k = 'feed'").bind(now),
  ]);
  forgetPoiFeed();
  return { id, rev, live: true };
}

// ─── READS ──────────────────────────────────────────────────────────

/** The POIs a list carries, newest first. */
const POI_LIST_MAX = 2000;

/**
 * Every POI, for a builder's list: its live revision, where it stands, and its newest revisions' states (no documents).
 * AUDIT POI S3: its name and pixel from the columns written with each revision, never read out of the documents - a
 * json_extract over every revision had made one draft deeper than SQLite's JSON bound a 500 for every builder.
 * AUDIT POI S10: and only what it lists is read - the listed POIs' newest POI_LIST_REVS revisions each, not every
 * revision of every POI.
 */
export async function listPoi(ctx, player, env) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  const docs = (await ctx.db.prepare(`SELECT d.id, d.created_by, d.created_at, d.live_rev, d.live_at, d.live_by, n.name, n.px, n.py,
    (SELECT MAX(rev) FROM poi_revs WHERE poi_id = d.id) AS newest
    FROM poi_docs d LEFT JOIN poi_revs n ON n.poi_id = d.id AND n.rev = COALESCE(d.live_rev, (SELECT MAX(rev) FROM poi_revs WHERE poi_id = d.id AND kind = 'doc'))
    ORDER BY d.created_at DESC LIMIT ${POI_LIST_MAX}`).all()).results ?? [];
  const revs = (await ctx.db.prepare(`SELECT poi_id, rev, kind, author, author_name, at, state, submitted_at, reviewer_name, reviewed_at, base_rev FROM (
    SELECT poi_id, rev, kind, author, author_name, at, state, submitted_at, reviewer_name, reviewed_at, base_rev, ROW_NUMBER() OVER (PARTITION BY poi_id ORDER BY rev DESC) AS k
    FROM poi_revs WHERE poi_id IN (SELECT id FROM poi_docs ORDER BY created_at DESC LIMIT ${POI_LIST_MAX})) WHERE k <= ${POI_LIST_REVS} ORDER BY poi_id, rev`).all()).results ?? [];
  const byPoi = new Map();
  for (const r of revs) {
    if (!byPoi.has(r.poi_id)) byPoi.set(r.poi_id, []);
    byPoi.get(r.poi_id).push(r);
  }
  return {
    pois: docs.map((d) => {
      const rs = byPoi.get(d.id) ?? [];
      return {
        id: d.id, name: d.name ?? d.id, px: d.px ?? null, py: d.py ?? null, createdBy: d.created_by, createdAt: d.created_at,
        liveRev: d.live_rev, liveAt: d.live_at, newestRev: d.newest ?? null,
        revs: rs.map((r) => ({ rev: r.rev, kind: r.kind, author: r.author_name, authorId: r.author, at: r.at, state: r.state, submittedAt: r.submitted_at, reviewer: r.reviewer_name, reviewedAt: r.reviewed_at, base: r.base_rev })),
      };
    }),
  };
}

/** One POI's every revision, documents and all - the history, and the drafts to open. */
export async function poiHistory(ctx, player, env, id) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  if (!POI_ID_RE.test(String(id))) return { error: 'body' };
  const poi = await ctx.db.prepare('SELECT id, created_by, created_at, live_rev, live_at, live_by FROM poi_docs WHERE id = ?').bind(id).first();
  if (!poi) return { error: 'not-found' };
  const revs = (await ctx.db.prepare('SELECT * FROM poi_revs WHERE poi_id = ? ORDER BY rev').bind(id).all()).results ?? [];
  return {
    id, liveRev: poi.live_rev, liveAt: poi.live_at, createdAt: poi.created_at,
    revs: revs.map((r) => ({ rev: r.rev, kind: r.kind, doc: parsed(r.doc), base: r.base_rev, author: r.author_name, authorId: r.author, at: r.at, state: r.state, submittedAt: r.submitted_at, reviewer: r.reviewer_name, reviewedAt: r.reviewed_at, note: r.note })),
  };
}

// ─── THE LIBRARY'S SHELF (POI-4b) ───────────────────────────────────

/** The entries one builder may keep on the shelf at once - a bound on a slip, not on a builder's work. */
export const POI_SHELF_MAX = 2000;
/** AUDIT POI S10: the entries one builder may ever put on the shelf, those taken off included - an entry taken off is
 *  kept, so a bound on the shelf alone let a loop of put and take off keep rows without end (6,000 in the audit's). */
export const POI_SHELF_EVER = 5 * POI_SHELF_MAX;
/** The entries a list answers, newest first. */
export const POI_SHELF_LIST = 5000;

/** Every entry on the shelf, newest change first, without its parts - what a builder browses. `{ items }`. */
export async function listShelf(ctx, player, env) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  const rows = (await ctx.db.prepare(`SELECT id, name, tags, thumb, parts, triangles, by, by_name, at, updated_at, updated_by FROM poi_shelf
    WHERE gone_at IS NULL ORDER BY updated_at DESC, id LIMIT ${POI_SHELF_LIST}`).all()).results ?? [];
  return {
    items: rows.map((r) => ({ id: r.id, name: r.name, tags: parsed(r.tags) ?? [], thumb: r.thumb, parts: r.parts, triangles: r.triangles, by: r.by_name, byId: r.by, at: r.at, updatedAt: r.updated_at, updatedBy: r.updated_by })),
  };
}

/** One entry, its parts and lights - what is stood when it is placed. */
export async function shelfEntry(ctx, player, env, id) {
  if (!poiRolesOf(player, env).builder) return { error: 'poi-not-builder' };
  if (!POI_SHELF_ID_RE.test(String(id))) return { error: 'body' };
  const r = await ctx.db.prepare('SELECT item, by, by_name, at, updated_at, gone_at FROM poi_shelf WHERE id = ?').bind(id).first();
  if (!r) return { error: 'not-found' };
  if (r.gone_at != null) return { error: 'poi-gone' };   // AUDIT POI U13: taken off the shelf - said so, not "the service does not know that request"
  return { id, item: parsed(r.item), by: r.by_name, byId: r.by, at: r.at, updatedAt: r.updated_at };
}

/**
 * A builder puts an entry on the shelf, or changes one: checked whole (its shape and its assets, stored and of their
 * kinds), new under its own id, or over an entry of the builder's own (an approver's, any entry). `{ id, at }`.
 * @param {any} ctx @param {any} player @param {any} env @param {{ item: any }} body
 */
export async function shelve(ctx, player, env, { item }) {
  const roles = poiRolesOf(player, env);
  if (!roles.builder) return { error: 'poi-not-builder' };
  const own = poiShelfProblems(item);
  if (own.length) return { error: 'poi-doc', problems: own };
  const { meshes, textures } = poiAssetsOf(item);
  const facts = await assetFactsOf(ctx.db, [...meshes, ...textures]);
  const problems = poiAssetProblems(item, (sha) => facts.get(sha) ?? null);
  if (problems.length) return { error: 'poi-doc', problems };
  const triangles = item.parts.reduce((n, part) => n + (Number(facts.get(part.mesh)?.triangles) || 0), 0);
  const text = JSON.stringify(item), tags = JSON.stringify(item.tags ?? []);
  for (let pass = 0; pass < 2; pass++) {
    const had = await ctx.db.prepare('SELECT by, gone_at FROM poi_shelf WHERE id = ?').bind(item.id).first();
    if (had) {
      if (had.gone_at != null) return { error: 'poi-gone' };   // AUDIT POI U13: its own word
      if (had.by !== player.id && !roles.approver) return { error: 'poi-not-author' };
      const r = await ctx.db.prepare('UPDATE poi_shelf SET item = ?, name = ?, tags = ?, thumb = ?, parts = ?, triangles = ?, updated_at = ?, updated_by = ? WHERE id = ? AND gone_at IS NULL')
        .bind(text, item.name, tags, item.thumb, item.parts.length, triangles, ctx.nowS, player.handle, item.id).run();
      if (!r.meta?.changes) return { error: 'poi-gone' };   // AUDIT POI S7: taken off between the read and the write
      return { id: item.id, at: ctx.nowS };
    }
    // AUDIT POI S8 / S10: PUT NEW IN ONE STATEMENT - its room counted in it (the shelf's bound, and the builder's every
    // entry ever's), its id taken once. Counted, then INSERT OR IGNOREd, two builders putting one id at once had both
    // been told it was theirs, and the second dropped; now the second finds the first's on the next pass and is answered
    // as over any entry that stands.
    const made = await ctx.db.prepare(`INSERT INTO poi_shelf (id, item, name, tags, thumb, parts, triangles, by, by_name, at, updated_at, updated_by)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?9
      WHERE (SELECT COUNT(*) FROM poi_shelf WHERE by = ?8 AND gone_at IS NULL) < ${POI_SHELF_MAX} AND (SELECT COUNT(*) FROM poi_shelf WHERE by = ?8) < ${POI_SHELF_EVER}
      ON CONFLICT (id) DO NOTHING`).bind(item.id, text, item.name, tags, item.thumb, item.parts.length, triangles, player.id, player.handle, ctx.nowS).run();
    if (made.meta?.changes) return { id: item.id, at: ctx.nowS };
    if (!(await ctx.db.prepare('SELECT 1 FROM poi_shelf WHERE id = ?').bind(item.id).first())) {
      // AUDIT POI U13: a full shelf its own word - it had been answered as a full day's uploads
      const kept = await ctx.db.prepare('SELECT COUNT(*) AS n FROM poi_shelf WHERE by = ? AND gone_at IS NULL').bind(player.id).first();
      return Number(kept?.n ?? 0) >= POI_SHELF_MAX ? { error: 'poi-shelf-full', max: POI_SHELF_MAX } : { error: 'poi-shelf-spent', max: POI_SHELF_EVER };
    }
  }
  return { error: 'poi-state' };
}

/** An entry taken off the shelf by its author or an approver - kept, as every record here is, but listed no more. */
export async function unshelve(ctx, player, env, { id }) {
  const roles = poiRolesOf(player, env);
  if (!roles.builder) return { error: 'poi-not-builder' };
  if (!POI_SHELF_ID_RE.test(String(id))) return { error: 'body' };
  const r = await ctx.db.prepare('SELECT by, gone_at FROM poi_shelf WHERE id = ?').bind(id).first();
  if (!r) return { error: 'not-found' };
  if (r.gone_at != null) return { error: 'poi-gone' };   // AUDIT POI U13
  if (r.by !== player.id && !roles.approver) return { error: 'poi-not-author' };
  const w = await ctx.db.prepare('UPDATE poi_shelf SET gone_at = ?, gone_by = ? WHERE id = ? AND gone_at IS NULL').bind(ctx.nowS, player.handle, id).run();
  if (!w.meta?.changes) return { error: 'poi-gone' };   // AUDIT POI S7: taken off by another between the read and the write
  return { id, gone: true };
}

/**
 * The approver's queue: the submitted revisions, oldest first, with the live document each would replace and its own
 * document's name (`docSha`, AUDIT POI S1 - what an approval names; null for a retirement). AUDIT POI S10: at most
 * POI_QUEUE_MAX of them, `more` true when others wait - it had answered up to 500 documents with their live ones.
 */
export async function poiQueue(ctx, player, env) {
  if (!poiRolesOf(player, env).approver) return { error: 'poi-not-approver' };
  const rows = (await ctx.db.prepare(`SELECT r.poi_id, r.rev, r.kind, r.doc, r.doc_sha, r.base_rev, r.author_name, r.at, r.submitted_at, d.live_rev, l.doc AS live_doc
    FROM poi_revs r JOIN poi_docs d ON d.id = r.poi_id LEFT JOIN poi_revs l ON l.poi_id = r.poi_id AND l.rev = d.live_rev
    WHERE r.state = 'submitted' ORDER BY r.submitted_at, r.poi_id, r.rev LIMIT ${POI_QUEUE_MAX + 1}`).all()).results ?? [];
  return {
    queue: rows.slice(0, POI_QUEUE_MAX).map((r) => ({
      id: r.poi_id, rev: r.rev, kind: r.kind, doc: parsed(r.doc), docSha: r.doc_sha ?? null, base: r.base_rev, author: r.author_name, at: r.at, submittedAt: r.submitted_at,
      liveRev: r.live_rev, liveDoc: parsed(r.live_doc),
      // made from a revision that is no longer the live one: approving it puts back over whatever went live since.
      // AUDIT POI S12: whatever the live one is now - none included (a change to a POI retired since would stand it
      // again, unwarned) - and a retirement too (it takes out a revision its asker never saw)
      stale: (r.base_rev ?? null) !== (r.live_rev ?? null),
    })),
    more: rows.length > POI_QUEUE_MAX,
  };
}

// ─── THE FEED THE GAME READS ────────────────────────────────────────

/** The isolate's kept feed - `{ v, body, live, checkedMs }` - so a game's minute-by-minute ask costs no read most times. */
let kept = null;
/** How long a kept feed answers before its version is asked again. */
export const POI_FEED_KEEP_MS = 15_000;
/** Forget the kept feed (an approval in this isolate; a test's fresh service). */
export function forgetPoiFeed() { kept = null; }

/**
 * THE LIVE FEED: every POI's live document - `{ v, pois: [{ id, rev, doc }] }` - and the set of assets they name. Kept
 * in the isolate; past POI_FEED_KEEP_MS the version row is asked (one small read), and the documents read again only when
 * it moved. `nowMs` the clock. AUDIT POI S11: `atLeast` the version the asking game already holds - newer than the kept
 * one (an approval made in another isolate, its feed fetched there), the version is asked now, inside the keep: else a
 * game holding v2 was answered this isolate's v1 (the tags differ, so a 200) and stood the older POIs again.
 * @param {any} db @param {number} nowMs @param {number} [atLeast]
 */
export async function poiLiveFeed(db, nowMs, atLeast = 0) {
  if (kept && kept.v >= atLeast && nowMs - kept.checkedMs < POI_FEED_KEEP_MS) return kept;
  const feed = await db.prepare("SELECT v FROM poi_feed WHERE k = 'feed'").first();
  const v = Number(feed?.v ?? 0);
  if (kept && kept.v === v) { kept.checkedMs = nowMs; return kept; }
  const rows = (await db.prepare(`SELECT d.id, d.live_rev AS rev, r.doc FROM poi_docs d JOIN poi_revs r ON r.poi_id = d.id AND r.rev = d.live_rev
    WHERE d.live_rev IS NOT NULL AND r.kind = 'doc' AND r.state = 'approved' ORDER BY d.id`).all()).results ?? [];
  const pois = [];
  const live = new Set();
  for (const r of rows) {
    const doc = parsed(r.doc);
    if (!doc) continue;
    pois.push({ id: r.id, rev: r.rev, doc });
    const { meshes, textures } = poiAssetsOf(doc);
    for (const s of [...meshes, ...textures]) live.add(s);
  }
  kept = { v, body: JSON.stringify({ v, pois }), live, checkedMs: nowMs };
  return kept;
}

/** The feed's ETag for a version. */
export const poiFeedTag = (/** @type {number} */ v) => `"poi-${v}"`;
/** AUDIT POI S11: the newest feed version an If-None-Match names - its tags strong or weak (`W/"poi-3"`: a proxy that
 *  compresses the body may weaken the tag it passes on), a list of them read whole - or -1 for none. @param {string | null} header */
export function poiHeldVersion(header) {
  let held = -1;
  for (const m of String(header ?? '').matchAll(/(?:^|,)\s*(?:W\/)?"poi-(\d{1,15})"\s*(?=,|$)/g)) held = Math.max(held, Number(m[1]));
  return held;
}
