// EG-PERFECT - THE AUDIT, THE SCREEN'S HALF (2026-10-18, Mac: "Lets audit this and ensure perfection"; bible/11-Multiplayer/
// Elite-Gates.md section 31's EG-PERFECT audit record): what a player sees and stands on where spec law 10 broke the bridges and
// opened the chambers' rings - every reader one law (net/eliteGates/egWalkGraph.js egRingSideWalls, world/eliteGates/egHall.js
// egLaneOpenEnds), the hang's reach read in the hall's own frame, a turned piece's column clear of its leap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egRingSideWalls, egRingSideOpen, EG_RING_DOOR, EG_RING_WALL_SIDES } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egLaneOpenEnds, egFragKeep } from '../../../src/world/eliteGates/egHall.js';
import { egHangReach, egHangModel, EG_HANG_CABLE_M, EG_HANG_HALF, EG_HANG_TOP } from '../../../src/scenes/eliteGates/egSpan.js';
import { egPiecePlan } from '../../../src/world/eliteGates/egPlatformModel.js';
import { SD_PENDULUM } from '../../../src/world/superDungeon/sdStepsModel.js';
import { createEgSpan, EG_GHOSTS_MAX } from '../../../src/scenes/eliteGates/egSpan.js';
import { egCircleSpecs } from '../../../src/net/eliteGates/egLaw.js';
import { EG_CRUMBLE_KINDS } from '../../../src/net/eliteGates/egSpanLaw.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';

/** A law 10 chamber: its ring wall (r 17.5 at the origin), its frame (z -16..16) and an alcove at its rim on the +x side. */
const chamber = (alcoves) => ({ law: 10, frags: [{ kit: 'caverns', cls: 'chamber', x: 0, z0: -16, z1: 16 }, { kit: 'caverns', cls: 'passage', x: 0, z0: -40, z1: -17 }], alcoves, deco: [{ t: 'wall', x: 0, z: 0, r: 17.5, y: 0, h: 9, kit: 'caverns' }], discs: [], lanes: [], bands: [], ramps: [], steps: [], heroes: [] });

test('EG-PERFECT AUDIT S1 AN ALCOVE\'S DOORWAY THROUGH ITS RING, ITS WIDTH ALONE (spec law 10; every reader of a ring wall): the side an alcove of the ring\'s own chamber opens keeps its wall either side of a doorway EG_RING_DOOR wide about the alcove (the whole side, 3.4-5.4 m, stood open about a 2 m niche); a passage\'s alcove beside the ring opens none of it; law 9 opens none; the clamp lets a body through the doorway alone (mutants: the whole side open; a passage\'s alcove opening the ring; the clamp open across the side)', () => {
  const R = 17.5, z = -16 / 3, x = Math.sqrt(16 * 16 - z * z) + 1.2, spec = chamber([{ x, z, y: 0, side: 1 }]), d = spec.deco[0];
  const opened = [...Array(EG_RING_WALL_SIDES).keys()].filter((k) => egRingSideWalls(spec, d, k).length !== 0 && egRingSideOpen(spec, d, k));
  assert.ok(opened.length >= 1 && opened.length <= 2, `${opened.length} sides hold its doorway`);
  let door = 0;
  for (const k of opened) {
    const walls = egRingSideWalls(spec, d, k), L = 2 * R * Math.sin(Math.PI / EG_RING_WALL_SIDES);
    assert.ok(walls.length >= 1, `side ${k} keeps wall beside its doorway`);
    door += (1 - walls.reduce((t, [a, b]) => t + (b - a), 0)) * L;
  }
  assert.ok(Math.abs(door - EG_RING_DOOR.w) < 0.05, `its doorway ${door.toFixed(2)} m`);
  // a passage's alcove beside the ring (z -17.5, outside the chamber's frame): no side of the ring opens for it
  const P = chamber([{ x: 4.7, z: -17.4, y: 0, side: 1 }]);
  assert.ok([...Array(EG_RING_WALL_SIDES).keys()].every((k) => !egRingSideOpen(P, P.deco[0], k) || egRingSideWalls(P, P.deco[0], k).length === 0), 'a passage\'s alcove opens nothing');
  assert.ok([...Array(EG_RING_WALL_SIDES).keys()].every((k) => egRingSideWalls({ ...spec, law: 9 }, d, k).length !== 1 || egRingSideWalls({ ...spec, law: 9 }, d, k)[0][1] === 1), 'law 9: whole');
  // the clamp: a body at the rim through the doorway passes; a metre and a half beside it, held
  const q = { t: 'chamber', x: 0, z: 0, r: R, y: 0 }, ux = x / Math.hypot(x, z), uz = z / Math.hypot(x, z), r = 0.35;
  assert.equal(egFragKeep(q, ux * (R + 0.1), uz * (R + 0.1), r, spec), null, 'through its doorway');
  assert.notEqual(egFragKeep(q, ux * (R + 0.1) - uz * 1.5, uz * (R + 0.1) + ux * 1.5, r, spec), null, 'beside it: the wall');
});

test('EG-PERFECT AUDIT S2 A LANE\'S END OVER THE VOID IS CLOSED (spec law 10\'s broken bridges and approaches; world/eliteGates/egHall.js egLaneOpenEnds - the lane\'s face and edge line there, its edges\' segment across it): an end no floor meets reads open, one a disc, a lane, a piece or a room meets reads closed (mutants: every end closed; a piece\'s top unread)', () => {
  const l = { ax: 0, az: 0, bx: 0, bz: 10, hw: 2, y: 5 };
  const spec = { discs: [{ x: 0, z: -4, r: 4, y: 5 }], lanes: [l], bands: [], ramps: [], steps: [], heroes: [] };
  assert.equal(egLaneOpenEnds(spec, l), 2, 'its b end over the void, its a end on the disc');
  assert.equal(egLaneOpenEnds({ ...spec, steps: [{ x: 0, y: 5, z: 11.2, w: 3, d: 2.6 }] }, l), 0, 'a piece abutting it');
  assert.equal(egLaneOpenEnds({ ...spec, steps: [{ x: 0, y: 5, z: 13.8, w: 3, d: 2.6 }] }, l), 2, 'a piece a gap on: open');
  assert.equal(egLaneOpenEnds({ ...spec, discs: [], steps: [{ x: 0, y: 1, z: 11.2, w: 3, d: 2.6 }] }, l), 3, 'a floor under its end is no floor at it');
});

test('EG-PERFECT AUDIT S3 A DRIFT\'S HANG READS A ROOM WHERE IT STANDS (scenes/eliteGates/egSpan.js egHangReach; a hall\'s `heroes` box is the hall\'s frame already): a room far from a drift caps nothing - its box read once more off its origin stood a phantom over open sky (14 of 23 capped hangs) - and a room over a drift caps it under its floor; the anchor\'s reach under its pivot is each band\'s model\'s own (mutants: the box shifted by its origin; the reach down 1.4 m)', () => {
  const drift = { kind: 'drift', x: 0, y: 0, z: 0, w: 3, d: 2.6, amp: 1.5 };
  const room = (box, o) => ({ steps: [drift], discs: [], lanes: [], bands: [], ramps: [], heroes: [{ room: 'tower', x: o[0], y: o[1], z: o[2], box, floors: [] }] });
  // a room 40 m off (its floor 6 m up) whose origin, added again, would stand its box over the drift
  assert.deepEqual(egHangReach(room([38, 6, -5, 50, 18, 5], [-40, 0, 0]), drift, 0), { len: SD_PENDULUM.len, over: EG_HANG_CABLE_M }, 'an open sky');
  const capped = egHangReach(room([-6, 10, -5, 6, 20, 5], [0, 0, 0]), drift, 0);
  assert.ok(capped.len < SD_PENDULUM.len, `under the room 10 m up: chains ${capped.len} m`);
  // the anchor's reach read off each band's own model (its parts that stay put when the chains lengthen, the chains aside): down
  // under the pivot, across and along - the first band's rib hangs 1.57 m under it, past the 1.4 m read before
  for (let band = 0; band < 4; band++) {
    const P = (m) => { const p = m.positions ?? m.subMeshes[0].positions, out = []; for (let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2]]); return out; };
    const key = (q) => q.map((v) => v.toFixed(3)).join(','), other = new Set(P(egHangModel(band, 23)).map(key));
    const anchor = P(egHangModel(band, 18)).filter((q) => other.has(key(q)) && q[1] > -4 && !(Math.abs(Math.abs(q[0]) - SD_PENDULUM.foot) <= 0.13 && Math.abs(q[2]) <= 0.13));
    const lo = Math.min(...anchor.map((q) => q[1])), hi = Math.max(...anchor.map((q) => q[1]));
    assert.ok(-lo <= EG_HANG_HALF.down, `band ${band}: its anchor ${(-lo).toFixed(2)} m under its pivot, within ${EG_HANG_HALF.down}`);
    assert.ok(anchor.every((q) => Math.abs(q[0]) <= EG_HANG_HALF.x && Math.abs(q[2]) <= EG_HANG_HALF.z), `band ${band}: its anchor within the reach across and along`);
    if (band !== 3) assert.ok(Math.abs(hi - EG_HANG_TOP[band]) < 0.01, `band ${band}: its top ${hi.toFixed(2)} m`);
  }
});

test('EG-PERFECT AUDIT S4 A TURNED PIECE\'S COLUMN CLEAR OF ITS LEAP (world/eliteGates/egPlatformModel.js egPiecePlan; spec law 10\'s `hd`): a still slab turned along x leaps over its +x and -x sides, so its broken column stands on a z side - it stood on the jump line (mutant: a turned piece\'s column on an x side)', () => {
  let cols = 0;
  for (const hd of [1, 3]) for (let seed = 1; seed <= 400; seed++) {
    const s = { i: 0, kind: 'still', x: 0, y: 0, z: 0, w: 3, d: 2.6, hd, road: 0 };
    const plan = egPiecePlan({ steps: [s], discs: [], lanes: [], bands: [], ramps: [], heroes: [] }, s, { seed, band: 0 });
    if (!plan.column) continue;
    cols++;
    assert.ok(plan.column.side === 0 || plan.column.side === 2, `hd ${hd} seed ${seed}: its column on side ${plan.column.side}`);
  }
  assert.ok(cols > 20, `${cols} columns`);
});

test('EG-PERFECT AUDIT S5 A CIRCLE PAST ITS GHOSTS\' SLOTS GHOSTS THE HALLS I AM AMONG (scenes/eliteGates/egSpan.js aimGhosts; render/superDungeon/sdStepsPass.js `ghosts`; sections 10.8 and 25.6): seed 7\'s circle 5 lays 72 Beats and Crumbles under spec law 10, past EG_GHOSTS_MAX - in its last hall every one of that hall\'s has its ghost, the rest the halls nearest it, and the pass\'s boxes are laid again for them (the circle\'s first 48 alone, its later halls drew none) (mutants: never aimed; aimed in the circle\'s order; the pass never told)', () => {
  const specs = egCircleSpecs(7, 5, 0), ghostly = (q) => q.kind === 'beat' || EG_CRUMBLE_KINDS.includes(q.kind);
  const all = specs.flatMap((sp) => sp.steps.filter(ghostly).map((q) => ({ h: sp.h, i: q.i, x0: sp.x0 })));
  assert.ok(all.length > EG_GHOSTS_MAX, `${all.length} past the slots`);
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4, ARRAY_BUFFER: 1, FLOAT: 5, STATIC_DRAW: 7, drawingBufferHeight: 720, drawingBufferWidth: 1280 }, { get: (t, k) => (k in t ? t[k] : (...args) => { calls.push([k, ...args]); if (k === 'getProgramParameter' || k === 'getShaderParameter') return true; if (k === 'getUniformLocation') return args[1]; return {}; }) });
  const span = createEgSpan({ renderer: { createMesh: (m) => ({ subMeshes: m.subMeshes, model: m }), destroyMesh: () => {}, gl }, audio: null, seed: 7, c: 5, lite: false });
  span.stand({ dynamicDraws: [], collider: null });
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  span.ride(0, 0.016, null, false);
  span.drawPass(I, I, null);
  const last = specs[specs.length - 1], at = (sp) => ({ pos: realmToDungeon(sp.x0 + sp.arrive.x, 0.1, sp.arrive.z), grounded: false, groundKey: null, height: 1.8 });
  const uploads = () => calls.filter((q) => q[0] === 'bufferData').length, before = uploads();
  span.ride(1, 0.016, at(last), true);
  const of = span.ghosts.of, mine = all.filter((q) => q.h === last.h);
  assert.equal(of.length, EG_GHOSTS_MAX, 'every slot stands for one');
  assert.ok(mine.every((q) => of.some((g) => g.h === q.h && g.i === q.i)), `its last hall's ${mine.length} all ghosted`);
  const far = (q) => Math.abs(q.x0 - last.x0), kept = of.map((g) => all.find((q) => q.h === g.h && q.i === g.i));
  assert.ok(Math.max(...kept.map(far)) <= Math.min(...all.filter((q) => !kept.includes(q)).map(far)), 'the rest the halls nearest it');
  assert.equal(uploads(), before + 1, 'the pass\'s boxes laid again for them');
  span.ride(1.1, 0.016, at(last), true);
  assert.equal(uploads(), before + 1, 'nothing again while I stay');
  span.clear();
});

