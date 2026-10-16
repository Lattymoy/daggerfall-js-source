// TV-SMOOTH / ROAD-BRIDGE / PACE-KEEP (2026-10-12, Mac with a video: "the overworld traveling at high speed looks
// stuttery on the character and the circle and the line where he walks to can be visually improved", "sometimes your
// multiplier slows down randomly without an enemy nearby").
//   1. the motor's snap guard scales with the step: a x100 step (8-17 m) is a walk, lerped - a teleport still snaps
//   2. one open leg between two road legs is the road's to the rate - a longer open run is still the open ground's
//   3. the Overworld's route line leaves from the DRAWN feet, the ring sits on them by the tenth of a pixel
//   4. the ring and the line's paint: the ring's breath (still under reduced motion), the line's dots standing on the land
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, FIXED_DT, ODOMETER_MAX_SPEED } from '../../../src/player/motor.js';
import { bridgedRoadLeg } from '../../../src/systems/travel/travelOptions.js';
import * as hudMod from '../../../src/ui/travel/travelViewHud.js';
import * as tvMod from '../../../src/scenes/travelView.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A motor's span alone: the reads (feetAt, bodyFeetAt) need nothing else. */
function span(from, to, stepLen) {
  const m = Object.create(PlayerMotor.prototype);
  m._prevPos = [...from]; m.pos = [...to]; m._alpha = 0.5; m._eyeFeetY = null; m.drawFeet = null;
  if (stepLen != null) m._spanStep = stepLen;
  return m;
}

test('TV-SMOOTH: a x100 step is a walk, lerped - the guard was 2 m and every step past it snapped the body, the camera and the ring (mutant: the guard unscaled)', () => {
  const x100 = FIXED_DT * 100;
  const walked = span([0, 0, 0], [12, 0, 0], x100);   // 7.2 m/s for 1.67 s: one step of a run at x100
  assert.deepEqual(walked.bodyFeetAt(0.5), [6, 0, 0], 'half way across the step');
  assert.deepEqual(walked.feetAt(0.5), [6, 0, 0]);
  const tele = span([0, 0, 0], [ODOMETER_MAX_SPEED * x100 + 5, 0, 0], x100);
  assert.deepEqual(tele.bodyFeetAt(0.5), [ODOMETER_MAX_SPEED * x100 + 5, 0, 0], 'past what any body walks in a step: a placement, snapped');
});

test('TV-SMOOTH: at x1 the guard is SNAP_SPAN, exactly as before', () => {
  const m = span([0, 0, 0], [PlayerMotor.SNAP_SPAN + 0.5, 0, 0], FIXED_DT);
  assert.deepEqual(m.bodyFeetAt(0.5), [PlayerMotor.SNAP_SPAN + 0.5, 0, 0], 'a 2.5 m span at x1 is a placement');
  const fresh = span([0, 0, 0], [PlayerMotor.SNAP_SPAN + 0.5, 0, 0]);
  assert.deepEqual(fresh.bodyFeetAt(0.5), [PlayerMotor.SNAP_SPAN + 0.5, 0, 0], 'a motor that never stepped: x1');
  assert.deepEqual(span([0, 0, 0], [1, 0, 0], FIXED_DT).bodyFeetAt(0.5), [0.5, 0, 0]);
  const motor = rd('src/player/motor.js');
  assert.match(motor, /if \(this\._acc >= step\) this\._spanStep = step;/, 'update records the step its span is');
  assert.equal((motor.match(/> this\._snapSpan2\(\)/g) ?? []).length, 3, 'eyeAt, feetAt and bodyFeetAt all read the scaled guard');
  assert.doesNotMatch(motor, /PlayerMotor\.SNAP_SPAN \* PlayerMotor\.SNAP_SPAN/);
});

test('ROAD-BRIDGE: one open pixel between two road legs is the road\'s; a longer run, an open end or open ground on one side is not (mutants: any open leg bridged, the distance unread)', () => {
  const R = (x, kind = 'road') => ({ x, y: 10, kind });
  assert.equal(bridgedRoadLeg([R(1), R(2, 'open'), R(3)], 1), true, 'road, one open pixel, road');
  assert.equal(bridgedRoadLeg([R(1, 'track'), R(2, 'open'), R(3, 'road')], 1), true, 'a track is a road');
  assert.equal(bridgedRoadLeg([R(1), { x: 2, y: 11, kind: 'open' }, R(3)], 1), true, 'a diagonal step');
  assert.equal(bridgedRoadLeg([R(1), R(4, 'open'), R(5)], 1), false, 'three open pixels: the open ground\'s');
  assert.equal(bridgedRoadLeg([R(1, 'open'), R(2, 'open'), R(3)], 1), false, 'open before it');
  assert.equal(bridgedRoadLeg([R(1), R(2, 'open')], 1), false, 'the last leg');
  assert.equal(bridgedRoadLeg([R(1), R(2)], 1), false, 'a road leg is no bridge');
  assert.equal(bridgedRoadLeg([R(1), R(2, 'sea'), R(3)], 1), false, 'a crossing is never the road\'s');
  assert.match(rd('src/systems/travel/travelOptions.js'), /ROAD_LEG_KINDS\.includes\(leg\.kind\) \|\| bridgedRoadLeg\(r\.legs, at\)/, 'journeyOnRoad reads it');
});

test('PACE-KEEP: the ground caps the dials, never writes them', () => {
  const src = rd('src/systems/travel/travelPace.js');
  const fn = /export function setPaceGround\(onRoad\) \{[\s\S]*?\n\}/.exec(src)?.[0] ?? '';
  assert.ok(fn, 'setPaceGround found');
  assert.doesNotMatch(fn, /write\(/, 'no write on the ground\'s word');
});

test('TV-SMOOTH: the route line leaves from the drawn feet; the ring is placed by the tenth of a pixel and centred on them', () => {
  const w = rd('src/scenes/world.js');
  const route = /\n  function travelViewRoute\(\) \{\n[\s\S]*?\n  \}\n/.exec(w)?.[0] ?? '';
  assert.match(route, /const pts = \[player\.feetAt\(\)\];\n\s*const me = state\.worldCoords\(pts\[0\]\);/);
  const hud = rd('src/ui/travel/travelViewHud.js');
  assert.match(hud, /translate3d\(\$\{f\.feet\.x\.toFixed\(1\)\}px, \$\{f\.feet\.y\.toFixed\(1\)\}px, 0\)/);
  const css = rd('src/ui/enhanced/enhancedStyle.js');
  const ring = /\.tview-ring \{([^}]*)\}/.exec(css)?.[1] ?? '';
  const n = (k) => Number(new RegExp(`${k}: (-?\\d+)px`).exec(ring)?.[1]);
  assert.match(ring, /box-sizing: border-box/);
  assert.deepEqual([n('left') * -2, n('top') * -2], [n('width'), n('height')], 'its middle on the feet');
  assert.match(css, /\.tview-ring::after \{[^}]*animation: tview-ring-breath/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.tview-ring::after \{ animation: none; \} \}/);
  // OW-DOTS-GROUND: no dash pattern and no march - the dots are the view's world points, each a round-capped stroke
  for (const sel of ['line', 'casing']) {
    const rule = new RegExp(`\\.tview-route-${sel} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    assert.match(rule, /stroke-linecap: round;/, `${sel}: round caps make the dots`);
    assert.doesNotMatch(rule, /animation|dasharray/, `${sel}: still, no screen pattern`);
  }
});

test('OW-DOTS-GROUND (Mac: "the dotted lines dont look still"): the route\'s dots are points on the land - the camera following the traveller moves none of them on the ground; toward the horizon they only thin (mutants: laid from the feet; the spacing not a doubling)', () => {
  const { routeGroundDots, ROUTE_DOT_M, ROUTE_DOTS_MAX } = tvMod;
  const route = (fz) => [[0, 0, fz], [0, 0, 400], [30, 0, 900], [30, 0, 1600]];   // feet first, the end last
  // a camera 40 m up and 60 m behind the feet, looking along +z, tilted down: a pinhole
  const camAt = (fz) => (p) => {
    const dz = p[2] - (fz - 60), dy = p[1] - 40, dx = p[0];
    const c = Math.cos(0.5), sn = Math.sin(0.5);
    const zc = dz * c - dy * sn, yc = dz * sn + dy * c;
    if (zc < 0.5) return { x: 0, y: 0, front: false };
    return { x: 640 + (700 * dx) / zc, y: 360 - (700 * yc) / zc, front: true, world: p };
  };
  const worldOf = (fz) => {
    const seen = new Map(); const pr = camAt(fz);
    const proj = (p) => { const q = pr(p); if (q.front) seen.set(`${q.x},${q.y}`, p); return q; };
    return routeGroundDots(route(fz), proj, { w: 1280, h: 720 }).map((q) => seen.get(`${q.x},${q.y}`));
  };
  const a = worldOf(0), b = worldOf(7.3);
  assert.ok(a.length > 30 && a.length <= ROUTE_DOTS_MAX, `${a.length} dots`);
  // distance back along the route from the end, x and z: every dot a multiple of the finest spacing
  const back = (p) => { const pts = route(0); let d = 0; for (let i = pts.length - 1; i > 0; i--) { const A = pts[i - 1], B = pts[i]; const L = Math.hypot(B[0] - A[0], B[2] - A[2]); const t = ((p[0] - B[0]) * (A[0] - B[0]) + (p[2] - B[2]) * (A[2] - B[2])) / (L * L); if (t >= -1e-9 && t <= 1 + 1e-9 && Math.hypot(B[0] + (A[0] - B[0]) * t - p[0], B[2] + (A[2] - B[2]) * t - p[2]) < 1e-6) return d + t * L; d += L; } return NaN; };
  for (const p of a) { const k = back(p) / ROUTE_DOT_M; assert.ok(Math.abs(k - Math.round(k)) < 1e-6, `a dot ${back(p)} m back: on the beat`); }
  // walked 7.3 m (the camera with the feet): a dot of the second frame past where both reach is a dot of the first
  const key = (p) => back(p).toFixed(4);
  const A = new Set(a.map(key));
  const common = b.filter((p) => back(p) < 1600 - 8 && back(p) > 60);
  const kept = common.filter((p) => A.has(key(p))).length;
  assert.ok(common.length > 20 && kept / common.length >= 0.9, `${kept} of ${common.length} dots where they were on the land`);
  assert.equal(routeGroundDots([], camAt(0)).length, 0);
  assert.ok(routeGroundDots(route(0), camAt(0), { w: 1280, h: 720 }).every((q) => q.x >= -16 && q.x <= 1296 && q.y >= -16 && q.y <= 736), 'on the screen alone');
  const hud = rd('src/ui/travel/travelViewHud.js');
  assert.match(hud, /const pairs = Array\.isArray\(f\.routeDots\) \? dotPairsFor\(f\.routeDotSizes\) : null;\n\s*const shown = pairs \? '' : Array\.isArray\(f\.routeDots\) \? routeDotsPath\(f\.routeDots, vw, vh\) : d;/, 'the readout draws the dots, a pair a size; the line where none are handed');
  assert.equal(hudMod.routeDotsPath([{ x: 1.26, y: 2 }, { x: 5000, y: 5 }, null], 100, 100), 'M1.3 2.0h0', 'a zero-length stroke each, off the screen none');
  assert.equal(hudMod.routeDotsPath([{ x: 1, y: 2, c: 0 }, { x: 3, y: 4, c: 2 }], 100, 100, 2), 'M3.0 4.0h0', 'one size\'s dots');
  assert.match(rd('src/scenes/travelView.js'), /routeDots: routeGroundDots\(routeWorld, proj, [^\n]*keep: dotSpacing \}\),[^\n]*\n\s*routeDotSizes: ROUTE_DOT_SIZES,/);
});

test('OW-DOTS-EVEN (Mac: "the dot spacing is still a bit weird make it more consistent"): ONE spacing on the ground for the whole line, picked at the feet and kept; the dots shrink with the land toward the horizon, thinned only where they would crowd (mutants: the spacing picked piece by piece; the sizes unread; the keep unread)', () => {
  const { routeGroundDots, ROUTE_DOT_PX, ROUTE_DOT_MIN_PX, ROUTE_DOT_SIZES, routeDotClass } = tvMod;
  const route = [[0, 0, 0], [0, 0, 400], [60, 0, 900], [200, 0, 1600], [400, 0, 4000]];
  const cam = (p) => { const dz = p[2] + 60, dy = p[1] - 40, dx = p[0]; const c = Math.cos(0.45), sn = Math.sin(0.45); const zc = dz * c - dy * sn, yc = dz * sn + dy * c; if (zc < 0.5) return { x: 0, y: 0, front: false }; return { x: 640 + (900 * dx) / zc, y: 360 - (900 * yc) / zc, front: true }; };
  const keep = { k: 0 };
  const dots = routeGroundDots(route, cam, { w: 1280, h: 720, keep });
  assert.ok(keep.k > 0, 'the spacing kept');
  // at the feet: ROUTE_DOT_PX to twice it apart on the screen, and the largest size
  const near = [...dots].sort((p, q) => q.y - p.y);
  const gap = Math.hypot(near[0].x - near[1].x, near[0].y - near[1].y);
  assert.ok(gap >= ROUTE_DOT_PX * 0.8 && gap < ROUTE_DOT_PX * 2.2, `the gap at the feet: ${gap.toFixed(1)} px`);
  assert.equal(near[0].c, 0, 'the dot at the feet the largest');
  // one ground spacing over the line's near stretch: every gap on the screen shrinks steadily - no run of dots and then a
  // doubled gap (the piece-by-piece spacing's look), until the crowding floor
  const gaps = [];
  for (let i = 1; i < near.length && near[i].y > 120; i++) gaps.push(Math.hypot(near[i].x - near[i - 1].x, near[i].y - near[i - 1].y));
  const steady = gaps.slice(0, gaps.findIndex((g) => g < ROUTE_DOT_MIN_PX * 1.5) >>> 0);   // up to where the floor thins them
  assert.ok(steady.length > 15, `${steady.length} gaps before the floor`);
  for (let i = 1; i < steady.length; i++) assert.ok(steady[i] <= steady[i - 1] * 1.05 + 0.3, `gap ${i}: ${steady[i].toFixed(2)} after ${steady[i - 1].toFixed(2)} - steady`);
  // the sizes shrink with them, never grow away from the feet
  for (let i = 1; i < near.length && near[i].y > 120; i++) assert.ok(near[i].c >= near[i - 1].c, 'smaller toward the horizon');
  assert.ok(near.some((p) => p.c >= 3), 'and the far ones small');
  // thinned only at the floor: no two dots closer than it (a tenth of a pixel's grace)
  for (let i = 1; i < near.length; i++) assert.ok(Math.hypot(near[i].x - near[i - 1].x, near[i].y - near[i - 1].y) >= ROUTE_DOT_MIN_PX * 0.5 - 0.1);
  // the keep: a spacing a hair past its edge is held, one far past it is picked again
  const k0 = keep.k;
  routeGroundDots(route, cam, { w: 1280, h: 720, keep });
  assert.equal(keep.k, k0, 'held frame to frame');
  // the keep's band, by the gap at the feet: half the spacing is held while its dots stand ROUTE_DOT_KEEP[0] of the gap
  // or more apart, double it while ROUTE_DOT_KEEP[1] or less - a camera nudged across a doubling's edge keeps its dots
  const { ROUTE_DOT_KEEP } = tvMod;
  for (const f of [0.5, 2]) {
    const held = { k: k0 * f };
    routeGroundDots(route, cam, { w: 1280, h: 720, keep: held });
    const q0 = cam([0, 0, 0]), q1 = cam([0, 0, 1]), at = Math.hypot(q1.x - q0.x, q1.y - q0.y) * k0 * f;   // its dots' gap at the feet
    const inBand = at >= ROUTE_DOT_PX * ROUTE_DOT_KEEP[0] && at <= ROUTE_DOT_PX * ROUTE_DOT_KEEP[1];
    assert.equal(held.k, inBand ? k0 * f : k0, `x${f}: ${inBand ? 'held' : 'picked again'} (${at.toFixed(2)} px)`);
  }
  // and a camera zoomed in a little, past the doubling's edge (half the spacing would now stand ROUTE_DOT_PX apart): the
  // spacing held - no dot comes or goes - while a fresh pick would halve it
  const q0 = cam([0, 0, 0]), q1 = cam([0, 0, 1]), s0 = Math.hypot(q1.x - q0.x, q1.y - q0.y) * k0;
  const z = (ROUTE_DOT_PX * 2 + 0.5) / s0, zoom = (p) => { const q = cam(p); return q.front ? { ...q, x: 640 + (q.x - 640) * z, y: 360 + (q.y - 360) * z } : q; };
  const nudged = { k: k0 };
  routeGroundDots(route, zoom, { w: 1280, h: 720, keep: nudged });
  assert.equal(nudged.k, k0, 'held');
  const fresh = { k: 0 };
  routeGroundDots(route, zoom, { w: 1280, h: 720, keep: fresh });
  assert.equal(fresh.k, k0 / 2, 'a fresh pick halves it');
  const far = { k: k0 * 8 };
  routeGroundDots(route, cam, { w: 1280, h: 720, keep: far });
  assert.equal(far.k, k0, 'far past it: picked again');
  assert.deepEqual([routeDotClass(1), routeDotClass(0.1), routeDotClass(2)], [0, ROUTE_DOT_SIZES.length - 1, 0]);
  const css = rd('src/ui/enhanced/enhancedStyle.js');
  assert.equal(Number(/\.tview-route-casing \{[^}]*stroke-width: (\d+);/.exec(css)?.[1]), hudMod.ROUTE_CASING_W, 'the casing\'s width pinned');
  assert.equal(Number(/\.tview-route-line \{[^}]*stroke-width: (\d+);/.exec(css)?.[1]), hudMod.ROUTE_LINE_W, 'the line\'s width pinned');
});
