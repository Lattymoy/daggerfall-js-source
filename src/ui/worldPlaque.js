// WORLD-HOVER, THE DRAW - the plaque under the crosshair.
//
// PX21c minted this as `lootHover.js`, for three loot keys, and named
// it after the one state it had. It answers the whole activation ladder
// now (World Tooltips 1.1 ported into systems/worldHover.js), so it is
// named for what it IS: the plaque, whatever is on it. The rename is
// the repo's own idiom - MakeHouseContainer -> isHouseContainerModel,
// overworldMap.js -> heldMap.js - and every pin that held the old name
// moved with it rather than being deleted.
//
// PX21c's charter, which the merge did not change:
//
//   Daggerfall tells you nothing about a pile until you open it, and
//   opening it is a window. This is the enhanced skin's answer: LOOK at
//   a pile and a small plaque names what is in it, in the same dress as
//   every other floating surface - so the decision "is this worth
//   stopping for" happens in the world rather than through a door.
//
//   It is a READOUT, not a control: no clicks, no keys, nothing to
//   dismiss.
//
//   ONE NODE, UPDATED ON CHANGE. A per-frame rebuild of a DOM list is
//   the entrance-replay bug (PX19k) wearing a different hat.
//
// What the merge DID change is what "on change" means. The old guard
// compared the key alone and could not see a list that changed under
// one; it compares the rendered signature now (systems/worldHover.js
// frameSignature, and the reasoning is there).
//
// AND IT MOVED TO THE RETICLE. PX21c stood the plaque at `bottom: 16%`
// with a comment explaining that it was "centred low so it never sits
// on the reticle" - standing far away to avoid something rather than
// knowing where it was. The reticle's own geometry is exported
// (hudCrosshair.crosshairCentreY + CROSSHAIR_ARM), so the plaque hangs
// a fixed gap BELOW the cross and grows downward: a one-line name sits
// just under it, a six-row pile adds rows away from it, and the cross
// is covered in no state at any length. That is also the mod's own
// anchor - HUDTooltip.Draw puts its panel at the screen's middle, and
// at `(Screen.height - largeHUD.Rectangle.height) / 2` under a docked
// large HUD (vendor .cs:1097-1112) - so ROAD-E E5's law, that a docked
// bar moves the reticle, moves the plaque with it for free.
import { injectEnhancedStyle, PLAQUE_MAX_W, STATS_W, STATS_GAP, STATS_MARGIN } from './enhancedStyle.js';   // QUICK-LOOT-STATS: the layout numbers live with the dress that draws them
import { isEnhanced } from '../systems/uiSkin.js';
import { isTouchDevice } from './touchDevice.js';
import { crosshairCentreY, CROSSHAIR_ARM } from './hudCrosshair.js';
import { hudReticle } from './hud.js';   // the reticle's own two terms, from their home
import { pickActivatableHit } from '../player/activate.js';
import { frameMark } from '../systems/frameClock.js';   // AUDIT-WH P3: the frame in flight, so the gate's two terms are computed once in it
import { resolveHover, frameSignature } from '../systems/worldHover.js';
import { foldQuickLoot, quickLootRow, quickLootStats, resetQuickLoot } from '../systems/quickLoot.js';   // QUICK-LOOT B3: the highlight is the FEATURE's - this draws it and frees it, it does not own it; QUICK-LOOT-STATS: and the lit row's own numbers
import { bodyTurnArmed, turnBodyStack, bodyTurnText, bodyStackMark, dropBodyTurns, resetBodyStack } from '../player/lootStack.js';   // LOOT-STACK: the pile's turn is spent where the reticle's pick is, and the plaque says where the body stands in it
import { setMidScreenText } from './midScreenText.js';   // LOOT-STACK: a turn speaks in DFU's own mid-screen voice, on both skins
import { quickslotTag } from './quickslotTags.js';   // LOOT-STACK: the turn key's own name, the classic way, the way the diamond names its keys
import { bindings } from './input.js';   // ...off the live store, so a rebind renames it

/** The gap in CSS pixels between the cross's lower arm tip and the
 *  plaque's top edge. Large enough that the two never read as one
 *  shape, small enough that the name is plainly about the reticle. */
export const PLAQUE_GAP = 18;

/**
 * QUICK-LOOT-STATS: WHICH SIDE THE STAT PANEL STANDS ON, decided by
 * arithmetic rather than by hope.
 *
 * The plaque is centred on the reticle (`translateX(-50%)`), so a panel
 * pinned to its right edge runs off a narrow screen - and the player
 * asked for the stats NEXT TO the window, so "next to" has to mean next
 * to on every screen rather than on the author's.
 *
 * The widths are IMPORTED from the sheet that draws them
 * (enhancedStyle.js), not restated: a layout decided against a number
 * the CSS no longer uses is a panel half off the screen, and two
 * literals is exactly how that happens. The plaque's HALF is taken at
 * its maximum - a short title makes the box narrower than the max and
 * never wider, so the conservative read is the safe one both ways.
 *
 * Right first (the reading order, and where a right-handed player's
 * eye already is), then left, then BELOW - which is not a failure
 * state but the honest answer on a phone, where nothing fits beside
 * anything.
 *
 * Pure, so the three cases can be driven rather than eyeballed at one
 * window size - which is exactly how CHARGEN-REFLEX's harness lied.
 */
export function statsSide(anchorX, viewportWidth) {
  const half = PLAQUE_MAX_W / 2;
  const need = half + STATS_GAP + STATS_W + STATS_MARGIN;
  if (!Number.isFinite(anchorX) || !Number.isFinite(viewportWidth) || viewportWidth <= 0) return 'below';
  if (anchorX + need <= viewportWidth) return 'right';
  if (anchorX - need >= 0) return 'left';
  return 'below';
}

/** AUDIT-WH2 L3-F2: a plaque that has not been drawn for this long is
 *  gone - take it down. ENH-NOTICE1's own constant and its own reason
 *  (ui/enhancedNotice.js NOTICE_WATCHDOG_MS), at the same 400ms: long
 *  enough that no honest frame rate trips it, short enough that a
 *  stranded name is a blink and not a fixture. */
export const PLAQUE_WATCHDOG_MS = 400;

let node = null;
let shownSig = null;
let lastX = null;
let lastTop = null;
let _faults = 0;        // AUDIT-WH L1: contained frames, counted
let _faultSaid = false; // ...and said once, not once a frame
let _watchdog = null;   // AUDIT-WH2 L3-F2: the heartbeat's handle - owned here, freed at every door out
let _schedule = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
let _cancel = (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); };
/** Tests replace the two clocks so a stranded plaque can be observed at
 *  once, exactly as `_setNoticeClockForTests` does for the notice. */
export function _setPlaqueClockForTests(s, c) { _schedule = s ?? _schedule; _cancel = c ?? _cancel; }

function ensure() {
  if (node || typeof document === 'undefined') return node;
  injectEnhancedStyle();
  node = document.createElement('div');
  node.className = 'wplaque';
  node.setAttribute('aria-hidden', 'true');   // the crosshair is not a reading order
  document.body.append(node);
  return node;
}

/**
 * THE PLAQUE IS OFF ON A TOUCH DEVICE, and this is not a layout
 * decision. On touch the activation ray is through the FINGER, not the
 * crosshair - `_tapPoint` -> `_tapDir` through `rayDirFromScreen` - so
 * a plaque anchored at the screen's middle would name what a tap would
 * NOT open. That breaks the founding law (it cannot disagree with the
 * door) on every frame, and a wrong answer delivered confidently is
 * worse than no answer. The tap-anchored variant - resolve on the tap's
 * own ray, anchor at the tap point, hold a couple of seconds - is a
 * real design and a later slice's; it is not this one wearing a media
 * query.
 */
export const worldPlaqueOn = () => {
  // AUDIT-WH P3: ASKED ONCE A FRAME, NOT TWICE. Both readers are
  // load-bearing and neither can go - `worldHoverFrame` gates the
  // whole resolve, and `showWorldPlaque` gates ABOVE `ensure()`
  // because a classic page must never reach `injectEnhancedStyle()`
  // (AUDIT 39) - so what changes is how often the two TERMS are
  // computed. `isEnhanced()` parses a URLSearchParams and
  // `isTouchDevice()` runs up to three matchMedia queries, and every
  // frame ran both twice.
  //
  // Memoised on `frameMark()`, which is the rAF stamp PERF1's clock
  // already puts up: it changes exactly once a frame and is NULL
  // between frames, so a skin flip or a tablet-mode flip is seen on
  // the very next frame, and a caller outside a frame (a test, the
  // console, a boot path) always recomputes. That last part is the
  // one that matters here - L5's whole point is that both terms can
  // change under a painted plaque.
  const mark = frameMark();
  if (mark !== null && _gateMark === mark) return _gateOn;
  _gateOn = isEnhanced() && !isTouchDevice();
  _gateMark = mark;
  return _gateOn;
};
let _gateMark = null;
let _gateOn = false;

/**
 * Where the reticle is THIS frame, in CSS pixels, or null off a canvas.
 * The two terms come from hud.js (`hudReticle`), which is their home -
 * a host that passed its own scale and bar height would be a second
 * copy of an arithmetic that has to agree with the drawn cross exactly
 * or the plaque hangs off it.
 *
 * Canvas pixels over the device ratio, the arithmetic
 * ui/enhancedHudText.js midTextTopPx already spells.
 */
export function plaqueAnchor(canvas) {
  if (!canvas?.width || !canvas?.height) return null;
  const { scale, largeHudHeight } = hudReticle(canvas);
  const dpr = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
  return {
    x: (canvas.width / 2) / dpr,
    top: (crosshairCentreY(canvas.height, largeHudHeight) + CROSSHAIR_ARM * scale) / dpr + PLAQUE_GAP,
  };
}

function paint(n, f, sel = -1, stats = []) {
  n.textContent = '';
  n.classList.toggle('has-list', f.kind === 'items' || f.kind === 'actions');
  const title = document.createElement('div');
  title.className = 'wplaque-title';
  // The mod joins a door's label with `\r` - "To\rPrivateer's Hold" -
  // and that IS a line break, not a separator to flatten. One node per
  // line inside the one title block, so the `has-list` divider still
  // sits under the whole label rather than between its halves.
  for (const line of String(f.title).split('\n')) {
    const l = document.createElement('div');
    l.className = 'wplaque-titleline';
    l.textContent = line;
    title.append(l);
  }
  n.append(title);
  for (const s of f.subs) {
    const sub = document.createElement('div');
    sub.className = 'wplaque-sub';
    sub.textContent = s;
    n.append(sub);
  }
  if (f.kind === 'actions') {
    // ACT-MENU: the verbs, in the loot list's own rows - one is lit, the wheel moves it, the activate key presses it
    const list = document.createElement('div');
    list.className = 'wplaque-list wplaque-acts';
    n.append(list);
    for (let i = 0; i < f.rows.length; i++) {
      const row = document.createElement('div');
      row.className = 'wplaque-row wplaque-act';
      if (i === sel) row.classList.add('sel');
      if (f.rows[i].disabled) row.classList.add('off');   // AUDIT DISC7 A4: a refused verb, its reason in its name
      row.textContent = f.rows[i].name;
      list.append(row);
    }
    return;
  }
  if (f.kind !== 'items') return;
  const list = document.createElement('div');
  list.className = 'wplaque-list';
  n.append(list);
  if (f.empty) {
    const p = document.createElement('div');
    p.className = 'wplaque-row wplaque-empty';
    p.textContent = 'Empty';
    list.append(p);
  }
  for (let i = 0; i < f.rows.length; i++) {
    const r = f.rows[i];
    const row = document.createElement('div');
    row.className = 'wplaque-row';
    // QUICK-LOOT B3: the highlight. A CLASS rather than an inline
    // style, because the dress is the sheet's (enhancedStyle.js) like
    // every other state this node wears, and because `.on`/`.has-list`
    // already established that idiom here. Indexed rather than
    // `rows.indexOf(r)`: that is quadratic on a list drawn every time
    // it changes, and it would answer the wrong row the day two rows
    // are the same object.
    if (i === sel) row.classList.add('sel');
    if (r.rarity) row.dataset.rarity = r.rarity;   // LR1
    const nm = document.createElement('span');
    nm.textContent = r.name;
    row.append(nm);
    if (r.stack) {
      const c = document.createElement('span');
      c.className = 'wplaque-count';
      c.textContent = `×${r.stack}`;
      row.append(c);
    }
    list.append(row);
  }
  if (f.rest > 0) {
    const more = document.createElement('div');
    more.className = 'wplaque-row wplaque-more';
    more.textContent = `and ${f.rest} more`;
    list.append(more);
  }
  // QUICK-LOOT-STATS: the lit row's own numbers, BESIDE the list.
  // A child of the plaque rather than a second fixed node, so it
  // rides the reticle's anchor for free and the one teardown that
  // already takes the plaque down takes it with it - a second
  // top-level overlay is a second thing to forget to hide (AUDIT 64
  // F37, the law ENH-NOTICE1's watchdog exists for).
  if (!stats.length) return;
  const panel = document.createElement('div');
  panel.className = 'wplaque-stats';
  panel.dataset.side = statsSide(lastX, globalThis.innerWidth ?? 0);
  for (const r of stats) {
    const line = document.createElement('div');
    line.className = 'wplaque-statrow';
    // A row with no label is a SENTENCE, not a pair - a survival
    // item's "Raw - cook it at a fire." has no left-hand word and
    // drawing an empty one would open a gap the eye reads as a
    // missing value.
    if (r.label) {
      const k = document.createElement('span');
      k.className = 'wplaque-statkey';
      k.textContent = r.label;
      line.append(k);
    } else line.classList.add('wplaque-statnote');
    const v = document.createElement('span');
    v.className = 'wplaque-statval';
    v.textContent = r.text;
    line.append(v);
    panel.append(line);
  }
  n.append(panel);
}

/**
 * Show `frame`, or hide the plaque when it is null. Idempotent: calling
 * it every frame with a frame that would paint the same costs nothing
 * after the first.
 *
 * `anchor` moves the node without repainting it, because the reticle
 * can move (a large HUD docking, a resize) while the name under it does
 * not change.
 */
function blank(n) {
  n.classList.remove('on');
  n.textContent = '';
  n.classList.remove('has-list');
}

/**
 * TAKE THE PLAQUE DOWN, whatever the skin says - the door a host's
 * overlay branch and its held-frame branch call before they return.
 *
 * AUDIT-WH H4/L3. The hide used to be spoken only by a frame that
 * reached `worldHoverFrame`, and three host branches return ABOVE that
 * call: both dungeon hosts on an overlay (`hideHudText` rides that
 * exact line, for this exact reason) and both above-ground hosts on a
 * held frame (a full-screen infection video). A DOM overlay stays
 * painted unless it is told otherwise (AUDIT 64 F37), so the plaque
 * hung frozen over every dungeon window - naming a container's
 * PRE-TAKE contents while the window behind it emptied the thing.
 *
 * It never calls `ensure()`. AUDIT 39's gate is about DRAWING: a
 * classic-skin page must not reach `injectEnhancedStyle()`, and a node
 * that does not exist has nothing to hide.
 */
export function hideWorldPlaque() {
  // AUDIT-WH2 L3-F2: the heartbeat stops with the thing it watches, and
  // it stops FIRST - a hide with a timer still pending would take the
  // plaque down twice and, in a test, hold the event loop open past the
  // run. The watchdog itself nulls the handle before it calls here, so
  // this is a no-op on that path.
  _cancel(_watchdog);
  _watchdog = null;
  foldQuickLoot(null);   // AUDIT DISC7 A8: a plaque taken down by any door takes its highlight with it
  if (!node) return;
  shownSig = null;
  blank(node);
}

export function showWorldPlaque(frame, anchor = null) {
  // THE SKIN GATE IS HERE, ABOVE ensure(). AUDIT 39: the hosts call
  // this every tick whatever the skin - they gate only the PICK - so a
  // classic-skin dungeon reached ensure() with a null frame on its
  // first tick and injectEnhancedStyle() put the enhanced sheet's
  // UNSCOPED head rules (`*`, `html, body`, `body`, `button`, `#app`)
  // onto the classic page. A player who chose classic never loads a
  // byte of that, which is this module's own doctrine - and four hosts
  // calling one seam is four more chances to reach ensure() by
  // accident, so the gate matters more now than it did.
  //
  // AUDIT-WH L5: but the gate refuses to DRAW, not to HIDE. Both of
  // its terms can flip under a painted plaque - the skin switch is a
  // live setting, and `isTouchDevice` reads a media query that a
  // tablet-mode flip or a plugged-in touchscreen changes - and a
  // bare `return` there stranded a painted node naming what the new
  // input can no longer open. Hiding an EXISTING node injects nothing,
  // so the gate above is untouched.
  if (!worldPlaqueOn()) { hideWorldPlaque(); return; }
  const n = ensure();
  if (!n) return;
  // AUDIT-WH2 L3-F2: THE HEARTBEAT, re-armed by every draw - and armed
  // ABOVE the signature short-circuit below, because a plaque standing
  // still on one name returns there and that is still a live frame.
  //
  // The seam's try/catch contains a throw INSIDE the hover call. It
  // cannot contain one BESIDE it: each host runs hundreds of lines
  // between its `worldHoverFrame(...)` and its bare
  // `requestAnimationFrame(frame)`, which is not in a `finally`, so any
  // throw downstream of the plaque kills the loop with the last name
  // still painted over a game that has stopped. A DOM overlay stays
  // painted unless it is told otherwise (AUDIT 64 F37); nothing else in
  // this module can tell it once the frames stop coming.
  _cancel(_watchdog);
  _watchdog = _schedule(() => { _watchdog = null; hideWorldPlaque(); }, PLAQUE_WATCHDOG_MS);
  if (anchor && (anchor.x !== lastX || anchor.top !== lastTop)) {
    lastX = anchor.x; lastTop = anchor.top;
    n.style.setProperty('--wp-x', `${anchor.x.toFixed(1)}px`);
    n.style.setProperty('--wp-top', `${anchor.top.toFixed(1)}px`);
  }
  // QUICK-LOOT B3: ...AND THE HIGHLIGHT IS PART OF WHAT IS PAINTED.
  // `frameSignature` answers what the FRAME would draw, and the
  // selection is not the frame's - it is this module's fold over it -
  // so a wheel click that moves the highlight down one row leaves the
  // frame identical and would not have repainted. Same defect PX21c had
  // with the key, one field further out.
  // QUICK-LOOT-STATS: the stat rows are derived from the lit row, so
  // the selection already covers them - EXCEPT that the panel's SIDE
  // is a function of where the plaque stands and how wide the window
  // is, and neither is in the frame. A resize with the crosshair held
  // still would otherwise leave the panel off the screen edge it was
  // laid out against.
  const stats = quickLootStats(frame);
  const sig = `${frameSignature(frame)}|${quickLootRow(frame)}|${statsSide(lastX, globalThis.innerWidth ?? 0)}`;
  if (sig === shownSig) return;
  shownSig = sig;
  if (!frame) {
    // HIDDEN ACTIVELY, never by a teardown. A persistent DOM overlay
    // stays painted unless it is told otherwise (AUDIT 64 F37) - the
    // notice panel's own law, and the reason ENH-NOTICE1 has a
    // watchdog. A frame that says nothing takes the plaque down.
    blank(n);
    return;
  }
  paint(n, frame, quickLootRow(frame), stats);
  n.classList.add('on');
}

/**
 * THE SEAM - the one function a host calls, once a frame, where it
 * already draws its HUD.
 *
 * `targets` is a THUNK, and that is the shape that makes this
 * affordable. The cost of a hover in this port is not the ray (~3 us)
 * and not the pick (~21 ns a target); it is BUILDING THE TARGET LIST,
 * which is 95-97% of it - a streaming city's door list is ~200 us and
 * ~4,500 allocations a frame, the exact shape PERF-TOWN1 already had to
 * go and fix. A thunk lets a host hand over a list it is holding
 * anyway, or rebuild one only when something moved, without this module
 * knowing or caring which.
 *
 * `pick` is the escape hatch, and it exists for one host shape. The
 * two exterior hosts do not race ONE target list: they run seven picks
 * (the bodies, the piles, the torches, the cart, the camps, the water,
 * and the door/person/board set) and settle them with
 * `player/activationRace.js`. A plaque that raced a single merged list
 * would resolve ties differently from the press on the frame it
 * mattered, which is the one thing this surface exists not to do - so
 * those hosts hand over the race's own winner instead, and `targets`
 * goes unread.
 *
 * `name` and `contents` are the host's namer and its read-only contents
 * accessor; the ladder they implement is systems/worldHover.js's
 * subject, not this file's.
 */
export function worldHoverFrame({
  eye = null, dir = null, targets = null, collider = null, pick = null,
  cursorActive = false, canvas = null, name = null, contents = null,
} = {}) {
  // AUDIT-WH2 L3-F1: ...AND THE HIDE IS SPOKEN HERE, NOT ONLY IN
  // showWorldPlaque. L5 put the gate's hide door on showWorldPlaque and
  // it was unreachable: `grep -rn showWorldPlaque src/scenes/` returns
  // NOTHING - every host calls this function and only this function, so
  // a bare `return null` here was the only gate production ever ran. A
  // skin switch or a tablet-mode flip under a painted plaque stranded
  // it naming what the new input can no longer open, which is the exact
  // defect L5 was written to close, closed on the wrong door.
  //
  // Both doors stay. This one is the one hosts reach; showWorldPlaque's
  // is the one a test, a console or a future caller reaches, and neither
  // can call `ensure()` (AUDIT 39: the gate is about DRAWING - a classic
  // page must not reach injectEnhancedStyle(), and hiding an existing
  // node injects nothing).
  //
  // LOOT-STACK: ...EXCEPT FOR A TURN OF THE PILE, which is about the RAY
  // and not about drawing. This is the one seam every host already calls
  // once a frame with the reticle's own pick - raced exactly as its press
  // races it - so a turn armed by its key (player/lootStack.js) is spent
  // here on both skins: a classic player turns a pile too, and DFU's
  // mid-screen line is the plaque they have. With no turn armed, the
  // plaque's gates below run exactly as they always did.
  //
  // ACT-MENU: a plaque that stands down folds NOTHING - the highlight goes with it, so a verb lit before a window
  // opened (or the skin changed) cannot be pressed later by a click that never saw it. (The hide folds the highlight
  // away too: AUDIT DISC7 A8; and a turn spent below returns before the fold.)
  const on = worldPlaqueOn();
  if (!on) hideWorldPlaque();
  // `cursorActive` is the crosshair's OWN first statement (there is no
  // reticle while a window is up, hudCrosshair.js:114) and so it is the
  // plaque's. In the dungeon this was an accident of scheduling - the
  // driver only ran with no overlay up - and an accident is not a law.
  // LOOT-STACK: and a turn armed before a window came up is dropped, not
  // kept to land on whatever the reticle meets after it.
  if (cursorActive || !eye || !dir || !collider) { dropBodyTurns(); foldQuickLoot(null); if (on) showWorldPlaque(null); return null; }
  if (!on && !bodyTurnArmed()) return null;
  // CONTAINED, COUNTED AND SAID - ONCRASH1's law, and a READOUT is a
  // stronger case for it than the wire frame that law was written for:
  // nothing this surface can compute is worth a dead game.
  //
  // `pick`, `targets`, `name` and `contents` are HOST closures, called
  // from inside four frame bodies that have no error boundary between
  // them and `requestAnimationFrame`. AUDIT-WH C1 was one instance -
  // a namer handed the exterior door's numeric key called `startsWith`
  // on it - and the class is the point, because `composeNamer` and
  // `addActivationNamer` are documented as "the same door a third
  // party would use". An extension API into an uncontained call path
  // is a crash waiting for its first extension.
  //
  // Said ONCE (the online lane's own idiom - a latch, not a per-frame
  // console), and the plaque goes down rather than freezing on its
  // last answer: a readout that cannot answer shows nothing.
  try {
    const reticle = () => (pick ? pick() : pickActivatableHit(eye, dir, targets?.() ?? [], collider));
    let hit = reticle();
    // LOOT-STACK: the turn, on the stack this very pick stood - and when
    // it turned, the pick again, so the plaque names the body the next
    // press will open.
    if (bodyTurnArmed()) {
      const turned = turnBodyStack(hit);
      if (turned) { setMidScreenText(bodyTurnText(turned)); hit = reticle(); }
    }
    if (!on) return null;
    const frame = markBodyStack(resolveHover(hit, { name, contents }));
    // QUICK-LOOT B3: the highlight is folded HERE, inside the
    // containment, because `nextSelection` reads the frame a host
    // closure just produced - and the whole reason this try/catch
    // exists is that a host closure can throw. The nudge is flushed
    // whether or not it moved anything, so a wheel click spent while
    // looking at a door does not arrive later at a chest.
    foldQuickLoot(frame);
    showWorldPlaque(frame, plaqueAnchor(canvas));
    return frame;
  } catch (e) {
    _faults += 1;
    if (!_faultSaid) {
      _faultSaid = true;
      console.warn(`[world-hover] the plaque could not resolve and is standing down for this frame: ${e?.message ?? e}`);
    }
    foldQuickLoot(null);   // AUDIT DISC7 A8: a contained fault lights nothing - a click must not press the last good frame's verb
    try { showWorldPlaque(null); } catch { /* the draw itself is gone; nothing left to hide */ }
    return null;
  }
}

/**
 * LOOT-STACK: A BODY IN A PILE SAYS WHERE IT STANDS IN IT - "2 of 3" - and
 * the key that turns it, named off the live bindings the way the diamond
 * names its keys (ui/quickslotTags.js: the classic short name, and no word
 * at all for an action bound to nothing, or to a pad button a line of text
 * cannot draw). The mark is a sub-line, so the repaint guard sees it
 * change (frameSignature reads the subs).
 */
function markBodyStack(f) {
  if (!f) return f;
  const m = bodyStackMark(f.key);
  if (!m) return f;
  const tag = quickslotTag(NEXT_BODY_ACTION, { bindings: bindings() });
  const key = tag?.kind === 'key' ? tag.text : null;
  return { ...f, subs: [...f.subs, `${m.index + 1} of ${m.count}${key ? ` \u00b7 ${key} for the next` : ''}`] };
}
/** The action a pile's turn answers (systems/inputActions.js). */
export const NEXT_BODY_ACTION = 'NextBody';

/** For tests and the console: how many frames the seam has contained. */
export const worldHoverFaults = () => _faults;


/** Tear down with the host that raised it. */
export function destroyWorldPlaque() {
  // AUDIT-WH2 L3-F2: EVERY ALLOCATION HAS AN OWNER, and a pending timer
  // is one. Freed first: a watchdog that fired after the node was gone
  // would be harmless but a watchdog left pending holds a test run open.
  _cancel(_watchdog);
  _watchdog = null;
  try { node?.remove(); } catch { /* already gone */ }
  node = null;
  shownSig = null;
  lastX = null;
  lastTop = null;
  _faults = 0;
  _faultSaid = false;
  _gateMark = null;
  _gateOn = false;
  // QUICK-LOOT B3: the highlight dies with the host that raised it. A
  // selection is ABOUT a key in a world this teardown is unmaking, so
  // carrying one across a mode change would point the take at a pile
  // that no longer exists - and the pending wheel nudge with it, or a
  // click spent in a dungeon would move the highlight in the street.
  // The state is the feature's (systems/quickLoot.js); the teardown
  // that frees it is still this module's, because this is what the
  // hosts call.
  resetQuickLoot();
  // LOOT-STACK: and the pile's choice with it, for the same reason - it
  // names a body in the world this teardown is unmaking.
  resetBodyStack();
}

/** For tests. */
export const _plaqueSignatureForTests = () => shownSig;
