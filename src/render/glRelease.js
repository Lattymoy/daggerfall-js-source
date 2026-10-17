// @ts-check
// GL-LEAK (FIELD BUGS 2026-10-03, Swololo: "After long plays there are consistent GPU memory leaks that do not lower
// down even after closing the tab ... Closing the browser down completely clears the GPU memory ... Might be related to
// some GL instances not being cleared through webgl"): THE PAGE'S CONTEXTS LET GO AS IT GOES.
//
// A WebGL context is freed when its canvas is collected - at the collector's leisure, which no GPU memory pressure asks
// for, and on Firefox the context's side lives in the separate GPU process. WEBGL_lose_context frees it NOW. Each owner
// of a context (the game's renderer, the held map's ink, the gate's veil, the intro's landscape) seats its letting-go
// here, and main.js's pagehide runs them all. A LEAF, no imports: the entry imports it, and its static reach stays
// what BOOT1 made it (test/render/boot2.test.js); an owner deep in the game seats itself here without the entry reaching it.

/** WEBGL_lose_context's door, the one home: a context let go now. Never throws (a context already lost answers no
 *  extension, and one lost twice is lost). */
export function loseGlContext(gl) {
  try { gl?.getExtension?.('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
}

const releasers = new Set();

/** Seat a letting-go for the page's going; the answer unseats it (an owner disposed before the page goes). */
export function onPageGone(fn) {
  releasers.add(fn);
  return () => releasers.delete(fn);
}

/** The page is going (pagehide, not kept for back-forward): every seated letting-go, once. One that throws does not
 *  keep the rest from theirs. */
export function releaseGlContexts() {
  const all = [...releasers];
  releasers.clear();
  for (const fn of all) { try { fn(); } catch { /* the page is going either way */ } }
}
