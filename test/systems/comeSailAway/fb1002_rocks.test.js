// FIELD BUGS 2026-10-02 - ROCK-FREE. Mac, testing sailing: "ships get stuck in the world of daggerfall ocean rocks".
// Come Sail Away's CheckCollision sweeps the hull's half-beam sphere along her length (SphereCastAll); the world's host
// answered it off the collider's own sphereCastAll, Unity's SphereCastAll over a BUCKET as one collider - and a static
// bucket is a pixel's whole ground, every World of Daggerfall rock of it in one. Two traps followed:
//   - a ledge under her (a rock's shelf, its foot in the sea) overlapping her sphere where the sweep starts answered the
//     zero point - a push from the scene's origin, whatever way that lay - and cast no ray at the rest of the pixel: the
//     rock ahead went unmet, and she sailed into it;
//   - once in it, every ray met its inner walls (the collider reads both faces) and pushed her back in, for good.
// Now the host asks the collider's hullSweepAll, collider by collider as Unity's SphereCastAll answers: a bucket's parts
// are its colliders (each addMesh one - a World of Daggerfall object's MeshCollider); a part her sphere overlaps where
// the sweep starts answers once, at its overlap, where it touches (never the zero point); a part that holds her centre
// answers nothing (Unity's sweep reads no back face); every other part is met by the sweep. And in a rock field a third
// held her: the response (systems/comeSailAway/comeSailAway.js lateUpdateSailing) took her way OFF what she met as well as into it,
// so a rock astern of a ship sailing away from it held her to its push, a metre a second. The pins, each red on the
// code before - every one through the REAL modules: the collider (player/collider.js), world.js's own csaSphereCastAll
// lifted from its source, and Come Sail Away's runtime over the vendored hulls (test/csaScene.mjs):
//   A LEDGE HIDES NO ROCK - over a ledge she is held off the rock ahead where open water holds her
//   THE LEDGE ALONE       - she sails over it and off it, nothing pushing her
//   ROCK-AWAY             - what she met takes only her way into it: sailing off from a rock astern, or backing off one
//                           ahead, she keeps the way open water gives her (the C#'s response took the way off it too,
//                           and held her to its push, a metre a second, while it lay in her sweep)
//   OUT OF THE ROCK       - a hull standing inside a rock (closed, or open beneath as a rock standing in the ground is)
//                           sails out of it
//   THE SWEEP'S LAW       - hullSweepAll part by part: an overlap answered once where it touches, a pitched sweep
//                           never grazing onto it again, a holding part silent (a shared edge crossed once), a mover
//                           never holding; nothing under her keel
//   THE HOST              - her keel line handed on, an overlap beside her kept where it touches
// Moved by the record's audit (2026-10-02b, `01-Overview/bugs/Field-Bugs-2026-10-02b.md`; its own pins in
// test/systems/comeSailAway/fb1002b_rocks.test.js): the sweep is the sphere's own (no spokes, so no `pass` for them), a ledge is no rock
// by the KEEL LINE where the host had dropped an overlap "beneath" her, and each sweep reaches her own end (ROCK-REACH)
// - so the rocks of these pins stand inside her own length, and the ledge under her keel.
// `01-Overview/bugs/Field-Bugs-2026-10-02.md`.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../../src/player/collider.js';
import { boxColliderTriangles } from '../../../src/world/prefabColliders.js';
import { HULL_NAMES } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { hullBuild } from '../../../src/systems/naval/navalShips.js';
import { scene } from '../../csaScene.mjs';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const cut = (s, start, end = '\n  }\n') => { const i = s.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return s.slice(i, s.indexOf(end, i) + end.length); };
const cutLine = (s, start) => { const i = s.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return s.slice(i, s.indexOf('\n', i) + 1); };
/** world.js's csaSphereCastAll - CheckCollision's sweep - lifted over a street's collider: no boat in it, and the
 *  ground probe over a sea with no ground under it. */
function liftSweep(col) {
  const body = `let { csaModeCollider, _csaBuckets, modes, surfaceAt, csaPixelAt, state, deepWaters } = s;
    ${cutLine(WORLD, '  const _csaSlab = [0, 0, 0]')}
    ${cut(WORLD, '  function csaSphereCastAll(')}
    return csaSphereCastAll;`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)({ csaModeCollider: () => col, _csaBuckets: new Map(), modes: { mode: 'exterior' }, surfaceAt: () => -Infinity, csaPixelAt: () => null, state: null, deepWaters: null });
}

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const SMALL_SHIP = HULL_NAMES.indexOf('Small Ship');
/** A rock as a box from min to max (prefabColliders' own box, a closed skin); `open` - no bottom faces, as a model
 *  standing in the ground has none. */
function rockMesh({ min, max, open = false }) {
  const m = boxColliderTriangles({ m_Center: { x: (min[0] + max[0]) / 2, y: (min[1] + max[1]) / 2, z: (min[2] + max[2]) / 2 }, m_Size: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] } });
  if (!open) return m;
  const low = (v) => m.positions[v * 3 + 1] === min[1];
  const indices = [];
  for (let i = 0; i < m.indices.length; i += 3) if (!(low(m.indices[i]) && low(m.indices[i + 1]) && low(m.indices[i + 2]))) indices.push(m.indices[i], m.indices[i + 1], m.indices[i + 2]);
  return { positions: m.positions, indices };
}
/** A pixel's ground: every rock its own part (addMesh) of the one bucket a pixel's static geometry stands in. */
function pixel(rocks) {
  const col = new Collider();
  for (const r of rocks) { const m = rockMesh(r); col.addMesh('pixel', m.positions, m.indices, I); }
  return col;
}
const inside = (p, r) => p[0] > r.min[0] && p[0] < r.max[0] && p[2] > r.min[2] && p[2] < r.max[2];

/** A Small Ship at (100, 34, 200) facing north, under sail with the wind astern (or her sails struck, at the oars),
 *  over `rocks`; `sail(seconds, keys)` answers her track. */
function under(rocks, { sails = true } = {}) {
  const s = scene();
  s.deps.sphereCastAll = liftSweep(pixel(rocks));
  const boat = s.helm(s.place(SMALL_SHIP, 0, [100, 34, 200], [0, 0, 1]));
  if (sails) s.rt.RaiseSails();
  s.rt.state.windVectorCurrent = [0, 0, 3];
  s.rt.state.windVectorTarget = [0, 0, 3];
  const sail = (seconds, keys = []) => {
    const track = [];
    s.held.clear();
    for (const k of keys) s.held.add(k);
    s.rt.state.oarThrottle = keys.includes('MoveForwards') ? 1 : keys.includes('MoveBackwards') ? -1 : 0;   // HELM-LADDER: the keys' rung
    for (let t = 0; t < seconds; t += 0.25) { s.frame(); track.push(boat.GameObject.position.slice()); }
    return track;
  };
  return { s, boat, sail };
}

/** A shelf under the sea's line 0.65 m under her keel (her collider's box's foot) - under her where she starts and
 *  running on under the rock ahead (its foot). PIN MOVED (AUDIT GALLEON, the merge with main, 2026-10-02): the Small
 *  Ship is Mac's galleon, her keel 4.64 m down where the mod's galleon's was 3.35 - at 4 m the shelf stood over it. */
const LEDGE = { min: [60, 20, 150], max: [140, 34 + hullBuild(SMALL_SHIP).keel - 0.65, 300] };
/** A rock ahead, standing out of the sea. */
const ROCK = { min: [70, 0, 280], max: [130, 80, 320] };

test('ROCK-FREE A LEDGE HIDES NO ROCK: over a ledge of the same pixel she is held off the rock ahead exactly where open water holds her - its overlap answered no zero point and hid nothing (she sailed through the rock, 855 m on)', () => {
  const open = under([ROCK]).sail(90);
  assert.ok(open.at(-1)[2] < ROCK.min[2], `open water: held off the rock (${open.at(-1)[2].toFixed(1)})`);
  const over = under([LEDGE, ROCK]).sail(90);
  for (const p of over) assert.ok(!inside(p, ROCK), `never in the rock (${p.map((v) => v.toFixed(1))})`);
  assert.deepEqual(over, open, 'the ledge changes nothing of her track');
});

test('ROCK-FREE THE LEDGE ALONE: she sails over a ledge under her and off its end as over open water - nothing pushes her, whatever way the scene\'s origin lies, and its end astern takes no way off her as she leaves it (ROCK-AWAY)', () => {
  const track = under([LEDGE]).sail(90);
  assert.deepEqual(track, under([]).sail(90), 'her track over open water, frame for frame');
  assert.ok(track.at(-1)[2] > LEDGE.max[2] + 50, `over it and off its end (${track.at(-1)[2].toFixed(1)})`);
});

test('ROCK-FREE OUT OF THE ROCK: a hull standing inside a rock - a closed one, or one open beneath as a model standing in the ground is - sails out of it as over open water; its own walls do not hold her in (they held her for good)', () => {
  const free = under([]).sail(90);
  for (const open of [false, true]) {
    const around = { min: [40, 0, 140], max: [160, 80, 260], open };
    const track = under([around]).sail(90);
    const out = track.findIndex((p) => !inside(p, around));
    assert.ok(out > 0, `${open ? 'open beneath' : 'closed'}: out of it (${track.at(-1).map((v) => v.toFixed(1))})`);
    assert.deepEqual(track.slice(0, out), free.slice(0, out), 'inside, nothing of it touched her');
    assert.ok(track.at(-1)[2] > around.max[2] + 20, 'and away');
  }
});

test('ROCK-AWAY: what she met takes only her way INTO it - a rock astern of her under sail, and a rock ahead of her backing off it at the oars, each leave her the way open water does (each held her to the push\'s one metre a second for as long as it lay in her sweep); at rest, or rowing into it, the C#\'s push', () => {
  // a rock just inside her stern's sphere (her sweep astern reaches her box's after end), and she sails away from it.
  // PIN MOVED (AUDIT GALLEON, the merge with main, 2026-10-02): the Small Ship is Mac's galleon - her box's ends her own
  // (stern -19.91, bow 21.93, where the mod's galleon's stood at -24.25 and 19.88), each rock as far inside them as it was
  const { aftZ, bowZ } = hullBuild(SMALL_SHIP);
  const astern = { min: [70, 0, 140], max: [130, 80, 200 + aftZ + 0.75] };
  assert.deepEqual(under([astern]).sail(60), under([]).sail(60), 'under sail away from it: open water\'s track');
  // a rock just inside her bow's sphere (her sweep ahead reaches her box's fore end); at the oars she backs off it
  const ahead = { min: [70, 0, 200 + bowZ - 0.87], max: [130, 80, 260] };
  const backing = under([ahead], { sails: false });
  const rowed = backing.sail(20, ['MoveBackwards']);
  assert.deepEqual(rowed, under([], { sails: false }).sail(20, ['MoveBackwards']), 'backing off it: open water\'s track');
  // rowing into it: held off, the C#'s push - she never gets nearer than she lay
  const into = under([ahead], { sails: false }).sail(20, ['MoveForwards']);
  for (const p of into) assert.ok(p[2] < 200.5, `held off the rock ahead (${p[2].toFixed(2)})`);
  // at rest, the C#'s push: a metre a second off it
  const rest = under([ahead], { sails: false });
  const z0 = rest.boat.GameObject.position[2];
  rest.sail(0.25);
  assert.deepEqual(rest.s.rt.state.MoveVectorCurrent, [0, 0, -1], 'pushed off it');
  assert.ok(Math.abs(rest.boat.GameObject.position[2] - (z0 - 0.25)) < 1e-4, 'a quarter metre in the quarter second');
  // a current carrying her off a rock is hers to keep; one carrying her onto one is taken, as the C# takes it
  const drift = (rocks) => { const u = under(rocks, { sails: false }); u.s.rt.state.currentVector = [0, 0, 0.5]; const at = u.boat.GameObject.position[2]; u.sail(0.25); return u.boat.GameObject.position[2] - at; };
  assert.ok(Math.abs(drift([astern]) - 0.375) < 1e-4, `off the rock astern: the push and the current, 1.5 m/s (${drift([astern])}; the C# took the current, 1)`);
  assert.ok(Math.abs(drift([ahead]) + 0.25) < 1e-4, `onto the rock ahead: the push alone (${drift([ahead])})`);
});

test('ROCK-FREE THE SWEEP\'S LAW: hullSweepAll answers part by part - an overlap once, where it touches; a pitched sweep never grazes onto it again; a part holding her centre answers nothing (its top\'s shared edge crossed once); a mover never holds; nothing wholly under her keel is met', () => {
  const o = [0, 0, 0], r = 3;
  // a ledge beneath (part 0) and a rock ahead (part 1)
  const col = pixel([{ min: [-20, -10, -20], max: [20, -2, 60] }, { min: [-5, -10, 30], max: [5, 10, 40] }]);
  const flat = col.hullSweepAll(o, r, [0, 0, 1], 30);
  assert.deepEqual(flat.filter((h) => h.start).map((h) => [h.dist, h.point.map((v) => Math.round(v * 1e9) / 1e9 + 0)]), [[0, [0, -2, 0]]], 'the ledge: once, where it touches - never the zero point');
  const ahead = flat.filter((h) => !h.start);
  assert.equal(ahead.length, 1);
  assert.ok(Math.abs(ahead[0].dist - 27) < 1e-6 && Math.abs(ahead[0].point[2] - 30) < 1e-6, `the rock's face, met by the sweep (${ahead[0].dist})`);
  // the swell pitches her sweep down: the ledge she overlaps is never met again as a rock ahead (its top 20 m on)
  const d = [0, -0.1, 1], l = Math.hypot(...d);
  const pitched = col.hullSweepAll(o, r, d.map((v) => v / l), 30).filter((h) => !h.start);
  assert.equal(pitched.length, 1);
  assert.ok(Math.abs(pitched[0].point[2] - 30) < 1e-6, `still the rock's face (${pitched[0].point.map((v) => v.toFixed(2))}), not the ledge's top grazed`);
  // a part holding her centre, its north wall in her sphere's reach (5 m off, the sphere 7) - and her centre under its
  // top's shared edge (the box's top is two faces on its diagonal, (30, -12) to (-10, 8), which crosses (0, 3): two
  // faces, one crossing) - and the same rock beyond
  const o2 = [0, 0, 3], r2 = 7, box = { min: [-10, -10, -12], max: [30, 10, 8] };
  for (const open of [false, true]) {
    const held = pixel([{ ...box, open }, { min: [-5, -10, 30], max: [5, 10, 40] }]);
    const out = held.hullSweepAll(o2, r2, [0, 0, 1], 30);
    assert.equal(out.filter((h) => h.start).length, 0, `${open ? 'open beneath' : 'closed'}: the holding part answers no overlap, its wall in reach`);
    assert.deepEqual(out.filter((h) => !h.start).map((h) => Math.round(h.dist)), [20], 'nor its inner wall (5 m on): the rock beyond is met, 27 m on less her radius');
  }
  // a rock over her - an arch's span, its underside and its top two crossings - holds her not: its overlap answers
  const arch = pixel([{ min: [-5, 2, -5], max: [5, 6, 5] }]);
  assert.deepEqual(arch.hullSweepAll(o, r, [0, 0, 1], 30).filter((h) => h.start).map((h) => h.point), [[0, 2, 0]], 'the span over her, where it touches');
  // a mover (a boat's collider, carried) holds no hull: the same box's overlap answers
  const boats = new Collider();
  const hull = rockMesh(box);
  boats.addMesh('boat', hull.positions, hull.indices, I, () => [0, 0, 0], () => [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(boats.hullSweepAll(o2, r2, [0, 0, 1], 30).filter((h) => h.start).map((h) => h.point), [[0, 0, 8]], 'a mover\'s overlap answers, where it touches');
  // the keel line (2026-10-02b): the ledge wholly under her keel is not met at all - the rock ahead is, as it was
  const keeled = col.hullSweepAll(o, r, [0, 0, 1], 30, { keelY: -1 });
  assert.deepEqual(keeled.map((h) => [h.part, Math.round(h.dist * 1e6) / 1e6]), [[1, 27]], 'the ledge (its top 1 m under her keel) unmet; the rock\'s face at 27');
  assert.equal(col.hullSweepAll(o, r, [0, 0, 1], 30, { keelY: -3 }).filter((h) => h.start).length, 1, 'a keel under the ledge\'s top: its overlap answers');
});

test('ROCK-FREE THE HOST: world.js\'s sweep hands the collider her keel line (2026-10-02b: the ledge beneath her unmet - an overlap "beneath" her had been dropped, a rock awash beside her with it) and keeps an overlap beside her where it touches, a static collider\'s, with no root, marked `start`; a rock just past her sphere answers nothing', () => {
  const col = pixel([{ min: [-20, -10, -20], max: [20, -2, 20] }, { min: [2, -10, -5], max: [12, 10, 5] }, { min: [-10, -10, -5], max: [-3.5, 10, 5] }]);
  const out = liftSweep(col)([0, 0, 0], 3, [0, 0, 1], 10, { keelY: -1.5 });
  assert.deepEqual(out, [{ point: [2, 0, 0], distance: 0, name: 'pixel', root: null, terrain: false, entity: false, start: true }], 'the rock beside her, where it touches; the ledge under her keel, unmet; the rock 3.5 m off, out of her sphere (3), nothing');
  assert.ok(!out.some((h) => h.point.every((v) => v === 0)), 'never the zero point');
});
