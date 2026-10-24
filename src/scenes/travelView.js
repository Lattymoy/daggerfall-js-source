// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV1 - THE TRAVEL VIEW, THE HOST'S HALF (bible/06-Systems/Travel-View.md).
//
// Mac (2026-09-27): "When opening the map, there should be a toggle to go
// to the overworld style map." The held map's foot row carries the door
// (ui/heldMap.js, "Overworld"); the Controls page carries an unbound
// action for a player who wants a key from play (TravelView).
//
// ONE HOST. The view is the streaming exterior's alone (scenes/world.js):
// THE FOUR HOSTS RULE names all four - world.js WIRED; exterior.js, the
// dev scene's fixed city, NOT WIRED on purpose (no streaming grid under a
// camera 450 m up, and no Travel Options journey to watch); worldModes.js
// (interiors) and dungeonContext.js have no sky - a door closes the view
// before either host draws a frame (AUDIT DEEP X-1: world.js cuts it above
// the mode's return, where the frame first sees the host is not outdoors;
// `allowed()` reads the same mode for the exterior frame's own cut).
//
// WHAT THIS FILE OWNS: the view's four states, the input it captures
// while up, the camera it hands the frame, and every way out. What it
// does NOT own: the camera's numbers (player/travelCamera.js, pure), the
// readout (ui/travel/travelViewHud.js), the body (player/mwView.js holds it in
// third person), the cursor (player/pointerLock.js) - each reached
// through the deps the host hands in, so the pins drive this whole
// machine against a fake host.
//
// THE STATES: off -> rising (TV_RISE_S, from the head's own eye) -> up
// -> falling (TV_FALL_S, back to the head, which keeps moving under it)
// -> off. A window opening, the host leaving the open air, the traveller
// dying: the view CUTS to off at once - a window is drawn over the
// head's frame, and a fall behind it would only be a fall nobody sees.
//
// THE INPUT, WHILE UP, IS THE VIEW'S (the wizard's law, U50: "A MODAL
// OVERLAY OWNS ITS INPUT"): a canvas press, drag, wheel and context menu
// are taken in the CAPTURE phase on the window and stopped, so the
// host's own ladders - the swing on the right button, Mouse0's
// activation, the relock on a press, the Morrowind zoom on the wheel -
// never see them. The DOM around the canvas (the readout's button, the
// travel panel, the chat) keeps its own clicks. The keyboard is the
// host's, bar seven things: the pause action (out), the look keys TurnLeft /
// TurnRight / LookUp / LookDown, which turn and tilt the view instead of
// the traveller, and the world's own two presses (TV_WORLD_ACTIONS, AUDIT
// DEEP2 A2). The host's own activation keys - Interact, SocialInteract,
// the loot keys - it refuses itself while the view is up (AUDIT OW5 V2),
// under the journey panel's own E. Movement is CAMERA-RELATIVE: while a movement key is
// held and no journey drives, the traveller turns toward the view's
// heading, so W walks up the screen.
//
// THE HEARTBEAT (the world plaque's own law, AUDIT-WH2 L3-F2: a DOM
// overlay stays painted, and a capture listener stays on the window,
// unless something tells it otherwise). Every frame the host draws re-arms
// it; when the frames stop coming for TV_HEARTBEAT_MS the view comes down
// on its own. A loop another boot or an unwind killed (`alive()` false) is
// taken down QUIETLY - the listeners and the readout, never the cursor,
// which is the successor's; a loop that threw, or a video that holds the
// frame, drops the view the ordinary way and hands the input back; a
// hidden tab (the browser stops the frames, nothing broke) keeps it. So
// the host's one unwind line (P0's `frameAlive` guard) stays the plaque's.
// ═══════════════════════════════════════════════════════════════════
import {
  TV_RISE_S, TV_FALL_S, TV_ZOOM_STEP, ceilingFor, initialCamera, stepCamera, zoomTarget, orbitBy, turnCamera, blendView,
  anglesOf, rightOf, leanedUp, turnHeading, forwardOf, tvOwnGrow, keysHeading,
} from '../player/travelCamera.js';
import { travelRateOf } from '../systems/timeScale.js';   // RATE-LAW: the keys' travel runs at its ground's rate
import { noteFirstUse } from '../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page

/** A press that moves further than this (px) before it lifts is a drag (the orbit), not a click (a pick). */
export const TV_CLICK_SLOP = 6;
/** AUDIT DEEP2 A2: the world's own presses - never made from under the view (the pad's A and Y reach the page as these). */
export const TV_WORLD_ACTIONS = Object.freeze(['ActivateCenterObject', 'SwingWeapon']);
/** AUDIT DEEP2 A4: a wheel event's pixels a zoom notch (a mouse's click is about 100), and the most notches one event
 *  may carry. */
export const TV_WHEEL_PX = 100, TV_WHEEL_MAX = 3;
/** AUDIT DEEP2 A4: A WHEEL EVENT BY ITS SIZE - ui/heldMap.js wheelPixels' law (lines 16 px, pages the screen), as zoom
 *  notches: a trackpad's dozens of small deltas were a full notch each, and crossed the whole band in a flick. */
export function wheelNotches(e, pageHeight = 800) {
  const d = Number(e?.deltaY) || 0;
  const px = e?.deltaMode === 1 ? d * 16 : e?.deltaMode === 2 ? d * (pageHeight || 800) : d;
  return Math.max(-TV_WHEEL_MAX, Math.min(TV_WHEEL_MAX, -px / TV_WHEEL_PX));
}
/** Keyboard orbit, radians per second; keyboard tilt, radians per second. */
export const TV_KEY_ORBIT_RATE = 1.6;
export const TV_KEY_TILT_RATE = 0.9;
/** The look keys the view takes for itself while up. */
export const TV_LOOK_ACTIONS = Object.freeze(['TurnLeft', 'TurnRight', 'LookUp', 'LookDown']);
/** How long the view waits for a frame before it takes itself down (ms) - a stalled or killed loop. */
export const TV_HEARTBEAT_MS = 600;
/** The movement actions whose press turns the traveller toward the view's heading. */
export const TV_MOVE_ACTIONS = Object.freeze(['MoveForwards', 'MoveBackwards', 'MoveLeft', 'MoveRight']);

/** TV1: THE DOOR UP - its words on the held map's foot row (ui/heldMap.js) and, ETHER-OW (2026-10-13), on the Eltheric
 *  Ocean's chart (ui/etherChartWindow.js), the map's answer past the Veil - and its key on either: O. */
export const TRAVEL_VIEW_BUTTON = 'Overworld (O)';
/** The view's own lines - the refusals the door says, and the readout's place line. */
export const TRAVEL_VIEW_TEXT = Object.freeze({
  enhancedOnly: 'Turn on the enhanced interface to use the overworld.',
  indoors: 'You can only survey the land from the open air.',
  underwater: 'You cannot survey the land from under the water.',
  enemies: 'You cannot survey the land with enemies nearby.',
  // TV2: what a click says when it cannot be a journey, and the trip's own words
  noJourneys: 'Turn on Travel Options to travel from the overworld.',
  water: 'You cannot walk out onto the water.',
  far: 'That lies beyond what you can see from here.',
  noWay: 'There is no way there by land.',
  mountains: 'The mountains cannot be crossed on foot.',   // OW-MOUNTAINS: a spot among the peaks
  placesOnly: 'Travel Options travels only to places. Click a town.',   // AUDIT DEEP T2-8: coordinate targeting off
  spot: 'The marked spot',
  theSpot: 'the marked spot',   // AUDIT OW5 P5: inside a sentence ("L leads the party to the marked spot.")
  partyHalted: 'The party has stopped.',
  attackAsk: (name) => [`Attack ${name || 'them'}?`, 'You will travel straight to them.'],   // OW-ATTACK: the box on an enemy's double-click   // AUDIT OW5 P5: a halt said - the panel only closed, and nobody knew why
  byRoad: (name) => `To ${name}, by the road`,
  acrossCountry: (name) => `To ${name}, across country`,
  toSpot: 'To the marked spot',
  // OWS2: the crossing's words - the trip's line when it puts to sea, and why one cannot
  bySea: (name) => `To ${name}, by sea`,
  toSpotBySea: 'To the marked spot, by sea',
  needBoat: 'There is no way there by land. You need a boat to cross the water.',
  passenger: 'You are aboard another\'s boat. Its helmsman sets the course.',
  rider: 'You ride in another\'s wagon. Its driver sets the course.',   // WAGONS2: seated in the back of another's wagon (scenes/wagon/wagonRiders.js)
  climbing: 'You cannot set out from a wall. Climb down first.',   // AUDIT FB1007b C2
  noLaunch: 'There is no water here for your boat to float in.',
  noWayAtSea: 'Your boat can make no way toward its mark.',
  noShore: 'There is no safe landing here. Your boat stays in the water.',
  leftMoored: 'Your boat is left moored where it landed.',
  noBoat: 'Your boat is not with you to cross the water.',
  aground: 'Your boat has run aground.',
  raidersAlongside: 'Pirates come alongside!',   // OWS3
  enemiesSlow: 'Enemies are near. You slow your pace.',   // OW6: the journey held for an enemy near (systems/travel/travelThreat.js), said once as it begins
  // TV-WASD: the bar's line while the movement keys travel - the speed, and the governor's hold beside it (the land's; OW6: or an enemy's)
  travelling: (rate, held = null) => (held != null && held < rate ? `Traveling at ×${held} of ×${rate}` : `Traveling at ×${rate}`),   // the travel strip's own sign
  inPlace: (place, region) => (region ? `${place}, ${region}` : place),
  nearPlace: (place, region) => (region ? `Near ${place}, ${region}` : `Near ${place}`),
  wilderness: (region) => (region ? `The wilds of ${region}` : 'The wilds'),
});

/** SHIP-SAIL (2026-09-28): the rows of the passage the Overworld offers where the walk is refused and the map's ship
 *  passage sails - the question, the fare's own row (partyTravelLaw.fareText, the party's prompts' words), the days
 *  the map would count (MERGE with LIVED1: online too - they pass on the traveller's own clock, `own`, as the enhanced
 *  map's "N days of your time" says; OL2's "none online, where the arrival is now" is superseded), and the popup's
 *  warning, said on the prompt as the party's journeys say it. */
export function shipPassageRows(name, fareRow, days = 0, unwell = false, own = false) {
  const rows = [`There is no way to ${name || 'there'} by land. Sail there by ship?`, fareRow];
  if (days > 0) rows.push(`The voyage takes ${days} ${days === 1 ? 'day' : 'days'}${own ? ' of your time' : ''}.`);
  if (unwell) rows.push('You are diseased or poisoned.');
  return rows;
}

/** TV2: the trip's line - a place by the roads when half its way or more is road or track, across country otherwise;
 *  a spot is a spot. OWS2: a trip that puts to sea says so. */
export function travelTripLine({ name = '', share = 0, spot = false, sea = false } = {}) {
  if (spot) return sea ? TRAVEL_VIEW_TEXT.toSpotBySea : TRAVEL_VIEW_TEXT.toSpot;
  if (sea) return TRAVEL_VIEW_TEXT.bySea(name);
  return share >= 0.5 ? TRAVEL_VIEW_TEXT.byRoad(name) : TRAVEL_VIEW_TEXT.acrossCountry(name);
}

/**
 * TV-WASD (2026-09-28, Mac: "Also need to add the ability to travel faster with WASD"): THE KEYS TRAVEL. Under the view
 * the movement keys walked the traveller at walking pace (TV1) - a crawl from 260 m up, beside a click's journey at
 * Travel Options' x10. While the view is up and no journey drives, a held movement key runs the world's clock at the
 * travel speed, which TV2's governor then holds to what the land raises, as it holds a journey. RATE-LAW (2026-10-04,
 * Mac: "Roads now travel at x100 and non roads at x60"): that speed is the ground's, as a journey's is - the road's
 * rate on a road or a track (`onRoad`, the traveller's feet on the network's lanes), the open rate anywhere else
 * (systems/timeScale.js travelRateOf); it was the Travel Options panel's spinner. The clock and not the legs, as a
 * journey's: offline the calendar runs with the walk (the road costs its hours), online the body alone (TO-ONLINE).
 * The body walks on its own feet - swimming, at a helm or aboard a boat, the keys are the sea's. The rate, or 0 while
 * the keys walk at walking pace (`travels` false - Travel Options off: no fast travel by the keys).
 */
export function travelWalkRate({ viewUp = false, journey = false, moving = false, onFoot = false, paused = false, travels = true, onRoad = false } = {}) {
  if (!viewUp || journey || !moving || !onFoot || paused || !travels) return 0;
  return travelRateOf(onRoad);
}

/** The readout's place line: inside a location's rect its name; on its pixel outside the rect "Near" it; else the
 *  region's wilds. */
export function travelViewLine({ place = null, near = null, region = '' } = {}) {
  if (place) return TRAVEL_VIEW_TEXT.inPlace(place, region);
  if (near) return TRAVEL_VIEW_TEXT.nearPlace(near, region);
  return TRAVEL_VIEW_TEXT.wilderness(region);
}

/**
 * @param {object} deps
 * @param {any} deps.canvas - the world canvas (the only target whose presses the view takes)
 * @param {() => number[]} deps.feet - the traveller's feet, the scene's frame
 * @param {() => {eye:number[], fwd:number[]}} deps.headView - the eye and look the frame draws without the view
 * @param {() => number} deps.yaw - the traveller's heading
 * @param {(y:number) => void} deps.setYaw
 * @param {(x:number, z:number) => number} [deps.heightAt] - the terrain; -Infinity where unbuilt
 * @param {() => number|null} [deps.cloudBase] - the deck's base over the traveller, metres (null: no deck)
 * @param {() => {ok:boolean, why?:string}} deps.allowed - the open air, a live traveller, the enhanced lane
 * @param {() => boolean} deps.windowUp - a window stands (the host's pause)
 * @param {() => boolean} [deps.overlayUp] - AUDIT DEEP2 A3: an enhanced overlay (the Tab dial) stands over the view - its keys are its own
 * @param {(why: string) => void} [deps.onLower] - OW-ONLY: the view is being brought down (not cut) - `why` the door
 * @param {() => boolean} [deps.danger] - enemies near (DFU's AreEnemiesNearby): the view will not rise, and falls
 * @param {(e:any) => string[]} deps.actionsOf - a key event's registry actions (KB1)
 * @param {() => boolean} [deps.movementHeld] - a movement action is held (the host's own Set)
 * @param {() => {forward: number, strafe: number}} [deps.movementAxes] - OW-FACE: the keys' axes (forward and right, -1..1)
 * @param {() => boolean} [deps.autopilot] - a Travel Options journey drives the traveller
 * @param {(on:boolean) => boolean} [deps.holdBody] - player/mwView.js mwViewHoldThird
 * @param {(free:boolean) => void} [deps.freeCursor] - the cursor out (up) and the look back (off)
 * @param {() => string} [deps.where] - the readout's line: the place and the region
 * @param {(p:number[]) => {x:number,y:number,front:boolean}} [deps.project] - a world point to the screen, this frame
 * @param {(x:number, y:number, e:any) => void} [deps.onPick] - TV2: a click on the ground (viewport pixels)
 * @param {(key:string, e?:any) => void} [deps.onMark] - TV2: a click on a mark that takes one (a place's plate); OW-ATTACK: with the press
 * @param {(x:number, y:number, key:string|null, e?:any) => void} [deps.onContext] - WAYPOINTS: a right click (viewport
 *   pixels, and the pickable mark under it or null)
 * @param {(x:number, y:number) => void} [deps.onPing] - PARTY-PING: the middle button, a point for the party
 * @param {() => Array<{key:string, at:number[], label?:string, sub?:string, kind?:string, pick?:boolean, edge?:boolean, badge?:any, color?:string, kin?:string|null, lv?:number|null, dist?:number, hub?:boolean, tip?:(() => any)|null, wpKind?:string, followed?:boolean}>} [deps.marks] - TV2/TV3/TV5: the
 *   keyed marks the readout draws, at WORLD points (projected here, through the frame's own matrices)
 * @param {() => number[][]} [deps.route] - TV2: the journey's way, world points from the feet on
 * @param {() => string} [deps.trip] - TV2: the journey in words
 * @param {() => {move?:string, out?:string}} [deps.hintKeys] - AUDIT DEEP T1-12: the keys the hint names, read on the way up
 * @param {{show:Function, hide:Function, update:Function, pickAt?:(x:number, y:number) => string|null}} [deps.hud] -
 *   ui/travel/travelViewHud.js (PERF-TV: `pickAt`, the pickable mark drawn under a click)
 * @param {() => void} [deps.openMap] - OW-BLOCK: the block's Map button
 * @param {(id:string) => void} [deps.onWaypointGo] - WAYPOINTS: a followed waypoint's Go
 * @param {() => Record<string,string>|null} [deps.followDist] - WAYPOINTS: each followed waypoint's distance, in words
 * @param {(t:string) => void} [deps.say]
 * @param {boolean} [deps.touch]
 * @param {any} [deps.win] - the event target listeners go on (the window)
 * @param {() => boolean} [deps.alive] - the host's loop still owns the frame (P0's frameAlive)
 * @param {(fn:Function, ms:number) => any} [deps.schedule] - the heartbeat's timer (setTimeout)
 * @param {(h:any) => void} [deps.cancel] - and its cancel (clearTimeout)
 */
/** OW-DOTS-GROUND / OW-DOTS-EVEN: how far apart the route's dots stand on the screen at the traveller's feet (px). */
export const ROUTE_DOT_PX = 12;
/** OW-DOTS-EVEN: the closest two dots may stand on the screen toward the horizon before every other one is let go (px) -
 *  by then each is drawn at its smallest (ROUTE_DOT_SIZES' last), so the line keeps its rhythm: a dot, a gap. */
export const ROUTE_DOT_MIN_PX = 4;
/** OW-DOTS-EVEN: the dots' sizes, a share of the dot at the feet - each dot drawn at the one nearest its own perspective
 *  (the ground's scale where it lies over the scale at the feet), so a dot and the gap after it shrink together toward
 *  the horizon, as a row of posts does. */
export const ROUTE_DOT_SIZES = Object.freeze([1, 0.85, 0.72, 0.6, 0.5, 0.42]);
/** The size class of a dot whose ground stands `r` times the feet's scale: the nearest of ROUTE_DOT_SIZES. */
export function routeDotClass(r) {
  let best = 0;
  for (let i = 1; i < ROUTE_DOT_SIZES.length; i++) if (Math.abs(ROUTE_DOT_SIZES[i] - r) < Math.abs(ROUTE_DOT_SIZES[best] - r)) best = i;
  return best;
}
/** OW-DOTS-GROUND: the finest spacing on the ground (m) - every spacing is it doubled, so a coarser set is a subset. */
export const ROUTE_DOT_M = 0.25;
/** OW-DOTS-GROUND: the most dots a frame lays (a far journey's line toward the horizon is bounded by it). */
export const ROUTE_DOTS_MAX = 1500;
/** OW-DOTS-EVEN: the spacing picked at the feet is kept until the dots there stand outside this share of ROUTE_DOT_PX
 *  (a zoom, a slope) - a spacing on its edge never flickers between two. */
export const ROUTE_DOT_KEEP = Object.freeze([0.8, 2.2]);
/** The finest doubling of ROUTE_DOT_M that stands `px` apart where the ground is `perM` px a metre. */
const dotStep = (perM, px) => ROUTE_DOT_M * 2 ** Math.max(0, Math.ceil(Math.log2(px / (perM * ROUTE_DOT_M))));
/**
 * OW-DOTS-GROUND (2026-10-12, Mac with a video: "the dotted lines dont look still"): THE ROUTE'S DOTS ARE POINTS ON THE
 * LAND. A dash pattern lives on the screen: laid along the projected path, it slid whenever the picture's lengths
 * changed - the camera's perspective stretches every piece as it follows the traveller, so no offset could hold it. Here
 * each dot is a place on the route in the world, at a whole multiple of a spacing measured back along the route from the
 * journey's end (ground metres, x and z), and projected like any mark: it stays where it lies while the traveller walks
 * over it.
 * OW-DOTS-EVEN (Mac: "the dot spacing is still a bit weird make it more consistent"): ONE SPACING ON THE GROUND for the
 * whole line - the doubling of ROUTE_DOT_M that stands ROUTE_DOT_PX apart at the traveller's feet, kept (`keep`, the
 * caller's memo) while it stays within ROUTE_DOT_KEEP of it - so the dots are evenly spaced on the land and close in
 * toward the horizon only as the land itself does, as a road's posts would. (A spacing picked piece by piece doubled at
 * every threshold the line crossed: runs of dots, then gaps.) Only where they would crowd closer than ROUTE_DOT_MIN_PX
 * on the screen does every other one drop out. Each dot carries its size class (`c`, routeDotClass): drawn smaller as the
 * land recedes, so the dot keeps its share of the gap after it. A piece is halved until it is short on the screen (a straight world piece
 * is not straight on it), and one behind the eye or off the screen (`w` x `h`, grown by `m`) lays nothing.
 * @param {number[][]} points the route's world points, the traveller's feet first, the journey's end last
 * @param {(p:number[]) => ({x:number, y:number, front:boolean}|null)} proj
 * @returns {{x:number, y:number, c:number}[]}
 */
export function routeGroundDots(points, proj, { px = ROUTE_DOT_PX, min = ROUTE_DOT_MIN_PX, max = ROUTE_DOTS_MAX, w = Infinity, h = Infinity, m = 16, keep = null } = {}) {
  const out = [];
  if (!points || points.length < 2 || typeof proj !== 'function') return out;
  const off = (q) => !q?.front || !Number.isFinite(q.x) || !Number.isFinite(q.y);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // THE LINE'S ONE SPACING: the ground's scale at the feet - a metre (or the first piece, if shorter) along the way
  let base = 0, feetPerM = 0;
  {
    const f = points[0];
    let n = 1;
    while (n < points.length - 1 && Math.hypot(points[n][0] - f[0], points[n][2] - f[2]) < 1e-6) n++;
    const L = Math.hypot(points[n][0] - f[0], points[n][2] - f[2]);
    const t = L > 0 ? Math.min(1, 1 / L) : 0;
    const q0 = proj(f), q1 = t > 0 ? proj(lerp(f, points[n], t)) : null;
    const perM = !off(q0) && !off(q1) ? Math.hypot(q1.x - q0.x, q1.y - q0.y) / (L * t) : 0;
    feetPerM = perM;
    if (perM > 0) {
      const kept = keep?.k > 0 ? keep.k * perM : 0;
      base = kept >= px * ROUTE_DOT_KEEP[0] && kept <= px * ROUTE_DOT_KEEP[1] ? keep.k : dotStep(perM, px);
      if (keep) keep.k = base;
    } else if (keep?.k > 0) base = keep.k;   // the feet off the picture: the spacing they last had
  }
  // a: the far end (dA from the journey's end), b: the near end (dB < dA)
  const piece = (a, b, dA, dB, qa, qb, depth) => {
    if (out.length >= max || !(dA > dB)) return;
    if (off(qa) && off(qb)) return;
    if (!off(qa) && !off(qb)) {
      if ((qa.x < -m && qb.x < -m) || (qa.x > w + m && qb.x > w + m) || (qa.y < -m && qb.y < -m) || (qa.y > h + m && qb.y > h + m)) return;
    }
    const len = off(qa) || off(qb) ? Infinity : Math.hypot(qb.x - qa.x, qb.y - qa.y);
    if (len > 80 && depth < 16) {   // short on the screen: its scale near even along it (OW-DOTS-EVEN)
      const mid = lerp(a, b, 0.5), dm = (dA + dB) / 2, qm = proj(mid);
      piece(a, mid, dA, dm, qa, qm, depth + 1);
      piece(mid, b, dm, dB, qm, qb, depth + 1);
      return;
    }
    if (!Number.isFinite(len)) return;   // still across the eye's plane at the depth's end: no dots there
    const perM = len / (dA - dB);
    if (!(perM > 0)) return;
    const k = Math.max(base || dotStep(perM, px), dotStep(perM, min));   // the line's spacing; thinned only where it would crowd
    // each dot's size by the ground's scale where IT lies: the steps to its neighbours on the screen over the step on the
    // ground (the piece's own scale for a lone dot) - a piece's mean would size its near and far dots alike
    const qs = [];
    for (let t = Math.floor(dA / k) * k; t > dB && qs.length + out.length < max; t -= k) {
      if (t > dA || t <= 0) continue;   // the end's own dot is the cross
      qs.push(proj(lerp(b, a, (t - dB) / (dA - dB))));
    }
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (off(q) || q.x < -m || q.x > w + m || q.y < -m || q.y > h + m) continue;
      const nb = [qs[i - 1], qs[i + 1]].filter((o) => o && !off(o));
      const here = nb.length ? nb.reduce((sum, o) => sum + Math.hypot(q.x - o.x, q.y - o.y), 0) / nb.length / k : perM;
      out.push({ x: q.x, y: q.y, c: routeDotClass(feetPerM > 0 ? here / feetPerM : 1) });
    }
  };
  let d = 0;
  let qb = proj(points[points.length - 1]);
  for (let i = points.length - 1; i > 0 && out.length < max; i--) {
    const b = points[i], a = points[i - 1];
    const seg = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const qa = proj(a);
    if (seg > 0) piece(a, b, d + seg, d, qa, qb, 0);
    d += seg; qb = qa;
  }
  return out;
}

export function createTravelView(deps) {
  const win = deps.win ?? globalThis;
  let state = 'off';           // 'off' | 'rising' | 'up' | 'falling'
  let t = 0;                   // the blend: 0 the head, 1 the sky
  let camera = null;           // player/travelCamera.js's state
  let shown = null;            // the frame's { eye, fwd } once blended
  let askedBody = false;       // AUDIT TV B2: the body was ASKED to hold - released on the way down whatever it answered
  let listening = false;
  let press = null;            // { id, x, y, moved, button }
  const pointers = new Map();  // pointerId -> {x, y} (pinch)
  let pinch = null;            // { d } the last two-finger distance
  const lookHeld = new Set();  // the TV_LOOK_ACTIONS held
  const keysTaken = new Set(); // AUDIT TV B4: the key codes whose press the view took - only their release is the view's
  const buttonsTaken = new Set(); // ...and the mouse buttons
  let lastHeading = null;
  let hintKeys = null;         // AUDIT DEEP T1-12: the bound keys the hint names (the Controls page is a window: never changes under the view)
  let beat = null;             // the heartbeat's timer
  let missed = false;          // AUDIT DEEP X-9: one beat already went by with no frame
  const schedule = deps.schedule ?? ((fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null));
  const cancel = deps.cancel ?? ((h) => { if (h != null && typeof clearTimeout === 'function') clearTimeout(h); });
  /** The host's loop is gone (a later boot, an unwind): down quietly, and the event goes on to whoever owns it now. */
  const gone = () => { if (state === 'off' || !deps.alive || deps.alive()) return false; finish(true); return true; };

  const isCanvasEvent = (e) => {
    const c = deps.canvas;
    const tg = e?.target;
    return !!c && (tg === c || (typeof c.contains === 'function' && tg && c.contains(tg)));
  };
  const swallow = (e) => { e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.(); };
  /** AUDIT TV B7: a key typed into a box (the chat, a name) is the box's - never the view's turn or its way down. */
  const typing = (e) => { const tg = e?.target; return !!tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || !!tg.isContentEditable); };

  function onPointerDown(e) {
    if (state === 'off' || gone() || !isCanvasEvent(e)) return;
    swallow(e);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; press = null; return; }
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, button: e.button ?? 0 };
  }
  function onPointerMove(e) {
    if (state === 'off') return;
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.d > 0 && d > 0) zoom(Math.log(d / pinch.d) / Math.log(TV_ZOOM_STEP));   // fingers apart: in
      pinch.d = d;
      return;
    }
    if (!press || press.id !== e.pointerId || !camera) return;
    // AUDIT DEEP2 A7: a MOUSE with no button down is not dragging - its release went elsewhere (a focus lost mid-drag),
    // and every hover after it orbited the view
    if (e.pointerType === 'mouse' && e.buttons === 0) { press = null; pointers.delete(e.pointerId); return; }
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.moved && Math.hypot(dx, dy) > TV_CLICK_SLOP) press.moved = true;
    if (press.moved) camera = orbitBy(camera, e.clientX - prev.x, e.clientY - prev.y);
  }
  function onPointerUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (state === 'off') { press = null; return; }
    swallow(e);
    const p = press;
    press = null;
    // AUDIT TV B9: a cancelled press (the browser took the finger for a scroll or a gesture) is never a pick
    if (p && p.id === e.pointerId && !p.moved && p.button === 0 && state === 'up' && e.type !== 'pointercancel') {
      // PERF-TV: the marks are drawn, so a click on a plate is found by where it landed - a place's (or TV5's far
      // place's) journey, never the ground's pick
      const key = deps.hud?.pickAt?.(e.clientX, e.clientY) ?? null;
      if (key) deps.onMark?.(key, e); else deps.onPick?.(e.clientX, e.clientY, e);   // OW-ATTACK: the press with the mark (an enemy's single click is the ground's)
    }
    // WAYPOINTS (2026-10-06, the player: "with right mouseclick context menu"): a RIGHT press that never moved is the
    // waypoint menu's - on a mark (a flag: its own menu) or on the land (add one there). A right DRAG still orbits.
    if (p && p.id === e.pointerId && !p.moved && p.button === 2 && state === 'up' && e.type !== 'pointercancel') {
      const key = deps.hud?.pickAt?.(e.clientX, e.clientY) ?? null;
      deps.onContext?.(e.clientX, e.clientY, key, e);
    }
    // PARTY-PING: the middle button names a point for the party. A drag still orbits.
    if (p && p.id === e.pointerId && !p.moved && p.button === 1 && state === 'up' && e.type !== 'pointercancel') {
      deps.onPing?.(e.clientX, e.clientY);
    }
  }
  function onMouse(e) {   // the host's window mousedown/mouseup (the swing, Mouse0) - the canvas's are the view's
    if (state === 'off' || gone() || !isCanvasEvent(e)) return;
    // AUDIT TV B4: a button held down before the view rose is the host's - its release goes on to the host, or the
    // swing (or Mouse0's hold) sticks down for good
    const b = e.button ?? 0;
    if (e.type === 'mouseup') { if (!buttonsTaken.delete(b)) return; } else buttonsTaken.add(b);
    swallow(e);
  }
  /** AUDIT TV B3: a finger on the canvas is the view's (its pointer events orbit, pinch and pick) - the touch layer
   *  (ui/touch/touch.js) never starts a stick, a look or a tap under it. Only the START is taken: a finger down before the view
   *  rose ends as the touch layer's own, so its stick lets go. */
  function onTouchStart(e) {
    if (state === 'off' || gone() || !isCanvasEvent(e)) return;
    swallow(e);
  }
  function onWheel(e) {
    if (state === 'off' || gone() || !isCanvasEvent(e)) return;
    swallow(e);
    zoom(wheelNotches(e, win?.innerHeight));
  }
  function onContext(e) { if (state !== 'off' && !gone() && isCanvasEvent(e)) swallow(e); }
  function onKey(e, down) {
    if (state === 'off' || gone()) return;
    const acts = deps.actionsOf?.(e) ?? [];
    const code = e.code ?? e.key ?? '';
    // AUDIT TV B7: a key typed into a box is the box's. AUDIT DEEP T1-7: a RELEASE there still stops the view's own turn
    // (a look key held, the chat opened, the key let go in the box: the view orbited on with nothing held)
    if (typing(e)) { if (!down) { keysTaken.delete(code); for (const a of acts) lookHeld.delete(a); } return; }
    // AUDIT TV B4: a release is the view's only when the press was - a look key held down before the view rose lets
    // go in the host's own Set, or the traveller turns on after the view is gone
    if (!down && !keysTaken.delete(code)) {
      for (const a of acts) lookHeld.delete(a);
      return;
    }
    // AUDIT DEEP2 A6: an auto-repeat of a key held down before the view rose is the host's too - taken, its release was
    // swallowed and the host turned the traveller on for good
    if (down && e.repeat && !keysTaken.has(code)) return;
    // AUDIT DEEP2 A3: an enhanced overlay opened over the view (the Tab dial) has the keys - its Escape closes it, its
    // arrows choose on it; the view took them first and went down under a dial still open
    if (down && deps.overlayUp?.()) return;
    // the pause key is the way down (KB1: the registry's Escape action, wherever the player bound it) - never the pause
    if (acts.includes('Escape')) { if (down) { keysTaken.add(code); exit('escape'); } swallow(e); return; }
    // AUDIT DEEP2 A2: the world's activation and swing are never pressed from under the view - a pad's A and Y reach the
    // page as those keys (ui/gamepadInput.js), and activated what stood before the traveller's head, or swung
    if (acts.some((a) => TV_WORLD_ACTIONS.includes(a))) { if (down) keysTaken.add(code); swallow(e); return; }
    const look = acts.filter((a) => TV_LOOK_ACTIONS.includes(a));
    if (!look.length) return;
    for (const a of look) { if (down) lookHeld.add(a); else lookHeld.delete(a); }
    if (down) keysTaken.add(code);
    swallow(e);
  }
  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);
  /** AUDIT DEEP2 A7: the window lost its focus - no release will come for what was held (a look key kept the view
   *  spinning, a drag orbited on every hover), so nothing is held. */
  function onBlur() {
    press = null; pinch = null;
    pointers.clear(); lookHeld.clear(); keysTaken.clear();
  }

  function listen(on) {
    if (on === listening || typeof win?.addEventListener !== 'function') return;
    const m = on ? 'addEventListener' : 'removeEventListener';
    win[m]('pointerdown', onPointerDown, true);
    win[m]('pointermove', onPointerMove, true);
    win[m]('pointerup', onPointerUp, true);
    win[m]('pointercancel', onPointerUp, true);
    win[m]('mousedown', onMouse, true);
    win[m]('mouseup', onMouse, true);
    win[m]('wheel', onWheel, { capture: true, passive: false });
    win[m]('contextmenu', onContext, true);
    win[m]('touchstart', onTouchStart, { capture: true, passive: false });   // AUDIT TV B3
    win[m]('keydown', onKeyDown, true);
    win[m]('keyup', onKeyUp, true);
    win[m]('blur', onBlur, true);   // AUDIT DEEP2 A7
    listening = on;
  }

  function zoom(notches) {
    if (!camera || !notches) return;
    camera = { ...camera, heightTarget: zoomTarget(camera.heightTarget, notches, ceilingFor(deps.cloudBase?.() ?? null)) };
  }

  function enter() {
    if (state === 'up' || state === 'rising') return true;
    const ok = deps.allowed();
    if (!ok?.ok) { if (ok?.why) deps.say?.(ok.why); return false; }
    if (deps.danger?.()) { deps.say?.(TRAVEL_VIEW_TEXT.enemies); return false; }
    noteFirstUse('travel-view');   // TUT1
    const from = state;
    if (from === 'off') camera = initialCamera(deps.feet(), deps.yaw());
    state = 'rising';
    // a view caught on its way down rises again with the body and the cursor it already holds (AUDIT TV B9: the host
    // notes the cursor as it was once, on the way up from the head)
    if (from === 'off') {
      hintKeys = deps.hintKeys?.() ?? null;
      deps.holdBody?.(true);
      askedBody = !!deps.holdBody;   // AUDIT TV B2: asked is released, even when the body could not be held
      deps.freeCursor?.(true);
    }
    listen(true);
    deps.hud?.show({ onReturn: () => exit('button'), onMap: () => deps.openMap?.(), onWaypointGo: (id) => deps.onWaypointGo?.(id) });   // OW-BLOCK: the block's Map; WAYPOINTS: a followed row's Go
    rearm();
    return true;
  }

  /** Re-armed by every frame the host draws; fires only when they stop. */
  function rearm() {
    missed = false;
    cancel(beat);
    beat = schedule(stalled, TV_HEARTBEAT_MS);
  }
  function stalled() {
    beat = null;
    if (state === 'off') return;
    if (gone()) return;
    if (win?.document?.hidden) { rearm(); return; }   // a hidden tab: the browser stopped the frames, nothing broke
    // AUDIT DEEP X-9: ONE silent beat is a long task (a quicksave, a shader's first compile) - its timer runs before the
    // frame it held back does; the view comes down on the SECOND, a loop that really stopped
    if (!missed) { missed = true; beat = schedule(stalled, TV_HEARTBEAT_MS); return; }
    finish();
  }

  /** Out: `cut` drops straight to off (a window, a door, a death); otherwise the camera falls back to the head. */
  function exit(why = 'escape', cut = false) {
    if (state === 'off') return false;
    if (!cut) deps.onLower?.(why);   // OW-ONLY: the host hears a view brought down - a journey stops with it
    if (cut) { finish(); return true; }
    state = 'falling';
    return true;
  }

  /** Down to off. `quiet`: the host is gone - the cursor is its successor's, so it is not handed back. */
  function finish(quiet = false) {
    cancel(beat);
    beat = null;
    state = 'off';
    t = 0;
    shown = null;
    press = null; pinch = null; pointers.clear(); lookHeld.clear(); keysTaken.clear(); buttonsTaken.clear();
    listen(false);
    deps.hud?.hide();
    if (askedBody) deps.holdBody?.(false);
    askedBody = false;
    if (!quiet) deps.freeCursor?.(false);
  }

  /** Before the motor reads the heading: camera-relative movement, and the look keys' orbit. */
  function steer(dt) {
    if (state === 'off' || !camera) return;
    const yawDir = (lookHeld.has('TurnRight') ? 1 : 0) - (lookHeld.has('TurnLeft') ? 1 : 0);
    const tiltDir = (lookHeld.has('LookDown') ? 1 : 0) - (lookHeld.has('LookUp') ? 1 : 0);
    if (yawDir || tiltDir) camera = turnCamera(camera, yawDir * TV_KEY_ORBIT_RATE * dt, tiltDir * TV_KEY_TILT_RATE * dt);
    // OW-FACE (FIELD BUGS 2026-10-01 #10): the body turns to the way the keys point from the view, not to the view's own
    // heading - it walked every key's way with its back to the camera (S toward it, A and D sideways), so the sprite's
    // eight views and the Morrowind body never turned; the host turns the axes onto the body (axesToward)
    if (!deps.autopilot?.() && deps.movementHeld?.()) {
      const ax = deps.movementAxes?.();
      deps.setYaw(turnHeading(deps.yaw(), (ax && keysHeading(camera.yaw, ax.forward, ax.strafe)) ?? camera.yaw, dt));
    }
  }

  /**
   * THE FRAME'S CAMERA, after the host's own eye is known. Null while off; else the eye and look to draw from, the
   * angles for the sky and the listener, the billboards' right and (leaned) up, the focus the fog and the shadows
   * measure from, and the blend.
   */
  function frame(dt, headArg = null) {
    if (state === 'off') return null;
    rearm();
    const ok = deps.allowed();
    if (!ok?.ok || deps.windowUp()) { finish(); return null; }
    // the view is for the road, not the fight: a foe near brings the camera down to the traveller's own eyes
    if ((state === 'up' || state === 'rising') && deps.danger?.()) exit('danger');
    const head = headArg ?? deps.headView();
    const ceiling = ceilingFor(deps.cloudBase?.() ?? null);
    const r = stepCamera(camera, { feet: deps.feet(), dt, ceiling, heightAt: deps.heightAt ?? null });
    camera = r.camera;
    if (state === 'rising') { t = Math.min(1, t + dt / TV_RISE_S); if (t >= 1) state = 'up'; }
    else if (state === 'falling') { t = Math.max(0, t - dt / TV_FALL_S); if (t <= 0) { finish(); return null; } }
    else t = 1;
    shown = blendView(head, { eye: r.eye, fwd: r.fwd }, t);
    const ang = anglesOf(shown.fwd);
    const tilt = Math.max(0, -ang.pitch);
    const f = deps.feet();
    return {
      eye: shown.eye, fwd: shown.fwd, yaw: ang.yaw, pitch: ang.pitch,
      right: rightOf(ang.yaw), up: leanedUp(ang.yaw, tilt * Math.min(1, t)),
      focus: [camera.focus[0], camera.focus[1], camera.focus[2]],
      blend: t, fullyUp: state === 'up', state,
      grow: tvOwnGrow(Math.hypot(shown.eye[0] - f[0], shown.eye[1] - f[1], shown.eye[2] - f[2])),   // OW-BIG: the traveller's sprite, grown with the eye's distance
    };
  }

  /** The readout, after the frame's matrices exist (the host's projection). */
  const dotSpacing = { k: 0 };   // OW-DOTS-EVEN: the route's ground spacing, kept between frames (routeGroundDots `keep`)
  function drawHud() {
    if (state === 'off' || !deps.hud) return;
    const feet = deps.feet();
    const f = deps.project ? deps.project(feet) : null;
    const ahead = forwardOf(deps.yaw(), 0);
    const a = deps.project ? deps.project([feet[0] + ahead[0] * 4, feet[1], feet[2] + ahead[2] * 4]) : null;
    const h = f && a && f.front && a.front ? (Math.atan2(a.x - f.x, -(a.y - f.y)) * 180) / Math.PI : null;
    if (h != null) lastHeading = h;
    const proj = (p) => (deps.project && p ? deps.project(p) : null);
    const routeWorld = deps.route?.() ?? [];
    const marks = [];
    for (const m of deps.marks?.() ?? []) {
      const at = proj(m.at);
      marks.push({ key: m.key, x: at?.x ?? 0, y: at?.y ?? 0, front: !!at?.front, label: m.label, sub: m.sub, kind: m.kind, pick: !!m.pick, edge: !!m.edge, ...(m.color ? { color: m.color } : {}), badge: m.badge ?? null,
        ...(m.kin ? { kin: m.kin } : {}), ...(m.lv != null ? { lv: m.lv } : {}), ...(Number.isFinite(m.dist) ? { dist: m.dist } : {}), ...(m.hub ? { hub: true } : {}), ...(m.tip ? { tip: m.tip } : {}),
        ...(m.wpKind ? { wpKind: m.wpKind } : {}), ...(m.followed ? { followed: true } : {}) });   // AUDIT NAMES N2-1: and the player's badge - dropped here, every marker was a bare name; AUDIT GATHER-OW: and a group's colour (every diamond was brass); FIELD BUGS 2026-10-04e: OW-KIN's kin, OW-WHO's Renown, OW-NODE-KM's distance, OW-HUBS' wheel and SEAT-TIP's card - each field the readout reads is carried, or it is dropped here; WAYPOINTS: a flag's kind and whether it is followed
    }
    deps.hud.update({
      feet: f, heading: lastHeading, yaw: camera?.yaw ?? 0, where: deps.where?.() ?? '',
      touch: !!deps.touch, fade: t, marks, keys: hintKeys,
      route: routeWorld.map(proj), trip: deps.trip?.() ?? '', sky: deps.sky?.() ?? '',   // OW-FORECAST: the weather ahead
      routeDots: routeGroundDots(routeWorld, proj, { w: deps.canvas?.clientWidth || Infinity, h: deps.canvas?.clientHeight || Infinity, keep: dotSpacing }),   // OW-DOTS-GROUND; OW-DOTS-EVEN: the line's spacing kept frame to frame
      routeDotSizes: ROUTE_DOT_SIZES,   // OW-DOTS-EVEN: the readout's path pair a size
      followDist: deps.followDist?.() ?? null,   // WAYPOINTS: the followed list's distances
    });
  }

  return {
    enter, exit, steer, frame, drawHud,
    /** The host's teardown: out at once, listeners and all. */
    dispose() { if (state !== 'off') finish(); },
    get active() { return state !== 'off'; },
    get state() { return state; },
    get camera() { return camera; },
    get blend() { return t; },
    /** TV2's ray and TV3's marks read the frame's own eye. */
    get eye() { return shown?.eye ?? null; },
    /** PARTY-PING: a key while the view is up looks along this, not the body's. */
    get fwd() { return shown?.fwd ?? null; },
    /** AUDIT DEEP2 D2: THE FLOATING ORIGIN MOVED by `offset` - every scene point the view holds moves with it. Unmoved,
     *  the feet's 819 m re-anchor read as a jump: the focus snapped to them and the eye lurched forward by its eased lag at
     *  every map pixel crossed (37 m at 400 m/s), and the frame's eye (the peers' and the sprite's 8-way view) stood a
     *  pixel off for a frame. A teleport is still a jump - it is no re-anchor. */
    rebase(offset) {
      if (!offset) return;
      const sh = (p) => (p ? [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]] : p);
      if (camera) camera = { ...camera, focus: sh(camera.focus), feet: sh(camera.feet) };
      if (shown) shown = { ...shown, eye: sh(shown.eye) };
    },
  };
}
