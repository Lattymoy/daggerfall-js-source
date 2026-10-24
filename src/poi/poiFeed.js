// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-2 (2026-10-14) - THE APPROVED POIS, AS THE GAME KNOWS THEM.
//
// The account service's open feed (server-account/src/poi.js poiLiveFeed: every POI's approved, live revision) and the
// assets it names (GET /v1/poi/asset/<sha>, cached a day - AUDIT POI S4) - read by every game, signed in or not, online or offline
// (bible/06-Systems/POI-Editor-Arc.md). Mac: "I need to be able to approve changes": what is here is what an approver
// let into the world, and nothing else.
//
//   - THE FEED: asked at start and every POI_FEED_POLL_MS after with the version it holds (If-None-Match: 304, nothing
//     read), so an approval reaches a playing game within a minute with no deploy and no reload. Every document is held
//     to the law again here (poiLaw.js poiDocProblems): a document the law refuses is not stood, whatever the wire says.
//     The last feed read is KEPT (`cache`) and read back at the next start, so a game without the network stands the
//     POIs it last saw.
//   - THE ASSETS: by their sha256, from memory, then the kept copy, then the network - and a fetched one is HASHED and
//     refused unless it is the bytes its name says (the content address is the integrity check: a proxy, a cache or a
//     server that hands back anything else hands back nothing). Each asked once at a time.
//   - THE EDITOR'S DRAFTS (`setOverlay`): the POI editor stands a builder's open drafts over the live set on that
//     builder's screen alone - an overlay by POI id, never sent anywhere (POI-3).
//   - ONE SERVICE'S FEED AT A TIME (AUDIT POI R15): the version, the tag and the kept copy are the service's they came
//     from (`base()`, which a stored override can move) - another service is asked afresh, and a kept copy is read back
//     under its own service alone.
//   - NEVER BACKWARDS (S11, the client's half): an answer older than one this game has already taken from the service
//     is a stale isolate's (server-account/src/poi.js keeps a feed fifteen seconds) and is not taken - it would take a
//     fresh approval back down. A kept copy sets no such floor: the service's answer beats last session's copy.
// ═══════════════════════════════════════════════════════════════════

import { poiDocProblems, poiPixelId, POI_SHA_RE } from './poiLaw.js';

/** How often a playing game asks whether the approved set moved. */
export const POI_FEED_POLL_MS = 60_000;
/** After a failed ask, the wait before the next - doubled each time to POI_FEED_POLL_MS. */
export const POI_FEED_RETRY_MS = 5_000;
/** The kept copy's keys (`cache`). */
export const POI_FEED_CACHE_KEY = 'poi:feed';
export const poiAssetCacheKey = (/** @type {string} */ sha) => `poi:a:${sha}`;
/** Assets held in memory at once (bytes) before the oldest asked is let go - the GPU keeps what is drawn. */
export const POI_ASSET_MEMORY_BYTES = 64 * 1024 * 1024;

const hex = (/** @type {ArrayBuffer} */ buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
/** A pixel no POI stands on: one shared answer, never a fresh array a pixel a frame (AUDIT POI R12). */
const NONE = Object.freeze([]);

/**
 * @param {{
 *   base: () => string | null,
 *   fetch?: (url: string, init?: any) => Promise<any>,
 *   cache?: { get: (key: string) => Promise<Uint8Array | null>, put: (key: string, bytes: Uint8Array) => Promise<void> } | null,
 *   subtle?: any, now?: () => number, log?: any,
 * }} deps `base` the account service's address (net/accountClient.js serviceBase), null where there is none
 */
export function createPoiFeed({ base, fetch = (u, i) => globalThis.fetch(u, i), cache = null, subtle = globalThis.crypto?.subtle, now = () => Date.now(), log = console }) {
  /** @type {Map<string, { id: string, rev: number, doc: any, draft?: boolean }>} */
  let live = new Map();
  /** @type {Map<string, any>} */
  let overlay = new Map();
  let version = -1, etag = null;
  /** AUDIT POI R15: the service the version and tag held are from; S11: the newest version it has answered this game */
  let heldBase = null, floor = -1;
  let nextAsk = 0, wait = POI_FEED_RETRY_MS, asking = null, gen = 0;
  /** AUDIT POI R13: a refresh asked while an ask was out - asked again the moment it answers */
  let again = false;
  /** @type {Map<number, any[]>} */
  let byPixel = new Map();
  const listeners = new Set();
  const memory = new Map();   // sha -> bytes, in the order asked (the oldest first let go)
  let memoryBytes = 0;
  const loading = new Map();  // sha -> Promise<Uint8Array>

  /** The standing set, live and overlaid, indexed by pixel; listeners told. */
  function reindex() {
    const all = new Map(live);
    for (const [id, e] of overlay) {
      if (e === null) all.delete(id);   // a draft retirement: gone from this builder's screen
      else all.set(id, e);
    }
    byPixel = new Map();
    for (const e of all.values()) {
      const k = poiPixelId(e.doc);
      if (!byPixel.has(k)) byPixel.set(k, []);
      byPixel.get(k).push(e);
    }
    gen++;
    for (const fn of listeners) { try { fn(); } catch (e) { if (log) console.warn('[poi] a listener threw', e); } }
  }
  /** Take a feed's body: every document the law takes, by id. Answers whether anything was taken. */
  function take(body, tag) {
    if (!body || !Number.isInteger(body.v) || !Array.isArray(body.pois)) return false;
    const next = new Map();
    for (const p of body.pois) {
      if (!p || typeof p.id !== 'string' || !Number.isInteger(p.rev)) continue;
      const problems = poiDocProblems(p.doc);
      if (problems.length || p.doc.id !== p.id) { if (log) console.warn(`[poi] ${p.id} r${p.rev} is not stood - the law refuses it`, problems.slice(0, 3)); continue; }
      next.set(p.id, { id: p.id, rev: p.rev, doc: p.doc });
    }
    live = next;
    version = body.v;
    etag = tag ?? `"poi-${body.v}"`;
    reindex();
    return true;
  }

  /** Read the kept feed (a start before the network answers, or without one). */
  async function readKept() {
    if (!cache) return false;
    try {
      const bytes = await cache.get(POI_FEED_CACHE_KEY);
      if (!bytes || version >= 0) return false;
      const kept = JSON.parse(new TextDecoder().decode(bytes));
      // AUDIT POI R15: the copy names the service it was read from - another's (a stored override moved, or a copy kept
      // before it said) is not this one's set, and its tag must never be sent here
      const b = base();
      if (!b || kept.base !== b) return false;
      heldBase = b;
      return take(kept.body, kept.etag);
    } catch (e) { if (log) console.warn('[poi] the kept feed would not read', e?.message ?? e); return false; }
  }

  /** Ask the service once - 304 for the version held, else the feed taken and kept. */
  async function ask() {
    const b = base();
    if (!b) return false;
    // AUDIT POI R15: another service than the one the version and tag came from - its own feed asked whole
    if (b !== heldBase) { heldBase = b; etag = null; version = -1; floor = -1; }
    const res = await fetch(`${b}/v1/poi/live`, { headers: etag ? { 'if-none-match': etag } : {} });
    if (res.status === 304) return false;
    if (!res.ok) throw new Error(`poi feed ${res.status}`);
    const text = await res.text();
    const body = JSON.parse(text);
    // S11 (AUDIT POI, the client's half): older than an answer already taken - a stale isolate's; what is held stands
    if (Number.isInteger(body?.v) && body.v < floor) { if (log) console.warn(`[poi] the feed answered v${body.v} under v${floor} - a stale answer, not taken`); return false; }
    const tag = res.headers?.get?.('etag') ?? null;
    const changed = body.v !== version;
    if (!take(body, tag)) throw new Error('poi feed: not a feed');
    floor = body.v;
    if (cache) cache.put(POI_FEED_CACHE_KEY, new TextEncoder().encode(JSON.stringify({ base: b, etag: tag, body }))).catch(() => {});
    return changed;
  }

  /** Once a frame (cheap): asks the service when its time has come, never twice at once; a failure backs off. Answers
   *  the ask's promise when one was made (a test awaits it), else null. @param {number} [t] */
  function tick(t = now()) {
    if (asking || t < nextAsk) return null;
    again = false;
    asking = ask().then(() => { wait = POI_FEED_RETRY_MS; nextAsk = again ? 0 : now() + POI_FEED_POLL_MS; }, (e) => {
      if (log) console.warn('[poi] the feed would not answer', e?.message ?? e);
      nextAsk = again ? 0 : now() + wait;
      wait = Math.min(wait * 2, POI_FEED_POLL_MS);
    }).finally(() => { asking = null; });
    return asking;
  }

  function remember(sha, bytes) {
    if (memory.has(sha)) return;
    memory.set(sha, bytes);
    memoryBytes += bytes.byteLength;
    for (const [k, v] of memory) {
      if (memoryBytes <= POI_ASSET_MEMORY_BYTES) break;
      memory.delete(k);
      memoryBytes -= v.byteLength;
    }
  }

  return {
    /** Start: the kept feed first (if any), then the service. */
    async start() { await readKept(); nextAsk = 0; },
    tick,
    /**
     * Ask now, whatever the clock (the editor after a verdict or a put-back). AUDIT POI R13 (CONTRACTS C7): with an ask
     * already out - which may have left before the approval landed - asked AGAIN the moment it answers, never dropped
     * (bible/Home.md ASYNC NEVER DROPS: the out ask used to set the next a minute off). Answers the ask that will carry it.
     */
    refresh() {
      if (!asking) { nextAsk = 0; return tick(); }
      again = true;
      return asking.then(() => asking ?? tick());
    },
    /** The POIs standing on a map pixel - live, with this screen's drafts over them. */
    atPixel(/** @type {number} */ px, /** @type {number} */ py) { return byPixel.get(py * 1000 + px) ?? NONE; },
    /** Every standing POI. */
    all() { return [...byPixel.values()].flat(); },
    /** The live set alone, by id. */
    liveOf(/** @type {string} */ id) { return live.get(id) ?? null; },
    /** The feed's version, and a counter that moves whenever the standing set does (a host's cheap "anything new?"). */
    version: () => version,
    generation: () => gen,
    /** Hear every change of the standing set. Answers the unsubscribe. */
    onChange(/** @type {() => void} */ fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** POI-3: a builder's drafts over the live set, on this screen alone - `{ id: { doc } | null }` (null: hidden). */
    setOverlay(/** @type {Map<string, any>} */ drafts) {
      overlay = new Map();
      for (const [id, d] of drafts) overlay.set(id, d === null ? null : { id, rev: d.rev ?? 0, doc: d.doc, draft: true });
      reindex();
    },
    /**
     * An asset's bytes by its sha256 - memory, the kept copy, then the network; checked against its name wherever it
     * came from. `auth` a builder's bearer for a draft's asset (POI-3), else none.
     * @param {string} sha @param {{ auth?: string | null }} [opts]
     */
    asset(sha, { auth = null } = {}) {
      if (!POI_SHA_RE.test(sha)) return Promise.reject(new Error('poi asset: not a sha256'));
      if (memory.has(sha)) return Promise.resolve(memory.get(sha));
      if (loading.has(sha)) return loading.get(sha);
      const p = (async () => {
        const check = async (bytes) => bytes && hex(await subtle.digest('SHA-256', bytes)) === sha;
        if (cache) {
          try { const kept = await cache.get(poiAssetCacheKey(sha)); if (kept && (await check(kept))) { remember(sha, kept); return kept; } } catch { /* a kept copy that will not read is fetched again */ }
        }
        const b = base();
        if (!b) throw new Error('poi asset: no service');
        const res = await fetch(`${b}/v1/poi/asset/${sha}`, { headers: auth ? { authorization: `Bearer ${auth}` } : {} });
        if (!res.ok) throw new Error(`poi asset ${sha.slice(0, 12)}: ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!(await check(bytes))) throw new Error(`poi asset ${sha.slice(0, 12)}: the bytes are not the ones it names`);
        remember(sha, bytes);
        if (cache) cache.put(poiAssetCacheKey(sha), bytes).catch(() => {});
        return bytes;
      })().finally(() => loading.delete(sha));
      loading.set(sha, p);
      return p;
    },
  };
}

/** The kept copy over the browser's Cache API (one cache, `dagger-poi`) - or null where there is none (Node, a page with
 *  storage refused). Bytes in, bytes out. */
export function browserPoiCache(caches = globalThis.caches) {
  if (!caches?.open) return null;
  const url = (key) => `https://poi.invalid/${encodeURIComponent(key)}`;
  let opened = null;
  const box = () => (opened ??= caches.open('dagger-poi'));
  return {
    async get(key) { const r = await (await box()).match(url(key)); return r ? new Uint8Array(await r.arrayBuffer()) : null; },
    async put(key, bytes) { await (await box()).put(url(key), new Response(bytes)); },
  };
}
