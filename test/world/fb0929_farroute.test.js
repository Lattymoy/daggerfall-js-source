// FB0929 (2026-09-29, the Discord's #bug-reports, SylviaBun, through Mac): "New Overworld map lags when fast-traveling
// to a distant location. I can use the Overworld map just fine, no lag even when moving at high speeds when just
// clicking around. The moment I go to my Travel Map and select a far away destination, the game drops to sub-10 FPS."
// (bible/06-Systems/Travel-View.md, FB0929.)
//
// THE FAR JOURNEY'S LINE. TV2's route line is an SVG path through every projected point of the journey - four a leg -
// dashed over a dark casing (ui/enhanced/enhancedStyle.js .tview-route-line). A click in the view is a few legs, all on the
// screen; a pick on the travel map is a hundred and more, and a point of it beside the eye's plane projects hundreds of
// thousands of pixels out. The browser lays a dash every 15 px of the WHOLE path, off the screen too, and rasters it
// again every frame the camera moves: 1,500,000 px of path, 100,000 dashes a frame. The planner, the legs and the
// host's points were never the cost (a plan is made once, at the pick). Now the path is cut to the screen, grown by
// ROUTE_CLIP_PX, before it is written - the same line on the screen, a screen's worth of dashes.
//
// Built by the real producers end to end: Hazelnut's own road bytes (vendor/roads-hazelnut) routed by the planner
// (planRoute, routeLegs), the host's drawn points (tvLegMid and routeDrawPoints), the host's line (travelViewRoute,
// lifted out of world.js's own text and run - tv7's bandHost way), the view's camera and the frame's projection
// (createTravelView, mat4, tapRay.projectToScreen) and the readout (updateTravelViewHud). The browser's own measure
// of the frame is tools/travelViewPerf.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planRoute, routeLegs, routeDrawPoints } from '../../src/systems/travel/travelRoute.js';
import { createTravelView, ROUTE_DOT_PX, ROUTE_DOTS_MAX } from '../../src/scenes/travelView.js';
import { forwardOf, TV_RISE_S } from '../../src/player/travelCamera.js';
import { projectToScreen } from '../../src/player/tapRay.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';
import { StreamingWorldState, mapPixelToWorldCoords } from '../../src/world/streamingWorld.js';
import * as hud from '../../src/ui/travel/travelViewHud.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const bytes = (n) => new Uint8Array(readFileSync(new URL(`../../vendor/roads-hazelnut/${n}`, import.meta.url)));
const NET = { roads: bytes('roadData.bytes'), tracks: bytes('trackData.bytes') };
const W = 1366, H = 768;   // the reporter's class of screen
const FROM = { x: 195, y: 172 };   // a pixel on one of Hazelnut's roads
const NEAR = { x: 193, y: 169 };   // three pixels off: a town's plate in the view
const FAR = { x: 595, y: 5 };   // four hundred off: a pick on the travel map
const SPOT_M = 300;   // a click on the ground the view shows: 300 m north, in the traveller's own pixel (40 native units a metre)

// the line's paint, read off the style sheet: the dash's period and the casing's width
const CSS = rd('src/ui/enhanced/enhancedStyle.js');
// OW-DOTS-GROUND: the line is drawn as dots now (the view's world points, scenes/travelView.js routeGroundDots) - the
// path's length is still the measure of what an uncut line would cost, a dot every ROUTE_DOT_PX at the finest
const DASH = [null, '0', String(ROUTE_DOT_PX)];
const CASING = /\.tview-route-casing \{[^}]*stroke-width: (\d+);[^}]*stroke-linecap: round; stroke-linejoin: round;/.exec(CSS);
const PERIOD = Number(DASH?.[1]) + Number(DASH?.[2]);

/** The host's two pieces, lifted out of world.js's own text: a leg's pixel middle and the route line's points. */
let _lifted = null;
function lifted() {
  if (_lifted) return _lifted;
  const w = rd('src/scenes/world.js');
  const mid = /\n  const tvLegMid = (\(p\) => \{[^\n]*\});\n/.exec(w);
  const route = /\n  function travelViewRoute\(\) \{\n[\s\S]*?\n  \}\n/.exec(w);
  assert.ok(mid && route, 'tvLegMid and travelViewRoute lifted');
  return (_lifted = { mid: mid[1], route: route[0] });
}

/** A journey from FROM to `goal` as the Overworld makes it: the plan, its legs, the host's drawn points, the host's line.
 *  `spot` (native) a walk's end in the goal's pixel; else the goal's middle. */
function journey(goal, spot = null) {
  const src = lifted();
  const plan = planRoute(FROM, goal, { roads: NET.roads, tracks: NET.tracks });
  assert.ok(plan, 'Hazelnut\'s roads join the two');
  const legs = routeLegs(plan.pixels, plan.kinds);
  const tvLegMid = new Function('mapPixelToWorldCoords', `return ${src.mid};`)(mapPixelToWorldCoords);
  const state = new StreamingWorldState(5);
  state.mapOrigin = { ...FROM }; state.current = { ...FROM };
  const me = tvLegMid(FROM), end = spot ? [spot.x, spot.z] : tvLegMid(goal);
  const [fx, fz] = state.localFromWorld(me[0], me[1]);
  const feet = [fx, 0, fz];
  const d = {
    tvTripLive: () => true, tvTrip: { natives: routeDrawPoints({ x: me[0], z: me[1] }, legs, { x: end[0], z: end[1] }, tvLegMid), _tail: null },
    player: { pos: feet, feetAt: () => feet }, state, travelOptions: { route: { i: 0, join: null } },
    // the scene point of a native one, on flat ground (CI has no ARENA2 heights): world.js tvSceneOf's own placement
    tvSceneOf: (nx, nz, lift = 0) => { const [x, z] = state.localFromWorld(nx, nz); return [x, lift, z]; },
    deepWaters: null, tvSeaY: () => 0, tvGroundGenNow: () => 1,
  };
  const travelViewRoute = new Function('d', `const { ${Object.keys(d).join(', ')} } = d;\n${src.route}\nreturn travelViewRoute;`)(d);
  const n1 = d.tvTrip.natives[1], [ax, az] = state.localFromWorld(n1[0], n1[1]);
  return { plan, legs, feet, travelViewRoute, heading: Math.atan2(ax - fx, az - fz) };
}

/** A document just real enough for the readout (test/ui/travel/tv5_far_places.test.js's fakeDoc, trimmed): its window W x H. */
function fakeDoc() {
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  const win = { innerWidth: W, innerHeight: H, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  const doc = { defaultView: win, fonts: null };
  const mk = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), className: '', textContent: '', id: '', children: [], style: { setProperty() {} }, ownerDocument: doc,
      attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      append(...c) { this.children.push(...c); }, remove() {}, addEventListener() {}, isConnected: true, width: 0, height: 0,
      getBoundingClientRect() { return { width: 0, height: 0 }; },
    };
    if (tag === 'canvas') n.getContext = () => ctx;
    return n;
  };
  Object.assign(doc, { createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null, head: mk('head'), body: mk('body') });
  return doc;
}

/** The view up over the journey, a frame drawn through the frame's own lens (world.js: DFU's 65-degree default field of
 *  view, the far plane 6000) - the readout's path data and the projected points it was handed. `turn` the drag. */
function drawn(j, turn = 0) {
  const doc = fakeDoc();
  const P = mirrorProjectionX(perspective((65 * Math.PI) / 180, W / H, 0.2, 6000));
  let V = null, seen = null;
  const tv = createTravelView({
    canvas: {}, win: { addEventListener() {}, removeEventListener() {} },
    feet: () => j.feet, headView: () => ({ eye: [j.feet[0], 1.7, j.feet[2]], fwd: forwardOf(j.heading, 0) }),
    yaw: () => j.heading + turn, setYaw: () => {}, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: () => [],
    project: (p) => (V ? projectToScreen(p, W, H, P, V, null, true) : null),   // world.js: through the frame's matrices, the mirror behind
    route: j.travelViewRoute, marks: () => [], trip: () => '',
    hud: { show: (h) => hud.showTravelViewHud(h, doc), hide: hud.hideTravelViewHud, update: (f) => { seen = f; hud.updateTravelViewHud(f); } },
    schedule: () => null, cancel: () => {},
  });
  try {
    tv.enter();
    for (let i = 0; i < 90 && tv.state !== 'up'; i++) tv.frame(TV_RISE_S / 60);
    assert.equal(tv.state, 'up');
    const f = tv.frame(1 / 60);
    V = lookAt(f.eye, [f.eye[0] + f.fwd[0], f.eye[1] + f.fwd[1], f.eye[2] + f.fwd[2]], [0, 1, 0]);   // world.js's view
    tv.drawHud();
    return { d: hud.travelViewHudState().route, points: seen.route, dots: seen.routeDots ?? [] };
  } finally { tv.exit('escape', true); hud.disposeTravelViewHud(); }
}

/** Path data's strokes: each subpath's points. */
const strokesOf = (d) => {
  const out = [];
  for (const m of d.matchAll(/([ML])(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
    if (m[1] === 'M') out.push([]);
    out.at(-1).push([Number(m[2]), Number(m[3])]);
  }
  return out;
};
/** How much line the path lays (px) - and the dashes the browser lays along it, one every PERIOD px. */
const lengthOf = (d) => strokesOf(d).reduce((s, st) => st.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - st[i - 1][0], p[1] - st[i - 1][1]) : t), s), 0);
const dashesOf = (d) => Math.round(lengthOf(d) / PERIOD);

test('FB0929 law: the line is cut to the screen grown by ROUTE_CLIP_PX, wider than the casing\'s reach - a cut\'s cap never shows; no screen given, the TV2 law as it was', () => {
  assert.ok(CASING && PERIOD === 12, 'OW-DOTS: a dot every 12 px at the feet, over a round-capped casing');
  assert.equal(hud.ROUTE_CLIP_PX, 16);
  assert.ok(hud.ROUTE_CLIP_PX > Number(CASING[1]) / 2 + 1, 'a round cap at the cut reaches half the casing\'s width past it (and a pixel of smoothing): off the screen');
  const at = (x, y, front = true) => ({ x, y, front });
  const M = hud.ROUTE_CLIP_PX;
  // on the screen: untouched - TV2's own pin, with and without the screen; a point on it written as it is, to the last
  // half pixel (from the margin to x 6.5, `a + (b - a) * 1` is 6.4999...: it would round the other way)
  const tv2 = [at(1.4, 2.6), at(10, 20), at(5, 5, false), at(30, 40), at(31, 41)];
  assert.equal(hud.routePath(tv2), 'M1 3 L10 20 M30 40 L31 41');
  assert.equal(hud.routePath(tv2, 100, 100), 'M1 3 L10 20 M30 40 L31 41');
  assert.equal(hud.routePath([at(-15.47, 50), at(6.5, 50)], 100, 100), 'M-15 50 L7 50');
  // no screen given: nothing is cut, off any edge
  assert.equal(hud.routePath([at(-5000, -70), at(-60, -9000)]), 'M-5000 -70 L-60 -9000');
  // out through the right edge and far away: the stroke ends where it leaves the grown screen
  assert.equal(hud.routePath([at(50, 50), at(100050, 50)], 100, 100), `M50 50 L${100 + M} 50`);
  // in from far away: a stroke begins where it enters
  assert.equal(hud.routePath([at(-100000, 60), at(50, 60)], 100, 100), `M${-M} 60 L50 60`);
  // across the whole screen from far off either side: the part over it alone
  assert.equal(hud.routePath([at(50, -1e6), at(50, 1e6)], 100, 100), `M50 ${-M} L50 ${100 + M}`);
  // wholly past it: nothing - above it, and by a corner either way; out and back: two strokes, never a line joining them
  // across what lies between
  assert.equal(hud.routePath([at(-5e5, -5e5), at(5e5, -5e5)], 100, 100), '');
  assert.equal(hud.routePath([at(200, 50), at(50, -100)], 100, 100), '');
  assert.equal(hud.routePath([at(50, -100), at(200, 50)], 100, 100), '');
  assert.equal(hud.routePath([at(10, 10), at(10, -900), at(90, -900), at(90, 10)], 100, 100), `M10 10 L10 ${-M} M90 ${-M} L90 10`);
  // behind the eye still breaks it, wherever it is
  assert.equal(hud.routePath([at(10, 10), at(20, 20), at(1e6, 0, false), at(30, 30), at(40, 40)], 100, 100), 'M10 10 L20 20 M30 30 L40 40');
});

test('FB0929 far: a pick across the map is a line of 139 legs - uncut, ~1.5 million px of path and ~100,000 dashes a frame; cut, every point within the grown screen and a few hundred dashes', () => {
  const far = journey(FAR);
  assert.equal(far.legs.length, 139, 'four hundred pixels of Hazelnut\'s roads');
  const { d, points, dots: dotsDrawn } = drawn(far);
  assert.equal(points.length, 1 + 4 * far.legs.length, 'the host hands the readout the WHOLE way, four points a leg');
  const uncut = hud.routePath(points);
  assert.ok(dashesOf(uncut) > 50000, `the line as it was: ${dashesOf(uncut)} dashes over ${Math.round(lengthOf(uncut))} px`);
  const M = hud.ROUTE_CLIP_PX;
  for (const st of strokesOf(d)) for (const [x, y] of st) assert.ok(x >= -M && x <= W + M && y >= -M && y <= H + M, `(${x}, ${y}) lies within the screen grown by ${M}`);
  assert.ok(d.startsWith(uncut.slice(0, uncut.indexOf(' L'))), 'the line still starts at the traveller\'s feet');
  assert.ok(dashesOf(d) <= 500, `a screen's worth of dashes (${dashesOf(d)}, over ${Math.round(lengthOf(d))} px)`);
  assert.ok(dotsDrawn.length > 0 && dotsDrawn.length <= ROUTE_DOTS_MAX, `OW-DOTS-GROUND: the dots drawn are bounded (${dotsDrawn.length})`);
  // the camera dragged half round: the line runs behind and beside the eye
  const back = drawn(far, Math.PI);
  assert.ok(dashesOf(hud.routePath(back.points)) > 50000 && dashesOf(back.d) <= 500, `turned: ${dashesOf(hud.routePath(back.points))} dashes uncut, ${dashesOf(back.d)} cut`);
});

test('FB0929 in view: a click on the ground the picture shows is a line wholly on the screen - drawn byte for byte as it was', () => {
  const o = mapPixelToWorldCoords(FROM.x, FROM.y);
  const spot = journey(FROM, { x: o.x + 16384, z: o.z + 16384 + SPOT_M * 40 });
  assert.equal(spot.legs.length, 0, 'in the traveller\'s own pixel: the straight line it is');
  const { d, points } = drawn(spot);
  const M = hud.ROUTE_CLIP_PX;
  assert.ok(points.every((p) => p.front && p.x >= -M && p.x <= W + M && p.y >= -M && p.y <= H + M), 'every point of it on the screen');
  assert.ok(d.length > 0, 'a line to walk');
  assert.equal(d, hud.routePath(points), 'the same path data - the dashes where they were');
});

test('FB0929: the cut line is the SAME line on the screen - every point of the screen as near to it as to the whole one, and its first stroke the whole one\'s from the feet to the screen\'s edge (the dashes\' phase with it) - a town\'s plate a few pixels off, and the pick across the map', () => {
  for (const [goal, turn] of [[NEAR, 0], [FAR, 0], [FAR, Math.PI]]) {
    const { d, points } = drawn(journey(goal), turn);
    const cut = strokesOf(d), whole = strokesOf(hud.routePath(points));
    const segs = (strokes) => strokes.flatMap((st) => st.slice(1).map((p, i) => [st[i][0], st[i][1], p[0], p[1]]))
      .filter(([ax, ay, bx, by]) => Math.max(ax, bx) >= -8 && Math.min(ax, bx) <= W + 8 && Math.max(ay, by) >= -8 && Math.min(ay, by) <= H + 8);
    const dist = (x, y, list) => {
      let best = Infinity;
      for (const [ax, ay, bx, by] of list) {
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        const t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
        best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
      }
      return best;
    };
    const A = segs(whole), B = segs(cut);
    assert.ok(A.length > 0, 'the line crosses the screen');
    let near = 0;
    for (let y = 0; y <= H; y += 3) {
      for (let x = 0; x <= W; x += 3) {
        const a = dist(x, y, A), b = dist(x, y, B);
        if (Math.min(a, b) > 6) continue;
        near++;
        assert.ok(Math.abs(a - b) <= 1, `(${x}, ${y}): ${a.toFixed(2)} px from the whole line, ${b.toFixed(2)} from the cut one`);
      }
    }
    assert.ok(near > 200, `the screen's points about the line compared (${near})`);
    // the first stroke: the whole one's own points from the feet, then where it first leaves the grown screen
    const k = cut[0].length - 1;
    assert.deepEqual(cut[0].slice(0, k), whole[0].slice(0, k), 'from the feet, point for point');
    if (k < whole[0].length) {
      const [ax, ay] = whole[0][k - 1], [bx, by] = whole[0][k], [ex, ey] = cut[0][k];
      assert.ok(dist(ex, ey, [[ax, ay, bx, by]]) <= 1, 'it leaves the screen ON the whole line');
    }
  }
});
