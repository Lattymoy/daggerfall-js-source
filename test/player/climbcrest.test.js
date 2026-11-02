// CLIMB-CREST (2026-10-26, the owner: "Pre existing issue where walls cant be climbed over"; bible/03-World/
// Parkour-Arc.md CLIMB-CREST): Daggerfall's city wall has no top to stand on - each face rises to a knife edge, and the
// coping's back falls 76 degrees to the wall walk 1.6 m under it (ARCH3D 445: faces to 8.05 m, the walk at 6.45 between
// copings 0.4 m deep). The enhanced climb read the coping's back as a roof too steep to stand on: a free climb stuck under
// the edge until its grip gave, and a body on the walk could not leave it. A CREST - the face's own top, its far side
// falling away, open air over it - is now a lip: the hand-hold holds it, the clamber takes it onto the walk behind (as far
// down as a hang's let-go) and the over-hang over it into a hang on the far face. Pinned on the sensors over the wall's
// own profile, on a real PlayerMotor climbing it whole both ways, and on the game's own wall (ARENA2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PlayerMotor, CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { senseLedge, senseGrip, crestTop, PARKOUR_HANG_DROP, PARKOUR_CREST_PAST, PARKOUR_CREST_DROP, PARKOUR_CREST_OPEN, PARKOUR_FACE_LEAN } from '../../src/player/parkour.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'ARCH3D.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const GEO = (high) => ({ low: 0.25, high, radius: 0.35, stand: CAPSULE_HEIGHT, crouch: 1.1, height: CAPSULE_HEIGHT });
/** The wall's measures (ARCH3D 445): its faces at z +-4.8 to 8.05 m, the walk 6.45 m up between copings whose backs fall
 *  from the edge to 0.4 m in. */
const W = Object.freeze({ half: 4.8, top: 8.05, walk: 6.45, coping: 0.4 });

/** Daggerfall's city wall along x (-40..40), its inside -z: two faces, two copings' backs and the walk - planes, as the
 *  game's are. `over` a roof over the outer edge (an eave), `fall` the coping's back's fall in metres (1.6, the game's). */
function wallOf({ over = null, fall = W.top - W.walk } = {}) {
  const col = new Collider(() => 0);
  const quad = (key, a, b, c, d) => col.addMesh(key, new Float32Array([...a, ...b, ...c, ...d]), [0, 1, 2, 0, 2, 3], I);
  const X = 40, { half, top, coping } = W, walk = top - fall;
  for (const s of [1, -1]) {
    quad(`face${s}`, [-X, 0, s * half], [X, 0, s * half], [X, top, s * half], [-X, top, s * half]);
    quad(`coping${s}`, [-X, top, s * half], [X, top, s * half], [X, walk, s * (half - coping)], [-X, walk, s * (half - coping)]);
  }
  quad('walk', [-X, walk, -(half - coping)], [X, walk, -(half - coping)], [X, walk, half - coping], [-X, walk, half - coping]);
  if (over) quad('eave', [-X, top + over, half - 0.5], [X, top + over, half - 0.5], [X, top + over, half + 0.6], [-X, top + over, half + 0.6]);
  return col;
}

test('CLIMB-CREST the measures: past the top 3 cm, a fall of 5 cm there (59 degrees at the least - the coping falls 76), a metre of open air over it', () => {
  assert.equal(PARKOUR_CREST_PAST, 0.03);
  assert.equal(PARKOUR_CREST_DROP, 0.05);
  assert.equal(PARKOUR_CREST_OPEN, 1);
  assert.ok(Math.atan2(W.top - W.walk, W.coping) * 180 / Math.PI > Math.atan2(PARKOUR_CREST_DROP, PARKOUR_CREST_PAST) * 180 / Math.PI, 'the coping falls past the crest\'s least');
});

test('CLIMB-CREST the crest: a face\'s top whose far side falls away under open air - from either face of the wall, the edge to the millimetre; none where a roof rises past the top, an eave stands over it, or the far side falls less (mutants: the fall unread; the air unread; the bisection unread)', () => {
  const col = wallOf();
  // from outside (+z), looking -z; from the walk, looking +z at the coping's back
  const out = crestTop(col, [0, 0, 6], [0, 0, -1], 6 - W.half, W.top - 0.1, W.top + 0.05);
  assert.ok(out != null && Math.abs(out - W.top) < 0.002, `from outside: the edge (${out})`);
  const lo = W.top - 0.1, at = W.half - W.coping + ((lo - W.walk) * W.coping) / (W.top - W.walk);   // the coping's back where the look meets it, a rung under the top (the face scan's)
  const fromWalk = crestTop(col, [0, 0, 0], [0, 0, 1], at, lo, W.top + 0.05);
  assert.ok(fromWalk != null && Math.abs(fromWalk - W.top) < 0.002, `from the walk, up the coping's back: the edge (${fromWalk})`);
  assert.equal(crestTop(wallOf({ over: 0.6 }), [0, 0, 6], [0, 0, -1], 6 - W.half, W.top - 0.1, W.top + 0.05), null, 'an eave 0.6 m over the edge: the eave\'s law, no crest');
  assert.equal(crestTop(wallOf({ fall: 0.03 }), [0, 0, 6], [0, 0, -1], 6 - W.half, W.top - 0.1, W.top + 0.05), null, 'a coping falling 4 degrees: a top, no crest');
  assert.equal(crestTop(col, [0, 0, 6], [0, 0, -1], 6 - W.half, W.top + 0.1, W.top + 0.2), null, 'the face met nowhere between');
  // a roof rising from the face's top (a pitched roof at 60 degrees from an eave at 3 m): no crest
  const roof = new Collider(() => 0);
  roof.addMesh('face', new Float32Array([-4, 0, 1, 4, 0, 1, 4, 3, 1, -4, 3, 1]), [0, 1, 2, 0, 2, 3], I);
  roof.addMesh('roof', new Float32Array([-4, 3, 1, 4, 3, 1, 4, 3 + 1.732 * 2, 3, -4, 3 + 1.732 * 2, 3]), [0, 1, 2, 0, 2, 3], I);
  assert.equal(crestTop(roof, [0, 0, 0], [0, 0, 1], 1, 2.9, 3.2), null, 'a roof rising past the face\'s top');
  assert.ok(PARKOUR_FACE_LEAN > 0);
});

test('CLIMB-CREST the sensors: the ledge at the crest is a lip with no top (no mantle - the clamber\'s), from outside and from the walk; the hand-hold holds it, hung under it off the face (mutants: the ledge refused; the hold refused)', () => {
  const col = wallOf();
  // a free climber near the top outside: its feet 1.6 m under the edge, a body's reach
  const l = senseLedge(col, [0, W.top - 1.6, W.half + 0.4], [0, 0, -1], GEO(2.1));
  assert.ok(l.ok && l.crest, `a lip (${l.why})`);
  assert.ok(Math.abs(l.lipY - W.top) < 0.002, `at the edge (${l.lipY})`);
  assert.equal(l.depth, 0, 'no top to stand on');
  assert.equal(l.mantle, null, 'nothing to stand on: the clamber\'s');
  const w = senseLedge(col, [0, W.walk, W.half - W.coping - 0.45], [0, 0, 1], GEO(2.1));
  assert.ok(w.ok && w.crest && Math.abs(w.lipY - W.top) < 0.002, `from the walk: the coping's crest (${w.why}, ${w.lipY})`);
  const g = senseGrip(col, [0, 0, W.half], [0, 0, 1], W.top, GEO(2.1));
  assert.ok(g, 'the hands hold the crest');
  assert.ok(Math.abs(g.lipY - W.top) < 0.002 && Math.abs(g.feet[1] - (g.lipY - PARKOUR_HANG_DROP)) < 1e-9 && g.feet[2] > W.half, `hung under it, off the face (${g.feet.map((v) => v.toFixed(2))})`);
  // an eave over it: the crest's no hold of the face's own law - and the steep roof past an eave is still no lip
  assert.equal(senseLedge(wallOf({ over: 0.6 }), [0, W.top - 1.6, W.half + 0.4], [0, 0, -1], GEO(2.1)).crest ?? false, false);
});

const blank = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };
const state = (m) => (m._pkMove ? `move:${m._pkMove.kind}` : m._wall ? m._wall.mode : m.grounded ? 'ground' : 'air');
function climber(col, skill) {
  return new PlayerMotor(col, { speed: 50, running: 30 }, {
    parkour: { enabled: () => true, inputs: () => ({ climbing: skill, jumping: 50 }), say: () => {}, tally: () => {} },
  });
}
/** Over the wall from one side (`s` 1 outside, -1 inside), Forward held up and over and Back held once hung on the far
 *  face: where the body ends, and every state it passed. */
function over(col, s, skill) {
  const m = climber(col, skill);
  m.spawn(0, 0.02, s * (W.half + 1.5));
  const yaw = s > 0 ? Math.PI : 0, seen = [];
  for (let i = 0; i < 60 * 60; i++) {
    const far = s * m.pos[2] < -W.half;   // past the far face
    if (far && m.grounded && m.pos[1] < 0.1) break;
    const input = far && (m.hanging || m._wall) ? { forward: -1 } : { forward: 1 };
    m.update(1 / 60, { ...blank, ...input }, yaw);
    const st = state(m);
    if (seen[seen.length - 1] !== st) seen.push(st);
  }
  return { m, seen };
}

test('CLIMB-CREST a real climber over Daggerfall\'s wall, both ways, at Climbing 50 and 100 (at 0 the grip gives a few metres up, as on any wall that tall): up the face, over the crest onto the walk, across it, over the far crest into a hang on the far face, down it - never a fall from the top (mutants: the walk\'s drop the step\'s; the far side\'s hang unread)', () => {
  const col = wallOf();
  for (const s of [1, -1]) for (const skill of [50, 100]) {
    const { m, seen } = over(col, s, skill);
    const path = seen.join(' > ');
    assert.ok(m.grounded && m.pos[1] < 0.1 && s * m.pos[2] < -W.half, `${s > 0 ? 'outside in' : 'inside out'}, Climbing ${skill}: on the far side's ground (${[...m.pos].map((v) => v.toFixed(2))}; ${path})`);
    assert.ok(seen.includes('move:mantle') && seen.includes('move:lower') && seen.includes('hang'), `${s}, ${skill}: over the crest onto the walk and into the far hang (${path})`);
    assert.ok(m.fallStart == null || m.fallStart - m.pos[1] < 5 || !m.falling, `${s}, ${skill}: no fall that hurts`);
  }
});

test('CLIMB-CREST with ARENA2: the game\'s own wall (ARCH3D 445, three lengths in a row) climbed over by the enhanced climber, both ways', { skip: skipReal }, async () => {
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const m445 = dfMeshToModel(arch.getMesh(arch.getRecordIndex(445)), () => ({ width: 64, height: 64 }));
  const col = new Collider(() => 0);
  for (const dx of [-25.6, 0, 25.6]) col.addMesh(`w${dx}`, m445.positions, m445.indices, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, dx - 3, 0, 0, 1]);
  for (const s of [1, -1]) {
    const { m, seen } = over(col, s, 100);
    assert.ok(m.grounded && m.pos[1] < 0.1 && s * m.pos[2] < -W.half, `${s}: over the game's wall (${[...m.pos].map((v) => v.toFixed(2))}; ${seen.join(' > ')})`);
  }
});
