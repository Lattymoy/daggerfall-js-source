// FIELD BUGS 2026-10-25i RAIL-HANG (#bug-reports, "Caravans get caught on shop signs"; Harlander: "Even going on foot
// you can get hung up on shop signs and fences"). The town's split-rail fences (ARCH3D 41206, 41207, 41208 - 358 of
// BLOCKS.BSA's placements) are a post and two rails, each rail a wedge: a flat face on the street side, and behind it
// two faces sloping to a back edge 0.55 m up for the lower rail, the upper rail's 0.9 m over it. Met from behind, the
// lower sphere of a walker's capsule came up under that edge with the rail's upper slope just over its centre, and PH1's
// one-way floor (player/collider.js _resolveSphere: a floor-sloped face just over the lower sphere's centre is a floor
// the body sank under, and the sphere is set ON it) set the body on the rail in the sideways pass - 0.39 m up for a
// walker, 0.55 for a wagon's driver - where it hung, wedged under the upper rail, bobbing. And met from the street at a
// run, the rail's under slope - its quad's diagonal edge over the sphere - set a runner 0.3 m up on it, under the rail's
// own top. A walking step now takes PH1's floor only where the body STANDS once set on it: its height clear over that
// floor (_standsOn). AUDIT FB1025i G1/G2: the stand ceiling the law first read had turned every 0.5-0.7 m top a walker
// stepped onto through the same arm - a bench, a bed, a throne's seat, a dungeon block's seam 0.501-0.505 m over its
// ramp - into a jump or a wall; those are the parent's again. Driven through the real PlayerMotor, EnemyAI and Collider,
// on a fence built to 41206's measures and, with ARENA2, on the game's own fences, benches and Privateer's Hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, FIXED_DT, CAPSULE_RADIUS, STEP_OFFSET } from '../../src/player/motor.js';
import { EnemyAI } from '../../src/characters/enemy/enemyMotor.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { layoutDungeon } from '../../src/world/dungeon/dungeonLayout.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { layoutRdbBlock } from '../../src/world/rdbLayout.js';
import { sightMarksOf } from '../../src/world/signSolid.js';
import { multiply, trs } from '../../src/world/mat4.js';
import { skipReal, game } from '../lwRealTown.mjs';

const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A fence to 41206's measures on flat ground, its feet on y 0, its rails along z from z0 to z1: each rail a wedge - the
 *  street face at x 0 from y0 to y1, and two faces back to an edge at x -0.2, 0.15 over y0 - and its post, a triangular
 *  prism from the ground to 1.75 m at z -1.19..-0.84 in front of the street face (x 0.01..0.18). `turn` maps each
 *  corner, for a fence authored in a turned frame. */
function madeFence({ z0 = -0.99, z1 = 2.01, post = true, turn = (v) => v, upperBack = -0.2 } = {}) {
  const p = [], ix = [];
  const quad = (a, b, c, d) => { const v = p.length / 3; p.push(...turn(a), ...turn(b), ...turn(c), ...turn(d)); ix.push(v, v + 1, v + 2, v, v + 2, v + 3); };
  for (const [y0, y1, back] of [[0.40, 0.65, -0.2], [1.30, 1.55, upperBack]]) {
    const ym = y0 + 0.15;
    quad([0, y0, z0], [0, y0, z1], [0, y1, z1], [0, y1, z0]);            // the street face
    quad([back, ym, z0], [back, ym, z1], [0, y0, z1], [0, y0, z0]);      // the under slope
    quad([0, y1, z0], [0, y1, z1], [back, ym, z1], [back, ym, z0]);      // the upper slope
  }
  if (post) {
    quad([0.01, 1.75, -1.02], [0.01, 0, -1.02], [0.18, 0, -1.19], [0.18, 1.75, -1.19]);
    quad([0.01, 1.75, -1.02], [0.18, 1.75, -0.84], [0.18, 0, -0.84], [0.01, 0, -1.02]);
    quad([0.18, 0, -1.19], [0.18, 0, -0.84], [0.18, 1.75, -0.84], [0.18, 1.75, -1.19]);
  }
  return { positions: new Float32Array(p), indices: new Uint32Array(ix) };
}
/** Square at the fence along +x from behind it (x -2) or along -x from the street (x 2), at `z`: a walker walking or
 *  running, or a wagon's driver at the gallop. Answers the body where it stands after two seconds. */
function square(col, z, { from = -2, mode = null, run = false } = {}) {
  const m = new PlayerMotor(col);
  m.spawn(from, 0.05, z);
  if (mode) m.transportMode = mode;
  const yaw = from < 0 ? Math.PI / 2 : -Math.PI / 2;
  for (let i = 0; i < 20; i++) m.update(FIXED_DT, IDLE, yaw);
  for (let i = 0; i < 120; i++) m.update(FIXED_DT, { ...IDLE, forward: 1, run: run || !!mode }, yaw);
  return m;
}
const BODIES = [{ who: 'a walker', run: false }, { who: 'a runner', run: true }, { who: 'a wagon\'s driver', mode: TRANSPORT_MODES.Cart }];

/** Where along a fence's rails a body meets them clear of its post and its ends: its rails' vertices (between 0.3 and
 *  0.7 m over its foot) run z0..z1, its post's (in front of the street face) p0..p1. */
function railStations(positions, foot) {
  let z0 = Infinity, z1 = -Infinity, p0 = Infinity, p1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1] - foot, z = positions[i + 2];
    if (x > 0.005) { p0 = Math.min(p0, z); p1 = Math.max(p1, z); } else if (y > 0.3 && y < 0.7) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  }
  const out = [];
  for (let z = z0 + 0.4; z <= z1 - 0.4; z += 0.25) if (z < p0 - 0.5 || z > p1 + 0.5) out.push(z);
  return out;
}
/** Every body, square at the rails from behind along their length: on the ground, its capsule against the back edge,
 *  never on it, under it or through it; and from the street, against the street face as it always was. */
function fenceHolds(col, back, front, stations, label) {
  assert.ok(stations.length >= 6, `${label}: stations along its rails (${stations.length})`);
  for (const b of BODIES) {
    for (const z of stations) {
      const m = square(col, z, b);
      assert.ok(Math.abs(m.pos[1]) < 0.01, `${label}, ${b.who} from behind at z ${z.toFixed(2)}: on the ground (feet ${m.pos[1].toFixed(3)} - hung on the rail)`);
      // against the back edge, never through it: its lower sphere under the edge, 0.2 m over its centre, comes no nearer
      // than sqrt(r^2 - 0.2^2) of it, and a body leaning on the rails' backs no farther than the radius and the skin
      assert.ok(back - m.pos[0] > 0.25 && back - m.pos[0] < CAPSULE_RADIUS + 0.03, `${label}, ${b.who} from behind at z ${z.toFixed(2)}: against its back edge (x ${m.pos[0].toFixed(3)})`);
      const s = square(col, z, { ...b, from: 2 });
      assert.ok(Math.abs(s.pos[1]) < 0.01 && Math.abs(s.pos[0] - (front + CAPSULE_RADIUS)) < 0.03, `${label}, ${b.who} from the street at z ${z.toFixed(2)}: against its face (x ${s.pos[0].toFixed(3)}, feet ${s.pos[1].toFixed(3)})`);
    }
  }
}
/** A runner square at the street face every 2 cm along the rails: never set on the under slope (its quad's diagonal edge
 *  holds a band of them, 0.3 m up, where PH1 read it as a floor over the sphere). */
function streetFaceHolds(col, front, stations, label) {
  const lo = Math.min(...stations), hi = Math.max(...stations);
  let n = 0;
  for (let z = lo; z <= hi + 1e-9; z += 0.02, n++) {
    const s = square(col, z, { run: true, from: 2 });
    assert.ok(Math.abs(s.pos[1]) < 0.01 && Math.abs(s.pos[0] - (front + CAPSULE_RADIUS)) < 0.03, `${label}, a runner from the street at z ${z.toFixed(2)}: against its face (x ${s.pos[0].toFixed(3)}, feet ${s.pos[1].toFixed(3)})`);
  }
  assert.ok(n > 50);
}

/** Privateer's Hold's seam connector (ARCH3D 67023, where S0000999 meets B0000006) to its measures: a floor at 0, a ramp
 *  rising 0.55 m over 1.6 m along -z, a riser of `rise` at its top to the next block's floor - the feet that stand at the
 *  riser stand lower than the ramp's top by the capsule's own rest on the slope, so a 0.45 m riser is a lip 0.5 m and
 *  more over them - between walls 4 m apart; and a ceiling over it all, if asked, its own part (the next block's room's,
 *  facing down into it). */
function seamRamp(rise, ceiling = null) {
  const p = [], ix = [];
  const quad = (a, b, c, d) => { const v = p.length / 3; p.push(...a, ...b, ...c, ...d); ix.push(v, v + 1, v + 2, v, v + 2, v + 3); };
  const top = 0.55 + rise;
  quad([-2, 0, 1.6], [2, 0, 1.6], [2, 0, 8], [-2, 0, 8]);
  quad([-2, 0.55, 0], [2, 0.55, 0], [2, 0, 1.6], [-2, 0, 1.6]);
  quad([-2, 0.55, 0], [-2, top, 0], [2, top, 0], [2, 0.55, 0]);
  quad([-2, top, -8], [2, top, -8], [2, top, 0], [-2, top, 0]);
  quad([-2, 0, 8], [-2, 4, 8], [-2, 4, -8], [-2, 0, -8]);
  quad([2, 0, 8], [2, 0, -8], [2, 4, -8], [2, 4, 8]);
  const ramp = { positions: new Float32Array(p), indices: new Uint32Array(ix) };
  if (ceiling === null) return [ramp];
  return [ramp, { positions: new Float32Array([-2, ceiling, -8, 2, ceiling, -8, 2, ceiling, 8, -2, ceiling, 8]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) }];
}
/** How many of a walker's and a runner's walks up the seam ramp (five lines across it) end past its lip. */
function overTheLip(rise, ceiling = null) {
  const mesh = seamRamp(rise, ceiling);
  let over = 0;
  for (const x of [-1, -0.5, 0, 0.5, 1]) {
    for (const run of [false, true]) {
      const col = new Collider(() => -Infinity);
      for (const part of mesh) col.addMesh('dungeon', part.positions, part.indices, I4);
      const m = new PlayerMotor(col);
      m.spawn(x, 0.02, 4);
      for (let i = 0; i < 20; i++) m.update(FIXED_DT, IDLE, Math.PI);
      for (let i = 0; i < 180; i++) m.update(FIXED_DT, { ...IDLE, forward: 1, run }, Math.PI);
      if (m.pos[2] < -1) over++;
    }
  }
  return over;
}

test('RAIL-HANG a fence built to 41206\'s measures: a walker, a runner and a wagon\'s driver square at its rails from behind stand on the ground against them - they hung on the lower rail\'s back edge, 0.39 m and 0.55 m up - and from the street against its face, where a runner was set on the under slope (mutants: the walk\'s floor never asked; the headroom never asked, or asked from the edge\'s own line, or short; the walk\'s end never undone)', () => {
  const col = new Collider(() => 0);
  const f = madeFence();
  col.addMesh('fence', f.positions, f.indices, I4);
  fenceHolds(col, -0.2, 0, railStations(f.positions, 0), 'the made fence');
  streetFaceHolds(col, 0, railStations(f.positions, 0), 'the made fence');
});

/** A body at the fence from behind or from the street at `skew` off square, sliding along its rails for two seconds:
 *  the highest its feet go. */
function slideAlong(col, z, skew, { from = -2, mode = null, run = false } = {}) {
  const m = new PlayerMotor(col);
  m.spawn(from, 0.05, z);
  if (mode) m.transportMode = mode;
  const yaw = (from < 0 ? Math.PI / 2 : -Math.PI / 2) + skew;
  for (let i = 0; i < 20; i++) m.update(FIXED_DT, IDLE, yaw);
  let top = 0;
  for (let i = 0; i < 120; i++) { m.update(FIXED_DT, { ...IDLE, forward: 1, run: run || !!mode }, yaw); top = Math.max(top, m.pos[1]); }
  return top;
}

test('RAIL-HANG met slantwise: every body at a fence built to 41206\'s measures 50 degrees off square, from behind and from the street, slides along its rails on the ground every frame - a wagon\'s driver sliding along TVRNBM04\'s 41207 was set on its rail a frame in two by the walk\'s vertical pass, which the sideways pass had refused (mutants: the vertical pass\'s floor asked of no walk)', () => {
  const col = new Collider(() => 0);
  const f = madeFence({ z0: -6, z1: 6, post: false });
  col.addMesh('fence', f.positions, f.indices, I4);
  for (const b of BODIES) {
    for (const skew of [-0.87, 0.87]) {
      for (const z of [-2, -1, 0, 1, 2]) {
        for (const from of [-2, 2]) {
          const top = slideAlong(col, z, skew, { ...b, from });
          assert.ok(top < 0.05, `${b.who} from ${from < 0 ? 'behind' : 'the street'} at z ${z}, ${skew > 0 ? '+' : '-'}50 degrees: never lifted (feet to ${top.toFixed(3)})`);
        }
      }
    }
  }
});

test('RAIL-HANG a fence whose upper rail stands 2 cm shallower than its lower (its back edge at x -0.18, the lower\'s at -0.2): every body from behind still stands on the ground against the lower rail - the headroom is asked inside the floor\'s edge, never on the edge\'s own line, which the upper rail no longer stands over (mutants: the headroom on the edge\'s line)', () => {
  const col = new Collider(() => 0);
  const f = madeFence({ upperBack: -0.18 });
  col.addMesh('fence', f.positions, f.indices, I4);
  for (const b of BODIES) {
    for (const z of railStations(f.positions, 0)) {
      const m = square(col, z, b);
      assert.ok(Math.abs(m.pos[1]) < 0.01, `${b.who} from behind at z ${z.toFixed(2)}: on the ground (feet ${m.pos[1].toFixed(3)})`);
    }
  }
});

test('RAIL-HANG on a turned deck: the same fence authored keel-up in a mover\'s bucket (its turn rights it, world = R b) holds every body from behind and from the street as it does on the ground - the headroom is asked in the world, whatever frame the floor was met in (mutants: the floor\'s point read in the bucket\'s frame)', () => {
  const R = [1, 0, 0, 0, -1, 0, 0, 0, -1];   // column-major: b -> (bx, -by, -bz), its own inverse
  const f = madeFence({ turn: (v) => [v[0], -v[1], -v[2]] });
  const col = new Collider(() => 0);
  col.addMesh('deck', f.positions, f.indices, I4, () => [0, 0, 0], () => R);
  fenceHolds(col, -0.2, 0, railStations(madeFence().positions, 0), 'the turned fence');
});

test('RAIL-HANG what the law leaves alone (AUDIT FB1025i G1, G2): a walker and a runner up Privateer\'s seam connector take its lip 0.5 m and more over their feet as the parent did, and one too tall for a step still stops them; a ledge a step high is stepped, one over a step is not; a body whose lower sphere sank a hand under a floor is set back on it (PH1) (mutants: the stand ceiling read again)', () => {
  assert.equal(overTheLip(0.45), 10, 'a 0.45 m riser at the ramp\'s top, a lip 0.5 m over the feet that reach it: walked and run, all ten');
  assert.equal(overTheLip(0.5), 10, 'a 0.5 m riser: all ten');
  assert.equal(overTheLip(0.7), 0, 'a 0.7 m riser: none, as none ever did');
  assert.equal(overTheLip(0.45, 1.0 + 2.1), 10, 'under a ceiling 2.1 m over the next floor - room for the body, 0.3 m over its head - all ten: the headroom asked is the body\'s own height, no more');
  for (const [h, onto] of [[0.45, true], [0.55, false]]) {
    const col = new Collider(() => 0);
    const p = [], ix = [];
    const quad = (a, b, c, d) => { const v = p.length / 3; p.push(...a, ...b, ...c, ...d); ix.push(v, v + 1, v + 2, v, v + 2, v + 3); };
    quad([0, 0, -3], [0, 0, 3], [0, h, 3], [0, h, -3]);       // its riser
    quad([0, h, -3], [0, h, 3], [30, h, 3], [30, h, -3]);     // its top
    col.addMesh('ledge', new Float32Array(p), new Uint32Array(ix), I4);
    const m = square(col, 0, { run: true });
    assert.equal(Math.abs(m.pos[1] - h) < 0.01, onto, `a ${h} m ledge: ${onto ? 'stepped onto' : 'a wall'} (feet ${m.pos[1].toFixed(3)}, x ${m.pos[0].toFixed(2)})`);
  }
  assert.ok(0.45 < STEP_OFFSET && STEP_OFFSET < 0.55);
  for (const sunk of [0.4, 0.6]) {
    const col = new Collider(() => -Infinity);
    col.addMesh('dungeon', new Float32Array([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4);
    const feet = [0, -sunk, 0];
    const out = col.move(feet, 0.05, 0, 0, 1.8);
    assert.ok(Math.abs(feet[1]) < 0.01 && out.grounded, `feet ${sunk} m under: set back on its floor (feet ${feet[1].toFixed(3)})`);
  }
});

test('RAIL-HANG a foe (AUDIT FB1025i G6): a real EnemyAI behind a fence chasing the player across it - its walk carries gravity\'s fall every step, as DFU\'s EnemyMotor does - stays on the ground at every station along the rails; it had hung on the lower rail at every one (mutants: the walk\'s ground never handed to the collider)', () => {
  const f = madeFence({ z0: -30, z1: 30, post: false });
  let lifted = 0, n = 0;
  for (let z = -0.5; z <= 1.5 + 1e-9; z += 0.25) {
    const col = new Collider(() => 0);
    col.addMesh('fence', f.positions, f.indices, I4);
    const foe = new EnemyAI(col, [-1.5, 0, z], Math.PI / 2, {});
    let hi = 0;
    for (let i = 0; i < 240; i++) { foe.update(1 / 60, [3, 0, z], null, false); hi = Math.max(hi, foe.feet[1]); }
    n++;
    if (hi > 0.05) lifted++;
  }
  assert.equal(n, 9);
  assert.equal(lifted, 0, `a foe set on the rail at ${lifted} of ${n} stations`);
});

test('RAIL-HANG a move that throws leaves no walking pass behind it (AUDIT FB1025i G8): a bucket whose frame fails mid-walk throws out of move, and the collider\'s next resolve is no walking step\'s', () => {
  const col = new Collider(() => 0);
  let fail = true;
  col.addMesh('bad', new Float32Array([-5, 0.4, -5, 5, 0.4, -5, 5, 0.4, 5, -5, 0.4, 5]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4, () => { if (fail) throw new Error('frame lost'); return [0, 0, 0]; });
  assert.throws(() => col.move([0, 0, 0], 0.05, 0, 0, 1.8), /frame lost/);
  assert.equal(col._walk, 0, 'no walking pass left standing');
  fail = false;
  col.removeBucket('bad');
});

test('RAIL-HANG with ARENA2: the game\'s own split-rail fences, 41206, 41207 and 41208, each stood on flat ground as a block stands it - every body square at the rails from behind stands on the ground against them, and from the street against their face', { skip: skipReal }, () => {
  const { modelOf } = game();
  for (const id of [41206, 41207, 41208]) {
    const m = modelOf(id);
    const P = m.positions;
    let foot = Infinity, back = Infinity, front = -Infinity;
    for (let i = 0; i < P.length; i += 3) foot = Math.min(foot, P[i + 1]);
    for (let i = 0; i < P.length; i += 3) if (P[i + 1] - foot > 0.3 && P[i + 1] - foot < 0.7) { back = Math.min(back, P[i]); front = Math.max(front, P[i]); }
    assert.ok(Math.abs(back + 0.2) < 0.01 && Math.abs(front) < 0.01, `${id}: its lower rail from x -0.2 to 0`);
    const col = new Collider(() => 0);
    col.addMesh(`m${id}`, P, m.indices, trs(0, -foot, 0, 0, 0, 0));
    fenceHolds(col, back, front, railStations(P, foot), String(id));
    streetFaceHolds(col, front, railStations(P, foot), String(id));
  }
});

test('RAIL-HANG with ARENA2, met slantwise: the game\'s own three fences, stood alone, met 10 to 50 degrees off square, either way, from behind and from the street by every body along their length: none ever lifted - a runner and a wagon\'s driver sliding off 41206\'s end at 10 degrees rode up onto its lower rail\'s last centimetres, where the way in runs along the upper rail\'s own end (mutants: the headroom asked at the way in alone)', { skip: skipReal }, () => {
  const { modelOf } = game();
  for (const id of [41206, 41207, 41208]) {
    const m = modelOf(id);
    let foot = Infinity;
    for (let i = 1; i < m.positions.length; i += 3) foot = Math.min(foot, m.positions[i]);
    const col = new Collider(() => 0);
    col.addMesh(`m${id}`, m.positions, m.indices, trs(0, -foot, 0, 0, 0, 0));
    for (const b of BODIES) {
      for (const deg of [-15, -10, 10, 15, -30, 30, -50, 50]) {
        for (const z of [0, 0.5, 1, 1.5]) {
          for (const from of [-2, 2]) {
            const top = slideAlong(col, z, (deg * Math.PI) / 180, { ...b, from });
            assert.ok(top < 0.05, `${id}, ${b.who} from ${from < 0 ? 'behind' : 'the street'} at z ${z}, ${deg} degrees: never lifted (feet to ${top.toFixed(3)})`);
          }
        }
      }
    }
  }
});

test('RAIL-HANG with ARENA2, the town as it stands: a wagon\'s driver sliding along TVRNBM04\'s 41207 from (13.7, 49.4), 51 degrees on, stays on the ground every frame - the walk\'s vertical pass had set it on the rail a frame in two where its sideways pass refused it (mutants: the vertical pass\'s floor asked of no walk)', { skip: skipReal }, () => {
  const { blocks, modelOf } = game();
  const lay = layoutRmbBlock(blocks.getBlockByName('TVRNBM04.RMB'));
  const col = new Collider(() => 0);
  lay.models.forEach((pm, i) => { const m = modelOf(pm.modelIdNum); if (m) col.addMesh(`m${i}`, m.positions, m.indices, pm.matrix, null, null, false, sightMarksOf(pm.modelIdNum, m)); });
  for (const mode of [TRANSPORT_MODES.Cart, TRANSPORT_MODES.Horse]) {
    const m = new PlayerMotor(col);
    m.spawn(13.7, 0.02, 49.4);
    m.transportMode = mode;
    for (let i = 0; i < 15; i++) m.update(FIXED_DT, IDLE, 0.89);
    let top = 0;
    for (let i = 0; i < 90; i++) { m.update(FIXED_DT, { ...IDLE, forward: 1, run: true }, 0.89); top = Math.max(top, m.pos[1]); }
    assert.ok(top < 0.05, `${mode === TRANSPORT_MODES.Cart ? 'the wagon' : 'the horse'}: on the ground along the fence (feet to ${top.toFixed(3)})`);
    assert.ok(m.pos[0] > 19, `and on along it (x ${m.pos[0].toFixed(2)})`);
  }
});

test('RAIL-HANG with ARENA2 (AUDIT FB1025i G2): the town\'s benches, 41105 and 41106 (a seat 0.55 m up over its pedestal), and the beds 41001, 41007, 41008 and 41050 (0.61 m), are walked and run onto from either long side on as many lines as the parent did - the stand ceiling had made every one a wall', { skip: skipReal }, () => {
  const { modelOf } = game();
  const PARENT = { 41105: 20, 41106: 20, 41001: 20, 41007: 12, 41008: 12, 41050: 12 };   // the parent's own count of 20 lines
  for (const id of Object.keys(PARENT).map(Number)) {
    const m = modelOf(id);
    let foot = Infinity;
    for (let i = 1; i < m.positions.length; i += 3) foot = Math.min(foot, m.positions[i]);
    let on = 0, n = 0;
    for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
      for (const run of [false, true]) {
        for (const side of [-1, 1]) {
          const col = new Collider(() => 0);
          col.addMesh('bench', m.positions, m.indices, trs(0, -foot, 0, 0, 0, 0));
          const mo = new PlayerMotor(col);
          mo.spawn(x, 0.02, side * 2);
          const yaw = side < 0 ? 0 : Math.PI;
          for (let i = 0; i < 20; i++) mo.update(FIXED_DT, IDLE, yaw);
          let top = 0;
          for (let i = 0; i < 120; i++) { mo.update(FIXED_DT, { ...IDLE, forward: 1, run }, yaw); top = Math.max(top, mo.pos[1]); }
          n++;
          if (top > 0.5) on++;
        }
      }
    }
    assert.equal(n, 20);
    assert.equal(on, PARENT[id], `${id}: on its top from ${on} of ${n} lines (the parent: ${PARENT[id]})`);
  }
});

test('RAIL-HANG with ARENA2 (AUDIT FB1025i G1): Privateer\'s Hold as MAPS.BSA lays it, one dungeon bucket - a walker and a runner from S0000999 south over the seam into B0000006, by its upper corridor and its lower, cross it as the parent did; the stand ceiling had stopped every one at the connector\'s lip, 0.501-0.505 m over the feet', { skip: skipReal }, () => {
  const { maps, blocks, modelOf } = game();
  const loc = maps.getLocationByName('Daggerfall', 'Privateer\'s Hold');
  const lay = layoutDungeon(loc, blocks, modelOf);
  const names = lay.blocks.map((b) => `${b.name}@${b.originX},${b.originZ}`);
  assert.ok(names.includes('S0000999.RDB@0,0') && names.includes('B0000006.RDB@0,-51.2'), names.join(' '));
  const col = new Collider(() => -Infinity);
  for (const b of lay.blocks) {
    const o = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const p of b.layout.placements) { const m = modelOf(p.modelIdNum); if (m) col.addMesh('dungeon', m.positions, m.indices, multiply(o, p.matrix)); }
  }
  for (const [label, from] of [['the upper corridor', [15.75, 35.22, 3]], ['the lower corridor', [34.75, 16.02, 3]]]) {
    for (const run of [false, true]) {
      const m = new PlayerMotor(col);
      m.spawn(...from);
      for (let i = 0; i < 15; i++) m.update(FIXED_DT, IDLE, Math.PI);
      for (let i = 0; i < 180; i++) m.update(FIXED_DT, { ...IDLE, forward: 1, run }, Math.PI);
      assert.ok(m.pos[2] < -9, `${label}, ${run ? 'a runner' : 'a walker'}: over the seam and on into B0000006 (z ${m.pos[2].toFixed(2)}, feet ${m.pos[1].toFixed(3)})`);
    }
  }
});

test('RAIL-HANG with ARENA2: W0000005\'s altar station - a body stood on the plinth 41832 inside the altar block 41831, whose top stands 1.25 m under the room\'s ceiling - meets the block\'s faces from inside on every heading, walked and run, as DFU\'s CharacterController meets a MeshCollider\'s (a surface, never a volume): PH1 had lifted it onto the block, where no body stands, and the parent walked it off (2.8 to 13.4 m in two seconds)', { skip: skipReal }, () => {
  const { blocks, modelOf } = game();
  const index = blocks.getBlockIndex('W0000005.RDB');
  const lay = layoutRdbBlock(blocks.getBlock(index), index, false, modelOf);
  const box = lay.placements.find((p) => p.modelIdNum === 41831);
  assert.ok(box && lay.placements.some((p) => p.modelIdNum === 41832), 'the altar\'s block and its plinth');
  const col = new Collider(() => -Infinity);
  lay.placements.forEach((p, i) => { const m = modelOf(p.modelIdNum); if (m) col.addMesh(`m${i}`, m.positions, m.indices, p.matrix); });
  lay.actionDoors.forEach((d, i) => { if (d.disabled) return; const m = modelOf(d.modelIdNum); if (m) col.addMesh(`d${i}`, m.positions, m.indices, d.matrix); });
  assert.ok(Number.isFinite(col.raycast([15.37, 46.2, 28.87], [0, 1, 0], 1)), 'the block\'s top over the station');
  const out = [];
  for (let k = 0; k < 8; k++) {
    for (const run of [false, true]) {
      const yaw = (k * 2 * Math.PI) / 8 + 0.1;
      const m = new PlayerMotor(col);
      m.spawn(15.37, 46.14, 28.87);
      for (let i = 0; i < 15; i++) m.update(FIXED_DT, IDLE, yaw);
      const s = [...m.pos];
      for (let i = 0; i < 120; i++) m.update(FIXED_DT, { ...IDLE, forward: 1, run }, yaw);
      const went = Math.hypot(m.pos[0] - s[0], m.pos[2] - s[2]);
      if (went > 1 || m.pos[1] > 46.5) out.push(`${run ? 'run' : 'walk'} ${k}: ${went.toFixed(2)} m, feet ${m.pos[1].toFixed(2)}`);
    }
  }
  assert.deepEqual(out, [], 'every heading held inside the block, on its plinth');
});

test('RAIL-HANG THE LAW WHERE IT IS WRITTEN: a walking step - no fall in it, or its motor\'s word that it began on the ground (EnemyMotor\'s walk) - hands every pass of its step the body\'s height for PH1\'s floor; the floor a walk set the body on is asked whether the body stands there once its walk is done, and the walk is made again with it a wall where it does not', () => {
  const col = rd('src/player/collider.js');
  assert.match(col, /    this\._walk = dy === 0 \|\| this\._onGround \? height : 0;\n    this\._resolveCapsule\(feet, hOut, height, Infinity, true\);/, 'a walking step\'s sideways pass');
  assert.match(col, /const unstood = floorAbove && this\._walk && this\._walkRefused;[^\n]*\n {10}if \(floorAbove && !unstood\) \{/, 'PH1\'s floor, a walk\'s refused only in the walk made again');
  assert.match(col, /if \(wallAbove \|\| unstood\) \{/, 'and there a wall, as SH1\'s');
  assert.match(col, /if \(liftY > -Infinity && !this\._standsOn\(liftX, liftZ, intoX, intoZ, center\[1\], radius\)\) \{/, 'asked once the walk is done, from where it left the sphere');
  assert.match(col, /finally \{ this\._keepFloor = was; this\._noStep = stepped; this\._onGround = stood; this\._walk = walked; \}/, 'a throw leaves none behind');
  const em = rd('src/characters/enemy/enemyMotor.js');
  assert.match(em, /const r = this\.collider\.move\(this\.feet, dxm, dy, dzm, this\.controllerHeight, true, FOE_KEEPS_FLOOR, false, this\.isGrounded\);/, 'the foe\'s walk hands its ground');
});
