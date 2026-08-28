// R3 — THE ROAD LAYER on the enhanced travel map.
//
// The relief mapping is now shared with the route line, so the pins
// that matter most are the ones that would catch the two drifting
// apart: a road and the route standing on the SAME pixel must agree on
// where the ground is and disagree only by their lift.

import { test } from 'node:test';
import assert from 'node:assert';

import {
  reliefPoint, RELIEF_LIFT, routePoints, roadPoints, roadModel,
  overworldHeight, buildRevealMask, revealLines,
  roadLayersForDistance, TRACK_FADE_DIST, ROAD_REVEAL_RADIUS,
} from '../src/ui/overworldModel.js';
import { createNetwork, linkPixels } from '../src/systems/roads.js';
import { traceNetwork } from '../src/systems/roadBake.js';

const W = 20, H = 20;
function ctx(fill = 10) {
  return { heightBytes: new Uint8Array(W * H).fill(fill), width: W, height: H };
}

/** A trunk CROSSROADS with a branching track.
 *
 *  The junction is load-bearing. A trunk that is one straight line
 *  traces to exactly one chain, and then a model that collapsed every
 *  chain into a single buffer would be indistinguishable from a
 *  correct one - the count assertion below can only mean something if
 *  the plane has more than one chain in it. */
function net() {
  const n = createNetwork(W, H);
  for (let x = 3; x < 16; x++) linkPixels(n.trunkExits, W, x, 8, x + 1, 8);
  for (let y = 3; y < 14; y++) linkPixels(n.trunkExits, W, 9, y, 9, y + 1);
  for (let y = 8; y < 13; y++) linkPixels(n.trackExits, W, 5, y, 5, y + 1);
  for (let x = 5; x < 8; x++) linkPixels(n.trackExits, W, x, 12, x + 1, 12);
  return n;
}

// ── the shared mapping ───────────────────────────────────────────

test('reliefPoint puts a pixel at its centre, on the height law, in scene signs', () => {
  const c = ctx(10);
  const [x, y, z] = reliefPoint(4, 6, c);
  assert.equal(x, 4.5, 'pixel centre, not corner');
  assert.equal(z, -6.5, 'north is +z, so the map y is negated');
  assert.equal(y, overworldHeight(10), 'no lift means the ground itself');
});

test('reliefPoint clamps at the edge of the data rather than reading past it', () => {
  const c = ctx(10);
  assert.equal(reliefPoint(-3, -3, c)[1], overworldHeight(10));
  assert.equal(reliefPoint(999, 999, c)[1], overworldHeight(10));
  // the scene position still honours what was asked for - only the
  // height SAMPLE clamps, or a path running off the edge would fold
  // back on itself
  assert.equal(reliefPoint(999, 0, c)[0], 999.5);
});

test('a road and the route on the SAME pixel agree on the ground and differ only by lift', () => {
  // The reason the mapping was extracted. Two copies of a coordinate
  // convention is how a layer ends up half a pixel out from the ground
  // it is drawn on, and nothing would throw.
  const c = ctx(37);
  const route = routePoints({ x: 5, y: 5 }, [{ x: 5, y: 5 }], c);
  const road = roadPoints([[{ x: 5, y: 5 }]], c, RELIEF_LIFT.trunk)[0];
  assert.equal(route[0], road[0], 'x must agree');
  assert.equal(route[2], road[2], 'z must agree');
  // Math.fround, not a tolerance: these buffers ARE Float32Arrays, so
  // the stored values are the doubles rounded to float32 and the
  // expected difference has to be computed the same way. The same
  // float32 boundary that made minStep overestimate in roads.js.
  const ground = overworldHeight(37);
  assert.equal(route[1] - road[1],
    Math.fround(ground + RELIEF_LIFT.route) - Math.fround(ground + RELIEF_LIFT.trunk),
    'and the only difference is the lift');
  assert.ok(route[1] > road[1], 'with the route on top');
});

test('the lift ORDER is ground < track < trunk < route', () => {
  // The order is the law; the numbers are skin. Equal lifts z-fight at
  // every junction, and a route drawn under the road it follows is
  // invisible exactly when it matters.
  assert.ok(0 < RELIEF_LIFT.track);
  assert.ok(RELIEF_LIFT.track < RELIEF_LIFT.trunk);
  assert.ok(RELIEF_LIFT.trunk < RELIEF_LIFT.route);
});

// ── the road model ───────────────────────────────────────────────

test('every traced chain becomes its OWN vertex run', () => {
  // One buffer for all chains would draw a line strip that jumps
  // between unconnected roads - a road that is not there.
  const c = ctx();
  const lines = traceNetwork(net());
  const model = roadModel(lines, c);
  assert.ok(lines.trunk.length > 1, 'the fixture must have more than one chain to test this');
  assert.equal(model.trunk.length, lines.trunk.length);
  assert.equal(model.track.length, lines.track.length);
  model.trunk.forEach((buf, i) => assert.equal(buf.length, lines.trunk[i].length * 3));
});

test('road vertices ride the relief - a chain over varying ground varies in height', () => {
  const c = ctx();
  for (let x = 0; x < W; x++) c.heightBytes[8 * W + x] = x * 6;
  const [buf] = roadPoints([[{ x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }]], c, RELIEF_LIFT.trunk);
  assert.ok(buf[1] < buf[4] && buf[4] < buf[7], 'the road should climb with the ground');
  assert.equal(buf[1], Math.fround(overworldHeight(18) + RELIEF_LIFT.trunk));
});

test('an empty network models to nothing rather than throwing', () => {
  const model = roadModel(traceNetwork(createNetwork(W, H)), ctx());
  assert.deepEqual(model.trunk, []);
  assert.deepEqual(model.track, []);
});

// ── discovery ────────────────────────────────────────────────────

/** Markers carry SCENE coordinates, as buildMarkerModel emits them. */
const marker = (px, py) => ({ x: px + 0.5, z: -(py + 0.5) });

test('the reveal mask covers a radius around each discovered place, and nothing else', () => {
  const mask = buildRevealMask([marker(10, 10)], { width: W, height: H, radius: 2 });
  assert.equal(mask[10 * W + 10], 1, 'the place itself');
  assert.equal(mask[10 * W + 12], 1, 'and out to the radius');
  assert.equal(mask[8 * W + 8], 1, 'corners too - it is a square scan');
  assert.equal(mask[10 * W + 13], 0, 'but not beyond it');
  assert.equal(mask[3 * W + 3], 0);
});

test('the mask round-trips marker scene coordinates back to map pixels', () => {
  // buildMarkerModel emits x = px + 0.5 and z = -(py + 0.5); getting
  // that inverse wrong shifts every road reveal by a pixel and only
  // shows up as roads fading in slightly off their towns.
  const mask = buildRevealMask([marker(4, 7)], { width: W, height: H, radius: 0 });
  assert.equal(mask[7 * W + 4], 1);
  assert.equal(mask.reduce((a, b) => a + b, 0), 1, 'radius 0 lights exactly one pixel');
});

test('the mask clamps at the map edge instead of wrapping to the next row', () => {
  // A row-fill that runs past the RIGHT edge writes into the start of
  // the following row - roads revealed on the far side of the map. The
  // marker therefore has to sit at the right edge: at the left edge
  // the fill can never overrun and the mutant walks through.
  const mask = buildRevealMask([marker(W - 2, 5)], { width: W, height: H, radius: 3 });
  assert.equal(mask[5 * W + (W - 1)], 1, 'the edge pixel itself is lit');
  assert.equal(mask[6 * W + 0], 0, 'but nothing bled into the next row');
  assert.equal(mask[6 * W + 1], 0);
  // and the same at the left edge, where the fill would run negative
  const left = buildRevealMask([marker(1, 5)], { width: W, height: H, radius: 3 });
  assert.equal(left[5 * W + 0], 1);
  assert.equal(left[4 * W + (W - 1)], 0, 'nothing bled back into the previous row');
});

test('reveal is PARTIAL - a road to nowhere fades out, it does not vanish', () => {
  const line = [];
  for (let x = 2; x < 18; x++) line.push({ x, y: 5 });
  const mask = buildRevealMask([marker(3, 5)], { width: W, height: H, radius: 3 });
  const out = revealLines([line], mask, W);
  assert.equal(out.length, 1, 'one revealed run');
  assert.ok(out[0].length < line.length, 'and it is shorter than the whole road');
  assert.ok(out[0].every((p) => mask[p.y * W + p.x]), 'every point revealed');
  assert.equal(out[0][0].x, 2, 'it starts where the road does');
});

test('a chain crossing two known places splits into two runs, not one', () => {
  // The middle is unknown; joining the runs would draw road through
  // country the player has never seen.
  const line = [];
  for (let x = 1; x < 19; x++) line.push({ x, y: 5 });
  const mask = buildRevealMask([marker(2, 5), marker(17, 5)], { width: W, height: H, radius: 2 });
  const out = revealLines([line], mask, W);
  assert.equal(out.length, 2);
  assert.ok(out[0][out[0].length - 1].x < out[1][0].x, 'and there is a gap between them');
});

test('a single revealed pixel is dropped - a dot is not a road', () => {
  // BOTH branches. A run that ends mid-line is flushed inside the
  // loop; a run still open when the line ends is flushed after it, and
  // a fixture that only ever hits the first leaves the second free to
  // emit one-point lines.
  const mask = buildRevealMask([marker(6, 5)], { width: W, height: H, radius: 0 });
  assert.deepEqual(revealLines([[{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }]], mask, W), [],
    'a lone pixel in the middle of a line');
  assert.deepEqual(revealLines([[{ x: 5, y: 5 }, { x: 6, y: 5 }]], mask, W), [],
    'and a lone pixel that ends the line');
});

test('nothing discovered reveals no road at all', () => {
  const mask = buildRevealMask([], { width: W, height: H });
  assert.deepEqual(revealLines(traceNetwork(net()).trunk, mask, W), []);
  assert.ok(ROAD_REVEAL_RADIUS > 0, 'and the default radius is not zero');
});

// ── level of detail ──────────────────────────────────────────────

test('trunk roads always draw; tracks drop out from altitude', () => {
  // Every farm lane at once, seen from over the whole bay, is noise
  // that buries the network the player is trying to read.
  assert.deepEqual(roadLayersForDistance(15), { trunk: true, track: true });
  assert.deepEqual(roadLayersForDistance(TRACK_FADE_DIST), { trunk: true, track: true });
  assert.deepEqual(roadLayersForDistance(TRACK_FADE_DIST + 1), { trunk: true, track: false });
  assert.deepEqual(roadLayersForDistance(1500), { trunk: true, track: false });
});

test('the fade sits inside the camera\'s real range', () => {
  // DIST_MIN 15, DIST_MAX 1500, cruise 115 - a threshold outside that
  // makes the layer either always on or always off, which is not a
  // level of detail.
  assert.ok(TRACK_FADE_DIST > 15 && TRACK_FADE_DIST < 1500);
  assert.ok(TRACK_FADE_DIST > 115, 'tracks should still be there at cruising altitude');
});
