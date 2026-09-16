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
import { injectEnhancedStyle, injectEnhancedFonts, HUD_TEXT_ROW_PX } from './enhancedStyle.js';

// One row's box in CSS pixels at scale 1 is `.hudtext-row`'s height,
// and it is the SHEET's number, imported rather than restated: the
// scroll-out below slides the column by a fraction of a row in pixels,
// so a row that is 20 in the sheet and 18 here would scroll out by the
// wrong amount on every line that leaves. ONE MEMBER, ONE EXPORT.
export const ENHANCED_HUD_TEXT_ROW_H = HUD_TEXT_ROW_PX;
export const ENHANCED_HUD_TEXT_ID = 'enhanced-hudtext';

let host = null;
let rows = [];
const last = {};

function build(doc) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const root = doc.createElement('div');
  root.id = ENHANCED_HUD_TEXT_ID;
  root.className = 'hudtext';
  root.setAttribute('aria-hidden', 'true');   // the notebook carries these lines in words (HudText.onMessage); this is paint
  doc.body.append(root);
  return root;
}

/**
 * One frame of the popup column.
 *
 * `frame` is what ui/hudText.js composed from PopupText's own state:
 *   `rows`    the lines to paint, front first, already cut to the
 *             count PopupText.Draw would have drawn;
 *   `slide`   the scroll-out, in ROWS (PopupText's timer / popDelay,
 *             negative while the front row is leaving, 0 otherwise);
 *   `visible` the host's draw gate - false hides the column without
 *             touching the queue.
 * Returns the host element (or null off a document), so a test can read
 * what was painted.
 */
export function drawEnhancedHudText(frame, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc) return null;
  const lines = frame?.visible === false ? [] : (frame?.rows ?? []);
  const slide = frame?.visible === false ? 0 : (frame?.slide ?? 0);
  // Nothing to say and nothing said yet: do not build a host for silence.
  if (!host && !lines.length) return null;
  if (!host) { host = build(doc); rows = []; }

  const shown = lines.length > 0;
  if (last.on !== shown) { last.on = shown; host.style.display = shown ? '' : 'none'; }
  // The scroll-out. `slide` is negative, so the column rides UP by a
  // fraction of one row - the classic's `y += (rowH + spacing) * timer
  // / popDelay` with the pixels named once (ENHANCED_HUD_TEXT_ROW_H).
  const y = `${(slide * ENHANCED_HUD_TEXT_ROW_H).toFixed(2)}px`;
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
// the crosshair. `.hudmid` is at 73%, which is 146/200, so a player
// swapping skins finds the line where they left it.
export const ENHANCED_MID_TEXT_ID = 'enhanced-midtext';

let midHost = null;
const lastMid = {};

/**
 * The mid-screen label, or nothing. `text` is the label's live text
 * (empty once its timer has blanked it) and `visible` the host's draw
 * gate, false hiding the line without touching the timer.
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
    doc.body.append(midHost);
  }
  if (lastMid.text !== text) { lastMid.text = text; midHost.textContent = text; }
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

/** A host tearing down - EVERY ALLOCATION HAS AN OWNER, and this one's
 *  is the same hand that calls ui/enhancedHud.js destroyEnhancedHud. */
export function destroyEnhancedHudText() {
  try { host?.remove(); } catch { /* already gone */ }
  try { midHost?.remove(); } catch { /* already gone */ }
  try { statusHost?.remove(); } catch { /* already gone */ }
  host = null; rows = [];
  midHost = null; statusHost = null;
  for (const k of Object.keys(last)) delete last[k];
  for (const k of Object.keys(lastMid)) delete lastMid[k];
  for (const k of Object.keys(lastStatus)) delete lastStatus[k];
}
