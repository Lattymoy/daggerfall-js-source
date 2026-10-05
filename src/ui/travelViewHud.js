// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV1 - THE TRAVEL VIEW'S READOUT (bible/06-Systems/Travel-View.md).
//
// What stands over the raised camera: the traveller's own mark (a ring
// at the feet and a chevron for the heading - from 450 m a body is a
// dozen pixels, and the mark is how the eye finds it), a compass that
// turns with the orbit, the bar at the foot of the screen (the view's
// name, where the traveller is, the hints, and the one button back), and
// the marks the later slices hang here: TV2's destination and route
// line, TV3's travellers.
//
// THE HUD'S KIND OF THING, NOT A WINDOW - ui/enhancedTravelControl.js's
// law, for its reason: nothing here registers with the overlay stack,
// because anything in that slot pauses the game and the view's whole
// point is a world that goes on under it. The root takes no pointer
// events; the button opts back in, as the travel panel's controls do.
// UPDATED, NOT REBUILT: every node is made once, and a frame writes only
// what changed.
//
// It stands at the foot of the screen, not the top: the Travel Options
// panel owns the top while a journey runs, and both are up together.
//
// TV2: THE PLACES AND THE WAY. The known places in the view wear a plate
// (a mark with `pick`, the one kind of mark that takes the pointer - a
// click on it is a journey there by the roads, the same as a click on the
// town itself), the journey's end wears the destination mark, and the
// route it walks is a line under them: an SVG path through the route's
// projected points, broken where a point falls behind the eye (and, since
// FB0929, cut to the screen). The bar carries the trip in words under the
// place line.
// ═══════════════════════════════════════════════════════════════════
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { titleBadge, glyphBadges, cssRgba, GLYPH_STROKE, GLYPH_EDGE_W } from './playerBadge.js';   // OVERWORLD NAMES: a player's name as it reads over their head in play
import { PIXEL_STACK } from './pixelifyFive.js';   // AUDIT NAMES N1-4: the in-play name face
import { renownText } from '../net/renown.js';
import { guildTagText } from '../net/guildLaw.js';
import { ribbonColours, heraldryOf, heraldryColourOf, heraldryKey } from '../net/heraldryLaw.js';   // AUDIT-SEATS: a Season's banner ribbon, under the name here too; AUDIT HERALDRY H4: the tag's frame
import { drawShield } from './heraldryArt.js';   // AUDIT HERALDRY H4: the guild's shield, in its tag's frame, on the canvas
import { TV_FILTER_GROUPS, TV_FILTER_TEXT, travelViewFilters, toggleTravelViewFilter, onTravelViewFilters, markShown, countGroups } from '../systems/travelViewFilters.js';   // OW-FILTER
import { TV_WHO_GROUPS, TV_WHO_TEXT, TV_KIN_COLORS, travelViewWho, toggleTravelViewWho, cycleTravelViewRenown, cycleTravelViewNodeKm } from '../systems/travelViewFilters.js';   // OW-WHO / OW-NODE-KM / OW-KIN
import { wheelPath } from './carriageWheel.js';   // OW-HUBS: a carriage town's wheel on its dot
import { placeTip, readTip, tipKey, SEAT_TIP_TEXT_MAX } from './eventMapMarks.js';   // SEAT-TIP: the held map's card, at the pointer here too
import { tickHudLayout } from './hudLayout.js';   // HUD-MOVE: the Overworld's block and the travel bar move too
import { travelPathMode, setTravelPathMode, onTravelPathMode, TRAVEL_PATH_MODES, TRAVEL_PATH_TEXT } from '../systems/travelPathMode.js';   // OW-PATH: the Roads / Free switch

export const TRAVEL_VIEW_HUD_ID = 'travel-view';
/** The name on the screen (the code's is TRAVEL VIEW: "overworld" is the streaming world's own word in the tree). */
export const TRAVEL_VIEW_TITLE = 'Overworld';
/** The SVG namespace the route line is drawn in. */
const SVG_NS = 'http://www.w3.org/2000/svg';
/** TV3: how far in from the screen's edge a mark held at the edge stands (px). */
export const TV_EDGE_MARGIN = 28;
/** OW-EDGES: how faint a mark in the picture is drawn where it would lie over the HUD's compass or its hotbar and bars. */
export const TV_UNDER_HUD_ALPHA = 0.22;
/** FB0929: how far past the screen's edge the route line is kept (px) - past the casing's reach (its width's half, a
 *  round cap's), so where the line is cut never shows. */
export const ROUTE_CLIP_PX = 16;
/** AUDIT DEEP T1-12: the mouse's hint, naming the keys the player really has - the movement keys and the way down
 *  (KB1: the registry's Escape action, wherever it is bound) - the defaults' words when the host names none. */
export function travelViewMouseHint({ move = 'WASD', out = 'Esc' } = {}) {
  return `Click to travel · Drag to turn · Wheel to zoom · ${move} to walk · ${out} to return`;
}
/** The hints under the name - what each hand does. */
export const TRAVEL_VIEW_HINTS = Object.freeze({
  mouse: travelViewMouseHint(),
  touch: 'Tap to travel · Drag to turn · Pinch to zoom',
});

/**
 * The compass needle's turn, degrees clockwise on the screen, for a camera heading `yaw`: north is +z, yaw 0, so a
 * camera facing north shows north straight up and one facing east (yaw +90 degrees) shows it to the left.
 */
export const compassDegrees = (yaw) => -(yaw * 180) / Math.PI;

/**
 * The traveller's chevron, degrees clockwise on the screen: the heading's projected direction from the feet.
 * `feetPx` and `aheadPx` are the projected feet and a point a few metres ahead of them; null when either is off
 * screen (the chevron keeps its last turn).
 */
export function chevronDegrees(feetPx, aheadPx) {
  if (!feetPx?.front || !aheadPx?.front) return null;
  const dx = aheadPx.x - feetPx.x, dy = aheadPx.y - feetPx.y;
  if (Math.hypot(dx, dy) < 1e-3) return null;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

let root = null;
let parts = null;
let last = null;

/**
 * TV3: A MARK OUTSIDE THE PICTURE, HELD AT ITS EDGE: where on a `w` x `h` screen (inset by `margin`) the mark of a
 * point projected at `p` stands, and the way its arrow points (degrees clockwise from up). A point behind the eye
 * projects through the mirror of itself, so its direction from the middle is turned round first. Null for a point
 * that is on the picture - it is drawn where it stands. EDGE-FURNITURE: `top` and `foot` are the clear room at the top and
 * the foot (the HUD's compass and the travel panel above, the view's bar and the hotbar below - measured by the
 * readout); a point under them is held at their edge, as one off the screen is.
 * @param {{x:number, y:number, front:boolean}} p
 */
export function edgeHold(p, w, h, margin = TV_EDGE_MARGIN, top = margin, foot = margin) {
  if (!p) return null;
  if (p.front && p.x >= margin && p.x <= w - margin && p.y >= top && p.y <= h - foot) return null;
  const cx = w / 2, cy = h / 2;
  let dx = p.x - cx, dy = p.y - cy;
  if (!p.front) { dx = -dx; dy = -dy; }
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = 1;   // straight behind: below, where the ground behind would be
  const sx = (cx - margin) / Math.max(1e-6, Math.abs(dx)), sy = (dy < 0 ? cy - top : cy - foot) / Math.max(1e-6, Math.abs(dy));
  const k = Math.min(sx, sy);
  return { x: cx + dx * k, y: cy + dy * k, angle: (Math.atan2(dx, -dy) * 180) / Math.PI };
}

/** FB0929: where the line from (ax, ay) to (bx, by) comes onto the box [lo, hx] x [lo, hy] and where it leaves it, as
 *  fractions along it (Liang-Barsky) - written to `_span`, both 0..1; false when it misses the box. */
const _span = [0, 1];
function spanIn(ax, ay, bx, by, lo, hx, hy) {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  for (let e = 0; e < 4; e++) {
    const p = e === 0 ? -dx : e === 1 ? dx : e === 2 ? -dy : dy;
    const q = e === 0 ? ax - lo : e === 1 ? hx - ax : e === 2 ? ay - lo : hy - ay;
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  _span[0] = t0; _span[1] = t1;
  return true;
}

/**
 * TV2: THE ROUTE LINE's path data through projected points: a move to the first point in front of the eye, a line to
 * each after it, and a new move after any point behind the eye (a line across it would be drawn through the camera).
 * FB0929 (the Discord: "The moment I go to my Travel Map and select a far away destination, the game drops to sub-10
 * FPS"): CUT TO THE SCREEN - `w` x `h`, grown by ROUTE_CLIP_PX - each line kept only where it crosses it, a new move
 * where it comes back on. A pick across the map is a line of a hundred legs and more, and a point of it beside the
 * eye's plane projects hundreds of thousands of pixels out; the browser dashed ALL of it, off the screen too, and
 * rastered it again every frame the camera moved (1.5 million px, 100,000 dashes: 220-430 ms a frame in Chromium, the
 * median - tools/travelViewPerf.mjs). On the screen the line is the one it was. No screen given, nothing is cut.
 * @param {Array<{x:number, y:number, front:boolean}|null>} points
 */
export function routePath(points, w = Infinity, h = Infinity) {
  const lo = Number.isFinite(w) && Number.isFinite(h) ? -ROUTE_CLIP_PX : -Infinity, hx = w + ROUTE_CLIP_PX, hy = h + ROUTE_CLIP_PX;
  let d = '';
  let pen = false;   // the last point was in front of the eye: a line runs on from it
  let on = false;    // ...and it lay on the grown screen: the stroke stands there
  let ax = 0, ay = 0;
  for (const p of points ?? []) {
    if (!p?.front || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { pen = false; continue; }
    if (!pen) {
      on = p.x >= lo && p.x <= hx && p.y >= lo && p.y <= hy;
      if (on) d += `M${Math.round(p.x)} ${Math.round(p.y)} `;
    } else if (spanIn(ax, ay, p.x, p.y, lo, hx, hy)) {
      const t0 = _span[0], t1 = _span[1];
      if (!on) d += `M${Math.round(ax + (p.x - ax) * t0)} ${Math.round(ay + (p.y - ay) * t0)} `;   // it comes on: a stroke from there
      d += t1 === 1 ? `L${Math.round(p.x)} ${Math.round(p.y)} ` : `L${Math.round(ax + (p.x - ax) * t1)} ${Math.round(ay + (p.y - ay) * t1)} `;
      on = t1 === 1;   // it ends on the screen, or goes off it (a line that misses the screen starts off it: `on` is false already)
    }
    ax = p.x; ay = p.y; pen = true;
  }
  return d.trim();
}

function put(node, key, value) {
  if (!node || last[key] === value) return;
  last[key] = value;
  node.textContent = value;
}
function style(node, key, prop, value) {
  if (!node || last[key] === value) return;
  last[key] = value;
  node.style[prop] = value;
}

function build(doc, hooks) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const r = doc.createElement('div');
  r.id = TRAVEL_VIEW_HUD_ID;
  r.className = 'tview';
  const el = (tag, cls, text = '') => { const n = doc.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
  const you = el('div', 'tview-you');
  const ring = el('div', 'tview-ring');
  const chev = el('div', 'tview-chev');
  you.append(ring, chev);
  // PERF-TV: every mark is drawn on ONE canvas (drawMarks) - pointer-free: a click on a plate is found by position
  const canvas = el('canvas', 'tview-canvas');
  // OW-BLOCK (2026-09-29, the player: "the whole bar in the top is too much ... a light weight block menu ... as much free
  // screen as possible", "put the overworld block to the right"): ONE COMPACT COLUMN in the bottom-right corner - where, the journey (or
  // none), the path and the map, the filters, the way back - the rest of the screen left to the land
  const bar = el('div', 'tview-bar');
  const text = el('div', 'tview-text');
  const title = el('div', 'tview-title', TRAVEL_VIEW_TITLE);
  const where = el('div', 'tview-where');
  const trip = el('div', 'tview-trip');   // TV2: the journey in words
  const hint = el('div', 'tview-hint');
  text.append(title, where, trip, hint);
  // TV2: the route line, under the marks - a casing and the line over it, one path's data for both
  let route = null, casing = null, line = null;
  if (typeof doc.createElementNS === 'function') {
    route = doc.createElementNS(SVG_NS, 'svg');
    route.setAttribute('class', 'tview-route');
    casing = doc.createElementNS(SVG_NS, 'path'); casing.setAttribute('class', 'tview-route-casing');
    line = doc.createElementNS(SVG_NS, 'path'); line.setAttribute('class', 'tview-route-line');
    route.append(casing, line);
  }
  // AUDIT DEEP2 E15: the places the canvas draws, in words - visually hidden, said when the set changes (never per frame)
  const said = el('ul', 'tview-said');
  said.setAttribute?.('aria-label', 'Places in view');
  // OW-PATH: THE SWITCH - Roads | Free, the chosen one lit (systems/travelPathMode.js keeps it on the device)
  const modes = el('div', 'tview-modes');
  const moderow = el('div', 'tview-moderow');
  moderow.setAttribute?.('role', 'group');
  moderow.setAttribute?.('aria-label', TRAVEL_PATH_TEXT.label);
  const modeBtns = {};
  for (const m of TRAVEL_PATH_MODES) {
    const b = el('button', 'tview-mode', TRAVEL_PATH_TEXT[m]);
    b.type = 'button';
    b.title = m === 'free' ? TRAVEL_PATH_TEXT.tipFree : TRAVEL_PATH_TEXT.tipRoads;
    b.onclick = (e) => { e.preventDefault(); setTravelPathMode(m); };
    modeBtns[m] = b;
    moderow.append(b);
  }
  modes.append(el('div', 'tview-label', TRAVEL_PATH_TEXT.label), moderow);
  // OW-DECK: the journey's bar docks here while both are up (syncDock) - one strip at the top, the foot left to the vitals
  const dock = el('div', 'tview-dock');
  // OW-IDLE (2026-09-29, the player: "half of the upper window gets removed when i dont move"): the journey's bar lives
  // only while a journey runs - standing still, its half of the strip went and the strip shrank to the other. Now the
  // dock holds this in its place: no journey, how to set out, and the map.
  const idle = el('div', 'tview-idle');
  const idleText = el('div', 'tview-idle-text');
  idleText.append(el('span', 'tview-label', 'Journey'), el('span', 'tview-idle-name', 'Not travelling'),
    el('span', 'tview-idle-sub', 'Click a town or the land to set out'));
  idle.append(idleText);
  dock.append(idle);
  // OW-BLOCK: the block's one Map, journey or none (the docked journey bar's own is hidden - one press, one place)
  const idleMap = el('button', 'tview-map', 'Map');
  idleMap.type = 'button';
  idleMap.onclick = (e) => { e.preventDefault(); hooks.onMap?.(); };
  const back = el('button', 'tview-back', 'Return');
  back.type = 'button';
  back.onclick = (e) => { e.preventDefault(); hooks.onReturn?.(); };
  const head = el('div', 'tview-head');
  head.append(text);   // OW-BLOCK: no compass of its own - the HUD's stands at the top of the screen
  head.title = travelViewMouseHint();   // OW-BLOCK: the hints under the pointer, not a line of the block
  const tools = el('div', 'tview-tools');
  tools.append(modes, idleMap);
  const foot = el('div', 'tview-foot');
  foot.append(back);
  // OW-FILTER: THE CORNER'S SWITCHES - one per group of marks, a dot in the mark's own colour and how many there are
  const filters = el('div', 'tview-filters');
  filters.setAttribute?.('role', 'group');
  filters.setAttribute?.('aria-label', 'Overworld filters');
  filters.append(el('div', 'tview-label', TV_FILTER_TEXT.title));
  const filterBtns = {}, filterNums = {};
  for (const g of TV_FILTER_GROUPS) {
    const b = el('button', 'tview-filter');
    b.type = 'button';
    b.dataset && (b.dataset.group = g);
    const dot = el('span', `tview-fdot tview-fdot-${g}`);
    const word = el('span', 'tview-fword', TV_FILTER_TEXT[g]);
    const num = el('span', 'tview-fnum', '0');
    b.append(dot, word, num);
    b.onclick = (e) => { e.preventDefault(); toggleTravelViewFilter(g); };
    filterBtns[g] = b; filterNums[g] = num;
    filters.append(b);
  }
  // OW-WHO / OW-NODE-KM (FIELD BUGS 2026-10-04e): THE PLAYERS - by who they are to me, the least Renown - and how far off
  // a gathering group still shows; the held map's key reads the same switches (systems/travelViewFilters.js)
  filters.append(el('div', 'tview-label', TV_WHO_TEXT.title));
  const whoBtns = {};
  for (const g of TV_WHO_GROUPS) {
    const b = el('button', 'tview-filter');
    b.type = 'button';
    b.dataset && (b.dataset.who = g);
    b.append(el('span', `tview-fdot tview-fdot-kin-${g}`), el('span', 'tview-fword', TV_WHO_TEXT[g]));
    b.onclick = (e) => { e.preventDefault(); toggleTravelViewWho(g); };
    whoBtns[g] = b;
    filters.append(b);
  }
  const renownBtn = el('button', 'tview-filter tview-cycle on');
  renownBtn.type = 'button';
  renownBtn.title = TV_WHO_TEXT.renownTip;
  renownBtn.onclick = (e) => { e.preventDefault(); cycleTravelViewRenown(); };
  const nodeBtn = el('button', 'tview-filter tview-cycle tview-cycle-wide on');
  nodeBtn.type = 'button';
  nodeBtn.title = TV_WHO_TEXT.nodeTip;
  nodeBtn.onclick = (e) => { e.preventDefault(); cycleTravelViewNodeKm(); };
  filters.append(renownBtn, nodeBtn);
  // SEAT-TIP: the card a hovered plate answers with (a seat's: who holds it, this week's battle) - the held map's look
  const tip = el('div', 'hmtip tview-tip');
  bar.append(head, dock, tools, filters, foot);   // OW-BLOCK: top to bottom
  // AUDIT TV B8: a press on the readout (Return, a plate) is the readout's - the host's window mousedown counts any
  // press as Mouse0 (the swing, the activation), so it stops here
  // PERF-TV: a label drawn before the plates' web font arrived would stay in the fallback face - the label images are
  // drawn again once the fonts are in
  doc.fonts?.addEventListener?.('loadingdone', () => { dropSprites(); canvasSig = []; });
  const own = (e) => e.stopPropagation?.();
  r.addEventListener?.('mousedown', own);
  r.addEventListener?.('mouseup', own);
  if (route) r.append(route);
  r.append(canvas, you, bar, said, tip);
  doc.body.append(r);
  return { root: r, parts: { you, ring, chev, canvas, bar, where, trip, hint, back, route, casing, line, said, modes, modeBtns, dock, idle, idleMap, filters, filterBtns, filterNums, whoBtns, renownBtn, nodeBtn, tip } };
}

/**
 * Show the readout (made once, then kept). `hooks.onReturn` is the button. (A plate's click is found by position -
 * travelViewHudPickAt - since PERF-TV draws the marks.)
 */
export function showTravelViewHud(hooks = {}, doc = globalThis.document) {
  if (!doc) return false;
  if (!root || !root.isConnected) {
    const b = build(doc, hooks);
    root = b.root; parts = b.parts; last = {};
    resetMarks();   // PERF-TV: a new canvas holds nothing
    stopModes?.(); stopModes = onTravelPathMode(paintModes);
    stopFilters?.(); stopFilters = onTravelViewFilters((f) => { paintFilters(f); canvasSig = []; });
  }
  paintModes(travelPathMode());
  paintFilters(travelViewFilters());
  tickHudLayout(doc);   // HUD-MOVE
  parts.back.onclick = (e) => { e.preventDefault(); hooks.onReturn?.(); };
  parts.idleMap.onclick = (e) => { e.preventDefault(); hooks.onMap?.(); };
  furniture.at = -Infinity;   // EDGE-FURNITURE: what stands at the edges now (a journey's panel may have come or gone)
  // OW-THEME: the plates in the theme's own stone - read at each open (a theme is chosen with the view down)
  const pf = themePlate(doc);
  if (pf !== plateFill) { plateFill = pf; dropSprites(); canvasSig = []; }
  const pl = !!doc?.getElementById?.(TV_PLUS_SHEET_ID);   // OW-PLUS-FACE: read at each open, as the plate's stone is
  if (pl !== plusFace) { plusFace = pl; dropSprites(); canvasSig = []; }
  root.style.display = '';
  listenPointer(doc.defaultView, true);
  return true;
}

/** Hide it (kept for the next open - the view is entered and left often). */
/**
 * OW-CONFIRM (2026-09-29, the player: "the question of attacking an enemy doesnt stay in overworld it zooms back to your
 * character; the question window's yes and no are not the same buttons as roads and free in the block"): THE VIEW'S OWN
 * QUESTION. A box of the Overworld's own - in its layer, over the map, the view left up under it - its rows and two
 * presses in the block's own faces (the Path switch's buttons, .tview-mode, and the block's stone). Enter or Y answers
 * yes, Escape or N no; while it stands the view's keys are its (the host's overlayUp asks travelViewConfirmOpen), and a
 * press on the map lets it go unanswered. One at a time: a second replaces the first.
 */
let confirmBox = null;   // { el, onYes, onNo, key }
export function travelViewConfirmOpen() { return !!confirmBox; }
export function hideTravelViewConfirm(answer = null) {
  const c = confirmBox;
  if (!c) return;
  confirmBox = null;
  c.el.remove?.();
  c.win?.removeEventListener?.('keydown', c.key, true);
  if (answer === true) c.onYes?.(); else if (answer === false) c.onNo?.();
}
export function showTravelViewConfirm({ rows = [], yes = 'Yes', no = 'No', onYes = null, onNo = null } = {}) {
  if (!root || !parts) return false;
  hideTravelViewConfirm();
  const doc = root.ownerDocument;
  const el = (cls, text = '') => { const n = doc.createElement('div'); n.className = cls; if (text) n.textContent = text; return n; };
  const box = el('tview-confirm');
  box.setAttribute?.('role', 'alertdialog');
  box.setAttribute?.('aria-modal', 'false');
  const words = el('tview-confirm-words');
  rows.forEach((r, i) => words.append(el(i === 0 ? 'tview-confirm-ask' : 'tview-confirm-row', r)));
  const presses = el('tview-moderow tview-confirm-presses');
  const press = (label, answer, lit) => {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = lit ? 'tview-mode on' : 'tview-mode'; b.textContent = label;
    b.onclick = (e) => { e.preventDefault(); hideTravelViewConfirm(answer); };
    return b;
  };
  presses.append(press(yes, true, true), press(no, false, false));
  box.append(words, presses);
  const own = (e) => e.stopPropagation?.();
  box.addEventListener?.('mousedown', own); box.addEventListener?.('pointerdown', own);
  root.append(box);
  const win = doc.defaultView;
  const key = (e) => {
    const k = e.code ?? e.key ?? '';
    const ans = k === 'Enter' || k === 'NumpadEnter' || k === 'KeyY' ? true : k === 'Escape' || k === 'KeyN' ? false : null;
    if (ans === null) return;
    e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.();
    hideTravelViewConfirm(ans);
  };
  win?.addEventListener?.('keydown', key, true);
  confirmBox = { el: box, onYes, onNo, key, win };
  return true;
}

export function hideTravelViewHud() {
  hideTravelViewConfirm(false);   // OW-CONFIRM: the view gone, the question with it - unanswered is no
  undock();   // OW-DECK: a journey that runs on outlives the view - its bar goes home to the top of the screen
  unpublishBlock(root?.ownerDocument);   // OW-NOTICES: the notices back to their own place
  if (root) root.style.display = 'none';
  listenPointer(parts?.canvas?.ownerDocument?.defaultView, false);
  hits = []; setHover(null);
  showMarkTip(null, null, 0, 0);   // SEAT-TIP: no card outlives the view
}

/** Take it down for good (a host teardown). */
export function disposeTravelViewHud() {
  hideTravelViewConfirm();
  undock();
  unpublishBlock(root?.ownerDocument);
  stopModes?.(); stopModes = null;
  stopFilters?.(); stopFilters = null;
  listenPointer(parts?.canvas?.ownerDocument?.defaultView, false);
  setHover(null);
  tipShown = '';   // SEAT-TIP: the card goes with the root
  root?.remove();
  root = null; parts = null; last = null;
  resetMarks();
  dropSprites();
}

/** OW-FILTER: the corner's switches, lit or dimmed. */
let stopFilters = null;
function paintFilters(f) {
  for (const [g, b] of Object.entries(parts?.filterBtns ?? {})) {
    const on = f[g] !== false;
    b.className = on ? 'tview-filter on' : 'tview-filter';
    b.setAttribute?.('aria-pressed', on ? 'true' : 'false');
    b.title = TV_FILTER_TEXT.tip(TV_FILTER_TEXT[g], on);
  }
  // OW-WHO / OW-NODE-KM: the players' switches and the two steps
  const w = travelViewWho();
  for (const [g, b] of Object.entries(parts?.whoBtns ?? {})) {
    const on = w[g] !== false;
    b.className = on ? 'tview-filter on' : 'tview-filter';
    b.setAttribute?.('aria-pressed', on ? 'true' : 'false');
    b.title = TV_WHO_TEXT.tip(TV_WHO_TEXT[g], on);
  }
  if (parts?.renownBtn) parts.renownBtn.textContent = TV_WHO_TEXT.renown(w.renown);
  if (parts?.nodeBtn) parts.nodeBtn.textContent = TV_WHO_TEXT.nodeKm(w.nodeKm);
}
/** SEAT-TIP: the hovered mark's card at the pointer, or none. `tip` is the mark's card or a function that makes it
 *  (a seat's, asked only of the plate under the pointer); its words written only when they change, its box measured
 *  once a card (a layout read each frame forced one), and its place written only when it moves. */
let tipShown = '', tipSize = null, tipAt = '';
function showMarkTip(tip, at, vw, vh) {
  const box = parts?.tip;
  if (!box) return;
  const t = tip && at ? readTip(typeof tip === 'function' ? tip() : tip, { textMax: SEAT_TIP_TEXT_MAX }) : null;
  if (!t) { if (tipShown) { tipShown = ''; tipSize = null; tipAt = ''; box.style.display = 'none'; } return; }
  const key = tipKey(t);
  if (key !== tipShown) {
    tipShown = key; tipSize = null; tipAt = '';
    const d = box.ownerDocument;
    box.replaceChildren?.();
    const line = (cls, text) => { const n = d.createElement('div'); n.className = cls; n.textContent = text; return n; };
    box.append(line('hmtip-title', t.title), ...t.lines.map((l) => line('hmtip-line', l)));
    box.style.display = 'block';
  }
  if (!tipSize || tipSize.vw !== vw) { const r = box.getBoundingClientRect?.() ?? { width: 0, height: 0 }; tipSize = { w: r.width, h: r.height, vw }; }
  const p = placeTip(at.x, at.y, tipSize.w, tipSize.h, vw, vh);
  const pos = `${p.left},${p.top}`;
  if (pos === tipAt) return;
  tipAt = pos;
  box.style.left = `${p.left}px`;
  box.style.top = `${p.top}px`;
}
/** OW-PATH: the switch's lit face. */
let stopModes = null;
function paintModes(m) {
  for (const [k, b] of Object.entries(parts?.modeBtns ?? {})) {
    const on = k === m;
    b.className = on ? 'tview-mode on' : 'tview-mode';
    b.setAttribute?.('aria-pressed', on ? 'true' : 'false');
  }
}

/**
 * OW-DECK (2026-09-29, the player: the Overworld's two bars into one): THE JOURNEY'S BAR, DOCKED. While a journey runs
 * under the view, ui/enhancedTravelControl.js's bar (its time, Map, Camp and Exit - its own listeners stand on the bar)
 * and its word are moved into this strip; when the view goes, they go home to the top of the screen. The panel's root
 * wears `data-docked` so its junction disc hangs under the strip. Asked each frame - one lookup by id.
 */
let docked = { bar: null, msg: null, tp: null };
function undock() {
  const { bar, msg, tp } = docked;
  if (bar && tp?.isConnected) { if (msg) tp.prepend(msg); tp.prepend(bar); }
  else { bar?.remove?.(); msg?.remove?.(); }
  tp?.removeAttribute?.('data-docked');
  docked = { bar: null, msg: null, tp: null };
  if (parts?.idle) parts.idle.style.display = '';   // OW-IDLE: the block keeps its journey section, standing still
  furniture.at = -Infinity;
}
function syncDock(doc) {
  if (!parts?.dock || !doc?.getElementById) return;
  const tp = doc.getElementById('enhanced-travel');
  if (docked.bar && (docked.tp !== tp || !docked.bar.isConnected)) undock();   // the journey ended (its panel torn down) or was made anew
  if (!docked.bar && tp) {
    const bar = tp.querySelector?.('.travelpanel-bar');
    if (bar) {
      const msg = tp.querySelector?.('.travelpanel-msg') ?? null;
      parts.dock.append(bar);
      if (msg) parts.dock.append(msg);
      tp.setAttribute?.('data-docked', '');
      docked = { bar, msg, tp };
      parts.idle.style.display = 'none';
      furniture.at = -Infinity;
    }
  }
}

function resetMarks() { hits = []; drawnKeys = []; canvasDrew = false; canvasSig = []; furniture.at = -Infinity; }
/** PERF-TV: the pointer's place over the page, followed while the readout stands (a plate under it is lit, and the
 *  cursor says it takes a click) - passive, never a handler that could stop the view's own. */
const onPointerMoveHud = (e) => { pointer = { x: e.clientX, y: e.clientY, ui: !!(root && e.target && e.target !== root && root.contains?.(e.target)) }; };   // SEAT-TIP: `ui` - over the block's own controls, not the land
/** AUDIT DEEP2 E10: a finger lifted leaves no hover behind (a drag ended over a plate lit it until the next touch). */
const onPointerUpHud = (e) => { if (e.pointerType === 'touch') pointer = null; };
let pointerWin = null;
function listenPointer(win, on) {
  if (on && win && pointerWin !== win && typeof win.addEventListener === 'function') {
    pointerWin?.removeEventListener?.('pointermove', onPointerMoveHud);
    pointerWin?.removeEventListener?.('pointerup', onPointerUpHud);
    win.addEventListener('pointermove', onPointerMoveHud, { passive: true });
    win.addEventListener('pointerup', onPointerUpHud, { passive: true });
    pointerWin = win;
  } else if (!on && pointerWin) {
    pointerWin.removeEventListener?.('pointermove', onPointerMoveHud);
    pointerWin.removeEventListener?.('pointerup', onPointerUpHud);
    pointerWin = null;
    pointer = null;
  }
}

/**
 * One frame's readout.
 * @param {{ feet: {x:number,y:number,front:boolean}|null, heading: number|null, yaw: number, where: string, keys?: {move?:string, out?:string}|null,
 *   touch?: boolean, fade?: number, trip?: string, route?: Array<{x:number,y:number,front:boolean}|null>,
 *   marks?: Array<{key:string, x:number, y:number, front:boolean, label?:string, sub?:string, kind?:string, pick?:boolean, edge?:boolean}> }} f
 *   `feet` the projected feet, `heading` the chevron's degrees (null keeps the last), `yaw` the camera's heading,
 *   `fade` 0..1 how far risen (the readout comes in with the camera and goes with it); TV2: `trip` the journey's line,
 *   `route` its projected points, and a mark with `pick` takes a click (`hooks.onMark`)
 */
export function updateTravelViewHud(f) {
  if (!parts) return;
  // PERF-TV (AUDIT DEEP2 F11): the screen's size read ONCE a frame, before this frame's writes - and the furniture with it
  const win = parts.canvas?.ownerDocument?.defaultView;
  const vw = win?.innerWidth ?? 0, vh = win?.innerHeight ?? 0, dpr = win?.devicePixelRatio || 1;   // read ONCE, before any write
  syncDock(parts.canvas?.ownerDocument);   // OW-DECK
  measureFurniture(parts.canvas?.ownerDocument, vw, vh);
  const fade = f.fade == null ? 1 : Math.max(0, Math.min(1, f.fade));
  style(root, 'op', 'opacity', fade.toFixed(3));
  if (f.feet?.front) {
    style(parts.you, 'you-d', 'display', '');
    style(parts.you, 'you-t', 'transform', `translate(${Math.round(f.feet.x)}px, ${Math.round(f.feet.y)}px)`);
  } else style(parts.you, 'you-d', 'display', 'none');
  if (f.heading != null) style(parts.chev, 'chev', 'transform', `rotate(${f.heading.toFixed(1)}deg)`);
  const words = `${last.where}|${last.hint}|${last.trip}`;
  put(parts.where, 'where', f.where ?? '');
  put(parts.hint, 'hint', f.touch ? TRAVEL_VIEW_HINTS.touch : travelViewMouseHint(f.keys ?? {}));
  put(parts.trip, 'trip', f.trip ?? '');
  style(parts.trip, 'trip-d', 'display', f.trip ? '' : 'none');
  if (`${last.where}|${last.hint}|${last.trip}` !== words) furniture.at = -Infinity;   // the bar's words changed: its height may have (a line wrapped, a journey's line came) - measured again next frame
  if (parts.line) {
    const d = routePath(f.route ?? [], vw, vh);   // FB0929: cut to the screen read above - a far journey's line dashed off it cost the frame
    if (last.route !== d) {
      last.route = d;
      parts.line.setAttribute('d', d);
      parts.casing.setAttribute('d', d);
    }
  }
  // OW-FILTER: the counts are of every mark (a hidden group still says how many it holds); the canvas draws the shown
  const all = f.marks ?? [];
  const counts = countGroups(all);
  for (const g of TV_FILTER_GROUPS) put(parts.filterNums?.[g], `fn-${g}`, String(counts[g]));
  const fl = travelViewFilters();
  drawMarks(all.filter((m) => markShown(m, fl)), vw, vh, dpr, f.feet?.front ? f.feet : null);   // OW-CROWD: my mark, the badges' nearness (off the picture, its middle)
}

/**
 * PERF-TV (bible/06-Systems/Travel-View.md): THE MARKS ARE DRAWN, NOT BUILT. Every mark - a traveller, a place's
 * plate, a far place (TV5), the journey's end - is painted on ONE canvas under the bar, a shape and a cached label
 * image each; a click on one that takes it (`pick`) is found here (travelViewHudPickAt) and the pointer's hover is
 * followed here. As DOM nodes each moving mark cost a style recalculation every frame - 20 plates and 64 travellers
 * 5.8 ms in the browser probe before, the screen's size read after each held mark's writes forcing a layout apiece -
 * and a picture that did not change is not drawn again.
 */
export const TRAVEL_VIEW_MARK_COLORS = Object.freeze({
  traveller: '#4e7f72', party: '#6fb86a', bone: '#e9e4d9', brass: '#c08a3e',   // enhancedStyle.js --verdigris, --bone, --brass; PARTY_MARK_CSS
  raider: '#bf2a1f',   // OWS3: Warm Ashes' raiders - enhancedStyle.js --cinnabar
  plate: 'rgba(14,16,19,0.72)', plateEdge: 'rgba(192,138,62,0.35)',
  lair: '#b0443a',   // TV6: an undiscovered dungeon - a lair's dull red
  band: '#e0503c',   // TV7: a roaming band - the enemy's red
  camp: '#d9622b',   // OW6: a camp, a pack or a band stood - an ember's red-orange, apart from the roaming bands
  wayfarer: '#c9a96e',   // LW3: the living world's parties on the road - road dust, apart from a player's verdigris
  bounty: '#0b0b0b', bountyRim: '#e6dccb',   // BOUNTY-OVERWORLD: a held bounty's hunt - BLACK, the maps' own circle (ui/bountyMapMark.js), with the legend's pale rim so it reads on dark ground
});
/** The plates' face - the stylesheet's --display, as the DOM plates had it. */
export const TRAVEL_VIEW_PLATE_FONT = "'Cormorant', Georgia, serif";
/** AUDIT DEEP2 E11: the other labels' face - the stylesheet's --data, as the DOM labels had it (a bare sans-serif was
 *  the canvas's own default, not the enhanced face). */
export const TRAVEL_VIEW_LABEL_FONT = "'Barlow Semi Condensed', system-ui, sans-serif";
const SPRITES_MAX = 512;
/** AUDIT NAMES N1-8: and the pixels they may hold between them (a player's badge is 3-4x a bare label's; 512 of them
 *  at a phone's dpr 3 came to ~95 MB) - 6 M pixels, ~24 MB. */
const SPRITE_PIXELS_MAX = 6e6;
/** AUDIT NAMES N1-1: the players' badges made new in one frame - a busy region's first frame (or a font arriving) made
 *  every one at once, a 70-175 ms stall; the rest wear their bare name for a frame or a few, and are made after. */
export const BADGE_BUILDS_PER_FRAME = 16;
const sprites = new Map();
let spritePixels = 0;
let badgeBuilds = 0;   // left this frame
/** A sprite kept, the oldest let go first while the count or the pixels are past their caps (one at a time: a clear()
 *  redrew every label in one frame). */
function keepSprite(key, sp) {
  const px = sp.c.width * sp.c.height;
  while (sprites.size && (sprites.size >= SPRITES_MAX || spritePixels + px > SPRITE_PIXELS_MAX)) {
    const k = sprites.keys().next().value, old = sprites.get(k);
    sprites.delete(k);
    spritePixels -= old.c.width * old.c.height;
  }
  sprites.set(key, sp);
  spritePixels += px;
  return sp;
}
/** Every sprite let go (a font arrived, the readout disposed). */
function dropSprites() { sprites.clear(); spritePixels = 0; }
let hits = [];          // this frame's pickable marks, drawn last on top: { key, x0, y0, x1, y1 }
let drawnKeys = [];
let canvasDrew = false;
let canvasSig = [];     // last frame's picture, as drawn
let hoverKey = null;
let pointer = null;     // { x, y } the pointer over the page, while the readout is shown
/** OW-HUBS: a carriage town's wheel on the Overworld, its radius (px). */
export const TV_WHEEL_R = 5.5;
/** OWS1: how far a ship's sail stands over its point (px) - a name worn above it stands above the sail. */
export const SHIP_MARK_RISE = 9;
/**
 * OWS1 (2026-09-28, the player's ask: "being able to see other players sailing in the overworld"): A SHIP'S MARK - a
 * hull under a sail, upright as a map draws its ships (Mount & Blade's parties at sea), in the look's colour, where the
 * dot stands. A traveller whose kind says `ship` (their region mark's way) is drawn so, in the picture; one held at an
 * edge keeps the arrow that points to them.
 */
export function drawShipMark(g, x, y) {
  g.beginPath();   // the hull: the deck's line, the keel narrower
  g.moveTo(x - 7, y + 1); g.lineTo(x + 7, y + 1); g.lineTo(x + 4, y + 5); g.lineTo(x - 4, y + 5); g.closePath();
  g.fill(); g.stroke();
  g.beginPath();   // the sail, off the mast's line
  g.moveTo(x - 1, y - SHIP_MARK_RISE); g.lineTo(x - 1, y - 1); g.lineTo(x + 6, y - 1); g.closePath();
  g.fill(); g.stroke();
}
/** OWS1: a mark at sea, by its kind. */
export const isShipKind = (m) => /\bship\b/.test(m.kind ?? '');
/** A mark's look, by its kind's first word. */
const lookOf = (m) => {
  const k = (m.kind ?? '').split(' ')[0];
  if (k === 'bounty') return k;   // BOUNTY-OVERWORLD: a held bounty's hunt
  if (k === 'gather') return k;   // GATHER-OW: a profession's group of nodes
  if (k === 'wayfarer') return k;   // LW3: the living world's parties on the road
  return k === 'place' || k === 'far' || k === 'dest' || k === 'target' || k === 'party' || k === 'lair' || k === 'band' || k === 'raider' || k === 'camp' ? k : 'traveller';
};
/** OW-THEME (2026-09-28, Mac: "The overworld ui needs to follow enhanced ui theme"): the plates' stone - the Enhanced
 *  (Plus) theme's own `--slate`, at the plates' alpha; the kit's plate where the page names none. */
export function themePlate(doc) {
  const v = doc?.defaultView?.getComputedStyle?.(doc.documentElement)?.getPropertyValue?.('--slate')?.trim?.() ?? '';
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return TRAVEL_VIEW_MARK_COLORS.plate;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0.78)`;
}
let plateFill = /** @type {string} */ (TRAVEL_VIEW_MARK_COLORS.plate);
/** OW-PLUS-FACE (2026-09-29, the player: "the fonts of the pois need to be enhanced plus fonts"): under Enhanced Plus
 *  (its sheet on the page, ui/enhancedPlusStyle.js PLUS_STYLE_ID) the plates, labels and distances wear the kit's pixel
 *  face (PIXEL_STACK - the names beside them already did) with its hard one-pixel shadow, not the serif and the blur. */
export const TV_PLUS_SHEET_ID = 'enhanced-plus-style';
let plusFace = false;
/** A label's image, made once (its shadow or its plate baked in) and kept by what it shows. */
function labelSprite(doc, text, look, size, journey, hover, dpr, hub = false) {
  const key = `${plusFace ? 'px' : 'cl'}|${look}|${size}|${journey ? 1 : 0}|${hover ? 1 : 0}|${hub ? 1 : 0}|${dpr}|${text}`;   // OW-HUBS: a carriage town's plate is its own
  let sp = sprites.get(key);
  if (sp) { sprites.delete(key); sprites.set(key, sp); return sp; }   // AUDIT DEEP2 E12: the newest at the back - the oldest goes first
  const c = doc.createElement('canvas');
  const x = c.getContext?.('2d');
  if (!x) return null;
  const plate = look === 'place' || look === 'far';
  const font = plusFace ? `${size}px ${PIXEL_STACK}`   // OW-PLUS-FACE
    : plate ? `${size}px ${TRAVEL_VIEW_PLATE_FONT}` : `${size}px ${TRAVEL_VIEW_LABEL_FONT}`;   // `sub`: a plate's second line (TV5's distance)
  x.font = font;
  const tw = x.measureText(text).width;
  const aw = journey ? x.measureText(' →').width : 0;
  const padX = plate ? 7 : 4, padY = plate ? 3 : 3;
  const w = Math.ceil(tw + aw + padX * 2), h = Math.ceil(size + padY * 2 + 2);
  c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  x.scale(dpr, dpr);
  x.font = font; x.textBaseline = 'top';
  const C = TRAVEL_VIEW_MARK_COLORS;
  if (plate) {
    x.fillStyle = plateFill; x.fillRect(0.5, 0.5, w - 1, h - 1);
    x.strokeStyle = hover || hub ? C.brass : C.plateEdge; x.lineWidth = hub ? 1.5 : 1; x.strokeRect(0.5, 0.5, w - 1, h - 1);   // OW-HUBS: a carriage town's plate edged in brass
    x.fillStyle = hover || look === 'far' ? C.brass : C.bone;
    if (plusFace) { x.shadowColor = '#050608'; x.shadowBlur = 0; x.shadowOffsetX = 1; x.shadowOffsetY = 1; }   // OW-PLUS-FACE: the kit's cut shadow
  } else if (plusFace) {
    x.shadowColor = '#050608'; x.shadowBlur = 0; x.shadowOffsetX = 1; x.shadowOffsetY = 1;   // OW-PLUS-FACE
    x.fillStyle = TV_KIN_COLORS[look.slice(4)] && look.startsWith('kin-') ? TV_KIN_COLORS[look.slice(4)] : look === 'dest' ? C.brass : look === 'sub' ? 'rgba(233,228,217,0.8)' : look === 'raider' ? C.raider : C.bone;   // OW-KIN
  } else {
    x.shadowColor = '#000'; x.shadowBlur = 3; x.shadowOffsetY = 1;
    x.fillStyle = TV_KIN_COLORS[look.slice(4)] && look.startsWith('kin-') ? TV_KIN_COLORS[look.slice(4)] : look === 'dest' ? C.brass : look === 'sub' ? 'rgba(233,228,217,0.8)' : look === 'raider' ? C.raider : C.bone;   // OWS3: "Pirates" in their colour; OW-KIN: a friend's, a guild-mate's name in theirs
  }
  x.fillText(text, padX, padY + 1);
  if (journey) { x.fillStyle = C.brass; x.fillText(' →', padX + tw, padY + 1); }
  return keepSprite(key, { c, w, h });
}
/** OVERWORLD NAMES: the in-play name face's colours (ui/nameLayer.js's .dfname-* rules), for the canvas. */
export const TRAVEL_VIEW_NAME_COLORS = Object.freeze({
  name: '#e9e4d9', party: '#73ff73',   // the bone a stranger's name is; net/social.js PARTY_GREEN_CSS for my party's
  renown: '#f2c46b', renownBack: 'rgba(14,16,19,0.78)', renownEdge: 'rgba(242,196,107,0.8)',   // .dfname-renown
  guild: '#a9c4dd',   // .dfname-guild
});
/** AUDIT HERALDRY H4: where a guild's heraldry is found by its tag - the host's (scenes/world.js seatArmsOf, the one
 *  ui/nameLayer.js frames its tags with) - or null. */
let armsOf = null;
/** AUDIT HERALDRY H4: the lookup the name face frames a guild's tag with, as in play (ui/nameLayer.js setArmsOf). */
export function setTravelViewArmsOf(fn) { armsOf = typeof fn === 'function' ? fn : null; }
/** AUDIT HERALDRY H4: a badge's guild's heraldry, where the host knows it - or null. */
const badgeArms = (b) => (guildTagText(b?.gt) && armsOf ? heraldryOf(armsOf(b.gt)) : null);
/** The badge's own words and marks, off a mark's `badge` (the peer's, as the relay stamped them). */
function badgeParts(b) {
  return { lv: renownText(b?.lv), gt: guildTagText(b?.gt), title: titleBadge(b), glyphs: glyphBadges(b), rb: ribbonColours(b?.rb), arms: badgeArms(b) };
}
/** Its key in the sprite cache and the frame's picture - H4: its tag's heraldry too, so new arms make a new sprite. */
const badgeKey = (b) => {
  if (!b) return '';
  const h = badgeArms(b);
  return `${b.title ?? ''}|${(b.glyphs ?? []).join(',')}|${b.lv ?? ''}|${b.gt ?? ''}|${(Array.isArray(b.rb) ? b.rb : []).join('/')}|${h ? heraldryKey(h) : ''}`;   // AUDIT GUILD2 G12: the whole arms
};
/** AUDIT HERALDRY H4: the tag's frame as the in-play face's (.dfname-guild.armed) - a dark plate edged in the guild's
 *  border colour, the shield at its left - px (the shield's width a share of the tag's size). */
export const TRAVEL_VIEW_ARMS = Object.freeze({ back: 'rgba(14,16,19,0.78)', shield: 0.82, pad: 2, gap: 2 });
/** AUDIT-SEATS: a Season's banner ribbon under the row - its field's band and its border's edge, px. */
export const TRAVEL_VIEW_RIBBON = Object.freeze({ band: 2, edge: 1, gap: 1 });
/**
 * OVERWORLD NAMES (2026-09-28, Mac: "Full, like in play"): A PLAYER'S NAME AS IT READS OVER THEIR HEAD IN PLAY - the
 * title its own line above, in its own colour (a gradient title across its letters); under it one row centred as the
 * DOM face centres it: the Renown in its amber box, the name (my party's in its green), the guild's tag in steel,
 * the glyphs in theirs. One image, made once and kept by what it shows.
 */
function badgeSprite(doc, m, size, party, dpr, bk = badgeKey(m.badge)) {
  const b = m.badge, journey = /\bjourney\b/.test(m.kind ?? '');
  const key = `badge|${size}|${party ? 1 : 0}|${m.kin ?? ''}|${journey ? 1 : 0}|${dpr}|${m.label}|${bk}`;   // OW-KIN: a friend made is drawn anew
  const sp = sprites.get(key);
  if (sp) { sprites.delete(key); sprites.set(key, sp); return sp; }
  if (badgeBuilds <= 0) return null;   // N1-1: this frame's are made - the name alone until the next
  badgeBuilds--;
  const c = doc.createElement('canvas');
  const x = c.getContext?.('2d');
  if (!x) return null;
  const P = badgeParts(b), N = TRAVEL_VIEW_NAME_COLORS;
  const small = Math.max(8, Math.round(size * 0.8));
  const rowFont = `${size}px ${PIXEL_STACK}`, smallFont = `${small}px ${PIXEL_STACK}`;   // N1-4: the face names wear in play
  x.font = smallFont;
  const lvW = P.lv ? Math.max(small * 1.2, x.measureText(P.lv).width + 6) : 0;
  const shieldW = P.gt && P.arms ? Math.round(small * TRAVEL_VIEW_ARMS.shield) : 0;   // AUDIT HERALDRY H4
  const gtW = P.gt ? x.measureText(P.gt).width + (shieldW ? shieldW + TRAVEL_VIEW_ARMS.gap + 2 * TRAVEL_VIEW_ARMS.pad : 0) : 0;
  const titleW = P.title ? x.measureText(P.title.text).width : 0;
  x.font = rowFont;
  const nameW = x.measureText(m.label ?? '').width, arrowW = journey ? x.measureText(' →').width : 0;
  const gs = Math.round(size * 0.95), gap = 4;
  const glyphW = P.glyphs.length ? P.glyphs.length * gs + (P.glyphs.length - 1) * 2 : 0;
  const rowW = lvW + (lvW ? gap : 0) + nameW + arrowW + (gtW ? gap + gtW : 0) + (glyphW ? gap + glyphW : 0);
  const titleH = P.title ? small + 3 : 0, rowH = size + 6;
  const ribbonH = P.rb ? TRAVEL_VIEW_RIBBON.gap + TRAVEL_VIEW_RIBBON.band + TRAVEL_VIEW_RIBBON.edge : 0;   // AUDIT-SEATS
  const w = Math.ceil(Math.max(rowW, titleW) + 8), h = Math.ceil(titleH + rowH + 2 + ribbonH);
  c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  x.scale(dpr, dpr);
  x.textBaseline = 'top';
  x.shadowColor = '#000'; x.shadowBlur = 3; x.shadowOffsetY = 1;
  if (P.title) {   // above the name, in its own colour - never the party's green (ACC3)
    x.font = smallFont;
    const tx = (w - titleW) / 2;
    if (P.title.gradient && typeof x.createLinearGradient === 'function') {
      // AUDIT NAMES N1-2: the DOM face's paint (titlePaint, AUDIT A4/A5) - no blurred shadow, which drowned the black
      // half on dark ground ("Sh" unseen); an EDGE outside the letters instead, a pixel of the title's own colour right
      // and below and a black one under that, and the gradient over them
      x.shadowBlur = 0; x.shadowOffsetY = 0;
      const edge = cssRgba(P.title.rgba) ?? N.name;
      x.fillStyle = '#000'; x.fillText(P.title.text, tx, 3);
      x.fillStyle = edge; x.fillText(P.title.text, tx + 1, 1); x.fillText(P.title.text, tx, 2);
      const gr = x.createLinearGradient(tx, 0, tx + titleW, 0);
      P.title.gradient.forEach((st, i, all) => gr.addColorStop(all.length > 1 ? i / (all.length - 1) : 0, cssRgba(st)));
      x.fillStyle = gr;
      x.fillText(P.title.text, tx, 1);
      x.shadowBlur = 3; x.shadowOffsetY = 1;
    } else {
      x.fillStyle = P.title.rgba ? cssRgba(P.title.rgba) : N.name;
      x.fillText(P.title.text, tx, 1);
    }
  }
  let cx = (w - rowW) / 2;
  const ry = titleH + 3;
  if (P.rb) {   // AUDIT-SEATS: a Season's banner ribbon under the row, the row's width - its field, edged in its border
    const R = TRAVEL_VIEW_RIBBON, by = ry + size + 3 + R.gap;
    x.shadowBlur = 0; x.shadowOffsetY = 0;
    x.fillStyle = P.rb.field; x.fillRect(cx, by, rowW, R.band);
    x.fillStyle = P.rb.border; x.fillRect(cx, by + R.band, rowW, R.edge);
    x.shadowBlur = 3; x.shadowOffsetY = 1;
  }
  if (P.lv) {   // the Renown, boxed, left of the name
    x.shadowBlur = 0; x.shadowOffsetY = 0;
    x.fillStyle = N.renownBack; x.fillRect(cx, ry - 1, lvW, size + 2);
    x.strokeStyle = N.renownEdge; x.lineWidth = 1; x.strokeRect(cx + 0.5, ry - 0.5, lvW - 1, size + 1);
    x.shadowBlur = 3; x.shadowOffsetY = 1;   // N1-3: the number wears the row's shadow, as in play
    x.font = smallFont; x.fillStyle = N.renown;
    x.fillText(P.lv, cx + (lvW - x.measureText(P.lv).width) / 2, ry + (size - small) / 2);
    cx += lvW + gap;
  }
  x.font = rowFont; x.fillStyle = party ? N.party : (TV_KIN_COLORS[m.kin] ?? N.name);   // OW-KIN (FIELD BUGS 2026-10-04e): a friend's name in the friends' blue, a guild-mate's in violet - my party's stays its green
  x.fillText(m.label ?? '', cx, ry);
  cx += nameW;
  if (journey) { x.fillStyle = TRAVEL_VIEW_MARK_COLORS.brass; x.fillText(' →', cx, ry); cx += arrowW; }
  if (P.gt && shieldW) {   // AUDIT HERALDRY H4: framed in its guild's heraldry - the plate, its edge, the shield, then the tag
    const A = TRAVEL_VIEW_ARMS, px = cx + gap;
    x.shadowBlur = 0; x.shadowOffsetY = 0;
    x.fillStyle = A.back; x.fillRect(px, ry - 1, gtW, size + 2);
    x.strokeStyle = heraldryColourOf(P.arms.border)?.hex ?? N.guild; x.lineWidth = 1; x.strokeRect(px + 0.5, ry - 0.5, gtW - 1, size + 1);
    drawShield(x, P.arms, px + A.pad, ry + (size - shieldW * 1.04) / 2, shieldW);
    x.shadowBlur = 3; x.shadowOffsetY = 1;
    x.font = smallFont; x.fillStyle = N.guild; x.fillText(P.gt, px + A.pad + shieldW + A.gap, ry + (size - small) / 2); cx += gap + gtW;
  } else if (P.gt) { x.font = smallFont; x.fillStyle = N.guild; x.fillText(P.gt, cx + gap, ry + (size - small) / 2); cx += gap + gtW; }
  if (glyphW && typeof globalThis.Path2D === 'function') {   // each in its own colour, as the DOM face draws them
    cx += gap;
    for (const g of P.glyphs) {
      const path = new globalThis.Path2D(g.path);
      x.save(); x.translate(cx, ry + (size - gs) / 2); x.scale(gs / 16, gs / 16);
      const col = g.rgba ? cssRgba(g.rgba) : N.name;
      if (g.gradient && typeof x.createLinearGradient === 'function') {
        const gr = x.createLinearGradient(0, 0, 16, 0);
        g.gradient.forEach((st, i, all) => gr.addColorStop(all.length > 1 ? i / (all.length - 1) : 0, cssRgba(st)));
        x.fillStyle = gr; x.fill(path); x.strokeStyle = col; x.lineWidth = GLYPH_EDGE_W; x.lineJoin = 'round'; x.stroke(path);
      } else if (GLYPH_STROKE[g.key]) { x.strokeStyle = col; x.lineWidth = GLYPH_NAME_W; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(path); }
      else { x.fillStyle = col; x.fill(path); }
      // N1-3: a glyph's DETAIL (the wolf's red eye) over it in its own colour, as the in-play drawing has it
      if (g.detail?.path) { x.fillStyle = cssRgba(g.detail.rgba) ?? col; x.fill(new globalThis.Path2D(g.detail.path)); }
      x.restore();
      cx += gs + 2;
    }
  }
  return keepSprite(key, { c, w, h });
}
/** The stroke a stroked glyph is drawn at over a name (ui/nameLayer.js's glyphSvgNode width). */
const GLYPH_NAME_W = 1.6;
function drawMarks(marks, vw, vh, dpr, feet = null) {
  const cv = parts.canvas;
  drawnKeys = marks.map((m) => m.key);
  if (!cv || (!marks.length && !canvasDrew)) { hits = []; return; }
  const g = cv.getContext?.('2d');
  if (!g) return;
  const bw = Math.round(vw * dpr), bh = Math.round(vh * dpr);
  const doc = cv.ownerDocument;
  badgeBuilds = BADGE_BUILDS_PER_FRAME;
  // where each mark stands this frame, and what is under the pointer (the plates on top, the last drawn first)
  const placed = [];
  const nextHits = [];
  for (const m of marks) {
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;   // AUDIT DEEP2 E: one NaN poisoned its whole edge's run
    const held = m.edge ? (edgeHold(m, vw, vh, TV_EDGE_MARGIN, furniture.top, furniture.foot) ?? (m.front ? notchHold(m, vh) : null)) : null;   // OW-EDGES
    if (!m.front && !held) continue;
    const at = held ?? m;
    placed.push({ m, held, x: Math.round(at.x), y: Math.round(at.y), look: lookOf(m), side: -1, bk: '', sp: null });
  }
  // OW-CROWD: the region's travellers decluttered - a crowd one mark, the edge's arrows together, the badges the nearest's
  const kept = declutterTravellers(placed, feet ?? { x: vw / 2, y: vh / 2 });
  placed.length = 0;
  placed.push(...kept);
  for (const q of placed) {
    // AUDIT NAMES N1-5: a player's badge made (or found) BEFORE the layout, so every box is the drawn one's - the
    // estimate ran 30-75% wide and sent a lone titled player ahead to a side, and two that fitted to an even spread.
    // AUDIT OW-CROWD: and AFTER the crowds are folded - the frame's sixteen builds were spent on badges a crowd or the
    // cap then dropped, and a crowd's arrow was laid out by its lead's badge, not its own words
    if (q.m.badge) { q.bk = badgeKey(q.m.badge); q.sp = badgeSprite(doc, q.m, q.held ? 11 : 12, q.look === 'party', dpr, q.bk); }
    if (q.held) q.side = heldSide(q, vw);
  }
  spreadHeld(placed, vw, vh);
  // OW-EDGES: along the top and the foot, each held mark at the edge - stepped in only where its box meets a notch
  for (const q of placed) {
    if (!q.held || q.side < 2) continue;
    const b = markBox(q, vw);
    const d = notchDepth(q.side === 2 ? furniture.topNotch : furniture.footNotch, b.x0, b.x1);
    if (q.side === 2) q.y = Math.round(Math.max(TV_EDGE_MARGIN, d));
    else q.y = Math.round(vh - Math.max(TV_EDGE_MARGIN, d));
  }
  // OW-EDGES (2026-09-29, the player: "i hope the floating pois marker dont float into that compass"): a mark IN the picture
  // whose box meets the HUD's compass or its hotbar and bars (a notch) is drawn faint - it is where its place is, and still
  // takes its click, but it never lies over the compass's letters or the slots; clear of them, whole again
  const N = furniture.notice;
  for (const q of placed) {
    q.fade = false;
    const b = markBox(q, vw);
    if (N && b.x1 > N.x0 && b.x0 < N.x1 && b.y1 > N.y0 && b.y0 < N.y1) { q.fade = true; continue; }   // OW-NOTICES: under a notice
    if (q.held) continue;
    if (b.y0 < notchDepth(furniture.topNotch, b.x0, b.x1) || b.y1 > vh - notchDepth(furniture.footNotch, b.x0, b.x1)) q.fade = true;
  }
  let hover = null;
  for (let i = placed.length - 1; i >= 0 && pointer && !pointer.ui; i--) {   // SEAT-TIP: the block's controls over a plate are the block's - no plate lit, no card
    const q = placed[i];
    if (!q.m.pick) continue;
    const b = pickBox(q, vw);   // BOUNTY-SNAP
    if (pointer.x >= b.x0 && pointer.x <= b.x1 && pointer.y >= b.y0 && pointer.y <= b.y1) { hover = q.m.key; break; }
  }
  setHover(hover);
  showMarkTip(hover ? placed.find((q) => q.m.key === hover)?.m.tip ?? null : null, pointer, vw, vh);   // SEAT-TIP: a seat's card while its plate is under the pointer
  // the picture this frame would draw: unchanged (a camera at rest), the canvas already shows it
  const sig = [bw, bh, hover ?? ''];
  for (const q of placed) sig.push(q.m.key, q.x, q.y, q.held ? Math.round(q.held.angle) : 999, q.m.label ?? '', q.m.sub ?? '', q.m.kind ?? '', q.bk, q.fade ? 1 : 0, q.m.kin ?? '', q.m.hub ? 1 : 0);   // OW-KIN, OW-HUBS
  for (const q of placed) if (q.m.pick) nextHits.push({ key: q.m.key, ...pickBox(q, vw) });   // BOUNTY-SNAP: a bounty's on its ring alone
  hits = nextHits;
  sayPlaces(placed);
  if (sig.length === canvasSig.length && sig.every((v, i) => v === canvasSig[i])) return;
  canvasSig = sig;
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, vw, vh);
  canvasDrew = false;
  const C = TRAVEL_VIEW_MARK_COLORS;
  const names = [];   // AUDIT NAMES N2-4: the players' names drawn in the picture so far this frame (px boxes)
  let unmade = false;   // N1-1: a badge not made this frame - its name alone, and the picture drawn again next frame
  for (const q of placed) {
    const { m, held, x, y, look } = q;
    g.globalAlpha = q.fade ? TV_UNDER_HUD_ALPHA : 1;   // OW-EDGES: faint where it would lie over the compass or the hotbar
    const color = look === 'gather' ? (m.color ?? C.brass) : look === 'party' ? C.party : look === 'traveller' ? C.traveller : look === 'lair' ? C.lair : look === 'band' ? C.band : look === 'raider' ? C.raider : look === 'camp' ? C.camp : look === 'bounty' ? C.bounty : look === 'wayfarer' ? (/\bfight\b/.test(m.kind ?? '') ? C.band : C.wayfarer) : C.brass;   // OWS3: a raider in the cinnabar; OW6: a camp in the ember; LW3: a party on the road in its dust (LW4: beset, in the bands' red)
    g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 1;
    if (held) {   // the arrow, turned the way it lies (0 up, clockwise)
      g.save(); g.translate(x, y); g.rotate((held.angle * Math.PI) / 180);
      if (look === 'bounty') g.strokeStyle = C.bountyRim;   // BOUNTY-OVERWORLD: a black arrow needs the pale edge
      // AUDIT DEEP2 E5: a NOTCHED head - a near-equilateral triangle read the same turned a third either way
      g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 2); g.lineTo(-7, 7); g.closePath(); g.fill(); g.stroke();
      g.restore();
    } else if (look === 'target') {
      g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = C.brass; g.stroke();
    } else if (isShipKind(m)) {
      drawShipMark(g, x, y);
    } else if (look === 'bounty') {   // BOUNTY-OVERWORLD: a hunt - a ring round a dot, the held map's circle
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = C.bountyRim; g.stroke();
      g.lineWidth = 2; g.strokeStyle = color; g.stroke();
      g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.lineWidth = 1; g.strokeStyle = C.bountyRim; g.fill(); g.stroke();
    } else if (look === 'gather') {   // GATHER-OW: a profession's group - a gem's diamond in its colour, a ring of dark
      g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x, y + 7); g.lineTo(x - 5, y); g.closePath(); g.fill(); g.stroke();
    } else if (look === 'camp') {   // OW6: a camp - a tent's peak, not a band's dot
      g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y + 5); g.lineTo(x - 6, y + 5); g.closePath(); g.fill(); g.stroke();
    } else if ((look === 'place' || look === 'far') && m.hub) {   // OW-HUBS: a carriage town - its wheel, brass on a dark edge
      wheelPath(g, x, y, TV_WHEEL_R);
      g.lineWidth = 3; g.strokeStyle = '#000'; g.stroke();
      g.lineWidth = 1.5; g.strokeStyle = C.brass; g.stroke();
    } else if (look === 'wayfarer') {   // LW3: a party on the road - a pack's square, a caravan's the larger
      const r = /\bcaravan\b/.test(m.kind ?? '') ? 5 : 3.5;
      g.beginPath(); g.rect(x - r, y - r, r * 2, r * 2); g.fill(); g.stroke();
    } else {
      const r = look === 'dest' || /\bcrowd\b/.test(m.kind ?? '') ? 7 : look === 'place' || look === 'far' ? 4 : 5;   // OW-CROWD: a crowd's dot the larger
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    if (!m.label) continue;
    const plate = look === 'place' || look === 'far';
    if (m.badge && !q.sp) unmade = true;
    const sp = q.sp   // OVERWORLD NAMES: a player, named as in play
      ?? labelSprite(doc, m.label, look === 'traveller' && m.kin ? `kin-${m.kin}` : look, held && !plate ? 11 : plate ? 13 : 12, /\bjourney\b/.test(m.kind ?? ''), m.key === hover, dpr, plate && !!m.hub);   // OW-KIN; OW-HUBS
    if (!sp) continue;
    const sb = m.sub ? labelSprite(doc, m.sub, 'sub', 11, false, false, dpr) : null;   // TV5: a far place's distance, under its plate
    // held at the foot, the label stands ABOVE its arrow - under it is the bar (EDGE-FURNITURE)
    // in the picture, a plate with a second line stands higher by it - the distance never across its own dot (AUDIT DEEP2 E9)
    // AUDIT NAMES N1-7: a player in the picture wears their name ABOVE their head, as in play (NAME1: never over it) -
    // under the point it lay across the body it named
    let ly = q.side === 3 ? y - 10 - sp.h - (sb ? sb.h : 0) : plate && !held ? y - 24 - sp.h / 2 - (sb ? sb.h : 0) : m.badge && !held ? y - (isShipKind(m) ? SHIP_MARK_RISE + 2 : NAME_ABOVE) - sp.h : y + (held ? 10 : 7);   // OWS1: over a ship, over its sail
    if (m.badge && !held) ly = clearOfNames(names, inScreen(x - sp.w / 2, sp.w, vw), ly, sp.w, sp.h);
    g.drawImage(sp.c, inScreen(x - sp.w / 2, sp.w, vw), ly, sp.w, sp.h);   // a long name held at a side edge stays on the screen
    if (sb) {
      g.drawImage(sb.c, inScreen(x - sb.w / 2, sb.w, vw), ly + sp.h, sb.w, sb.h);
    }
    canvasDrew = true;
  }
  g.globalAlpha = 1;
  canvasDrew = canvasDrew || placed.length > 0;
  if (unmade) canvasSig = [];
}
/**
 * OW-CROWD (2026-10-02, Mac: "reduce the overwhelming player markers that flood the screen ... I like it, dont get me
 * wrong, but there must be a way to make it where its not overwhelming"): THE REGION'S TRAVELLERS, DECLUTTERED, as they
 * are placed on the screen. Travellers drawn within TV_CROWD_PX of one another are one mark, a dot named for how many
 * ("4 travellers"), at their middle; arrows held at the screen's edge within TV_CROWD_EDGE_PX of one another one arrow,
 * the nearest's, named the same; and of the travellers still drawn alone in the picture, only the TV_BADGES_MAX nearest
 * my own mark wear their badge (the title, the Renown, the guild's tag, the glyphs) - the rest, and every arrow at the
 * edge (AUDIT OW-CROWD), their name alone. The badges are made after (drawMarks), for the marks still wearing one. My
 * party is never folded nor stripped (it is not a traveller's mark), nor is anything else. Pure over the placements:
 * `{ m, x, y, held, look, side, bk, sp }`, in their own order (a crowd where its first member stood - AUDIT OW-CROWD).
 * @param {Array<any>} placed @param {{ x: number, y: number }} feet my mark on the screen
 */
export function declutterTravellers(placed, feet) {
  const isTraveller = (q) => (q.m.kind ?? '').split(' ')[0] === 'traveller';
  const near = (q) => Math.hypot(q.x - feet.x, q.y - feet.y);
  const order = new Map(placed.map((q, i) => [q, i]));   // AUDIT OW-CROWD: the marks' own order kept - my party over a crowd
  const out = [], trav = [];
  for (const q of placed) (isTraveller(q) ? trav : out).push(q);
  trav.sort((a, b) => near(a) - near(b) || (a.m.key < b.m.key ? -1 : a.m.key > b.m.key ? 1 : 0));
  /** @type {Array<{ held: boolean, x: number, y: number, members: any[] }>} */
  const groups = [];
  for (const q of trav) {
    const held = !!q.held, r = held ? TV_CROWD_EDGE_PX : TV_CROWD_PX;
    const g = groups.find((c) => c.held === held && Math.hypot(c.x - q.x, c.y - q.y) <= r);   // held to its first member
    if (g) g.members.push(q);
    else groups.push({ held, x: q.x, y: q.y, members: [q] });
  }
  let badges = 0;
  for (const g of groups) {
    const lead = g.members[0];
    if (g.members.length === 1) {
      if (lead.m.badge) {
        // past the nearest few, or held at the edge (AUDIT OW-CROWD: a region's lone arrows wore every badge, uncapped,
        // round the screen): the name alone - the badge comes with them into the picture
        if (!lead.held && badges < TV_BADGES_MAX) badges++;
        else { lead.m = { ...lead.m, badge: undefined }; lead.sp = null; lead.bk = ''; }
      }
      out.push(lead);
      continue;
    }
    const n = g.members.length;
    const x = g.held ? lead.x : Math.round(g.members.reduce((a, q) => a + q.x, 0) / n);
    const y = g.held ? lead.y : Math.round(g.members.reduce((a, q) => a + q.y, 0) / n);
    const ship = g.members.every((q) => isShipKind(q.m));
    const crowd = { ...lead, x, y, bk: '', sp: null,
      m: { key: `crowd:${lead.m.key}`, label: crowdLabel(n), kind: `traveller crowd${ship ? ' ship' : ''}`, edge: lead.m.edge, front: true, x: lead.m.x, y: lead.m.y } };
    order.set(crowd, Math.min(...g.members.map((q) => order.get(q))));   // drawn where its first member was
    out.push(crowd);
  }
  return out.sort((a, b) => order.get(a) - order.get(b));
}
/** OW-CROWD: travellers drawn this near one another (px) are one mark; arrows at the edge this near, one arrow; the
 *  travellers alone in the picture who wear their badge, the nearest my mark. */
export const TV_CROWD_PX = 36;
export const TV_CROWD_EDGE_PX = 56;
export const TV_BADGES_MAX = 6;
/** OW-CROWD: a crowd's words. */
export const crowdLabel = (n) => `${n} travellers`;
/** A player's name in the picture: its foot this far above their head's point (px) - the dot's radius and air. */
const NAME_ABOVE = 8;
/** The room between two players' names stacked in the picture (px). */
const NAME_STACK_GAP = 2;
/**
 * AUDIT NAMES N2-4: A PLAYER'S NAME IN THE PICTURE STANDS CLEAR OF THOSE DRAWN BEFORE IT. From the view's height a
 * party side by side projects a few pixels apart (heads 1.5 m apart are 2-7 px at 1080p), and their names printed one
 * over another, unreadable. Each goes UP past any it would cross - a stack over the group, in the marks' own order
 * (the room's, stable frame to frame) - and is kept for the ones after it. Every input is in the picture's signature,
 * so a picture at rest keeps its stack.
 * @param {{ x0: number, x1: number, y0: number, y1: number }[]} boxes
 */
function clearOfNames(boxes, x, y, w, h) {
  for (let moved = true; moved;) {
    moved = false;
    for (const b of boxes) if (x < b.x1 && x + w > b.x0 && y < b.y1 && y + h > b.y0) { y = b.y0 - NAME_STACK_GAP - h; moved = true; }
  }
  boxes.push({ x0: x, x1: x + w, y0: y, y1: y + h });
  return y;
}
/** A mark's box width - a player's badge the one drawn (N1-5); else its label's, by its length (a badge not made yet:
 *  the row as the badge sprite lays it out, or the title). */
const markWidth = (q) => {
  const m = q.m;
  if (q.sp) return q.sp.w;
  if (!m.badge) return Math.max(24, 9 * (m.label?.length ?? 0) + 16);
  const P = badgeParts(m.badge);
  const row = 9 * (m.label?.length ?? 0) + (P.lv ? 22 : 0) + (P.gt ? 8 * P.gt.length + 4 + (P.arms ? 16 : 0) : 0) + P.glyphs.length * 14 + 16;   // H4: its shield's frame
  return Math.max(24, row, P.title ? 8 * P.title.text.length + 16 : 0);
};
/** The lines a mark's label hangs below (or, at the foot, above) its point past the first: a far place's distance, a
 *  player's title (px) - a badge made, what it stands past a bare label's 20. */
const extraLines = (q) => (q.m.sub ? 16 : 0) + (q.sp ? Math.max(0, q.sp.h - 20) : q.m.badge && titleBadge(q.m.badge) ? 13 : 0);
/** The room between two marks held along one edge. */
const HELD_GAP = 4;
/** EDGE-FURNITURE: what stands at the screen's edges while the view is up - the game HUD's compass, its vitals and
 *  hotbar and its quick-slot block (the HUD stays under the view), a journey's travel panel and its junction disc, a
 *  phone's touch buttons. The view's own bar is measured apart (it is MOVED clear of what stands under it). */
const FURNITURE = '.hud-top, .hud-bottom, .hud-quick, .travelpanel-bar, .travelpanel-junction, .dftouch-btn, .qtrack';   // AUDIT GUIDE D1: the quest card's corner too
/** A held arrow's room off the furniture (px) - its own half height (10) and a little air. */
const FURNITURE_GAP = 12;
/** How often the furniture is measured (ms) - a layout read, so twice a second and never per mark. */
const FURNITURE_EVERY_MS = 500;
/** AUDIT DEEP2 E6: the least of the screen left clear between an axis's two furniture bands - under it both shrink, in
 *  proportion (a per-band cap of 30% put the marks ahead inside a phone's travel panel). */
const FURNITURE_MIN_CLEAR = 0.25;
/** How far in from a side a side's marks reach with their labels (px) - a piece within it stands in that side's way. */
const SIDE_REACH = 120;
/** AUDIT DEEP2 E1/E2: the view's block's own foot (px, the style sheet's `bottom`) and its air over what it clears. */
const BAR_FOOT = 18, BAR_AIR = 8;
const furniture = { top: TV_EDGE_MARGIN, foot: TV_EDGE_MARGIN, lTop: TV_EDGE_MARGIN, lFoot: TV_EDGE_MARGIN, rTop: TV_EDGE_MARGIN,
  rFoot: TV_EDGE_MARGIN, topLo: TV_EDGE_MARGIN, topHi: 0, footLo: TV_EDGE_MARGIN, footHi: 0, bar: BAR_FOOT, at: -Infinity, vw: 0, vh: 0,
  topNotch: [], footNotch: [], notice: null };
/**
 * OW-EDGES (2026-09-29, the player: "all the markers floating around can be more to the screen edges, respect the hotbar
 * and other bars"): THE NOTCHES. A piece across the top or the foot (the HUD's compass, its hotbar and vitals) held EVERY
 * mark along that edge clear of its whole depth - the hotbar's 150 px lifted a town at the screen's far left as high as
 * one straight over it. Each such piece is now a notch: its own span [x0, x1] and depth `d` (px from its edge). A mark at
 * that edge stands at the edge, and steps in only where its box meets a notch; a point in the picture UNDER a notch (it
 * would be drawn behind the bar) is held at the notch's edge, as one off the screen is.
 */
function notchDepth(list, x0, x1) {
  let d = 0;
  for (const n of list) if (x1 > n.x0 && x0 < n.x1) d = Math.max(d, n.d);
  return d;
}
/** The notch a point in the picture stands under, as a held place at its edge - or null. */
function notchHold(m, vh) {
  const F = furniture;
  for (const n of F.topNotch) if (m.x > n.x0 && m.x < n.x1 && m.y < n.d) return { x: m.x, y: n.d, angle: 0 };
  for (const n of F.footNotch) if (m.x > n.x0 && m.x < n.x1 && m.y > vh - n.d) return { x: m.x, y: vh - n.d, angle: 180 };
  return null;
}
/** Two bands along one axis `n` long, kept to leave FURNITURE_MIN_CLEAR of it between them. */
function clearBands(a, b, n) {
  const room = n * (1 - FURNITURE_MIN_CLEAR);
  if (a + b <= room) return [a, b];
  const k = room / (a + b);
  return [a * k, b * k];
}
/**
 * EDGE-FURNITURE (2026-09-28, Mac: "Fix this bug"; AUDIT DEEP2 E1/E2/E4/E6/E7): WHAT STANDS AT THE EDGES, MEASURED - a
 * layout read, so at most every FURNITURE_EVERY_MS, when the screen changes size and when the view opens; never per
 * frame, never per mark. A piece whose middle is in the screen's middle third is a BAND across its edge (the compass,
 * the vitals, the travel panel): the marks held at that edge stand clear of it. One in a side third is a CORNER piece
 * (the quick-slot block, a phone's buttons, the junction disc): the marks along that edge stop short of it. Any piece
 * within SIDE_REACH of a side stands in that side's way. And the view's own bar is LIFTED clear of whatever stands
 * under it - it sat on the HUD's vitals at every screen size (same layer, drawn after them), and on a phone the touch
 * buttons stood over its Return.
 */
/**
 * OW-NOTICES (2026-09-29, the player: "the notifications on the right side go into the box they need to be adjusted"):
 * THE BLOCK'S EDGES, TOLD TO THE PAGE. The notice stack (ui/enhancedNotice.js) stands at the right edge, centred - over
 * the Overworld's block. While the view is up the root wears `data-tview-block` ('foot' or 'top', where the block
 * stands) and `--tview-block-top` / `--tview-block-bottom` (px); the style sheet sets the stack above the block, or under
 * it. Written only when they change; taken off as the view goes (unpublishBlock).
 */
let publishedBlock = '';
function publishBlock(doc, at, top, bottom) {
  const root = doc?.documentElement;
  const key = `${at}|${Math.round(top)}|${Math.round(bottom)}`;
  if (!root?.style || key === publishedBlock) return;
  publishedBlock = key;
  if (root.dataset) root.dataset.tviewBlock = at;
  root.style.setProperty?.('--tview-block-top', `${Math.round(top)}px`);
  root.style.setProperty?.('--tview-block-bottom', `${Math.round(bottom)}px`);
}
function unpublishBlock(doc) {
  const root = doc?.documentElement;
  publishedBlock = '';
  if (!root) return;
  if (root.dataset) delete root.dataset.tviewBlock;
  root.style?.removeProperty?.('--tview-block-top');
  root.style?.removeProperty?.('--tview-block-bottom');
}
function measureFurniture(doc, vw, vh) {
  const now = globalThis.performance?.now?.() ?? Date.now();
  if (now - furniture.at < FURNITURE_EVERY_MS && furniture.vw === vw && furniture.vh === vh) return;
  const G = FURNITURE_GAP, M = TV_EDGE_MARGIN;
  const f = { top: M, foot: M, lTop: M, lFoot: M, rTop: M, rFoot: M, topLo: M, topHi: vw - M, footLo: M, footHi: vw - M, topNotch: [], footNotch: [] };
  const rects = [];
  for (const e of doc?.querySelectorAll?.(FURNITURE) ?? []) {
    if (parts?.bar?.contains?.(e)) continue;   // OW-DECK: the docked journey bar is the strip's own, measured with it
    const r = e?.getBoundingClientRect?.();
    if (r && r.width > 0 && r.height > 0) rects.push(r);
  }
  // the bar first: lifted over every piece under it that shares its span, then a piece like the rest
  const bar = parts?.bar, br = bar?.getBoundingClientRect?.(), back = parts?.back?.getBoundingClientRect?.();
  let barFoot = BAR_FOOT;
  if (br && br.width > 0 && br.height > 0) {
    // what it lifts over: a band under it (the vitals, the buttons mid-foot) and anything under its Return - never a
    // corner block that only its far end reaches (on a narrow phone that lifted it over the quick slots to mid-screen)
    // OW-BLOCK: the block stands in the bottom-right corner - LIFTED over whatever stands under its span in the foot half (a
    // phone's buttons, a HUD piece); on a touch screen the style sheet stands it at the top, and it is left there
    if ((br.top + br.bottom) / 2 >= vh / 2) {   // OW-NOTICES: at the foot by its middle - the block is taller than half a short screen
      const band = (r) => { const mid = (r.left + r.right) / 2; return mid > vw * 0.3 && mid < vw * 0.7; };
      const underBack = (r) => back && back.width > 0 && r.right > back.left && r.left < back.right;
      for (const r of rects) if (r.top >= vh / 2 && r.right > br.left && r.left < br.right && (band(r) || underBack(r))) barFoot = Math.max(barFoot, vh - r.top + BAR_AIR);
      barFoot = Math.min(barFoot, Math.max(BAR_FOOT, vh * (1 - FURNITURE_MIN_CLEAR) - br.height));   // never past the screen's middle
      const top = vh - barFoot - br.height;
      rects.push({ left: br.left, right: br.right, top, bottom: top + br.height, width: br.width, height: br.height });
      if (furniture.bar !== barFoot) { furniture.bar = barFoot; if (bar.style) bar.style.bottom = `${Math.round(barFoot)}px`; }
      publishBlock(doc, 'foot', top, top + br.height);
    } else {
      rects.push({ left: br.left, right: br.right, top: br.top, bottom: br.bottom, width: br.width, height: br.height });
      publishBlock(doc, 'top', br.top, br.bottom);
    }
  }
  for (const r of rects) {
    let upper = r.bottom <= vh / 2, lower = r.top >= vh / 2;
    // OW-EDGES: a tall piece across the middle is the edge's it stands on - the Overworld's block rises from the foot past
    // the middle, and the right side's marks slid under it; one that stands on neither is still no edge's
    if (!upper && !lower) { if (r.bottom >= vh * 0.75) lower = true; else if (r.top <= vh * 0.25) upper = true; else continue; }
    const mid = (r.left + r.right) / 2;
    const band = mid > vw * 0.3 && mid < vw * 0.7;
    if (upper) {
      if (band) f.topNotch.push({ x0: r.left - G, x1: r.right + G, d: Math.max(M, r.bottom + G) });   // OW-EDGES: its span, not the edge's
      else if (mid <= vw * 0.3) f.topLo = Math.max(f.topLo, r.right + G);
      else f.topHi = Math.min(f.topHi, r.left - G);
      if (r.left < SIDE_REACH) f.lTop = Math.max(f.lTop, r.bottom + G);
      if (r.right > vw - SIDE_REACH) f.rTop = Math.max(f.rTop, r.bottom + G);
    } else {
      if (band) f.footNotch.push({ x0: r.left - G, x1: r.right + G, d: Math.max(M, vh - r.top + G) });   // OW-EDGES
      else if (mid <= vw * 0.3) f.footLo = Math.max(f.footLo, r.right + G);
      else f.footHi = Math.min(f.footHi, r.left - G);
      if (r.left < SIDE_REACH) f.lFoot = Math.max(f.lFoot, vh - r.top + G);
      if (r.right > vw - SIDE_REACH) f.rFoot = Math.max(f.rFoot, vh - r.top + G);
    }
  }
  [f.top, f.foot] = clearBands(f.top, f.foot, vh);
  { // OW-EDGES: the deepest notch at the top and at the foot kept to FURNITURE_MIN_CLEAR between them, as the bands were
    const t = f.topNotch.reduce((a, n) => Math.max(a, n.d), M), b = f.footNotch.reduce((a, n) => Math.max(a, n.d), M);
    const [ct, cb] = clearBands(t, b, vh);
    for (const n of f.topNotch) n.d = Math.min(n.d, ct);
    for (const n of f.footNotch) n.d = Math.min(n.d, cb);
  }
  [f.lTop, f.lFoot] = clearBands(f.lTop, f.lFoot, vh);
  [f.rTop, f.rFoot] = clearBands(f.rTop, f.rFoot, vh);
  { const [a, b] = clearBands(f.topLo, vw - f.topHi, vw); f.topLo = a; f.topHi = vw - b; }
  { const [a, b] = clearBands(f.footLo, vw - f.footHi, vw); f.footLo = a; f.footHi = vw - b; }
  // OW-NOTICES: the notice stack's box (ui/enhancedNotice.js), read with the rest - a mark under a notice is drawn faint
  const ns = doc?.getElementById?.('enhanced-notice')?.getBoundingClientRect?.();
  f.notice = ns && ns.width > 0 && ns.height > 0 ? { x0: ns.left, x1: ns.right, y0: ns.top, y1: ns.bottom } : null;
  Object.assign(furniture, f, { at: now, vw, vh });
}
/** Which edge a held mark stands on: 0 left, 1 right, 2 the top, 3 the foot. AUDIT DEEP2 E4: one on the top or the foot
 *  whose box would reach past a side's line stands ON that side, in its corner - two runs, one an edge, never saw each
 *  other across a corner, so a town just round it lay over a town just before it. */
function heldSide(q, vw) {
  const m = TV_EDGE_MARGIN, h = q.held;
  if (h.x <= m + 0.5) return 0;
  if (h.x >= vw - m - 0.5) return 1;
  const half = markWidth(q) / 2 + 4;
  if (q.x - half < m) { q.x = m; return 0; }
  if (q.x + half > vw - m) { q.x = Math.round(vw - m); return 1; }
  return h.y < (furniture.vh || 2 * h.y + 2) / 2 ? 2 : 3;   // OW-EDGES: the top or the foot by which half it is held in (a notch's edge is no longer the band's)
}
/**
 * EDGE-DECLUTTER (2026-09-28, Mac: "Just #1"): THE MARKS HELD AT ONE EDGE, SPREAD so none lies over another. Two towns
 * (or a town and a rider) in much the same direction were held at the same spot, one plate hiding the other and its
 * click. Each edge's marks keep their order along it and slide apart - down a side (by their boxes' heights), along
 * the top or the foot (by their widths) - just enough, each run of them centred on where its marks would stand; each
 * arrow still points its own way. An edge too crowded to part them spaces them evenly along it instead. Every run's
 * BOXES stay inside its edge's clear stretch (EDGE-FURNITURE), the ends' included (AUDIT DEEP2 E8).
 */
function spreadHeld(placed, vw, vh) {
  const sides = [[], [], [], []];   // left, right, top, foot
  for (const q of placed) {
    if (!q.held) continue;
    const side = q.side;
    if (side < 2) {
      const b = markBox(q, vw);
      sides[side].push({ q, pos: q.y, a: q.y - b.y0, b: b.y1 - q.y });
    } else {
      const half = markWidth(q) / 2 + 4;
      sides[side].push({ q, pos: q.x, a: half, b: half });
    }
  }
  const F = furniture;
  const bounds = [[F.lTop, vh - F.lFoot], [F.rTop, vh - F.rFoot], [F.topLo, F.topHi], [F.footLo, F.footHi]];
  // AUDIT NAMES N1-6: the top and the foot first, then each side's run between the labels they hang into its corners -
  // a titled label held at the top reached down past where the left side's run began, its title across the next name
  for (const s of [2, 3, 0, 1]) {
    const items = sides[s];
    if (!items.length) continue;
    items.sort((u, v) => u.pos - v.pos || (u.q.m.key < v.q.m.key ? -1 : u.q.m.key > v.q.m.key ? 1 : 0));
    if (s < 2) cornersOf(bounds[s], s, items, sides, vw);
    const [lo, hi] = bounds[s];
    const fit = (r) => Math.min(Math.max(r.at, lo + items[r.i0].a), hi - r.span - items[r.i1].b);
    // runs of touching marks, each run centred on where its marks would stand (its first mark at `at`, the rest `off`
    // below it); a run that meets the one before it joins it, and the joined run is centred again
    const runs = [];
    for (let i = 0; i < items.length; i++) {
      items[i].off = 0;
      let r = { i0: i, i1: i, sum: items[i].pos, n: 1, span: 0, at: items[i].pos };
      r.at = fit(r);   // AUDIT DEEP2 E3: a lone mark kept inside its stretch BEFORE it is weighed against the run above it
      for (let p = runs[runs.length - 1]; p; p = runs[runs.length - 1]) {
        const shift = p.span + items[p.i1].b + HELD_GAP + items[r.i0].a;
        if (p.at + shift <= r.at) break;
        for (let k = r.i0; k <= r.i1; k++) items[k].off += shift;
        p.sum += r.sum - shift * r.n; p.n += r.n; p.i1 = r.i1; p.span = shift + r.span;
        p.at = p.sum / p.n; p.at = fit(p);
        runs.pop(); r = p;
      }
      runs.push(r);
    }
    for (const r of runs) {
      const a = lo + items[r.i0].a, z = hi - items[r.i1].b;
      const even = r.span > z - a;   // more than the edge holds: spaced evenly along it
      const at = even ? a : fit(r);
      for (let k = r.i0; k <= r.i1; k++) {
        const pos = even ? a + ((z - a) * (k - r.i0)) / Math.max(1, r.i1 - r.i0) : at + items[k].off;
        if (s < 2) items[k].q.y = Math.round(pos); else items[k].q.x = Math.round(pos);
      }
    }
  }
}
/** A label's left edge, kept inside a screen `vw` wide (4 px in). */
const inScreen = (x0, w, vw) => (vw > w + 8 ? Math.min(Math.max(4, x0), vw - 4 - w) : x0);
/** A pickable mark's box on the screen - its plate (or its label) and its dot, with a finger's slack, kept inside the
 *  screen as its label is. */
/** N1-6: a side's stretch [lo, hi] narrowed to start under the top's labels and end over the foot's that reach into
 *  it - within the side's widest label (or SIDE_REACH) of its edge. */
function cornersOf(bound, s, items, sides, vw) {
  let reach = SIDE_REACH;
  for (const it of items) reach = Math.max(reach, markWidth(it.q) + TV_EDGE_MARGIN + 8);
  const near = (b) => (s === 0 ? b.x0 < reach : b.x1 > vw - reach);
  for (const it of sides[2]) { const b = markBox(it.q, vw); if (near(b)) bound[0] = Math.max(bound[0], b.y1 + HELD_GAP); }
  for (const it of sides[3]) { const b = markBox(it.q, vw); if (near(b)) bound[1] = Math.min(bound[1], b.y0 - HELD_GAP); }
}
/** BOUNTY-SNAP: how far from a bounty's ring (or its edge arrow) a click still takes it, px - the ring's own 7 and a
 *  little slack, never its label: a click beside it is the ground's, so a walk near a hunt never snaps by accident. */
export const BOUNTY_SNAP_PX = 10;
/** The box a pickable mark takes a click in: a bounty's ring alone, every other mark its markBox. */
function pickBox(q, vw) {
  if (q.look === 'bounty') return { x0: q.x - BOUNTY_SNAP_PX, x1: q.x + BOUNTY_SNAP_PX, y0: q.y - BOUNTY_SNAP_PX, y1: q.y + BOUNTY_SNAP_PX };
  return markBox(q, vw);
}
function markBox(q, vw) {
  const plate = q.look === 'place' || q.look === 'far';
  const w = markWidth(q), h = plate ? 24 : 20;
  const x0 = inScreen(q.x - w / 2, w, vw);
  if (q.side === 3) return { x0: x0 - 4, x1: x0 + w + 4, y0: q.y - 14 - h - extraLines(q), y1: q.y + 10 };   // its label above it
  if (plate && !q.held) return { x0: x0 - 4, x1: x0 + w + 4, y0: q.y - 36 - (q.m.sub ? 16 : 0), y1: q.y + 8 };   // over its dot (E9)
  if (q.m.badge && !q.held) return { x0: x0 - 4, x1: x0 + w + 4, y0: q.y - NAME_ABOVE - h - extraLines(q), y1: q.y + 8 };   // N1-7: over the head
  return { x0: x0 - 4, x1: x0 + w + 4, y0: Math.min(q.y - 10, q.y - h), y1: q.y + 28 + extraLines(q) };
}
/** AUDIT DEEP2 E15: the pickable places' names (and distances), written to the hidden list when the set changes. */
/** AUDIT OW5 R3: how often (ms) the words are written again when only a distance changed - a journey's distances
 *  tick every tenth of a kilometre, and the list was emptied and built again on a third of the frames at speed. */
export const TV_SAID_DISTANCE_MS = 5000;
function sayPlaces(placed) {
  const list = parts?.said;
  if (!list) return;
  let text = '', names = '';
  for (const q of placed) if (q.m.pick && q.m.label) { text += `${q.m.label}${q.m.sub ? `, ${q.m.sub}` : ''}\n`; names += `${q.m.label}\n`; }
  if (last.said === text) return;
  // AUDIT DEEP2 E15's own law, kept: written when the SET changes - the same places with new distances wait their turn
  const at = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (last.saidNames === names && at - (last.saidAt ?? -Infinity) < TV_SAID_DISTANCE_MS) return;
  last.said = text; last.saidNames = names; last.saidAt = at;
  const doc = list.ownerDocument;
  list.textContent = '';
  for (const line of text.split('\n')) if (line) { const li = doc.createElement('li'); li.textContent = line; list.append(li); }
}
function setHover(key) {
  if (key === hoverKey) return;
  hoverKey = key;
  const body = parts?.canvas?.ownerDocument?.body;
  if (body?.style) body.style.cursor = key ? 'pointer' : '';
}
/** PERF-TV: THE CLICK ON A MARK - the key of the pickable mark drawn at (x, y) this frame, the one on top; null for none
 *  (the click is the ground's - scenes/travelView.js asks here before it picks). */
export function travelViewHudPickAt(x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const b = hits[i];
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b.key;
  }
  return null;
}

/** The pins' read: what the readout shows right now. */
export function travelViewHudState() {
  if (!parts) return null;
  return {
    shown: root.style.display !== 'none',
    where: parts.where.textContent,
    hint: parts.hint.textContent,
    trip: parts.trip.textContent,
    route: last.route ?? '',
    marks: [...drawnKeys],   // PERF-TV: the marks the canvas was handed this frame
    hits: hits.map((h) => ({ ...h })),   // and the boxes that take a click
    said: last.said ?? '',   // AUDIT DEEP2 E15: the places in words
  };
}
