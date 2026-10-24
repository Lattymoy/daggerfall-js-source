// @ts-check
// AUDIT SOUNDSCAPE S7 + H2 + H6 (2026-10-24): THE PORT'S CLIPS, LOADED - one loader for the soundscape's (soundscapeSfx.js)
// and the horse's (systems/horse/horseVoice.js), where each had its own and each was wrong a different way: the
// soundscape's asked once and a first load that failed left every slap, creak and gull silent for the session; the
// horse's asked again every 2 s for as long as the game ran - 450 requests a minute for a file the server refused - from
// every rider's frame, a new promise each frame.
//
// A file's bytes, once fetched, are kept until the bus takes them (`registerSound`), so a pass that could not register
// asks again without fetching again; a file the server refuses (4xx) is never asked for again; a pass that left any
// unloaded is followed by another after CLIP_RETRY_MS[n], and after the last of them the loader gives up. `install` may be
// asked every frame: with nothing to do it answers at once and makes nothing.

/** The gaps after a pass that left a clip unloaded, then none (ms). */
export const CLIP_RETRY_MS = Object.freeze([2000, 8000, 30000, 120000]);

/**
 * A loader for `files` ({ key: file }): `install(audio)` - starts a pass when one is due and answers the pass in flight
 * or the last one settled (a promise of how many stand); `has(key)`; `count`. `urlOf(file)` the file's URL (the default
 * fetch's); `fetchBytes(file)` replaces the fetch (the tests'); `now()` the clock.
 * @param {Record<string, string>} files
 * @param {{ urlOf?: (file: string) => string, fetchBytes?: ((file: string) => Promise<Uint8Array>) | null, now?: () => number, retryMs?: readonly number[] }} [opts]
 */
export function createClipInstaller(files, { urlOf = (f) => f, fetchBytes = null, now = () => Date.now(), retryMs = CLIP_RETRY_MS } = {}) {
  const keys = Object.keys(files);
  const ready = new Set(), refused = new Set();
  /** @type {Map<string, Uint8Array>} */
  const bytes = new Map();
  /** @type {Promise<number> | null} */
  let running = null;
  let settled = Promise.resolve(0), nextAt = 0, tries = 0, gaveUp = false;
  const load = fetchBytes ?? (async (/** @type {string} */ file) => {
    const r = await fetch(urlOf(file));
    if (!r.ok) throw Object.assign(new Error(`${file}: ${r.status}`), { status: r.status });
    return new Uint8Array(await r.arrayBuffer());
  });
  const finished = () => ready.size + refused.size >= keys.length;
  /** @param {any} audio */
  async function pass(audio) {
    for (const key of keys) {
      if (ready.has(key) || refused.has(key)) continue;
      try {
        if (!bytes.has(key)) bytes.set(key, await load(files[key]));
        if (await audio.registerSound(key, bytes.get(key))) { ready.add(key); bytes.delete(key); }
      } catch (err) {
        const status = Number(/** @type {any} */ (err)?.status);
        if (status >= 400 && status < 500) refused.add(key);   // the server said no: a later pass would hear no again
      }
    }
    if (!finished()) {
      if (tries < retryMs.length) nextAt = now() + retryMs[tries++];
      else gaveUp = true;
    }
    return ready.size;
  }
  return {
    get count() { return ready.size; },
    has: (/** @type {string} */ key) => ready.has(key),
    /** @param {any} audio @returns {Promise<number>} */
    install(audio) {
      if (running) return running;
      if (gaveUp || finished() || !audio?.registerSound || now() < nextAt) return settled;
      running = pass(audio).then((n) => { running = null; settled = Promise.resolve(n); return n; });
      return running;
    },
    /** Test seam. */
    _reset() { ready.clear(); refused.clear(); bytes.clear(); running = null; settled = Promise.resolve(0); nextAt = 0; tries = 0; gaveUp = false; },
  };
}
