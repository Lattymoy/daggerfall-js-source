// LOAD1 (2026-10-05, Mac: "add loading screens where needed for the game in an enhanced UI type fashion, maybe make it
// where people can also use screenshots for the loading screen and a way to access them in the menu"):
// THE LOADING SCREEN.
//
// The game's loads had no face. The boot from the menu into the world ran behind a bare canvas for seconds (the only
// word of it was the window's title, main.js `status`), and a dungeon's door, a fast travel, a save loaded in play
// all held the last frame or black until the next one stood. DFU has no loading screen either - its loads are the
// fade (ui/fadeLayer.js) - so this is the port's own, drawn only under the enhanced skin and only on the player's
// switch (the Features row `loading-screen`, systems/features.js). The classic skin never mounts it: Daggerfall's
// loads look the way they always did there.
//
// WHAT IT SHOWS. The place being loaded, large, over the skin's rule and gem; the step the load is on (the same words
// the window's title carries); a bar that runs while the load does - no percentage, because no load in the port
// knows its own length and a bar that lies is worse than one that only says "working"; and behind it all, ONE OF THE
// PLAYER'S OWN SCREENSHOTS (systems/shotGallery.js, the menu's Screenshots pane decides which are in the turn) with
// where and when it was taken, or - with none, or on the row's Night sky - the menu's own pixel ground (PX1).
//
// HOLDS, NOT A SWITCH. A load can start inside another (the boot loads a save; a travel lands in a dungeon), so a
// caller BEGINS a hold and ENDS it, and the screen stands while any hold is open. `end` is idempotent and safe from
// any door. A hold shorter than its `delay` never shows a screen at all (a building's door costs a frame, not a
// flash), and a screen once up stands MIN_SHOWN_MS, so a load that ends a moment after it appears does not blink.
//
// NEVER TRAPS. Every hold carries a ceiling (`maxMs`); a load that throws past its own `end` lets the screen go at
// that ceiling, with a console line naming the hold, rather than standing over a live game for ever. The crash
// banner (main.js, z-index 20) stands above this screen (19), so a crash under a load is still read.
//
// THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD (bible Home, Process): the node is taken out of `node` before it is
// faded or removed, so a hold begun while the last one fades builds a fresh screen rather than reviving a dying one.
//
// EVERY ALLOCATION HAS AN OWNER: the shot's object URL is let go in `teardown`, the one path that ends the screen's
// life. The ground is drawn ONCE per window size and kept (AUDIT LOAD1 1): the menu's 125 ms redraw costs 100 ms a
// draw at 1080p, and a loading screen that eats the main thread slows the very load it covers.
//
// ASIDE, NEVER OVER (AUDIT LOAD1 2): a window the player must act on - the chargen at a new game's boot, a pause, a
// level-up box - and a full-screen film own the screen while they stand; the loading screen hides under them, its
// holds untouched, and comes back only if the load is still going when they close.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { drawPixelGround } from './pixelGround.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { pageHas } from '../systems/pageQuery.js';
import { getPref } from '../systems/uiPrefs.js';
import { loadingShot, shotCaption, GALLERY_MAX } from '../systems/shotGallery.js';

export const LOADING_ID = 'enhanced-loading';
/** The Features row's key (systems/features.js `loading-screen`): 'shots', 'art' or 'off'. */
export const LOADING_PREF = 'loadingScreen';
export const LOADING_MODES = Object.freeze(['shots', 'art', 'off']);
/** Over the world, the base HUD and the death screen (18); under the crash banner (20). The HUD pieces that stand
 *  higher (the gate's banner and cards, the siege and arena HUDs, the revenant cards, the pad's prompts) are hidden
 *  while it shows (`body.ld-up`, LOADING_CSS); the windows above it are the windows it steps aside for. */
export const LOADING_Z = 19;
/** An in-game load shorter than this shows nothing. The boot passes 0: it is never this short. */
export const APPEAR_MS = 280;
/** Once up, the screen stands at least this long - a screen that blinks reads as a glitch, not a load. */
export const MIN_SHOWN_MS = 650;
export const LOADING_FADE_MS = 240;
/** A hold's ceiling unless it names its own - long past any real load on a slow phone, short of a player giving up. */
export const HOLD_MAX_MS = 180_000;

/** Lines for the corner when no screenshot stands there - each one a thing this game does, none naming a key (keys
 *  are the player's to rebind, and a tip naming the default would lie to anyone who did). */
export const LOADING_TIPS = Object.freeze([
  `Up to ${GALLERY_MAX} of the screenshots you take are kept under Screenshots in the menu, and can stand on this screen while the world loads.`,
  'Banks keep your gold, write letters of credit for the road and lend to those in good standing.',
  'Members of the Mages Guild can make spells of their own at the guild’s spellmaker.',
  'Ask anyone in town where a place is, and they may mark it on your map.',
]);

/** What the screen draws as, now: 'off' under the classic skin or the row's Off, else the row's choice. The probes'
 *  fixed vantage (?shot) and ?noloading draw none: a probe's frame is the world's, never a screen over it. */
export function loadingMode(search = globalThis.location?.search ?? '') {
  if (pageHas('shot', search) || pageHas('noloading', search)) return 'off';
  if (!isEnhanced(search)) return 'off';
  const v = getPref(LOADING_PREF);
  return LOADING_MODES.includes(v) ? v : 'shots';
}

/** The tip for a screen built at `now` - one a minute, so two loads in a row do not read the same line twice. */
export const tipAt = (now = Date.now()) => LOADING_TIPS[Math.floor(now / 60_000) % LOADING_TIPS.length];

const holds = new Set();
let node = null;          // the screen standing, or null
let shownAt = 0;          // when it became visible
let appearTimer = null;   // the delay before the first hold's screen shows
let leaveTimer = null;    // the MIN_SHOWN_MS wait before it fades
let place = '';
let line = '';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * Begin a hold: the screen stands (after `delay`) until every hold has ended.
 * `place` is the big line (the town, the dungeon, the character's last stand); `line` is the step.
 * @param {{ place?: string, line?: string, delay?: number, maxMs?: number, why?: string }} [opts]
 * @returns {{ end: () => void, line: (text: string) => void, place: (text: string) => void, readonly open: boolean }}
 */
export function beginLoading({ place: p = '', line: l = '', delay = APPEAR_MS, maxMs = HOLD_MAX_MS, why = 'a load' } = {}) {
  let open = true;
  let ceiling = null;
  const hold = {
    end() {
      if (!open) return;
      open = false;
      if (ceiling) { clearTimeout(ceiling); ceiling = null; }
      holds.delete(hold);
      if (!holds.size) settle();
    },
    line(text) { if (open) setLoadingLine(text); },
    place(text) { if (open) setLoadingPlace(text); },
    get open() { return open; },
  };
  if (typeof document === 'undefined' || loadingMode() === 'off') { open = false; return hold; }
  // the first hold of a load sets both words afresh; a hold inside it adds only what it names
  if (!holds.size) { place = String(p ?? ''); line = String(l ?? ''); }
  else { if (p) place = String(p); if (l) line = String(l); }
  holds.add(hold);
  if (Number.isFinite(maxMs) && maxMs > 0) {
    ceiling = setTimeout(() => { console.warn(`[loading] ${why} held the loading screen past ${maxMs} ms - letting it go`); hold.end(); }, maxMs);
  }
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }   // a screen about to leave stays for the new hold
  if (node) { node._keepHidden = false; paint(); paintAside(); }
  else if (!appearTimer) {
    if (delay > 0) appearTimer = setTimeout(() => { appearTimer = null; if (holds.size && !node) build(); }, delay);
    else build();
  }
  return hold;
}

// ── ASIDE ────────────────────────────────────────────────────────
// Two things own the screen over a load. A FILM (scenes/shared.js holdFrame - DFU's vid window pauses the game, and the
// hosts' frames that raise and end the screen wait it out) and a WINDOW (the world host's frame asks, every frame, and
// the boot's chargen says so itself - it is shown mid-boot, before any frame runs). Each is a reason; the screen is
// hidden while any stands, its holds untouched.
//
// BACK ONLY IF STILL LOADING (AUDIT LOAD1 6): when the last reason goes while the frame's hold is open, the screen stays
// hidden until the frame's next answer - a move that ended under the film ends hidden, rather than flashing back whole
// for the one frame before its fade.
const asideFor = new Set();
let revealOnSync = false;
const hiddenNow = () => asideFor.size > 0 || revealOnSync;
/** @param {'film'|'window'} reason @param {boolean} on */
export function setLoadingAside(reason, on) {
  const had = asideFor.has(reason);
  if (on) asideFor.add(reason); else asideFor.delete(reason);
  if (had && !on && !asideFor.size && framed?.open) revealOnSync = true;
  paintAside();
}
/** A film's hold (scenes/shared.js) - the 'film' reason. */
export function stepAsideLoading(on) { setLoadingAside('film', on); }
export const loadingAside = () => hiddenNow();
function paintAside() {
  if (node) node.classList.toggle('aside', hiddenNow() || !!node._keepHidden);
  paintHudVeil();
}
/** The HUD pieces that stand above the screen's z-index go while it is SEEN - not while it is aside or gone. */
function paintHudVeil() {
  globalThis.document?.body?.classList?.toggle('ld-up', !!node && !hiddenNow() && !node._keepHidden);
}

/** The step line and the place, on the screen of the holds open now - nothing with none open, so a word set between
 *  loads never stands on the next one. */
export function setLoadingLine(text) { if (!holds.size) return; line = String(text ?? ''); if (node) paint(); }
export function setLoadingPlace(text) { if (!holds.size) return; place = String(text ?? ''); if (node) paint(); }
/** True while a screen is drawn - not merely held: a hold still inside its delay shows nothing yet. */
export const loadingShown = () => !!node;
export const loadingHeld = () => holds.size > 0;

/**
 * Run `fn` under a hold, ended however it ends - the shape every in-game seam takes, so a throw mid-load can never
 * leave the screen standing (the hold's ceiling is the second net, not the first).
 * @template T @param {Parameters<typeof beginLoading>[0]} opts @param {(hold: ReturnType<typeof beginLoading>) => T} fn @returns {Promise<Awaited<T>>}
 */
export async function withLoading(opts, fn) {
  const hold = beginLoading(opts);
  try { return await fn(hold); } finally { hold.end(); }
}

// ── THE FRAME'S HOLD ─────────────────────────────────────────────
// The world host asks one question every frame - is the world being moved (scenes/world.js worldMoveBusy, and a
// door's build, worldModes `transitioning`) - and this answers it: a hold begun on the first frame it is true, ended
// on the first it is false. Every mover is behind that question already (AUDIT 68 S22 made it the one), and every one
// of them lowers its flag in a `finally` - the teleport core's own window from its build's wait on; a throw in its
// synchronous teardown above that is a crash (the banner stands over the screen), and the hold's ceiling lets the
// screen go. `place` and `line` are asked again
// every frame the hold is open: a load knows where it is going only once its teleport starts.
let framed = null;
/** @param {boolean} busy @param {{ place?: () => string, line?: () => string, delay?: number }} [ask] */
export function syncLoading(busy, { place: placeOf = () => '', line: lineOf = () => '', delay = APPEAR_MS } = {}) {
  if (revealOnSync) {
    revealOnSync = false;
    if (!busy && node) node._keepHidden = true;   // the move ended under the film or the window: it ends hidden
    paintAside();
  }
  if (!busy) {
    if (framed) { const h = framed; framed = null; h.end(); }   // the slot first (bible Home: THE SLOT IS EMPTIED...)
    return;
  }
  // a hold its ceiling let go stays let go for the rest of this move - the flag is stuck, and the screen is not
  if (!framed) framed = beginLoading({ place: placeOf(), line: lineOf(), delay, why: 'a world move' });
  else if (framed.open) { framed.place(placeOf()); framed.line(lineOf()); }
}

/** The frame's place (scenes/world.js loadingPlaceNow): where a world move is bound, once its teleport has named it;
 *  nothing while a move has not yet named one (never the place being LEFT); the place itself for a door's build, which
 *  opens where the player stands. */
export function loadingPlaceOf({ dest = null, moving = false, placeAt = () => '', here = () => '' } = {}) {
  if (dest) return placeAt(dest.x, dest.y);
  return moving ? '' : here();
}

/** What the boot's steps say on the screen (scenes/world.js names them on the window's title through `status`). A step
 *  not listed is said as it is named, its first letter raised. */
export function bootLine(step) {
  const s = String(step ?? '').trim();
  if (!s) return 'Loading';
  if (s === 'loading data') return 'Reading the game data';
  if (s === 'indexing locations') return 'Charting the Iliac Bay';
  if (s === 'reading the towns of the homes') return 'Reading the towns';
  if (s.startsWith('building player pixel') || s.startsWith('streaming world')) return 'Raising the land';
  return s[0].toUpperCase() + s.slice(1);
}
/** The boot's hold's ceiling: a first boot on a slow phone is minutes, never ten. */
export const BOOT_HOLD_MAX_MS = 600_000;

function settle() {
  if (appearTimer) { clearTimeout(appearTimer); appearTimer = null; }
  if (!node) { place = ''; line = ''; return; }
  const wait = Math.max(0, MIN_SHOWN_MS - (Date.now() - shownAt));
  leaveTimer = setTimeout(() => { leaveTimer = null; if (!holds.size) leave(); }, wait);
}

function leave() {
  const gone = node;
  node = null;   // the slot first: a hold begun during the fade builds its own screen
  place = ''; line = '';
  paintHudVeil();
  if (!gone) return;
  gone.classList.add('out');
  setTimeout(() => teardown(gone), LOADING_FADE_MS);
}

function teardown(root) {
  root._stop?.();
  root.remove();
}

/** Every screen up, gone now - the tests' reset, and a host's own (a page going away). */
export function removeLoadingScreen() {
  framed = null;
  revealOnSync = false;
  for (const h of [...holds]) h.end();
  holds.clear();
  if (appearTimer) { clearTimeout(appearTimer); appearTimer = null; }
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  const gone = node;
  node = null;
  place = ''; line = '';
  if (gone) teardown(gone);
  paintHudVeil();
  document?.getElementById?.(LOADING_ID)?.remove();
}
/** The tests' reset of the aside reasons - in the game each reason is owned by its holder (the film's count, the frame). */
export function _resetLoadingAsideForTests() { asideFor.clear(); revealOnSync = false; }

function paint() {
  if (!node) return;
  const pl = node.querySelector('.ld-place');
  const ln = node.querySelector('.ld-line');
  if (pl && pl.textContent !== place) pl.textContent = place;
  if (ln && ln.textContent !== (line || 'Loading')) ln.textContent = line || 'Loading';
  node.classList.toggle('noplace', !place);
}

let groundKept = null;   // { w, h, canvas } - the last size drawn
let groundDraws = 0;
/** How many times the sky has been drawn this session - the tests' window on the once-per-size law. */
export const loadingGroundDraws = () => groundDraws;
function groundFor(w, h) {
  const c = el('canvas', 'px-ground ld-ground');
  if (!groundKept || groundKept.w !== w || groundKept.h !== h) {
    const kept = el('canvas');
    drawPixelGround(kept, w, h, 0);
    groundDraws++;
    groundKept = { w, h, canvas: kept };
  }
  c.width = groundKept.canvas.width;
  c.height = groundKept.canvas.height;
  c.getContext('2d')?.drawImage(groundKept.canvas, 0, 0);
  return c;
}

function build() {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectLoadingStyle();
  document.getElementById(LOADING_ID)?.remove();   // one screen, ever - a stray from a torn-down page goes first
  const root = el('div', 'ld');
  root.id = LOADING_ID;
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  const still = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) root.classList.add('still');
  if (hiddenNow()) root.classList.add('aside');

  // THE GROUND: the menu's own night (PX1), the screen's floor whatever stands on it - drawn once per window size and
  // kept; its drift is the menu's own CSS (`.px-ground`), on the compositor, never the main thread.
  const ground = groundFor(globalThis.innerWidth || 1280, globalThis.innerHeight || 720);
  const shot = el('img', 'ld-shot');
  shot.alt = '';
  shot.decoding = 'async';
  let shotUrl = null;
  root.append(ground, shot, el('i', 'px-vignette'), el('i', 'ld-veil'));

  const plate = el('div', 'ld-plate');
  const rule = el('div', 'ld-rule');
  rule.append(el('span', 'px-gem'));
  const bar = el('div', 'ld-bar');
  bar.append(el('i', 'ld-run'));
  plate.append(el('div', 'ld-place'), rule, el('div', 'ld-line'), bar);
  const corner = el('div', 'ld-corner');
  corner.append(el('span', 'ld-tip', tipAt()));
  root.append(plate, corner);

  root._stop = () => {
    if (shotUrl) { URL.revokeObjectURL(shotUrl); shotUrl = null; }
  };
  document.body.append(root);
  node = root;
  shownAt = Date.now();
  paint();
  paintHudVeil();

  // THE PICTURE: asked once per screen, and only on the row's Your screenshots. It arrives when the gallery answers;
  // the ground stands until then, and for good if the gallery holds nothing in the turn.
  if (loadingMode() === 'shots') {
    loadingShot().then((s) => {
      if (node !== root || !s?.blob) return;   // the screen went, or nothing in the turn
      shotUrl = URL.createObjectURL(s.blob);
      shot.onload = () => { if (node === root) root.classList.add('shot'); };
      shot.src = shotUrl;
      const cap = shotCaption(s);
      if (cap) corner.replaceChildren(el('span', 'ld-cap', cap));
    }).catch(() => {});
  }
  return root;
}

const LOADING_STYLE_ID = 'enhanced-loading-style';
function injectLoadingStyle(doc = document) {
  if (doc.getElementById(LOADING_STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = LOADING_STYLE_ID;
  s.textContent = LOADING_CSS;
  doc.head.append(s);
}

// The menu's pixel idiom (ui/enhancedStyle.js .px-*): whole-pixel rules, 2px shadows, the brass gem, the pixel face.
export const LOADING_CSS = `
.ld { position: fixed; inset: 0; z-index: ${LOADING_Z}; overflow: hidden; background: var(--ink, #0e1013);
  color: #d8cfae; font-family: var(--data); pointer-events: auto; cursor: progress; user-select: none;
  animation: ld-in ${LOADING_FADE_MS}ms steps(4, end) both; }
.ld.aside { visibility: hidden; pointer-events: none; }
body.ld-up .wb-gate-banner, body.ld-up .wb-title-card, body.ld-up .wb-dmg-chart, body.ld-up .sg-hud,
body.ld-up .arena-hud, body.ld-up .rvncard-stack, body.ld-up #plus-pad-prompts { visibility: hidden !important; }
.ld.out { animation: ld-out ${LOADING_FADE_MS}ms steps(4, end) both; pointer-events: none; }
@keyframes ld-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes ld-out { from { opacity: 1 } to { opacity: 0 } }
.ld-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0;
  transition: opacity 600ms ease; transform-origin: 50% 60%; }
.ld.shot .ld-shot { opacity: 1; animation: ld-drift 24s ease-out both; }
@keyframes ld-drift { from { transform: scale(1.0) } to { transform: scale(1.06) } }
.ld-veil { position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(to bottom, rgba(5,6,8,0) 45%, rgba(5,6,8,0.55) 72%, rgba(5,6,8,0.88) 100%); }
.ld-plate { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 48px 56px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 0; }
.ld-place { font-size: 44px; line-height: 1.1; letter-spacing: 0.06em; color: #e9e4d9;
  text-shadow: 3px 3px 0 rgba(0,0,0,0.85); max-width: min(900px, 92vw); overflow-wrap: anywhere; }
.ld.noplace .ld-place { display: none; }
.ld-rule { display: flex; align-items: center; gap: 14px; width: min(360px, 70vw); margin: 16px 0 14px; padding-left: 4px; }
.ld-rule::after { content: ''; flex: 1; height: 2px; background: #7d7460; opacity: 0.55; }
.ld-line { font-size: 15px; letter-spacing: 0.24em; text-transform: uppercase; color: #9c937d;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); min-height: 1.4em; }
.ld-bar { position: relative; width: min(360px, 70vw); height: 6px; margin-top: 14px; overflow: hidden;
  background: rgba(10,12,17,0.65); box-shadow: 0 0 0 2px #3a352a; }
.ld-run { position: absolute; top: 0; bottom: 0; left: 0; width: 28%; background: var(--brass, #c08a3e);
  box-shadow: inset 0 -2px 0 rgba(93,77,12,0.9); animation: ld-run 1.4s steps(28, end) infinite; }
@keyframes ld-run { from { transform: translateX(-100%) } to { transform: translateX(360%) } }
.ld.still .ld-run { animation: none; width: 100%; opacity: 0.6; }
.ld.still .ld-shot, .ld.still .px-ground { animation: none; }
.ld-corner { position: absolute; right: 32px; bottom: 56px; max-width: min(420px, 40vw); text-align: right;
  font-size: 14px; line-height: 1.5; color: #a89f88; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.ld-cap { letter-spacing: 0.12em; }
@media (max-width: 720px) {
  .ld-plate { padding: 0 20px 92px; }
  .ld-place { font-size: 30px; }
  .ld-line { font-size: 13px; letter-spacing: 0.18em; }
  .ld-corner { left: 20px; right: 20px; bottom: 24px; max-width: none; text-align: left; font-size: 13px; }
}
`;
