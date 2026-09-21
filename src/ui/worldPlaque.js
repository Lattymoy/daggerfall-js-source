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
// large HUD (vendor .cs:1085-1100) - so ROAD-E E5's law, that a docked
// bar moves the reticle, moves the plaque with it for free.
import { injectEnhancedStyle } from './enhancedStyle.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { isTouchDevice } from './touchDevice.js';
import { crosshairCentreY, CROSSHAIR_ARM } from './hudCrosshair.js';
import { hudReticle } from './hud.js';   // the reticle's own two terms, from their home
import { pickActivatableHit } from '../player/activate.js';
import { resolveHover, frameSignature } from '../systems/worldHover.js';

/** The gap in CSS pixels between the cross's lower arm tip and the
 *  plaque's top edge. Large enough that the two never read as one
 *  shape, small enough that the name is plainly about the reticle. */
export const PLAQUE_GAP = 18;

let node = null;
let shownSig = null;
let lastX = null;
let lastTop = null;
let _faults = 0;        // AUDIT-WH L1: contained frames, counted
let _faultSaid = false; // ...and said once, not once a frame

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
export const worldPlaqueOn = () => isEnhanced() && !isTouchDevice();

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

function paint(n, f) {
  n.textContent = '';
  n.classList.toggle('has-list', f.kind === 'items');
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
  for (const r of f.rows) {
    const row = document.createElement('div');
    row.className = 'wplaque-row';
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
  if (anchor && (anchor.x !== lastX || anchor.top !== lastTop)) {
    lastX = anchor.x; lastTop = anchor.top;
    n.style.setProperty('--wp-x', `${anchor.x.toFixed(1)}px`);
    n.style.setProperty('--wp-top', `${anchor.top.toFixed(1)}px`);
  }
  const sig = frameSignature(frame);
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
  paint(n, frame);
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
  if (!worldPlaqueOn()) return null;
  // `cursorActive` is the crosshair's OWN first statement (there is no
  // reticle while a window is up, hudCrosshair.js:114) and so it is the
  // plaque's. In the dungeon this was an accident of scheduling - the
  // driver only ran with no overlay up - and an accident is not a law.
  if (cursorActive || !eye || !dir || !collider) { showWorldPlaque(null); return null; }
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
    const hit = pick ? pick() : pickActivatableHit(eye, dir, targets?.() ?? [], collider);
    const frame = resolveHover(hit, { name, contents });
    showWorldPlaque(frame, plaqueAnchor(canvas));
    return frame;
  } catch (e) {
    _faults += 1;
    if (!_faultSaid) {
      _faultSaid = true;
      console.warn(`[world-hover] the plaque could not resolve and is standing down for this frame: ${e?.message ?? e}`);
    }
    try { showWorldPlaque(null); } catch { /* the draw itself is gone; nothing left to hide */ }
    return null;
  }
}

/** For tests and the console: how many frames the seam has contained. */
export const worldHoverFaults = () => _faults;

/** Tear down with the host that raised it. */
export function destroyWorldPlaque() {
  try { node?.remove(); } catch { /* already gone */ }
  node = null;
  shownSig = null;
  lastX = null;
  lastTop = null;
  _faults = 0;
  _faultSaid = false;
}

/** For tests. */
export const _plaqueSignatureForTests = () => shownSig;
