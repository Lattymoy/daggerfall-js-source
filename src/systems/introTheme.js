// ═══════════════════════════════════════════════════════════════════
// THE INTRO THEME — the one piece of music this port ships.
//
// Every other note the game plays is synthesised from the player's own
// MIDI.BSA (systems/songPlayer.js, the A5 arc), because DFU's own
// soundfont is DFU's and classic's songs are classic's. This is the
// exception and it is the ONLY one: an original recording of the main
// theme, ours, which is why it can ship and why it can play before the
// ARENA2 folder pick has happened. Ledger A.
//
// ── IT IS THE CLOCK ──────────────────────────────────────────────
//
// ui/introCue.js drives every visual off this element's currentTime.
// That is not a convenience, it is the sync: a wall-clock animation
// started beside a .play() drifts the instant either one stalls, and on
// a cold load the streaming audio is exactly the thing that stalls. If
// the song hitches the picture waits with it, which is right, instead
// of sliding permanently out of step, which is what "timed to the
// music" usually means in practice.
//
// ── IT OUTLIVES THE INTRO ────────────────────────────────────────
//
// The element is owned by THIS module, not by the intro's DOM host, so
// when the intro unmounts the music keeps playing and the menu inherits
// it mid-phrase. An element parented to the intro would stop the moment
// the intro was removed and the "fade into the menu" would be a fade
// into silence - which is the opposite of the brief.
//
// ── MusicVolume IS READ, NOT COPIED ──────────────────────────────
//
// The volume comes from systems/settings.js through songPlayer's own
// musicGain(), and onSettingChange keeps it live - so the slider in the
// enhanced menu moves this track while it is playing, the same way it
// moves everything else. A second volume path here would be a second
// thing to remember, which is the fault ensureAudio's header already
// records having made three times.
//
// ── NEVER TRAPS, AND SAYS SO ─────────────────────────────────────
//
// A browser will not start audio before a user gesture, and the
// enhanced door is the FIRST thing on screen, so on a cold load there
// has been no gesture and play() rejects. That is not an error and it
// is not worked around: `start` resolves with { playing: false } and
// the intro runs on the wall clock, silent, exactly as U22's splash
// does. A missing or blocked asset costs you the music, never the game.
// ═══════════════════════════════════════════════════════════════════

import { musicGain } from './songPlayer.js';
import { onSettingChange } from './settings.js';

/** Where the track lives - AS A MODULE-RELATIVE URL, because the game
 *  page does not live at the site root and a page-relative string was
 *  the whole intro's undoing: the app ships at /play/, public/ ships
 *  beside it at the root, so 'intro/theme.mp3' resolved to
 *  /play/intro/theme.mp3 and 404'd - in dev AND in the deployed build.
 *  The probe that would have caught it was the one U65 flagged as
 *  never run: every splash, the logo and the music were silently
 *  absent from the shipped intro, and the opacity-only checks stayed
 *  green because a broken <img> holds its style perfectly well.
 *
 *  new URL(..., import.meta.url) is the one spelling that is correct
 *  everywhere: dev serves the source tree so the file is beside this
 *  module; the build statically rewrites the pattern to the emitted
 *  asset, hashed, at whatever base and page depth the site uses. */
export const THEME_URL = new URL('../assets/intro/theme.mp3', import.meta.url).href;

/** How long to wait for the track before starting anyway. The intro is
 *  not worth a black screen on a slow connection, and 2.5 s is about
 *  the point at which a player starts wondering whether it is broken. */
export const READY_TIMEOUT_MS = 2500;

let _el = null;                       // the one element, module-owned
let _unsubscribe = null;

/** The element, or null if none has been made. Exported for the host
 *  and for tests; nothing else should reach for it. */
export function themeElement() { return _el; }

/**
 * Create the audio element and try to start it.
 *
 * Resolves { playing, element } - `playing` false means the browser
 * refused, or there is no audio at all, and the caller should run on a
 * wall clock. NEVER REJECTS.
 *
 * `make` is injected so the tests can drive this without a DOM; the
 * default builds a real <audio>.
 */
export async function startTheme({ url = THEME_URL, make, timeoutMs = READY_TIMEOUT_MS, startAt = 0 } = {}) {
  try {
    if (_el) return { playing: !_el.paused, element: _el };
    const el = make ? make(url) : makeAudio(url);
    if (!el) return { playing: false, element: null };
    _el = el;
    el.volume = clamp01(musicGain());
    // The slider moves this track while it plays - one store, one law.
    _unsubscribe = onSettingChange((section, key) => {
      if (section === 'Controls' && key === 'MusicVolume' && _el) _el.volume = clamp01(musicGain());
    });

    // Wait for enough buffer OR the timeout, whichever comes first.
    await Promise.race([canPlay(el), delay(timeoutMs)]);
    // THE COLD OPEN. The intro starts mid-song (introCue.START_TIME),
    // and the SEEK is this module's job because the element is: the cue
    // sheet reads currentTime as absolute track time, so the sheet's
    // bars stay bars of the recording and every cue still sits on its
    // measured onset. Seeking after the ready race means the metadata
    // is normally in; if the browser is not ready even then, the
    // assignment lands when it can (currentTime sets are queued against
    // metadata by every engine this port supports), and the worst case
    // is the same silent wall-clock intro a blocked autoplay gets.
    if (startAt > 0) {
      try { el.currentTime = startAt; } catch { /* pre-metadata; the queued set stands */ }
    }
    try {
      await el.play();
      return { playing: true, element: el };
    } catch {
      // Blocked before a gesture. Expected on a cold load; not an error.
      return { playing: false, element: el };
    }
  } catch {
    return { playing: false, element: null };
  }
}

/**
 * The song's own time, in seconds - the clock ui/introCue.js reads.
 * Returns null when there is no playing element, which is the caller's
 * signal to fall back to its wall clock.
 */
export function themeTime() {
  if (!_el || _el.paused) return null;
  const t = _el.currentTime;
  return Number.isFinite(t) ? t : null;
}

/** Stop and release. The menu keeps the track by NOT calling this;
 *  it exists for the skip path and for tests. */
export function stopTheme() {
  try { _el?.pause(); } catch { /* a detached element can throw; harmless */ }
  _unsubscribe?.();
  _unsubscribe = null;
  _el = null;
}

// ── plumbing ───────────────────────────────────────────────────────

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function makeAudio(url) {
  // Off globalThis, not the bare global: this module is imported by
  // node tests where `Audio` is not declared at all, and a bare
  // reference is a ReferenceError rather than the `undefined` the
  // never-traps path needs (and eslint's no-undef says so first).
  const Ctor = globalThis.Audio;
  if (typeof Ctor !== 'function') return null;
  const el = new Ctor(url);
  el.preload = 'auto';
  el.loop = true;               // the menu sits under it for as long as it sits
  return el;
}

/** Resolves when the element says it can play through, or errors out.
 *  An error resolves rather than rejects - the caller's next move is
 *  the same either way. */
function canPlay(el) {
  return new Promise((resolve) => {
    if (el.readyState >= 3) return resolve();
    const done = () => {
      el.removeEventListener('canplay', done);
      el.removeEventListener('error', done);
      resolve();
    };
    el.addEventListener('canplay', done);
    el.addEventListener('error', done);
  });
}

/** Test seam: forget the module-level element without touching the DOM. */
export function _resetForTests() { _el = null; _unsubscribe = null; }
