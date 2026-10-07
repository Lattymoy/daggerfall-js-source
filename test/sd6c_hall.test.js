// SD6c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 8): THE ORRERY'S HALL ON THE
// PAGE - world/sdHall.js (where its parts stand, the meshes they are), world/sdHallArt.js (what they wear),
// scenes/sdHall.js (the dungeon host's set: stood, heard, turned, pressed), and the hosts' wiring - the turn sent, the
// realm's word read, the snap's lash on whoever stands in the hall, the edge widened by the Concord.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_ORRERY, SD_STONES, SD_STONE_POS, SD_STONE_REACH, SD_STONE_SETTLE_MS, SD_FRAY_LASH, SD_WALK, orreryOf, realmToDungeon,
  dungeonToRealm, inOrreryHall, sdHourWord,
} from '../src/net/sdBrain.js';
import { SD_REALM_ORIGIN } from '../src/net/sdBrain.js';
import { SD_REALM_FLOORS, realmClamp, SD_REALM_ARCHIVE } from '../src/world/sdRealm.js';
import {
  stoneFrame, stonePoint, plaqueFrame, handleFoot, handleBox, plaqueBox, handMatrix, dialCentre, buildHallModel, buildHandModel,
  buildLitModel, buildFrayModel, buildBridgeModel, hallFloorTris, SD_STONE_SIZE, SD_DIAL, SD_HAND, SD_HANDLE, SD_PLAQUE, SD_LIT_RING,
  SD_FRAY_RING, SD_BRIDGE, SD_FIRST_STEP, SD_HALL_FLOORS,
} from '../src/world/sdHall.js';
import {
  hallArt, hallFaceArt, hallEmblemArt, hallPlaqueArt, hallGlowArt, SD_SIGNS, SD_PIPS, SD_HALL_FACE_RECORD, SD_HALL_EMBLEM_RECORD,
  SD_HALL_PLAQUE_RECORD, SD_HALL_GLOW_RECORD, SD_GLOW_COLORS, SD_HALL_ART_SIZE, SD_EMBLEM_SIZE,
} from '../src/world/sdHallArt.js';
import { createSdHall, sdStoneKey, sdPlaqueKey, SD_HALL_TEXT, SD_HALL_SOUNDS, SD_HAND_RATE } from '../src/scenes/sdHall.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const overlap = (p, q) => [0, 1, 2].every((k) => p.min[k] < q.max[k] && q.min[k] < p.max[k]);
const bearing = (x, z) => ((Math.atan2(x - SD_ORRERY.x, z - SD_ORRERY.z) * 180) / Math.PI + 360) % 360;

test('SD6c the layout: each stone faces the hall\'s centre, its right the right of one who faces it (render/mat4 lookAt\'s); its two handles on its face, the right forward; no handle\'s box near another\'s; the plaques on the rim, numbered clockwise from the walk in, none on the walk in or the way on (mutants: a stone turned away; the handles swapped)', () => {
  for (let i = 0; i < SD_STONES.length; i++) {
    const { at, n, R } = stoneFrame(i);
    const toCentre = [SD_ORRERY.x - at[0], 0, SD_ORRERY.z - at[2]], l = Math.hypot(toCentre[0], toCentre[2]);
    assert.ok(near(n, [toCentre[0] / l, 0, toCentre[2] / l]), 'facing the centre');
    assert.ok(near(cross(R, [0, 1, 0]), n), 'R x up = n: a face across R and up looks along n');
    // one who faces it looks along -n; lookAt's right for that eye is up x (eye - centre) = up x n
    assert.ok(near(cross([0, 1, 0], n), R), 'R is the right of one who faces it');
    const right = handleFoot(i, 1), left = handleFoot(i, -1);
    assert.ok(dot([right[0] - at[0], 0, right[2] - at[2]], R) > 0.5 && dot([left[0] - at[0], 0, left[2] - at[2]], R) < -0.5, 'the right handle on the right');
    for (const p of [right, left]) assert.ok(Math.abs(dot([p[0] - at[0], 0, p[2] - at[2]], R)) < SD_STONE_SIZE.w / 2, 'on the face, within the slab');
  }
  const boxes = [];
  for (let i = 0; i < SD_STONES.length; i++) for (const a of [1, -1]) boxes.push(handleBox(i, a));
  for (let k = 0; k < SD_PLAQUE.bearings.length; k++) boxes.push(plaqueBox(k));
  for (let p = 0; p < boxes.length; p++) for (let q = p + 1; q < boxes.length; q++) assert.ok(!overlap(boxes[p], boxes[q]), `boxes ${p} and ${q} apart`);
  const order = SD_PLAQUE.bearings.map((b) => (b - 180 + 360) % 360);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'numbered clockwise from the walk in');
  for (let k = 0; k < SD_PLAQUE.bearings.length; k++) {
    const { at, n } = plaqueFrame(k);
    assert.ok(Math.abs(Math.hypot(at[0] - SD_ORRERY.x, at[2] - SD_ORRERY.z) - SD_PLAQUE.r) < 1e-9 && SD_PLAQUE.r < SD_ORRERY.r - 1);
    assert.ok(Math.abs(at[0] - SD_WALK.x) > SD_WALK.halfW + 1 && Math.abs(at[0] - SD_BRIDGE.x) > SD_BRIDGE.halfW + 1, 'off the walk in and the way on');
    assert.ok(dot(n, [SD_ORRERY.x - at[0], 0, SD_ORRERY.z - at[2]]) > 0, 'facing in');
  }
});

test('SD6c THE HAND: on its dial, standing off the face, the twelfth hour straight up and turning CLOCKWISE as one facing the stone sees it - three o\'clock to their right; a proper turn, never a mirror (mutants: the hands turn backwards; a mirrored hand)', () => {
  for (let i = 0; i < SD_STONES.length; i++) {
    const { n, R } = stoneFrame(i);
    const m = (h) => handMatrix(i, h);
    const col = (M, c) => [M[c * 4], M[c * 4 + 1], M[c * 4 + 2]];
    assert.ok(near(col(m(0), 1), [0, 1, 0]), 'the twelfth straight up');
    assert.ok(near(col(m(3), 1), R), 'three to the right');
    assert.ok(near(col(m(6), 1), [0, -1, 0]), 'six straight down');
    assert.ok(near(col(m(9), 1), R.map((v) => -v)), 'nine to the left');
    for (const h of [0, 1.5, 7, 11.9]) {
      const M = m(h);
      assert.ok(near(cross(col(M, 0), col(M, 1)), col(M, 2)), 'x cross y = z: no mirror');
      assert.ok(near(col(M, 2), n), 'its face toward the hall');
      assert.ok(near(col(M, 3), realmToDungeon(...stonePoint(i, 0, SD_DIAL.y, SD_HAND.off)), 1e-5), 'its hub on the dial, before the face');
    }
  }
  const hand = buildHandModel();
  for (let k = 0; k < hand.normals.length; k += 3) assert.ok(hand.normals[k + 2] > 0.99, 'the hand faces its own +z');
  const ys = []; for (let k = 1; k < hand.positions.length; k += 3) ys.push(hand.positions[k]);
  assert.ok(Math.abs(Math.max(...ys) - SD_HAND.len) < 1e-6, 'its point along +y');
});

test('SD6c the models: the hall\'s standing parts by record - each stone\'s dial and sign facing the hall, the plaques, the first step; the dial\'s light in its six segments clockwise from the twelfth; the fray a step a turn round the rim; the bridge from the rim to the first step, facing up (mutants: the lit ring at the wrong hours; the fray backwards)', () => {
  const hall = buildHallModel();
  const recs = hall.subMeshes.map((s) => s.textureRecord);
  for (const r of [SD_HALL_FACE_RECORD, ...SD_STONES.map((_, i) => SD_HALL_EMBLEM_RECORD + i), ...SD_PIPS.map((_, k) => SD_HALL_PLAQUE_RECORD + k), 0, 1, 2]) assert.ok(recs.includes(r), `record ${r}`);
  assert.ok(hall.subMeshes.every((s) => s.textureArchive === SD_REALM_ARCHIVE));
  for (let k = 0; k < hall.normals.length; k += 3) assert.ok(Math.abs(Math.hypot(hall.normals[k], hall.normals[k + 1], hall.normals[k + 2]) - 1) < 1e-5);
  // each sign faces the hall: its sub-mesh's normal is its stone's n
  for (let i = 0; i < SD_STONES.length; i++) {
    const sm = hall.subMeshes.find((s) => s.textureRecord === SD_HALL_EMBLEM_RECORD + i);
    const v = sm.startIndex * 3;
    assert.ok(near([hall.normals[v], hall.normals[v + 1], hall.normals[v + 2]], stoneFrame(i).n, 1e-5), `sign ${i} faces the hall`);
    const p = dungeonToRealm(hall.positions[v], hall.positions[v + 1], hall.positions[v + 2]);
    assert.ok(Math.hypot(p[0] - SD_STONE_POS[i].x, p[2] - SD_STONE_POS[i].z) < SD_STONE_SIZE.w, 'on its own stone');
  }
  // the first step's floor: a disc round its centre
  const floor = hall.subMeshes.find((s) => s.textureRecord === 0);
  let onStep = 0;
  for (let k = floor.startIndex; k < floor.startIndex + floor.primitiveCount * 3; k++) { const p = dungeonToRealm(hall.positions[k * 3], hall.positions[k * 3 + 1], hall.positions[k * 3 + 2]); if (Math.hypot(p[0] - SD_FIRST_STEP.x, p[2] - SD_FIRST_STEP.z) <= SD_FIRST_STEP.r + 1e-3) onStep++; }
  assert.equal(onStep, floor.primitiveCount * 3);
  // the dial's light
  assert.equal(buildLitModel(0), null);
  for (let n = 1; n <= 6; n++) {
    const lit = buildLitModel(n), seen = new Set();
    for (let k = 0; k < lit.positions.length; k += 3) {
      const p = dungeonToRealm(lit.positions[k], lit.positions[k + 1], lit.positions[k + 2]), r = Math.hypot(p[0] - SD_ORRERY.x, p[2] - SD_ORRERY.z);
      assert.ok(r >= SD_LIT_RING.r0 - 1e-3 && r <= SD_LIT_RING.r1 + 1e-3);
      seen.add(Math.floor(bearing(p[0], p[2]) / 60));
      assert.ok(lit.normals[k + 1] > 0.99, 'facing up');
    }
    assert.deepEqual([...seen].sort(), [...Array(n).keys()], `the first ${n} segments, clockwise from the twelfth`);
  }
  // the fray
  assert.equal(buildFrayModel(0), null);
  for (const f of [1, 12, 48]) {
    const fr = buildFrayModel(f);
    assert.equal(fr.positions.length / 3, f * 6, 'a step a turn');
    let most = 0;
    for (let k = 0; k < fr.positions.length; k += 3) {
      const p = dungeonToRealm(fr.positions[k], fr.positions[k + 1], fr.positions[k + 2]), r = Math.hypot(p[0] - SD_ORRERY.x, p[2] - SD_ORRERY.z);
      assert.ok(r >= SD_FRAY_RING.r0 - 1e-3 && r <= SD_FRAY_RING.r1 + 1e-3 && fr.normals[k + 1] > 0.99);
      most = Math.max(most, (bearing(p[0], p[2]) + 359.9) % 360 + 0.1);
    }
    assert.ok(most <= (f / 48) * 360 + 1e-3, `${f}: clockwise from the twelfth`);
  }
  const bridge = buildBridgeModel();
  for (let k = 0; k < bridge.positions.length; k += 3) {
    const p = dungeonToRealm(bridge.positions[k], bridge.positions[k + 1], bridge.positions[k + 2]);
    assert.ok(p[2] >= SD_BRIDGE.z0 - 1e-3 && p[2] <= SD_BRIDGE.z1 + 1e-3 && bridge.normals[k + 1] > 0.99);
  }
  assert.ok(SD_BRIDGE.z0 < SD_ORRERY.z + SD_ORRERY.r && SD_BRIDGE.z1 > SD_FIRST_STEP.z - SD_FIRST_STEP.r, 'it reaches into both');
});

test('SD6c THE FLOORS: the bridge and the first step stand in the collider from the first, and the edge keeps a body off them until the Concord adds them (mutants: the bridge open before the Concord; the step unreachable after it)', () => {
  const onBridge = realmToDungeon(0, 0, (SD_BRIDGE.z0 + SD_BRIDGE.z1) / 2), onStep = realmToDungeon(SD_FIRST_STEP.x, 0, SD_FIRST_STEP.z);
  const back = realmClamp(onBridge, 0.4, SD_REALM_FLOORS);
  assert.ok(back, 'put back before the Concord');
  assert.ok(Math.hypot(back[0] - SD_REALM_ORIGIN[0] - SD_ORRERY.x, back[1] - SD_REALM_ORIGIN[2] - SD_ORRERY.z) <= SD_ORRERY.r, 'into the hall');
  assert.ok(realmClamp(onStep, 0.4, SD_REALM_FLOORS));
  const all = [...SD_REALM_FLOORS, ...SD_HALL_FLOORS];
  assert.equal(realmClamp(onBridge, 0.4, all), null, 'the Concord\'s floors: the bridge');
  assert.equal(realmClamp(onStep, 0.4, all), null, 'and the step');
  // walked the bridge's length with the body's inset, never put back
  for (let z = SD_ORRERY.z; z <= SD_FIRST_STEP.z; z += 0.25) assert.equal(realmClamp(realmToDungeon(0, 0, z), 0.4, all), null, `z ${z}`);
  assert.ok(realmClamp(realmToDungeon(0, 0, SD_FIRST_STEP.z + SD_FIRST_STEP.r + 1), 0.4, all), 'nothing past the step yet');
  // the collider's floors: the bridge's middle and the step's centre are under a triangle
  const tris = hallFloorTris();
  const under = (p) => { for (let k = 0; k < tris.length; k += 9) { const a = [tris[k], tris[k + 2]], b = [tris[k + 3], tris[k + 5]], c = [tris[k + 6], tris[k + 8]]; const s = (u, v, w) => (u[0] - w[0]) * (v[1] - w[1]) - (v[0] - w[0]) * (u[1] - w[1]); const d1 = s([p[0], p[2]], a, b), d2 = s([p[0], p[2]], b, c), d3 = s([p[0], p[2]], c, a); if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true; } return false; };
  assert.ok(under(onBridge) && under(onStep));
  assert.ok(!under(realmToDungeon(SD_BRIDGE.halfW + 1, 0, (SD_BRIDGE.z0 + SD_BRIDGE.z1) / 2)), 'nothing beside the bridge');
  for (let k = 1; k < tris.length; k += 3) assert.equal(tris[k], 0, 'every floor at y 0');
});

test('SD6c THE ART: a dial of twelve equal hours; six signs, each its own; plaques numbered in pips; glows their own light - every picture drawn y up (mutants: a sign the same as another; a plaque\'s pips miscounted)', () => {
  const recs = hallArt().map(([r]) => r);
  assert.deepEqual(recs, [SD_HALL_FACE_RECORD, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  const px = (img, u, v) => { const S = img.width, x = Math.floor(((u + 1) / 2) * S), y = Math.floor(((v + 1) / 2) * S), i = (y * S + x) * 4; return img.colors.slice(i, i + 3); };
  const bright = (c) => c[0] + c[1] + c[2] > 400;
  const face = hallFaceArt();
  for (let h = 0; h < 12; h++) { const a = (h / 12) * Math.PI * 2; assert.ok(bright(px(face.albedo, 0.72 * Math.sin(a), 0.72 * Math.cos(a))), `hour ${h} marked`); assert.ok(!bright(px(face.albedo, 0.72 * Math.sin(a + 0.26), 0.72 * Math.cos(a + 0.26))), 'between them dark'); }
  assert.equal(face.albedo.width, SD_HALL_ART_SIZE);
  const masks = SD_SIGNS.map((sign) => { let bits = ''; for (let y = -0.9; y < 0.9; y += 0.06) for (let x = -0.9; x < 0.9; x += 0.06) bits += sign(x, y) >= 1 ? '1' : '0'; return bits; });
  for (let i = 0; i < masks.length; i++) {
    const on = [...masks[i]].filter((b) => b === '1').length;
    assert.ok(on > 40, `sign ${i} has a body`);
    for (let j = i + 1; j < masks.length; j++) { let diff = 0; for (let k = 0; k < masks[i].length; k++) if (masks[i][k] !== masks[j][k]) diff++; assert.ok(diff > 60, `signs ${i} and ${j} differ`); }
  }
  assert.equal(hallEmblemArt(0).albedo.width, SD_EMBLEM_SIZE);
  const emblems = SD_SIGNS.map((_, i) => hallEmblemArt(i).albedo.colors);
  for (let i = 0; i < emblems.length; i++) for (let j = i + 1; j < emblems.length; j++) {
    let diff = 0; for (let k = 0; k < emblems[i].length; k += 4) if (emblems[i][k] !== emblems[j][k]) diff++;
    assert.ok(diff > 500, `stones ${i} and ${j} wear different signs`);
  }
  for (let k = 0; k < SD_PIPS.length; k++) {
    assert.equal(SD_PIPS[k].length, k + 1);
    const img = hallPlaqueArt(k).albedo;
    for (const [x, y] of SD_PIPS[k]) assert.ok(bright(px(img, x * 0.75, y * 0.75)), `plaque ${k}'s pip`);
    // a die's face reads the same turned half round (none to read backwards)
    const set = (p) => p.map(([x, y]) => `${x},${y}`).sort().join(' ');
    assert.equal(set(SD_PIPS[k]), set(SD_PIPS[k].map(([x, y]) => [-x === 0 ? 0 : -x, -y === 0 ? 0 : -y])));
  }
  for (const [k, rec] of Object.entries(SD_HALL_GLOW_RECORD)) {
    const g = hallGlowArt(SD_GLOW_COLORS[k]);
    assert.deepEqual([...g.albedo.colors.slice(0, 3)], [...SD_GLOW_COLORS[k]]);
    assert.deepEqual([...g.emission.colors.slice(0, 3)], [...SD_GLOW_COLORS[k]], `${rec} its own light`);
  }
});

/** The set over a fake renderer, engine and clock. */
function rig({ s = 1 } = {}) {
  const made = [], dropped = [], uploads = [], sounds = [], sent = [], said = [], floors = [];
  let t = 10_000;
  const renderer = { createMesh: (m) => { const g = { id: made.length, m }; made.push(g); return g; }, destroyMesh: (g) => dropped.push(g), uploadTexture: (a, r) => uploads.push([a, r]), uploadEmissionTexture: () => {} };
  const audio = { play3d: (rec, at, vol, o) => sounds.push({ rec, at, vol, pitch: o?.pitch }) };
  const hall = createSdHall({ renderer, audio, s, now: () => t, onTurn: (i, a) => { sent.push([i, a]); return true; }, say: (x) => said.push(x) });
  const draws = [];
  const collider = { addMesh: (bucket, tris) => floors.push([bucket, tris.length]) };
  return { hall, draws, collider, made, dropped, uploads, sounds, sent, said, floors, tick: (ms) => { t += ms; } };
}
const atStone = (i, d = 1.5) => realmToDungeon(SD_STONE_POS[i].x + stoneFrame(i).n[0] * d, 0, SD_STONE_POS[i].z + stoneFrame(i).n[2] * d);

test('SD6c THE SET: stood once - the hall, a hand on each dial, the bridge hidden, the floors to the collider; the first word puts the hands where the stones are; a later word turns them the short way at the gear\'s pace, its clunk at the stone and lesser ones at its partners; the snap\'s toll; the dial and the fray rebuilt to the counts; the Concord\'s chime, line and bridge (mutants: the first word turned to; the long way round; the bridge laid early)', () => {
  const o = orreryOf(1);
  const r = rig();
  assert.equal(r.hall.stand({ dynamicDraws: r.draws, collider: r.collider }), true);
  assert.equal(r.hall.stand({ dynamicDraws: r.draws, collider: r.collider }), false, 'once');
  assert.ok(r.uploads.length >= 16 && r.uploads.every(([a]) => a === SD_REALM_ARCHIVE));
  assert.equal(r.draws.length, 1 + SD_STONES.length + 1, 'the hall, six hands, the bridge');
  const bridge = r.draws[r.draws.length - 1];
  assert.ok(bridge.object.matrix.every((v) => v === 0), 'the bridge hidden');
  assert.deepEqual(r.floors, [['sd:hall', hallFloorTris().length]]);
  // the first word: where the stones ARE
  const st0 = [3, 11, 5, 0, 7, 9];
  r.hall.frame(0.016, atStone(0), { k: 'pz', s: 1, st: st0, f: 4, lit: 2, ok: false });
  assert.deepEqual(r.hall.shown, st0, 'put there, not turned there');
  assert.equal(r.sounds.length, 0, 'no turn heard');
  assert.deepEqual(r.hall.counts, { lit: 2, fray: 4 });
  assert.equal(r.draws.length, 1 + 6 + 1 + 2, 'the dial\'s light and the fray among the draws');
  // a turn: stone 1 from 11 forward to 0 - the short way, through the twelfth; its partners with it
  const i = 1, st1 = [...st0]; st1[i] = 0;
  const partners = [];
  for (let j = 0; j < 6; j++) if (j !== i && o.gear[i][j] !== 0) { partners.push(j); st1[j] = (st0[j] + o.gear[i][j] + 12) % 12; }
  r.hall.frame(0.1, atStone(0), { k: 'pz', s: 1, st: st1, f: 5, lit: 3, ok: false, i, a: 1, id: 'peer-x', q: 1 });
  const shownStep = r.hall.shown[i];
  assert.ok(shownStep > 11 && shownStep < 12, `forward through the twelfth (${shownStep})`);
  assert.equal(r.sounds[0].rec, SD_HALL_SOUNDS.clunk);
  assert.ok(near(r.sounds[0].at, dialCentre(i)), 'its clunk at its stone');
  assert.deepEqual(r.sounds.slice(1).map((x) => x.vol), partners.map(() => 0.4), 'lesser at each partner');
  for (let k = 0; k < 40; k++) r.hall.frame(0.05, atStone(0), null);
  assert.deepEqual(r.hall.shown.map((h) => Math.round(h * 1000) / 1000 % 12), st1, 'arrived');
  assert.ok(SD_HAND_RATE >= 1 / (SD_STONE_SETTLE_MS / 1000), 'an hour inside the gear\'s settling');
  assert.deepEqual(r.hall.counts, { lit: 3, fray: 5 });
  assert.ok(r.dropped.length >= 2, 'the old dial and fray freed');
  // the snap
  r.hall.frame(0.016, atStone(0), { k: 'pz', s: 1, st: st0, f: 0, lit: 2, ok: false, i: 0, a: 1, id: 'peer-x', q: 2, x: 1 });
  assert.ok(r.sounds.some((x) => x.rec === SD_HALL_SOUNDS.toll), 'the toll');
  assert.equal(r.hall.counts.fray, 0);
  assert.equal(r.draws.length, 1 + 6 + 1 + 1, 'no fray to draw');
  // another slot's word: nothing
  r.hall.frame(0.016, atStone(0), { k: 'pz', s: 2, st: [0, 0, 0, 0, 0, 0], f: 0, lit: 6, ok: true });
  assert.equal(r.hall.concord, false);
  // the Concord
  r.hall.frame(0.016, atStone(0), { k: 'pz', s: 1, st: [...o.truth], f: 7, lit: 6, ok: true, i: 2, a: -1, id: 'peer-x', q: 3 });
  assert.equal(r.hall.concord, true);
  assert.ok(r.sounds.some((x) => x.rec === SD_HALL_SOUNDS.chime));
  assert.deepEqual(r.said, [SD_HALL_TEXT.concord]);
  assert.deepEqual([...bridge.object.matrix], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 'the bridge laid');
  r.hall.clear();
  assert.ok(r.dropped.length >= 5, 'every mesh freed');
});

test('SD6c THE PRESS: a handle turns its stone from within reach - forward on the right, back on the left - never in its gear\'s settling, never after the Concord; out of reach it says so; a plaque says its riddle, and the ray\'s plaque shows it (mutants: a turn from across the hall; a turn in the settling)', () => {
  const o = orreryOf(1);
  const r = rig();
  r.hall.stand({ dynamicDraws: r.draws, collider: r.collider });
  r.hall.frame(0.016, atStone(2), { k: 'pz', s: 1, st: [...o.start], f: 0, lit: 0, ok: false });
  const t = r.hall.targets();
  assert.equal(t.length, 6 * 2 + 6);
  assert.deepEqual(t.filter((x) => x.key.startsWith('sdstone:2:')).map((x) => x.key), [sdStoneKey(2, 1), sdStoneKey(2, -1)]);
  assert.equal(r.hall.press(sdStoneKey(2, 1)), true);
  assert.equal(r.hall.press(sdStoneKey(2, -1)), true);
  assert.deepEqual(r.sent, [[2, 1], [2, -1]]);
  assert.equal(r.hall.press(sdStoneKey(5, 1)), true);
  assert.deepEqual(r.said, [SD_HALL_TEXT.closer], 'a stone out of reach');
  assert.equal(r.sent.length, 2);
  // a turn heard: the stone's gear settles before another goes
  r.hall.frame(0.016, atStone(2), { k: 'pz', s: 1, st: [...o.start], f: 1, lit: 0, ok: false, i: 2, a: 1, id: 'peer-me', q: 1 });
  r.hall.press(sdStoneKey(2, 1));
  assert.equal(r.sent.length, 2, 'inside the settling');
  r.tick(SD_STONE_SETTLE_MS);
  r.hall.press(sdStoneKey(2, 1));
  assert.equal(r.sent.length, 3, 'after it');
  // reach is the realm's own law
  const edge = realmToDungeon(SD_STONE_POS[2].x + stoneFrame(2).n[0] * (SD_STONE_REACH + 0.2), 0, SD_STONE_POS[2].z + stoneFrame(2).n[2] * (SD_STONE_REACH + 0.2));
  r.hall.frame(0.016, edge, null); r.tick(SD_STONE_SETTLE_MS);
  r.hall.press(sdStoneKey(2, 1));
  assert.equal(r.sent.length, 3);
  // the plaques
  assert.deepEqual(r.hall.hoverName(sdPlaqueKey(4)), { title: SD_HALL_TEXT.plaque(4), subs: [o.riddles[4].text] });
  assert.equal(SD_HALL_TEXT.plaque(4), 'Ledger Plaque V');
  r.hall.press(sdPlaqueKey(4));
  assert.equal(r.said.at(-1), o.riddles[4].text);
  assert.deepEqual(r.hall.hoverName(sdStoneKey(0, -1)), { title: 'Daggerfall - the lion', subs: [SD_HALL_TEXT.hour(o.start[0]), SD_HALL_TEXT.back] });
  assert.equal(SD_HALL_TEXT.hour(3), `Its hand stands at the ${sdHourWord(3)} hour.`);
  assert.equal(r.hall.hoverName('sdstone:9:f'), null);
  // the Concord: the stones will not turn
  r.hall.frame(0.016, atStone(2), { k: 'pz', s: 1, st: [...o.truth], f: 9, lit: 6, ok: true });
  r.tick(SD_STONE_SETTLE_MS);
  r.hall.press(sdStoneKey(2, 1));
  assert.equal(r.sent.length, 3);
  assert.equal(r.said.at(-1), SD_HALL_TEXT.still);
});

/** world.js's hall word and lash, from its own text, over fakes. */
function worldHall({ slot = 4, at = [0, 0, SD_ORRERY.z], health = 80, max = 100 } = {}) {
  const w = read('src/scenes/world.js');
  const fn = (name) => { const i = w.indexOf(`\n  function ${name}(`); assert.ok(i > 0, name); return w.slice(i + 1, w.indexOf('\n  }\n', i) + 4); };
  const line = (re) => { const m = w.match(re); assert.ok(m, String(re)); return m[0]; };
  const log = [];
  const playerEntity = { health, maxHealth: max };
  const env = {
    modes: { sdRealmSlot: () => slot }, player: { pos: realmToDungeon(...at) }, playerEntity,
    hurtPlayer: (e, n, o) => { log.push(['hurt', n, !!o?.bypassShield]); e.health -= n; }, flashPlayerDamage: (n) => log.push(['flash', n]),
    setMidScreenText: (t) => log.push(['said', t]), sdDungeonToRealm: dungeonToRealm, inOrreryHall, SD_FRAY_LASH, SD_HALL_TEXT,
    online: { id: 'peer-me' }, SD_TURN_WAIT_LINE: 'wait',   // AUDIT SD II (PIN MOVED, L7 H2): the lash falls on whom the snap names
  };
  const body = `let _sdHall = null;\n${fn('sdHallHeard')}\n${line(/ {2}const sdHallWord = [^\n]*\n/)}${line(/ {2}const sdConcordHere = [^\n]*\n/)}return { sdHallHeard, sdHallWord, sdConcordHere };`;
  return { ...new Function(...Object.keys(env), body)(...Object.values(env)), log, playerEntity };
}

test('SD6c the world host\'s hall, run from its own text: the realm\'s word kept for the realm I stand in; the snap lashes me in the hall a quarter of my health, no shield taking it, and says so; outside the hall it only says so; the Concord widens the edge (mutants: the lash on everyone; the lash shielded; another realm\'s word taken)', () => {
  const word = { k: 'pz', s: 4, st: [1, 2, 3, 4, 5, 6], f: 0, lit: 1, ok: false, i: 0, a: 1, id: 'peer-x', q: 9, x: 1, ls: ['peer-me'] };   // AUDIT SD II (PIN MOVED): naming me
  const inHall = worldHall();
  inHall.sdHallHeard(word);
  assert.deepEqual(inHall.log, [['hurt', 25, true], ['flash', 25], ['said', SD_HALL_TEXT.snap]]);
  assert.equal(inHall.sdHallWord(), word);
  assert.equal(inHall.sdConcordHere(), false);
  inHall.sdHallHeard({ ...word, x: undefined, ok: true });
  assert.equal(inHall.sdConcordHere(), true, 'the Concord here');
  assert.equal(inHall.log.length, 3, 'no snap, no lash');
  const outside = worldHall({ at: [0, 0, 0] });
  outside.sdHallHeard(word);
  assert.deepEqual(outside.log, [['said', SD_HALL_TEXT.snap]], 'on the Threshold, only the word');
  const elsewhere = worldHall({ slot: 5 });
  elsewhere.sdHallHeard(word);
  assert.deepEqual(elsewhere.log, [], 'another realm\'s word');
  assert.equal(elsewhere.sdHallWord(), null);
  const low = worldHall({ health: 3, max: 4 });
  low.sdHallHeard(word);
  assert.deepEqual(low.log[0], ['hurt', 1, true], 'at least one');
});

test('SD6c the hosts by source: the dungeon host stands the hall in the Hour alone, frames it, offers its handles and plaques, names them, presses them and frees it; the mode machine routes the keys and forwards the turn and the word; the world host hears the realm, lashes, widens the edge with the Concord and sends the turn', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const sdHall = _sdRealm \? createSdHall\(\{ renderer, audio, s: dfLocation\.sdRealm, onTurn: \(i, a\) => !!opts\.sdTurn\?\.\(i, a\), say: \(t\) => setMidScreenText\(t\) \}\) : null;/);
  assert.match(D, /if \(playerFeet && !_sdHallStood\) \{ _sdHallStood = true; sdHall\.stand\(\{ dynamicDraws, collider \}\); \}\n\s+sdHall\.frame\(dt, playerFeet \?\? null, opts\.sdHallWord\?\.\(\) \?\? null\);/);
  assert.match(D, /if \(sdEnd\) sdEndFrame\(playerFeet\);[^\n]*\n\s+if \(sdHall\) sdHallFrame\(dt, playerFeet\);/);
  assert.match(D, /if \(sdHall\) targets\.push\(\.\.\.sdHall\.targets\(\)\);/);
  assert.match(D, /\(key\) => sdHall\?\.hoverName\(key\) \?\? null,/);
  assert.match(D, /sdPress\(key\) \{ return !!sdEnd\?\.press\(key\) \|\| !!sdHall\?\.press\(key\); \},/);
  assert.match(D, /sdHall\?\.clear\(\);/);
  const W = read('src/scenes/worldModes.js');
  assert.match(W, /if \(key\.startsWith\('sdrift:'\) \|\| key\.startsWith\('sdreturn:'\) \|\| key\.startsWith\('sdstone:'\) \|\| key\.startsWith\('sdplaque:'\)\) \{ dungeonCtx\.sdPress\?\.\(key\); return true; \}/);
  assert.match(W, /sdTurn: \(i, a\) => host\.sdTurn\?\.\(i, a\) \?\? false,/);
  assert.match(W, /sdHallWord: \(\) => host\.sdHallWord\?\.\(\) \?\? null,/);
  const w = read('src/scenes/world.js');
  assert.match(w, /online\.onSdHall = \(w\) => sdHallHeard\(w\);/);
  assert.match(w, /if \(!player\.arena && modes\?\.sdRealmSlot\?\.\(\) != null\) player\.arena = sdConcordHere\(\) \? _realmArenaBridged : _realmArena;/);
  assert.match(w, /const _realmArenaBridged = realmArena\(\[\.\.\.SD_REALM_FLOORS, \.\.\.SD_HALL_FLOORS, \.\.\.SD_STEPS_FLOORS\]\);/);   // SD7b (PIN MOVED): and the Steps' band and the arena
  assert.match(w, /sdTurn: \(i, a\) => !!online\?\.sendSdTurn\?\.\(i, a\),/);
  assert.match(w, /sdHallWord: \(\) => sdHallWord\(\),/);
  assert.match(read('bible/11-Multiplayer/Super-Dungeons.md'), /### SD6c - shipped 2026-10-07/);
});
