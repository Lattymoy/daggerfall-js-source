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
  title.textContent = f.title;
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
  if (!worldPlaqueOn()) return;
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
    n.classList.remove('on');
    n.textContent = '';
    n.classList.remove('has-list');
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
 * `name` and `contents` are the host's namer and its read-only contents
 * accessor; the ladder they implement is systems/worldHover.js's
 * subject, not this file's.
 */
export function worldHoverFrame({
  eye = null, dir = null, targets = null, collider = null,
  cursorActive = false, canvas = null, name = null, contents = null,
} = {}) {
  if (!worldPlaqueOn()) return null;
  // `cursorActive` is the crosshair's OWN first statement (there is no
  // reticle while a window is up, hudCrosshair.js:114) and so it is the
  // plaque's. In the dungeon this was an accident of scheduling - the
  // driver only ran with no overlay up - and an accident is not a law.
  if (cursorActive || !eye || !dir || !collider) { showWorldPlaque(null); return null; }
  const hit = pickActivatableHit(eye, dir, targets?.() ?? [], collider);
  const frame = resolveHover(hit, { name, contents });
  showWorldPlaque(frame, plaqueAnchor(canvas));
  return frame;
}

/** Tear down with the host that raised it. */
export function destroyWorldPlaque() {
  try { node?.remove(); } catch { /* already gone */ }
  node = null;
  shownSig = null;
  lastX = null;
  lastTop = null;
}

/** For tests. */
export const _plaqueSignatureForTests = () => shownSig;
