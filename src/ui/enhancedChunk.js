// MENU1 (2026-09-15, Mac relaying a player): "sometimes you're unable
// to open the enhanced menus. For example a player might open the
// radial and select the spellbook, but it will fail to open."
//
// THE ROOT CAUSE IS THE DEPLOY, AND THE BUG IS THE SILENCE.
//
// Every enhanced menu is a LAZY CHUNK - `enhancedSpellbook`,
// `enhancedMenu`, `enhancedInventory`, `enhancedChronicle`,
// `enhancedTalk`, `enhancedBook` each build to their own
// content-hashed file, reached by a dynamic `import()` the first time
// a player opens that door. The deploy DELETES the files it replaces:
// measured against the live site, the previous build's
// `assets/main-EDqp0hIk.js` answers 404 within the hour, while a chunk
// whose CONTENT did not change keeps its hash and survives.
//
// So a tab that was open across a deploy is running the old entry
// bundle and asking for old chunk URLs - and the ones that 404 are
// exactly the menus that deploy touched. Everything already in memory
// keeps working (the dial is in the main bundle, so the rose still
// opens); the door behind it does not. That is the whole "random": it
// depends on whether a deploy landed since the tab opened, and on
// which chunks that deploy changed.
//
// What made it unreportable rather than merely annoying is what the
// doors did next. Six of the seven caught the rejection, wrote
// `console.warn` and called `close()`; `charSheetDoor.js` had no catch
// at all and left an unhandled rejection. Either way the player got
// NOTHING - no box, no line, no sound - from a failure they did not
// cause and cannot diagnose, in a game where every other refusal
// speaks ("(the spellbook art is unavailable)"). A door that declines
// in silence is indistinguishable from an input that was not received,
// which is precisely how this was reported: "it will fail to open".
//
// THE ONE HOME, so the seven cannot drift again:
//   - RETRY ONCE. A transient fetch failure is the common case and
//     costs one round trip to rule out.
//   - THEN SPEAK, in the overlay's own host div - no chunk, no font,
//     no stylesheet, nothing that could be the thing that failed.
//   - AND STAY. The door does NOT close: its `done` stays false, so
//     the host keeps the overlay slot and the game stays paused behind
//     a message, rather than silently handing the keys back to a
//     player who thinks they pressed the wrong button.
//   - THE RELOAD IS OFFERED, not taken. A stale chunk is fixed by
//     reloading and by nothing else, and the player is the one who
//     decides when to spend their unsaved progress on it.

/** Is this rejection a module that could not be fetched (a deploy took
 *  it), rather than one that threw while evaluating? The two want
 *  different words: the first is fixed by a reload, the second is a
 *  bug and a reload will reproduce it. Chromium, Firefox and WebKit
 *  all phrase the fetch failure differently, so the test is the shape
 *  they agree on rather than any one message. */
export function isChunkLoadError(err) {
  const m = String(err?.message ?? err ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|dynamically imported module/i.test(m);
}

export const RELOAD_TEXT = 'The game was updated while this tab was open, so this screen could not be loaded. Reloading will fix it.';
export const BROKEN_TEXT = 'This screen could not be loaded.';

/** The notice, painted into the door's own host element with inline
 *  style only - the error path must not depend on anything that could
 *  be the thing that broke. */
export function paintChunkNotice(host, { err, onDismiss, reload = () => globalThis.location?.reload() } = {}) {
  if (!host?.ownerDocument) return null;
  const doc = host.ownerDocument;
  const el = (tag, css, text) => {
    const n = doc.createElement(tag);
    n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };
  const scrim = el('div', 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;'
    + 'background:rgba(8,9,11,.72);z-index:30;font:14px/1.5 system-ui,sans-serif;color:#e9e4d9;padding:16px');
  const card = el('div', 'max-width:420px;width:100%;background:#14161a;border:1px solid #2b323b;border-radius:8px;padding:18px');
  card.append(el('p', 'margin:0 0 14px', isChunkLoadError(err) ? RELOAD_TEXT : BROKEN_TEXT));
  const row = el('div', 'display:flex;gap:8px;justify-content:flex-end');
  const dismiss = el('button', 'background:#2b323b;color:#e9e4d9;border:0;border-radius:4px;padding:8px 14px;font:inherit;cursor:pointer', 'Close');
  dismiss.type = 'button';
  dismiss.addEventListener('click', () => onDismiss?.());
  row.append(dismiss);
  if (isChunkLoadError(err)) {
    const again = el('button', 'background:#c08a3e;color:#0e1013;border:0;border-radius:4px;padding:8px 14px;font:inherit;cursor:pointer', 'Reload');
    again.type = 'button';
    again.addEventListener('click', () => reload());
    row.append(again);
  }
  card.append(row);
  scrim.append(card);
  host.append(scrim);
  return scrim;
}

/**
 * Load an enhanced menu's chunk and mount it. The ONE door every
 * `ui/*Door.js` goes through.
 *
 * @param {object} o
 * @param {() => Promise<any>} o.load   the dynamic import, as a thunk (so it can be retried)
 * @param {(mod: any) => void} o.mount  hand the module to the door's own mounter
 * @param {() => boolean} o.alive       false once the door has been torn down while we were loading
 * @param {HTMLElement} o.host          the door's own host element - where the notice goes
 * @param {() => void} o.onDismiss      the door's close, run when the player dismisses the notice
 * @param {string} o.label              for the console line
 */
export async function mountEnhancedChunk({ load, mount, alive = () => true, host, onDismiss, label = 'menu', retries = 1, wait = (ms) => new Promise((r) => setTimeout(r, ms)), retryMs = 400, notice = paintChunkNotice }) {
  let err = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (!alive()) return false;
    try {
      const mod = await load();
      if (!alive()) return false;
      mount(mod);
      return true;
    } catch (e) {
      err = e;
      if (attempt < retries) await wait(retryMs);
    }
  }
  if (!alive()) return false;
  console.warn(`[${label}] the enhanced screen could not mount:`, err?.message ?? err);
  // The door STAYS OPEN behind the notice: `done` is still false, the
  // host keeps the slot, and the player is told rather than handed the
  // keys back with nothing to show for the press.
  //
  // U51's LAW IS THE FLOOR AND IT STILL HOLDS: "a failed load must
  // take its empty div with it, or the host holds an overlay that
  // never reports done - a frozen game." A notice that PAINTED is the
  // way out, so the door may stay; a notice that could not paint
  // (no host, no document, a detached node) is no way out at all, and
  // then the old answer is the only safe one. The fallback is not a
  // nicety: without it this fix would trade a silent refusal for a
  // wedged game, which is the worse of the two.
  if (!notice(host, { err, onDismiss })) onDismiss?.();
  return false;
}
