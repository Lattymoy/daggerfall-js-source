// ═══════════════════════════════════════════════════════════════════
// THE BUILD MOVED WHILE THE PAGE WAS OPEN.
//
// A player reported `boot failed: Failed to fetch dynamically imported
// module` on the deployed site. The build was not broken - a fresh one
// loads every chunk - and this is what actually happens:
//
//   1. The game's page (play/index.html, served at /play/ - U60)
//      hard-references SEVENTEEN hashed chunk URLs (the entry script
//      plus its modulepreload list).
//   2. Every deploy renames chunks. Changing NOTHING but the build sha
//      renames eight of them, `main` and the four enhanced screens
//      among them, because scripts/buildTag.mjs stamps the sha into a
//      module `main` imports and the change cascades.
//   3. GitHub Pages replaces the whole artifact. The old hashed files
//      are DELETED, not kept beside the new ones.
//   4. `main` is redeployed several times a day.
//
// So a returning player whose browser still holds that page from an
// earlier deploy starts the page from cache and then asks for a chunk
// that no longer exists. The LAZY chunks are the exposed ones, because
// they are the chunks a first visit never fetched - and four of the
// eight that churn are exactly the screens you reach by clicking.
//
// ── WHY A RELOAD IS THE WHOLE FIX ────────────────────────────────
//
// Nothing is wrong with the deployed site. The page is simply holding
// a map of a build that is gone, and a reload fetches the current one.
// That makes this recoverable rather than fatal - and it covers every
// cause of a missing chunk, not only the churn above: a purged CDN
// edge, a half-finished deploy, an extension that ate one request.
//
// ── AND WHY IT RELOADS EXACTLY ONCE ──────────────────────────────
//
// A reload that does not fix it must not reload again. If the chunk is
// missing for a reason a fresh index cannot mend, an automatic retry
// is an infinite loop pointed at the player - a blank page that keeps
// blinking, with no error to report and nothing they can do. So the
// second failure gets WORDS and a button instead, and the words say
// what happened rather than blaming their connection.
// ═══════════════════════════════════════════════════════════════════

/** What browsers say when a dynamic import's URL is not there. All
 *  four are the same event with different vendors' words, and a check
 *  that knew only Chrome's would leave Firefox and Safari players on
 *  the dead page. Vite's CSS preloader has its own phrasing. */
export const STALE_CHUNK_MESSAGES = Object.freeze([
  'Failed to fetch dynamically imported module',   // Chrome / Edge
  'error loading dynamically imported module',     // Firefox
  'Importing a module script failed',              // Safari
  'Unable to preload CSS',                         // Vite's preloader
]);

/** True when this error is a chunk that is not on the server. */
export function isStaleChunk(err) {
  const text = String(err?.message ?? err ?? '');
  return STALE_CHUNK_MESSAGES.some((m) => text.toLowerCase().includes(m.toLowerCase()));
}

/** The key the ONE reload is remembered under. sessionStorage rather
 *  than localStorage: the memory should last a tab, not a machine - a
 *  player who hits this on Tuesday must still get their free reload on
 *  Wednesday. */
export const RELOAD_KEY = 'dagger:stale-chunk-reload';

/** Said to the player when the reload did not help. It names what
 *  happened, because "failed to fetch dynamically imported module" is
 *  a sentence about JavaScript and this one is about them. */
export const STALE_CHUNK_TEXT =
  'This page was loaded from an older version of the game that has since been replaced. '
  + 'Reloading did not pick up the new one - try a hard refresh (Ctrl-Shift-R, or Cmd-Shift-R on a Mac).';

/**
 * What to do about a boot failure. Pure, so the ladder is pinnable
 * without a browser.
 *
 * @returns 'rethrow'  not a chunk problem - whatever handled boot
 *                     failures before still handles this one
 *          'reload'   fetch the current build and try again, once
 *          'explain'  the reload has already been spent; say so
 */
export function staleChunkAction(err, { reloaded = false } = {}) {
  if (!isStaleChunk(err)) return 'rethrow';
  return reloaded ? 'explain' : 'reload';
}
