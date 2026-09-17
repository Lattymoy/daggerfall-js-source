// FONT1 (2026-09-16, Mac: "Enhanced mode UI ... Ambient Text mod also
// doesnt use it. Any enhanced UI or text must be our enhanced
// version"): THE POPUP COLUMN, IN THE ENHANCED FACE.
//
// Every line the game says without opening a window comes through
// PopupText - AddHUDText: the Ambient Text mod's street lines
// (systems/ambientText.js -> townTalk.say -> HudText.add), "Your Long
// Blade skill has improved.", the loot tallies, the door texts, the
// quest lines. ui/hudText.js drew them all with the CLASSIC BITMAP
// FONT through ui/text.js, on the enhanced skin as on the classic one,
// because ui/enhancedHud.js replaced the bars and the compass and
// never took the text. So the one part of the enhanced HUD a player
// READS was the one part still in the 1996 face.
//
// THIS MODULE IS THE DRAW, AND ONLY THE DRAW. HudText keeps the whole
// PopupText machine - the queue, the pop delay, the rubberband, the
// scroll-out - as the single timer and the single model, and hands
// this renderer the FRAME it would have painted: the rows in order and
// the slide, already computed by PopupText's own arithmetic. A second
// timer here would be a second PopupText, and two of them drift.
//
// WHERE IT SITS. The classic column starts at the top of the 320x200
// NativePanel (PopupText.Draw's `float y = 4`) and grows downward,
// centred. The enhanced skin has furniture there already - the compass
// strip at top 18 (26 tall) and the target bar under it - so the
// column starts BELOW that block and keeps the same centred downward
// growth. The 96px is measured, not guessed - see HUD_TEXT_TOP_PX in
// ui/enhancedStyle.js, which is where the sheet keeps it - and the
// strip rides --hud-scale like every other part of this HUD.
//
// UPDATED, NOT REBUILT, like ui/enhancedHud.js: the rows are pooled
// and only what CHANGED is written, so a still frame costs a handful
// of string compares rather than a fresh DOM sixty times a second.
//
// AND IT REACHES ITS HIDE DOOR. AUDIT 64 F37's law: a persistent DOM
// overlay stays painted unless told otherwise, so the hosts call
// through on EVERY frame with their gate as an argument rather than
// skipping the call - a skipped call would leave the last lines
// standing over a hidden HUD for as long as the player kept it hidden.
//
// AUDIT FONT F1 (2026-09-16) - ONE ELEMENT PER MODEL, NOT ONE ELEMENT.
// FONT1 shipped this module's host, rows and last-frame cache as
// MODULE SINGLETONS, on the reading that DFU has exactly one PopupText.
// This port has two live at once: scenes/townTalk.js builds one and
// scenes/dungeonContext.js another, and on ?world in a dungeon BOTH
// draw every frame - the dungeon's inside worldModes' dungeon arm, the
// town's from townTalk.frame straight after. So the dungeon painted its
// rows and townTalk's EMPTY queue hid them again in the same task, and
// every dungeon popup - a skill improving, a loot tally, a door's text,
// a quest line through ctx.hudSay - was never once seen under this
// skin; when townTalk DID have a line (the Ambient Text mod's street
// lines go through townTalk.say, in a dungeon too) it overwrote the
// dungeon's rows instead.
//
// The fix is keyed hosts: ONE `.hudtext-stack` per document holds the
// place and the scale, and each owner draws into its own `.hudtext`
// inside it. Two models stack - both sets of lines readable - and
// neither can blank the other. The alternative was to funnel
// dungeonContext into townTalk's HudText, one PopupText as DFU has;
// that was refused because ?dungeon boots dungeonContext with no
// townTalk at all, so the funnel would have had to invent a second
// owner for the standalone host and the two hosts would still have
// ticked one queue twice (a double drain of PopupText's single timer).
// A key per owner costs one Map and is true on every host.
//
// WHAT THIS MODULE IS NOT. FONT1 took the HUD's own text - this column,
// the mid-screen label, the online status line - and the online panels
// and the touch layer beside them. The NATIVE WINDOWS are still drawn
// on the canvas in the 1996 bitmap face under this skin, and that is a
// slice of its own rather than an oversight: ui/deathScreen.js:71-72,
// ui/restWindow.js:839, ui/saveWindow.js:615+ (shadowText, eight
// sites), ui/travelPopUp.js:602, ui/questJournal.js:641-642,
// ui/messageBox.js:431/:434 and ui/actionText.js:41/:152 (every
// ActionTextBox). Each of those is a native window whose every drawn
// element cites a DFU rect (THE NATIVE-WINDOW RULE), so the face cannot
// change without the metrics changing with it.
import { injectEnhancedStyle, injectEnhancedFonts, HUD_TEXT_ROW_PX } from './enhancedStyle.js';
import { nativeMetrics } from './nativePanel.js';

// One row's box in CSS pixels at scale 1 is `.hudtext-row`'s height,
// and it is the SHEET's number, imported rather than restated: the
// scroll-out below slides the column by a fraction of a row in pixels,
// so a row that is 20 in the sheet and 18 here would scroll out by the
// wrong amount on every line that leaves. ONE MEMBER, ONE EXPORT.
export const ENHANCED_HUD_TEXT_ROW_H = HUD_TEXT_ROW_PX;
/** The STACK - one per document, whatever number of models draw into
 *  it (AUDIT FONT F1). Each owner's column is a `.hudtext` inside it
 *  carrying `data-owner`. */
export const ENHANCED_HUD_TEXT_ID = 'enhanced-hudtext';

let stack = null;
/** key -> { host, rows, last } - one entry per PopupText model. */
const columns = new Map();
/** AUDIT FONT F2: the last --hud-scale this module was told, KEPT.
 *  ui/enhancedHud.js writes the scale only when it CHANGES (once at
 *  boot, then on a settings move), and these hosts are built lazily -
 *  the column on the first line the game says, which may be an hour
 *  later - so a host that was not there for the write has to be given
 *  the number when it is made or it draws at 1 under a HUD at 2. */
let hudScaleVar = null;

function applyScale(node) {
  if (hudScaleVar !== null) node.style.setProperty('--hud-scale', hudScaleVar);
}

function buildStack(doc) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const root = doc.createElement('div');
  root.id = ENHANCED_HUD_TEXT_ID;
  root.className = 'hudtext-stack';
  root.setAttribute('aria-hidden', 'true');   // the notebook carries these lines in words (HudText.onMessage); this is paint
  applyScale(root);
  doc.body.append(root);
  return root;
}

function buildColumn(doc, key) {
  const col = doc.createElement('div');
  col.className = 'hudtext';
  col.dataset.owner = key;
  stack.append(col);
  return { host: col, rows: [], last: {} };
}

/**
 * One frame of ONE model's popup column.
 *
 * `frame` is what ui/hudText.js composed from PopupText's own state:
 *   `rows`    the lines to paint, front first, already cut to the
 *             count PopupText.Draw would have drawn;
 *   `slide`   the scroll-out, in ROWS (PopupText's timer / popDelay,
 *             negative while the front row is leaving, 0 otherwise);
 *   `visible` the host's draw gate - false hides the column without
 *             touching the queue (a hidden HUD, and AUDIT FONT F4's
 *             canvas window standing over it).
 * `key` names the OWNER (AUDIT FONT F1) - two models never share one
 * element. Returns that owner's column (or null off a document), so a
 * test can read what was painted.
 */
export function drawEnhancedHudText(frame, doc = (typeof document === 'undefined' ? null : document), key = 'hud') {
  if (!doc) return null;
  const lines = frame?.visible === false ? [] : (frame?.rows ?? []);
  const slide = frame?.visible === false ? 0 : (frame?.slide ?? 0);
  let col = columns.get(key);
  // Nothing to say and nothing said yet: do not build a host for silence.
  if (!col && !lines.length) return null;
  if (!stack) stack = buildStack(doc);
  if (!col) { col = buildColumn(doc, key); columns.set(key, col); }
  const { host, rows, last } = col;

  const shown = lines.length > 0;
  if (last.on !== shown) { last.on = shown; host.style.display = shown ? '' : 'none'; }
  // The scroll-out. `slide` is negative, so the column rides UP by a
  // fraction of one row - the classic's `y += (rowH + spacing) * timer
  // / popDelay`.
  //
  // AUDIT FONT F8: by the FRONT ROW'S OWN height, measured, because
  // rows wrap now - the classic measures the string it is drawing and
  // a two-line row that scrolled out by one row's worth would jump.
  // ENHANCED_HUD_TEXT_ROW_H is the sheet's min-height and the answer
  // for a row that has not been laid out (and for a fake document).
  const rowH = (slide !== 0 && rows[0]?.offsetHeight) || ENHANCED_HUD_TEXT_ROW_H;
  const y = `${(slide * rowH).toFixed(2)}px`;
  if (last.slide !== y) { last.slide = y; host.style.setProperty('--hudtext-slide', y); }
  if (!shown) return host;

  while (rows.length < lines.length) {
    const n = doc.createElement('div');
    n.className = 'hudtext-row';
    host.append(n);
    rows.push(n);
  }
  for (let i = 0; i < rows.length; i++) {
    const n = rows[i];
    if (i >= lines.length) {
      if (n.style.display !== 'none') n.style.display = 'none';
      continue;
    }
    if (n.style.display === 'none') n.style.display = '';
    if (n.textContent !== lines[i]) n.textContent = lines[i];
  }
  return host;
}

/** EVERY ALLOCATION HAS AN OWNER: a model whose host is ending takes
 *  its own column with it (scenes/dungeonContext.js's destroy), and
 *  the stack goes when the last one does. */
export function releaseEnhancedHudText(key) {
  const col = columns.get(key);
  if (!col) return;
  try { col.host.remove(); } catch { /* already gone */ }
  columns.delete(key);
  if (!columns.size) { try { stack?.remove(); } catch { /* already gone */ } stack = null; }
}

/** AUDIT FONT F2: --hud-scale is declared on `.hud` (ui/enhancedHud.js
 *  build), and the popup column and the mid-screen label are SIBLINGS
 *  of it on document.body - the variable never inherited into either,
 *  so at hudScale 2 the column drew through the compass block at half
 *  size and at 0.5 it floated over the world. enhancedHud's scale write
 *  hands it here, exactly as it already hands it to the damage-number
 *  layer; the number is KEPT for whichever of the two is built later. */
export function setEnhancedHudTextScale(scale, doc = (typeof document === 'undefined' ? null : document)) {
  hudScaleVar = String(scale);
  if (!doc) return;
  for (const id of [ENHANCED_HUD_TEXT_ID, ENHANCED_MID_TEXT_ID]) {
    doc.getElementById?.(id)?.style?.setProperty('--hud-scale', hudScaleVar);
  }
}

// ── THE HUD'S OTHER TEXT SURFACE ────────────────────────────────────
//
// DaggerfallHUD owns TWO (AUDIT 64 F34): the column above and the
// MID-SCREEN LABEL - one centred line that replaces itself, where the
// mode word, the eleven "You are too far away" refusals and the whole
// lockpick ladder are spoken. ui/midScreenText.js drew it with the
// classic bitmap font on both skins, so under the enhanced skin the
// two surfaces disagreed about what face the game speaks in.
//
// It lives in THIS module rather than a third one because it is the
// same thing: HUD text, in the skin's face, with the same hide door
// and the same updated-not-rebuilt law. Its own host, because the two
// surfaces sit in different places and one must never push the other.
//
// WHERE IT SITS. DFU puts it at native y=146 of 200 - just under
// three quarters of the way down - and that proportion is the whole
// placement: high enough to read at a glance, low enough not to sit on
// the crosshair.
//
// AUDIT FONT F11: AND 146/200 IS NOT 73% OF THE SCREEN. FONT1 wrote
// `.hudmid { top: 73% }` and claimed with it that a player swapping
// skins finds the line where they left it. The classic label is a
// NativePanel child and nativePanel.nativeMetrics FLOORS the fit and
// centres the 320x200 panel in what is left, so the proportion only
// comes out at 73% when the viewport is 16:10; at 1280x1024 the panel
// is scale 4 with oy 112 and the label sits at 68%. So this writes the
// REAL number - midScreenTextY, in CSS pixels, off the same canvas and
// the same floored arithmetic - and the sheet's 73% is the fallback
// for a frame that has not been drawn yet.
export const ENHANCED_MID_TEXT_ID = 'enhanced-midtext';

let midHost = null;
const lastMid = {};

/**
 * The classic label's top edge in CSS pixels - `nativeMetrics(canvas)`
 * exactly as ui/midScreenText.js's classic arm draws it, divided back
 * out of the canvas's device pixels. null off a canvas.
 */
export function midTextTopPx(canvas, y) {
  if (!canvas?.width || !canvas?.height || !Number.isFinite(y)) return null;
  const m = nativeMetrics(canvas);
  const dpr = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
  return (m.oy + y * m.s) / dpr;
}

/**
 * The mid-screen label, or nothing. `text` is the label's live text
 * (empty once its timer has blanked it), `visible` the host's draw
 * gate - false hiding the line without touching the timer - and `top`
 * the classic label's own top edge in CSS pixels (null leaves the
 * sheet's fallback proportion alone).
 */
export function drawEnhancedMidText(frame, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc) return null;
  const text = frame?.visible === false ? '' : String(frame?.text ?? '');
  if (!midHost && !text) return null;
  if (!midHost) {
    injectEnhancedStyle(doc);
    injectEnhancedFonts(doc);
    midHost = doc.createElement('div');
    midHost.id = ENHANCED_MID_TEXT_ID;
    midHost.className = 'hudmid';
    midHost.setAttribute('aria-hidden', 'true');
    applyScale(midHost);
    doc.body.append(midHost);
  }
  if (lastMid.text !== text) { lastMid.text = text; midHost.textContent = text; }
  const top = Number.isFinite(frame?.top) ? `${frame.top.toFixed(1)}px` : null;
  if (top !== null && lastMid.top !== top) { lastMid.top = top; midHost.style.setProperty('--hudmid-top', top); }
  const shown = text !== '';
  if (lastMid.on !== shown) { lastMid.on = shown; midHost.style.display = shown ? '' : 'none'; }
  return midHost;
}

// ── THE ONLINE STATUS LINE ──────────────────────────────────────────
//
// "Connecting...", "Reconnecting", "The relay refused the name" - the
// online session's own word on the socket (AUDIT ONLINE D12/E11),
// drawn top-left over the world. It is drawn in the ONLINE lane, which
// is the enhanced lane whole (systems/onlineLane.js), so it had no
// business being the one online surface still in the classic bitmap
// font while the chat, the roster, the party HUD and the friends panel
// beside it are all in the skin's own face.
//
// Top-left at 8px, which is where the classic drew it (8,8 scaled) and
// clear of the chat panel's own corner at 44.
export const ENHANCED_STATUS_ID = 'enhanced-netstatus';

let statusHost = null;
const lastStatus = {};

/** The status line, or '' for none. Same hide law as the two above. */
export function drawEnhancedStatusLine(text, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc) return null;
  const line = String(text ?? '');
  if (!statusHost && !line) return null;
  if (!statusHost) {
    injectEnhancedStyle(doc);
    injectEnhancedFonts(doc);
    statusHost = doc.createElement('div');
    statusHost.id = ENHANCED_STATUS_ID;
    statusHost.className = 'hudstatus';
    statusHost.setAttribute('aria-hidden', 'true');
    doc.body.append(statusHost);
  }
  if (lastStatus.text !== line) { lastStatus.text = line; statusHost.textContent = line; }
  const shown = line !== '';
  if (lastStatus.on !== shown) { lastStatus.on = shown; statusHost.style.display = shown ? '' : 'none'; }
  return statusHost;
}

/** Every surface in this module, gone.
 *
 *  AUDIT FONT F12: this used to name "the same hand that calls
 *  ui/enhancedHud.js destroyEnhancedHud" - a caller that does not
 *  exist. NOTHING in src/ calls destroyEnhancedHud either: the
 *  enhanced HUD's elements live as long as the page does, because
 *  every skin and scene change in this port ends in location.replace.
 *  So this door's callers today are the TESTS, which drive the module
 *  over a fake document per case; a PER-OWNER teardown, which is the
 *  one that a live host really does reach, is releaseEnhancedHudText
 *  (scenes/dungeonContext.js's destroy calls it, because a dungeon
 *  context IS torn down inside a session). If a page-level teardown is
 *  ever wired, this is the half of it that belongs here. */
export function destroyEnhancedHudText() {
  for (const col of columns.values()) { try { col.host.remove(); } catch { /* already gone */ } }
  columns.clear();
  try { stack?.remove(); } catch { /* already gone */ }
  try { midHost?.remove(); } catch { /* already gone */ }
  try { statusHost?.remove(); } catch { /* already gone */ }
  stack = null;
  midHost = null; statusHost = null;
  hudScaleVar = null;
  for (const k of Object.keys(lastMid)) delete lastMid[k];
  for (const k of Object.keys(lastStatus)) delete lastStatus[k];
}
