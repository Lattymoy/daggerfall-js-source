// FONT1 (2026-09-16, Mac: "Enhanced mode UI ... Ambient Text mod also
// doesnt use it. Any enhanced UI or text must be our enhanced
// version"): THE HUD'S TEXT, IN THE ENHANCED FACE.
//
// DaggerfallHUD owns the text surfaces a player READS without opening
// a window: the popup column (PopupText - AddHUDText), the mid-screen
// label (SetMidScreenText) and, in this port, the online status line.
// ui/enhancedHud.js replaced the bars and the compass and never took
// the text, so the one part of the enhanced HUD a player read was the
// one part still in the 1996 face. FONT1 gave all three the skin's
// face, in this module.
//
// THIS MODULE IS THE DRAW, AND ONLY THE DRAW. The models keep their
// whole machine - ui/hudText.js is PopupText's queue, timer and
// rubberband; ui/midScreenText.js is the label's one timer - and hand
// this renderer the FRAME they would have painted. A second timer here
// would be a second model, and two of them drift.
//
// ENH-NOTICE3 (2026-09-21, Mac: "All mods, including climates and
// calories need to utilize the enhanced notification popup"): THE
// POPUP COLUMN LEFT THIS MODULE. FONT1 drew PopupText's rows as a DOM
// column at the top of the screen, under the compass block, one
// `.hudtext` per model inside one `.hudtext-stack` (AUDIT FONT F1 keyed
// them, F2 scaled them, F7 stepped them out of the chat's peek, F8 let
// them wrap). That column was a SECOND enhanced face beside the notice
// panel ENH-NOTICE1 gave the message box - and the rows it carried
// (Climates & Calories' hunger, thirst and cold, the Ambient Text mod's
// street lines, the torches' burn-out, every skill-up and loot tally)
// were exactly the lines the player expected in the panel. So each
// PopupText row is a TOAST in the notice stack now (ui/enhancedNotice
// .js drawEnhancedToasts, handed HudText.frame each draw as this module
// was), and the column, its sheet rules, its tops and its scale write
// are retired: Ledger A row "THE HUD LINE AS A TOAST". What stays here
// is the HUD's OTHER two surfaces, below.
//
// UPDATED, NOT REBUILT, like ui/enhancedHud.js: only what CHANGED is
// written, so a still frame costs a handful of string compares rather
// than a fresh DOM sixty times a second.
//
// AND IT REACHES ITS HIDE DOOR. AUDIT 64 F37's law: a persistent DOM
// overlay stays painted unless told otherwise, so the hosts call
// through on EVERY frame with their gate as an argument rather than
// skipping the call - a skipped call would leave the last line
// standing over a hidden HUD for as long as the player kept it hidden.
//
// WHAT THIS MODULE IS NOT. FONT1 took the HUD's own text and the
// online panels and the touch layer beside them. The NATIVE WINDOWS
// are still drawn on the canvas in the 1996 bitmap face under this
// skin, and that is a slice of its own rather than an oversight:
// ui/deathScreen.js:168-170, ui/restWindow.js:866, ui/saveWindow.js:641+
// (shadowText, eight sites), ui/travelPopUp.js:716,
// ui/questJournal.js:641-642, ui/messageBox.js:474/:477 and
// ui/actionText.js:45/:137 (every ActionTextBox's parchment on the
// classic skin). Each of those is a native window whose every drawn
// element cites a DFU rect (THE NATIVE-WINDOW RULE), so the face
// cannot change without the metrics changing with it.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { nativeMetrics } from './nativePanel.js';

/** AUDIT FONT F2: the last --hud-scale this module was told, KEPT.
 *  ui/enhancedHud.js writes the scale only when it CHANGES (once at
 *  boot, then on a settings move), and the label's host is built
 *  lazily - on the first line the game says, which may be an hour
 *  later - so a host that was not there for the write has to be given
 *  the number when it is made or it draws at 1 under a HUD at 2. */
let hudScaleVar = null;

function applyScale(node) {
  if (hudScaleVar !== null) node.style.setProperty('--hud-scale', hudScaleVar);
}

/** AUDIT FONT F2: --hud-scale is declared on `.hud` (ui/enhancedHud.js
 *  build), and the mid-screen label is a SIBLING of it on document.body
 *  (named for the ONE surface it scales since ENH-NOTICE3 retired the
 *  column - AUDIT ENH-NOTICE3 A10; the status line never took it)
 *  - the variable never inherited into it, so at hudScale 2 the label
 *  drew at half size and at 0.5 it floated. enhancedHud's scale write
 *  hands it here, exactly as it already hands it to the damage-number
 *  layer; the number is KEPT for a label built later. (The popup column
 *  this once scaled too is a toast in the notice stack since
 *  ENH-NOTICE3, which does not scale with the HUD - it is the box's
 *  stack, at the box's size.) */
export function setEnhancedMidTextScale(scale, doc = (typeof document === 'undefined' ? null : document)) {
  hudScaleVar = String(scale);
  if (!doc) return;
  doc.getElementById?.(ENHANCED_MID_TEXT_ID)?.style?.setProperty('--hud-scale', hudScaleVar);
  for (const h of labelHosts.values()) h.node.style.setProperty('--hud-scale', hudScaleVar);   // AUDIT HCC U6: the mods' HUD labels scale with it
}

// ── A MOD'S OWN HUD LABEL (AUDIT HCC U6) ────────────────────────────
//
// DaggerfallUI.AddTextLabel on the HUD's NativePanel - a mod's line at a native position of its own (Horse Cart and
// Cargo's horse name at y=112). The enhanced face is the mid-screen label's (`.hudmid`: the skin's face, the HUD's
// scale, the classic line's own top edge); one node per label id, so two mods' labels never share a line.
/** @type {Map<string, { node: any, last: Record<string, any> }>} */
const labelHosts = new Map();
/** `frame` = { text, visible, top } as drawEnhancedMidText's. Returns the node (null off a document or when nothing
 *  was ever shown). */
export function drawEnhancedHudLabel(id, frame, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc) return null;
  const text = frame?.visible === false ? '' : String(frame?.text ?? '');
  let h = labelHosts.get(id);
  if (!h && !text) return null;
  if (!h) {
    injectEnhancedStyle(doc);
    injectEnhancedFonts(doc);
    const node = doc.createElement('div');
    node.id = id;
    node.className = 'hudmid';
    node.setAttribute('aria-hidden', 'true');
    applyScale(node);
    doc.body.append(node);
    h = { node, last: {} };
    labelHosts.set(id, h);
  }
  const { node, last } = h;
  if (last.text !== text) { last.text = text; node.textContent = text; }
  const top = Number.isFinite(frame?.top) ? `${frame.top.toFixed(1)}px` : null;
  if (top !== null && last.top !== top) { last.top = top; node.style.setProperty('--hudmid-top', top); }
  const shown = text !== '';
  if (last.on !== shown) { last.on = shown; node.style.display = shown ? '' : 'none'; }
  return node;
}

// ── THE MID-SCREEN LABEL ────────────────────────────────────────────
//
// DaggerfallHUD's second text surface (AUDIT 64 F34): one centred line
// that replaces itself, where the mode word, the eleven "You are too
// far away" refusals and the whole lockpick ladder are spoken.
// ui/midScreenText.js drew it with the classic bitmap font on both
// skins, so under the enhanced skin the surfaces disagreed about what
// face the game speaks in.
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
 *  over a fake document per case. (The per-owner teardown a live host
 *  really does reach is the toasts' - ui/enhancedNotice.js
 *  releaseEnhancedToasts, through HudText.dispose from
 *  scenes/dungeonContext.js's destroy - since ENH-NOTICE3 moved the
 *  column there.) If a page-level teardown is ever wired, this is the
 *  half of it that belongs here. */
export function destroyEnhancedHudText() {
  try { midHost?.remove(); } catch { /* already gone */ }
  try { statusHost?.remove(); } catch { /* already gone */ }
  midHost = null; statusHost = null;
  for (const h of labelHosts.values()) { try { h.node.remove(); } catch { /* already gone */ } }
  labelHosts.clear();
  hudScaleVar = null;
  for (const k of Object.keys(lastMid)) delete lastMid[k];
  for (const k of Object.keys(lastStatus)) delete lastStatus[k];
}
