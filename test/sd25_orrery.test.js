// SD25 S10 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 7): THE ORRERY OF
// ENDINGS REBUILT - the stones in the Daggerfall manner inside the law's shapes (world/sdHall.js), the hall's atlas through
// the paint box (world/sdHallArt.js), the orrery overhead in mode A (world/sdOrreryModel.js), and the set that moves them
// (scenes/sdHall.js): crown gears that move only with their own hands, bezels that settle gold and burn ember on a refusal,
// frozen banners, the dial's rise and fall, the fray's tabs, the Concord's sequence and its plated bridge. Every law is the
// Orrery's own (net/sdBrain.js), run from its own code; the lab's knobs from its own text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_ORRERY, SD_STONES, SD_STONE_POS, SD_STONE_SETTLE_MS, orreryOf, orreryLit, orreryTurn, dungeonToRealm, realmToDungeon,
} from '../src/net/sdBrain.js';
import {
  stoneFrame, plaqueFrame, stoneQuads, lecternQuads, stoneSolids, hallSolidTris, buildHallModel, buildHandModel, handMatrix, buildBezelModel,
  buildCrownGearModel, gearMatrix, bannerPose, buildBannerModel, buildLitModel, buildFrayModel, buildBandModel, bandMatrix,
  buildBridgeModel, buildBridgePlateModel, plateMatrix, bridgePlateSpan, dialFloorQuads, numeralStrokes, frayTabBearing,
  SD_STONE_SIZE, SD_HANDLE, SD_PLAQUE, SD_LAW_MARGIN, SD_CROWN_GEAR, SD_BANNER, SD_BANNER_VERTS, SD_NUMERALS, SD_INNER_BEZEL, SD_LIT_RING,
  SD_FRAY_RING, SD_FRAY_TAB, SD_BRIDGE, SD_BRIDGE_PLATES, SD_BAND,
} from '../src/world/sdHall.js';
import {
  hallArt, hallAtlasArt, hallGemArt, hallBandArt, hallBridgeArt, gemGlow, SD_HALL_ATLAS, SD_HALL_ATLAS_RECORD, SD_BANNER_RAMPS, SD_GEM_RAMP,
  SD_HALL_GLOW_RECORD, SD_HALL_GEM_RECORD, SD_HALL_FLASH_RECORD, SD_HALL_EMBER_DIM_RECORD, SD_GLOW_COLORS, SD_RELIEF_EDGE_GLOW, SD_PIPS,
} from '../src/world/sdHallArt.js';
import {
  buildOrbitRing, buildOrreryHub, ringHang, ringPose, ringMatrix, ringRadius, ringTicks, hubMatrix, SD_ORRERY_RINGS, SD_ORRERY_HUB,
  SD_RING_TICK_S, SD_RING_TICK_DEG, SD_RING_SHIVER, SD_RING_SHIVER_HZ, SD_RING_SNAP_S, SD_RING_CONCORD_S, SD_ORRERY_MODE_B,
} from '../src/world/sdOrreryModel.js';
import {
  createSdHall, sdStoneKey, SD_HALL_SOUNDS, SD_HALL_REMAP, SD_CONCORD_MS, SD_BRIDGE_LAY_MS, SD_BEZEL_MS, SD_DIAL_FLASH_MS, SD_DIAL_DIM_MS,
  SD_FRAY_PULSE_HZ, SD_FRAY_FULL_MS, SD_GEM_LIGHT, SD_HAND_RATE,
} from '../src/scenes/sdHall.js';
import { SD_RAMP, SD_LIGHT } from '../src/world/sdLook.js';
import { offPalette, paletteOf } from '../src/world/sdPixelKit.js';
import { SD_REALM_BRASS_RECORD } from '../src/world/sdRealm.js';
import { SD_GLYPHS, SD_HOUR_NUMERALS } from '../src/world/sdSkyArt.js';
import { TELEGRAPH_THROB_MAX_HZ } from '../src/render/gateTelegraph.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const xf = (M, p) => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]];
const det3 = (M) => dot([M[0], M[1], M[2]], cross([M[4], M[5], M[6]], [M[8], M[9], M[10]]));
/** A model's vertices (the dungeon's frame), through `M` when given. */
const vertsOf = (m, M = null) => { const out = []; for (let k = 0; k < m.positions.length; k += 3) { const p = [m.positions[k], m.positions[k + 1], m.positions[k + 2]]; out.push(M ? xf(M, p) : p); } return out; };
/** A model's triangles `{ rec, P, U }` (the dungeon's frame). */
const trisOf = (m) => {
  const out = [];
  for (const sm of m.subMeshes) for (let k = sm.startIndex; k < sm.startIndex + sm.primitiveCount * 3; k += 3) {
    const v = [0, 1, 2].map((j) => m.indices[k + j]);
    out.push({ rec: sm.textureRecord, P: v.map((q) => [m.positions[q * 3], m.positions[q * 3 + 1], m.positions[q * 3 + 2]]), U: v.map((q) => [m.uvs[q * 2], m.uvs[q * 2 + 1]]) });
  }
  return out;
};
/** A dungeon point in stone `i`'s frame: [r across, y up, o toward its face from its mid-plane]. */
const local = (i, d) => { const { at, n, R } = stoneFrame(i), p = dungeonToRealm(d[0], d[1], d[2]), v = [p[0] - at[0], 0, p[2] - at[2]]; return [dot(v, R), p[1], dot(v, n)]; };
const localPlaque = (k, d) => { const { at, n, R } = plaqueFrame(k), p = dungeonToRealm(d[0], d[1], d[2]), v = [p[0] - at[0], 0, p[2] - at[2]]; return [dot(v, R), p[1], dot(v, n)]; };
/** The set over a fake renderer, its clock and its sounds. */
function rig({ s = 1, updates = null } = {}) {
  const made = [], sounds = [], sent = [], said = [];
  let t = 50_000, clock = 600;
  const renderer = { createMesh: (m) => { made.push(m); return { m }; }, destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {}, updateMeshVertices: updates ? (g, p) => updates.push(Float32Array.from(p)) : undefined };
  const audio = { play3d: (rec, at, vol, o) => sounds.push({ rec, at, vol, pitch: o?.pitch }) };
  const hall = createSdHall({ renderer, audio, s, now: () => t, clock: () => clock, onTurn: (i, a) => { sent.push([i, a]); return true; }, say: (x) => said.push(x) });
  const draws = [];
  hall.stand({ dynamicDraws: draws, collider: null });
  return { hall, draws, made, sounds, sent, said, tick: (ms) => { t += ms; }, at: (ms) => { t = ms; }, setClock: (c) => { clock = c; }, now: () => t };
}
const word = (s, st, extra = {}) => ({ k: 'pz', s, st, f: 0, lit: orreryLit(orreryOf(s), st), ok: false, ...extra });
const atStone = (i, d = 1.5) => { const { n } = stoneFrame(i), p = SD_STONE_POS[i]; return realmToDungeon(p.x + n[0] * d, 0, p.z + n[2] * d); };

test('SD-LOOK S10 NO VISUAL LARGER THE LAW: every part of every stone - plinth, chamfered shaft, relief, dial, notch, levers, cradle, rod, its bezel, its hand at every hour, its crown gear turned anywhere, its banner at rest and all through the Concord\'s wind - within SD_LAW_MARGIN (5 cm) of its solids (stoneSolids: the slab, the cap, the handles, unchanged), over its crown within its footprint; and its outline REACHES the slab, so a body stops at what it sees; every lectern within 5 cm of its post and tablet (mutants: the plinth 10 cm out; the banner hung off the stone; the banner\'s ripple past the law; the shaft shrunk; the gear past its crown; the bezel proud)', () => {
  const M = SD_LAW_MARGIN, { w, d, h } = SD_STONE_SIZE, capTop = h + 0.12, e = 1e-6;
  assert.equal(M, 0.05);
  // the solids are the law's own, unchanged: a slab, a cap, two handles - and the collider's count with them
  assert.equal(hallSolidTris().length / 9, SD_STONES.length * (4 * 5 + 1) * 2 + SD_PLAQUE.bearings.length * 6 * 2);
  const hx = w / 2 - SD_HANDLE.inset;
  const inSolid = ([r, y, o]) => (Math.abs(r) <= w / 2 + M + e && Math.abs(o) <= d / 2 + M + e && y >= -M - e && y <= h + M + e)
    || (Math.abs(r) <= w / 2 + 0.05 + M + e && Math.abs(o) <= d / 2 + 0.05 + M + e && y >= h - M - e && y <= capTop + M + e)
    || ([-1, 1].some((sd) => Math.abs(r - sd * hx) <= 0.06 + M + e) && o >= d / 2 - M - e && o <= d / 2 + SD_HANDLE.out + M + e && y >= SD_HANDLE.y - 0.11 - M - e && y <= SD_HANDLE.y + 0.11 + M + e);
  const law = (p) => (p[1] > capTop ? Math.abs(p[0]) <= w / 2 + 0.05 + M + e && Math.abs(p[2]) <= d / 2 + 0.05 + M + e : inSolid(p));
  const hand = buildHandModel(), gear = buildCrownGearModel(), pos = new Float32Array(SD_BANNER_VERTS * 3), nrm = new Float32Array(SD_BANNER_VERTS * 3);
  for (let i = 0; i < SD_STONES.length; i++) {
    const pts = [];
    for (const [, P] of stoneQuads(i)) pts.push(...P);
    pts.push(...vertsOf(buildBezelModel(i)));
    for (const hr of [0, 1.5, 3, 6.25, 9, 11.9]) { pts.push(...vertsOf(hand, handMatrix(i, hr))); pts.push(...vertsOf(gear, gearMatrix(i, hr))); }
    for (const age of [-1, 0.4, 1.1, 1.5, 2.2, 2.9, SD_BANNER.wind, 99]) {
      bannerPose(age, pos, nrm);
      for (let q = i * SD_BANNER_VERTS / SD_STONES.length; q < (i + 1) * SD_BANNER_VERTS / SD_STONES.length; q++) pts.push([pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]]);
    }
    const L = pts.map((p) => local(i, p));
    const out = L.filter((p) => !law(p));
    assert.equal(out.length, 0, `stone ${i}: ${out.length} points past the law, first ${out[0]?.map((v) => v.toFixed(3))}`);
    // the outline reaches the slab's faces (the shaft's own parts, over the plinth and under the cap, the levers aside)
    const inStone = (U) => U.every(([u, v]) => u * 256 >= SD_HALL_ATLAS.stone[0] && u * 256 <= SD_HALL_ATLAS.stone[0] + SD_HALL_ATLAS.stone[2] && v * 256 >= SD_HALL_ATLAS.stone[1] && v * 256 <= SD_HALL_ATLAS.stone[1] + SD_HALL_ATLAS.stone[3]);
    const shaft = stoneQuads(i).filter(([rec, , U]) => rec === SD_HALL_ATLAS_RECORD && inStone(U)).flatMap(([, P]) => P).map((p) => local(i, p));   // the shaft's own faces
    const ext = (k, f) => f(...shaft.map((p) => p[k]));
    assert.ok(ext(2, Math.max) >= d / 2 - M && ext(2, Math.min) <= -d / 2 + M, `stone ${i}: its face and back within 5 cm of the slab's (${ext(2, Math.max).toFixed(3)}, ${ext(2, Math.min).toFixed(3)})`);
    assert.ok(ext(0, Math.max) >= w / 2 - M && ext(0, Math.min) <= -w / 2 + M, `stone ${i}: its sides within 5 cm of the slab's`);
    assert.ok(ext(1, Math.min) <= 0.3 + 1e-6 && ext(1, Math.max) >= h - 1e-6, 'from its plinth to its cap');
    // the banner hangs behind it, never into the shaft
    bannerPose(-1, pos, nrm);
    for (let q = i * SD_BANNER_VERTS / 6; q < (i + 1) * SD_BANNER_VERTS / 6; q++) assert.ok(local(i, [pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]])[2] < -0.33, 'behind the shaft\'s back');
  }
  // the lecterns: within 5 cm of the post (0.14 square, to its top) or the tablet (1.0 x 0.7 at 0.09 before it)
  for (let k = 0; k < SD_PLAQUE.bearings.length; k++) {
    const L = lecternQuads(k).flatMap(([, P]) => P).map((p) => localPlaque(k, p));
    const bad = L.filter(([r, y, o]) => !((Math.abs(r) <= 0.07 + M + e && Math.abs(o) <= 0.07 + M + e && y >= -e && y <= SD_PLAQUE.post + M + e)
      || (Math.abs(r) <= SD_PLAQUE.w / 2 + M + e && Math.abs(o - 0.09) <= M + e && y >= SD_PLAQUE.post - M - e && y <= SD_PLAQUE.post + SD_PLAQUE.h + M + e)));
    assert.equal(bad.length, 0, `lectern ${k}: ${bad.length} points past its post and tablet`);
  }
  // the lab draws the law over it (?law)
  assert.match(read('src/tools/abyssLab.js'), /if \(lawMesh\) renderer\.drawMeshWire\(lawMesh, identity\(\), null\);/);
});

test('SD-LOOK S10 THE TURN PROBE: a turn heard sets its stone\'s hand going and its partners\' (the law\'s gearing, as every hand shows its stone) - and each CROWN GEAR moves exactly when its own hand moves, 2:1 against it, a proper turn; at rest none moves; IN MODE A NO RING MOVES on a turn, a partner\'s or any: the rings follow only their decor, never a stone (mutants: the gear 1:1; the gear with its hand\'s way; the gear ahead of its hand; a ring on its stone\'s hour; mode B switched on)', () => {
  assert.equal(SD_ORRERY_MODE_B, false, 'mode A ships');
  const o = orreryOf(1), st0 = [...o.start], r = rig();
  r.hall.frame(0.016, null, word(1, st0));
  const { hands, gears, rings } = r.hall.parts;
  assert.equal(gears.length, SD_STONES.length);
  const snap = (list) => list.map((d) => [...d.object.matrix]);
  const ringsBefore = snap(rings);
  // the gear's turn against its hand's, as one facing the stone sees it: the angle of its own +y on (R, up)
  const angle = (i, M) => { const { R } = stoneFrame(i); return Math.atan2(dot([M[4], M[5], M[6]], R), M[5]); };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (let i = 0; i < SD_STONES.length; i++) {
    assert.ok(Math.abs(det3(gears[i].object.matrix) - 1) < 1e-6, `gear ${i}: no mirror`);
    assert.ok(Math.abs(wrap(angle(i, gears[i].object.matrix) + SD_CROWN_GEAR.ratio * angle(i, hands[i].object.matrix))) < 1e-5, `gear ${i}: twice its hand, against it`);
    assert.ok(dot([gears[i].object.matrix[8], gears[i].object.matrix[9], gears[i].object.matrix[10]], stoneFrame(i).n) > 0.999, 'its face toward the hall');
  }
  assert.equal(SD_CROWN_GEAR.ratio, 2);
  // a turn of stone i: its partners move with it, by the law's gearing
  const i = o.order[o.order.length - 1], st1 = orreryTurn(o, st0, i, 1);
  const moved = st1.map((hh, j) => hh !== st0[j]);
  assert.ok(moved.filter(Boolean).length >= 2, 'a turn that moves partners');
  r.tick(1000);
  const handsAt = snap(hands), gearsAt = snap(gears);
  r.hall.frame(0.05, null, word(1, st1, { f: 1, i, a: 1, id: 'peer-x', q: 1 }));
  for (let k = 0; k < 8; k++) {
    r.tick(50);
    const hb = snap(hands), gb = snap(gears);
    r.hall.frame(0.05, null, null);
    for (let j = 0; j < SD_STONES.length; j++) {
      const handMoved = hands[j].object.matrix.some((v, q) => v !== hb[j][q]), gearMoved = gears[j].object.matrix.some((v, q) => v !== gb[j][q]);
      assert.equal(gearMoved, handMoved, `frame ${k}, stone ${j}: its gear moves when its hand moves, and only then`);
      assert.ok(Math.abs(wrap(angle(j, gears[j].object.matrix) + SD_CROWN_GEAR.ratio * angle(j, hands[j].object.matrix))) < 1e-5, `stone ${j}: its gear where its hand is, mid-turn`);
    }
  }
  for (let j = 0; j < SD_STONES.length; j++) assert.equal(gears[j].object.matrix.some((v, q) => v !== gearsAt[j][q]), moved[j], `stone ${j}: its gear moved as its stone did`);
  for (let j = 0; j < SD_STONES.length; j++) assert.equal(hands[j].object.matrix.some((v, q) => v !== handsAt[j][q]), moved[j]);
  // the rings: not a hair, through the turn and the hands' run (the realm's clock held)
  assert.deepEqual(snap(rings), ringsBefore, 'no ring moved on the turn');
  // and a hall fed other hours hangs its rings alike at the same moment
  const r2 = rig();
  r2.hall.frame(0.016, null, word(1, st1, { f: 9 }));
  assert.deepEqual(snap(r2.hall.parts.rings), ringsBefore, 'the rings never read a stone');
  // the decor ticks on the realm's clock, every ring together
  r.setClock(600 + SD_RING_TICK_S); r.hall.frame(0, null, null);
  assert.ok(rings.every((d, k) => d.object.matrix.some((v, q) => v !== ringsBefore[k][q])), 'the decor\'s tick');
});

test('SD-LOOK S10 THE BEZELS: gold while their stone\'s gear settles (SD_STONE_SETTLE_MS, the law\'s), dimming as it frees, cold after - the turned stone\'s alone; the fray\'s ember when the realm refuses MY turn (its word `w`, to me alone, carries no stone - the stone is my press\'s), for SD_BEZEL_MS.ember; never on another\'s refusal nor a stale press; their halos with them (mutants: gold through the whole settling; the ember on every stone; the ember with no press of mine)', () => {
  const o = orreryOf(1), st0 = [...o.start], r = rig();
  r.hall.frame(0.016, atStone(2), word(1, st0));
  const { bezels } = r.hall.parts;
  assert.ok(bezels.every((b) => b.texRemap === null), 'cold');
  const st1 = orreryTurn(o, st0, 2, 1);
  r.tick(1000);
  r.hall.frame(0.016, atStone(2), word(1, st1, { f: 1, i: 2, a: 1, id: 'peer-x', q: 1 }));
  assert.equal(bezels[2].texRemap, SD_HALL_REMAP.gold, 'gold as its gear settles');
  assert.ok(bezels.every((b, j) => j === 2 || b.texRemap === null), 'the turned stone\'s alone - a partner\'s gear does not settle');
  assert.ok(r.hall.halos().some((h) => h.color[0] > 0 && h.color[1] / h.color[0] > 0.7), 'a gold halo');
  r.tick(SD_STONE_SETTLE_MS * (SD_BEZEL_MS.gold + 0.05)); r.hall.frame(0.016, atStone(2), null);
  assert.equal(bezels[2].texRemap, SD_HALL_REMAP.dim, 'dimming as it frees');
  r.tick(SD_STONE_SETTLE_MS); r.hall.frame(0.016, atStone(2), null);
  assert.equal(bezels[2].texRemap, null, 'cold once free');
  assert.deepEqual([...SD_HALL_REMAP.gold.values()], ['38151_18'], 'the hands\' brass glow');
  // my press, refused: the ember on that stone
  assert.equal(r.hall.press(sdStoneKey(2, -1)), true);
  assert.deepEqual(r.sent.at(-1), [2, -1]);
  r.tick(80);
  r.hall.frame(0.016, atStone(2), word(1, st1, { f: 1, w: 1 }));
  assert.equal(bezels[2].texRemap, SD_HALL_REMAP.ember, 'the ember on the stone I pressed');
  assert.ok(bezels.every((b, j) => j === 2 || b.texRemap === null), 'and no other');
  assert.ok(r.hall.halos().some((h) => Math.abs(h.color[1] / h.color[0] - SD_LIGHT.ember[1]) < 1e-6), 'an ember halo');
  r.tick(SD_BEZEL_MS.ember + 10); r.hall.frame(0.016, atStone(2), null);
  assert.equal(bezels[2].texRemap, null, 'gone');
  // a refusal long after my press is not my press's
  r.tick(SD_BEZEL_MS.mine);
  r.hall.frame(0.016, atStone(2), word(1, st1, { f: 1, w: 1 }));
  assert.ok(bezels.every((b) => b.texRemap === null), 'a stale press lights nothing');
  // nor a refusal before I pressed at all
  const r2 = rig();
  r2.hall.frame(0.016, atStone(2), word(1, st0));
  r2.tick(500);
  r2.hall.frame(0.016, atStone(2), word(1, st0, { w: 1 }));
  assert.ok(r2.hall.parts.bezels.every((b) => b.texRemap === null), 'no press, no ember');
  assert.deepEqual([...SD_HALL_REMAP.ember.values()], [`38151_${SD_HALL_GLOW_RECORD.fray}`], 'the fray\'s ember');
});

test('SD-LOOK S10 THE DIAL AND THE GEM: the lit plates rise 3 cm - how many, never which; a rise flashes the whole inner ring once, a fall dims it with a lower clunk, never at the snap; the gem\'s record is the count (seven of them) and its light the Mantella\'s, never out and every count its own; the fray\'s tabs a turn each of its Hollow\'s own snap, the last eight pulsing at 2 Hz (under the 3 Hz ceiling), blazing white at the snap and dropped (mutants: the flash on a fall; the dim gone; the pulse at four; the warning a tab early; the gem out at nought)', () => {
  const o = orreryOf(1), r = rig();
  const stA = [...o.truth]; stA[0] = (stA[0] + 1) % 12; stA[1] = (stA[1] + 1) % 12; stA[2] = (stA[2] + 1) % 12;   // three true
  r.hall.frame(0.016, null, { ...word(1, stA), f: 3 });
  assert.equal(r.hall.counts.lit, 3);
  const { flash, hub } = r.hall.parts;
  assert.ok(flash.hidden, 'no flash at the first word');
  assert.equal(hub.texRemap, SD_HALL_REMAP.gem[3], 'the gem at three');
  assert.ok(SD_HALL_REMAP.gem.every((m, n) => (n === 0 ? m === null : m.get(`38151_${SD_HALL_GEM_RECORD}`) === `38151_${SD_HALL_GEM_RECORD + n}`)));
  const L = r.hall.lights()[0];
  assert.ok(L.color.every((v, c) => Math.abs(v - SD_LIGHT.mantella[c] * gemGlow(3) * SD_GEM_LIGHT.gain) < 1e-9) && L.range === SD_GEM_LIGHT.range, 'its light, as bright as the count');
  assert.equal(gemGlow(0), 0.2, 'never out');
  assert.equal(gemGlow(6), 1);
  for (let n = 1; n <= 6; n++) assert.ok(gemGlow(n) > gemGlow(n - 1), `${n} brighter than ${n - 1}: every count its own`);
  // a rise: one flash of the whole ring
  const stB = [...stA]; stB[0] = o.truth[0];
  r.tick(1000);
  r.hall.frame(0.016, null, { ...word(1, stB), f: 4, i: 0, a: -1, id: 'p', q: 1 });
  assert.equal(r.hall.counts.lit, 4);
  assert.ok(!r.hall.parts.flash.hidden && r.hall.parts.lit.hidden, 'nearer: the whole inner ring flashes');
  assert.equal(r.hall.parts.lit.texRemap, null);
  r.tick(SD_DIAL_FLASH_MS + 1); r.hall.frame(0.016, null, null);
  assert.ok(r.hall.parts.flash.hidden && !r.hall.parts.lit.hidden, 'once');
  // a fall: dimmed, a lower clunk
  r.tick(1000);
  const heard = r.sounds.length;
  r.hall.frame(0.016, null, { ...word(1, stA), f: 5, i: 0, a: 1, id: 'p', q: 2 });
  assert.equal(r.hall.parts.lit.texRemap, SD_HALL_REMAP.litDim, 'further: dimmed');
  assert.ok(r.hall.parts.flash.hidden, 'no flash');
  assert.ok(r.sounds.slice(heard).some((x) => x.rec === SD_HALL_SOUNDS.clunk && x.pitch < 0.8), 'a downward clunk');
  r.tick(SD_DIAL_DIM_MS + 1); r.hall.frame(0.016, null, null);
  assert.equal(r.hall.parts.lit.texRemap, null);
  // the snap: no flash nor dim, every tab blazing, then dropped
  r.tick(1000);
  r.hall.frame(0.016, null, { ...word(1, [...o.truth]), f: 0, i: 0, a: 1, id: 'p', q: 3, x: 1 });
  assert.ok(r.hall.parts.flash.hidden && r.hall.parts.lit.texRemap === null, 'the snap is no rise');
  const blaze = r.made.at(-1);
  assert.equal(trisOf(blaze).filter((t) => t.rec === SD_HALL_FLASH_RECORD).length, o.fray * 10, 'every tab up, white');
  r.tick(SD_FRAY_FULL_MS + 1); r.hall.frame(0.016, null, null);
  assert.equal(r.hall.counts.fray, 0, 'dropped');
  // the last eight: 2 Hz, only once eight or fewer remain
  assert.ok(SD_FRAY_PULSE_HZ <= TELEGRAPH_THROB_MAX_HZ);
  const pulseAt = (f) => {
    const q = rig();
    q.hall.frame(0.016, null, { ...word(1, [...o.start]), f });
    const seen = [];
    for (let k = 0; k < 400; k++) { q.tick(5); q.hall.frame(0, null, null); seen.push(q.hall.parts.fray?.texRemap === SD_HALL_REMAP.pulse); }
    return seen;
  };
  const tabs = o.fray;
  assert.ok(pulseAt(tabs - 9).every((v) => !v), 'nine left: no warning');
  const p8 = pulseAt(tabs - 8), flips = p8.filter((v, k) => k > 0 && v !== p8[k - 1]).length;
  assert.equal(flips / 2, SD_FRAY_PULSE_HZ * 2, `eight left: ${flips / 2} pulses in 2 s`);
  const warned = buildFrayModel(tabs - 8, tabs);
  assert.equal(trisOf(warned).filter((t) => t.rec === SD_HALL_EMBER_DIM_RECORD).length, 8 * 10, 'the last eight in their dim ember');
  assert.equal(trisOf(warned).filter((t) => t.rec === SD_HALL_GLOW_RECORD.fray).length, (tabs - 8) * 10);
  assert.deepEqual([...SD_HALL_REMAP.pulse.entries()], [[`38151_${SD_HALL_EMBER_DIM_RECORD}`, `38151_${SD_REALM_BRASS_RECORD}`]], 'pulsing to cold brass');
});

test('SD-LOOK S10 THE RINGS IN MODE A: hung from the slot (tilts within 12-40 degrees, every screen alike), they tick together once every SD_RING_TICK_S and hold between; shiver only past three quarters of the fray, at or under 2 Hz; turn one whole turn back over the snap; lie in one plane at the Concord - a proper turn about the hub, high over every stone and gear, the hub and gem never near the floor (mutants: a tick every second; the shiver from the first turn; the Concord not flat; the rings down into the hall)', () => {
  const hang = ringHang(7), R = SD_ORRERY_RINGS;
  assert.deepEqual(hang, ringHang(7), 'the slot\'s');
  assert.notDeepEqual(hang.map((x) => x.tilt), ringHang(8).map((x) => x.tilt), 'each Hollow its own');
  for (const h of hang) assert.ok(h.tilt >= (R.tilt0 * Math.PI) / 180 && h.tilt <= (R.tilt1 * Math.PI) / 180);
  const P = (t, fray = 0, snap = -1, conc = -1) => [...ringPose(1, hang, t, fray, snap, conc)];
  // the decor: held between ticks, one tick each SD_RING_TICK_S
  assert.deepEqual(P(6.5), P(11.9), 'held');
  const step = Math.abs(P(12.5)[0] - P(11.9)[0]);
  assert.ok(Math.abs(step - (SD_RING_TICK_DEG * Math.PI) / 180) < 1e-9, `a tick of ${SD_RING_TICK_DEG} degrees`);
  assert.equal(SD_RING_TICK_S, 6);
  assert.ok(Math.abs(ringTicks(12.1) - (2 + (() => { const e = 0.1 / 0.25; return e * e * (3 - 2 * e); })())) < 1e-9, 'eased as the escapement');
  // the shiver
  assert.deepEqual(P(20, 0.74), P(20, 0), 'none before three quarters');
  const sh = [];
  for (let k = 0; k < 200; k++) sh.push(P(20 + k / 100, 0.8)[1] - P(20 + k / 100, 0)[1]);
  assert.ok(Math.max(...sh.map(Math.abs)) <= (SD_RING_SHIVER * Math.PI) / 180 + 1e-9 && Math.max(...sh) > 0.5 * (SD_RING_SHIVER * Math.PI) / 180, 'a shiver of 1.5 degrees');
  assert.ok(SD_RING_SHIVER_HZ <= 2);
  // the snap: a whole turn back
  const base = P(20)[0];
  assert.ok(Math.abs(P(20, 0, SD_RING_SNAP_S / 2)[0] - (base - Math.PI)) < 1e-9, 'half a turn back at half the snap');
  assert.deepEqual(P(20, 0, SD_RING_SNAP_S + 0.01), P(20), 'then where it was');
  // the Concord: one plane
  assert.ok(Math.abs(P(20, 0, -1, SD_RING_CONCORD_S / 2)[1] - P(20)[1] / 2) < 1e-9, 'mid-swing');
  for (const c of [SD_RING_CONCORD_S, 5, Infinity]) assert.equal(P(20, 0, -1, c)[1], 0, 'flat');
  // the matrices: proper turns about the hub; every ring over the stones' gears
  let lowest = Infinity;
  for (let k = 0; k < SD_STONES.length; k++) {
    const m = ringMatrix(k, hang, ringPose(k, hang, 33, 0.9, -1, -1));
    assert.ok(Math.abs(det3(m) - 1) < 1e-6, `ring ${k}: no mirror`);
    const c = dungeonToRealm(m[12], m[13], m[14]);
    assert.deepEqual(c.map((v) => Math.round(v * 1e4) / 1e4), [SD_ORRERY.x, R.hubY, SD_ORRERY.z]);
    for (const p of vertsOf(buildOrbitRing(k), m)) lowest = Math.min(lowest, dungeonToRealm(...p)[1]);
    const v = vertsOf(buildOrbitRing(k)).map((p) => Math.hypot(p[0], p[2]));
    for (const rr of [ringRadius(k) - R.w / 2, ringRadius(k) + R.w / 2]) assert.ok(v.filter((x) => Math.abs(x - rr) < 1e-5).length >= R.segs * 4, `ring ${k}'s band at ${rr.toFixed(2)} m`);
  }
  assert.ok(lowest > SD_CROWN_GEAR.y + SD_CROWN_GEAR.tip + 0.5, `the lowest ring ${lowest.toFixed(2)} m up, over every gear`);
  const hubY = vertsOf(buildOrreryHub(), hubMatrix(0.3)).map((p) => dungeonToRealm(...p)[1]);
  assert.ok(Math.min(...hubY) > 6 && Math.max(...hubY) <= SD_ORRERY_HUB.top + 1e-6, 'the hub and its gem hang from the dark, nowhere near the floor');
  assert.ok(Math.abs(Math.min(...hubY) - (SD_ORRERY_HUB.gemY - SD_ORRERY_HUB.gemDown)) < 1e-6, 'the gem\'s point its foot');
});

test('SD-LOOK S10 THE CONCORD: the banners stream (uploaded each frame of SD_BANNER.wind, then still in a new ripple), the rings swing flat and lock with ONE tock as the gem flares and its band runs out from the hub, then the bridge\'s twelve plates flip into place from the rim out and fold into the one bridge - each step a function of when the word was heard; a Concord that held before I came stands whole at once, silent (mutants: the tock twice; the wind unending; the first word choreographed; the plates from the far end)', () => {
  const o = orreryOf(1), ups = [], r = rig({ updates: ups });
  r.hall.frame(0.016, null, word(1, [...o.start]));
  const { band, plates, bridge, hub, banner } = r.hall.parts;
  assert.ok(banner && band.hidden && bridge.hidden && plates.every((p) => p.hidden));
  const rest = vertsOf(buildBannerModel());
  r.tick(1000);
  r.hall.frame(0.016, null, word(1, [...o.truth], { f: 3, i: 0, a: 1, id: 'p', q: 1, ok: true }));
  const T0 = r.now(), at = (ms) => { r.at(T0 + ms); r.hall.frame(0.016, null, null); };
  at(600);
  const hang = ringHang(1);
  for (let k = 0; k < SD_STONES.length; k++) assert.ok(Math.abs(Math.acos(Math.min(1, r.hall.parts.rings[k].object.matrix[5])) - hang[k].tilt / 2) < 1e-3, `ring ${k} mid-swing`);
  assert.equal(hub.texRemap, SD_HALL_REMAP.flare, 'the gem flares');
  assert.ok(!band.hidden && band.object.matrix[10] > 0.2 && band.object.matrix[10] < 1, 'its band on its way to the rim');
  assert.ok(plates.every((p) => p.hidden) && bridge.hidden, 'no plate before the rings lock');
  assert.ok(ups.length > 0, 'the banners stream');
  const mid = ups.at(-1);
  assert.ok(mid.some((v, k) => Math.abs(v - rest[Math.floor(k / 3)][k % 3]) > 0.01), 'moved off their frozen ripple');
  const tocks = () => r.sounds.filter((x) => x.rec === SD_HALL_SOUNDS.clunk && x.pitch === 0.45).length;
  assert.equal(tocks(), 0);
  at(SD_CONCORD_MS.rings + 10); at(SD_CONCORD_MS.rings + 40);
  assert.equal(tocks(), 1, 'one great tock as they lock');
  at(SD_CONCORD_MS.bridgeFrom + SD_BRIDGE_LAY_MS * 0.35);
  const shown = plates.map((p) => !p.hidden);
  assert.ok(shown[0] && !shown[SD_BRIDGE_PLATES.n - 1], 'from the rim out');
  assert.ok(shown.every((v, j) => j === 0 || !v || shown[j - 1]), 'each after the one before it');
  const k0 = plates[0].object.matrix;
  assert.ok(Math.abs(det3(k0) - 1) < 1e-6, 'a plate flips, never mirrors');
  at(SD_CONCORD_MS.bridgeFrom + SD_BRIDGE_LAY_MS + 5);
  assert.ok(plates.every((p) => p.hidden) && !bridge.hidden, 'folded into the one bridge');
  assert.equal(hub.texRemap, SD_HALL_REMAP.gem[6], 'the gem whole at six');
  const count = ups.length;
  at(SD_BANNER.wind * 1000 + 50); at(SD_BANNER.wind * 1000 + 500); at(SD_BANNER.wind * 1000 + 900);
  assert.ok(ups.length <= count + 2, 'the wind drops: no more uploads');
  const still = ups.at(-1), pos = new Float32Array(SD_BANNER_VERTS * 3), nrm = new Float32Array(SD_BANNER_VERTS * 3);
  bannerPose(SD_BANNER.wind, pos, nrm);
  assert.ok(still.every((v, k) => Math.abs(v - pos[k]) < 1e-6), 'frozen again');
  assert.ok(still.some((v, k) => Math.abs(v - rest[Math.floor(k / 3)][k % 3]) > 0.002), 'mid-ripple anew');
  assert.ok(r.hall.parts.rings.every((d) => Math.abs(d.object.matrix[5] - 1) < 1e-9), 'every ring flat: one plane');
  assert.equal(tocks(), 1);
  // the first word's rule: it held before I came - whole, at once, silent
  const ups2 = [], late = rig({ updates: ups2 });
  late.hall.frame(0.016, null, word(1, [...o.truth], { f: 5, ok: true }));
  assert.ok(late.hall.parts.plates.every((p) => p.hidden) && !late.hall.parts.bridge.hidden && !late.hall.parts.band.hidden, 'the bridge and the band whole');
  assert.deepEqual([...late.hall.parts.band.object.matrix], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.ok(late.hall.parts.rings.every((d) => Math.abs(d.object.matrix[5] - 1) < 1e-9), 'the rings flat');
  assert.equal(ups2.length, 1, 'the banners stood in their last ripple once');
  assert.ok(ups2[0].every((v, k) => Math.abs(v - pos[k]) < 1e-6));
  assert.equal(late.sounds.length + late.said.length, 0, 'no chime, no line, no tock');
  late.tick(5000); late.hall.frame(0.016, null, null);
  assert.equal(ups2.length, 1);
  // the plates' hinges: each flips about its near edge into its own place
  for (let j = 0; j < SD_BRIDGE_PLATES.n; j++) {
    const [za] = bridgePlateSpan(j), hinge = realmToDungeon(SD_BRIDGE.x, SD_BRIDGE.y, za), m = plateMatrix(j, 0.3);
    assert.ok(Math.hypot(...sub(xf(m, hinge), hinge)) < 1e-4, `plate ${j}: on its hinge`);
    assert.deepEqual([...plateMatrix(j, 1)].map((v) => Math.round(v * 1e4) / 1e4 || 0), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  assert.ok(bridgePlateSpan(0)[0] < bridgePlateSpan(1)[0] && bridgePlateSpan(SD_BRIDGE_PLATES.n - 1)[1] <= SD_BRIDGE.z1, 'the first at the hall\'s rim');
});

test('SD-LOOK S10 THE HALL\'S ATLAS, THROUGH THE PAINT BOX: every texel of it in its ramps (sdLook\'s, and the kingdoms\' cloth - no blue: the Bay\'s sky is the Hour\'s only blue); the heraldry in relief lit from the top-left, brass but the Underking\'s bone; metal\'s light no more than its rubbed edge; the gem\'s light rising with the count, never out; the band two colours dithered; the bridge\'s plates engraved XII at the rim back to I (mutants: the relief lit from below; the atlas left unquantized; the plates\' hours forward)', () => {
  const { albedo, emission } = hallAtlasArt(), S = SD_HALL_ATLAS.size;
  const pal = paletteOf(SD_RAMP.basalt, SD_RAMP.brass, SD_RAMP.bronze, SD_RAMP.verdigris, SD_RAMP.pale, ...SD_BANNER_RAMPS);
  assert.equal(offPalette(albedo, pal), 0, 'every texel in its ramps');
  for (const r of SD_BANNER_RAMPS) { assert.equal(r.length, 5); for (const c of r) assert.ok(!(c[2] > c[0] + 8 && c[2] > c[1] + 8), `no blue cloth (${c})`); }
  let maxE = 0;
  for (let i = 0; i < S * S; i++) maxE = Math.max(maxE, emission.colors[i * 4], emission.colors[i * 4 + 1], emission.colors[i * 4 + 2]);
  assert.ok(maxE > 0 && maxE <= Math.ceil(255 * SD_RELIEF_EDGE_GLOW), `metal's light its rubbed edge alone (${maxE})`);
  // the relief: within each emblem, the sign's lit (top-left) edge brighter than its shadowed edge
  const lum = (x, y) => { const i = (y * S + x) * 4; return albedo.colors[i] * 0.3 + albedo.colors[i + 1] * 0.59 + albedo.colors[i + 2] * 0.11; };
  for (let k = 0; k < 6; k++) {
    const [x0, y0, w, h] = SD_HALL_ATLAS.emblem[k];
    let lit = 0, shade = 0, nl = 0, ns = 0;
    for (let y = y0 + 6; y < y0 + h - 6; y++) for (let x = x0 + 6; x < x0 + w - 6; x++) {
      const here = lum(x, y), up = lum(x - 1, y + 1), dn = lum(x + 1, y - 1);
      if (here > 60 && up < 40) { lit += here; nl++; }
      if (here > 25 && dn < 40 && up > 40) { shade += here; ns++; }
    }
    assert.ok(nl > 5 && ns > 5 && lit / nl > shade / ns + 20, `sign ${k}: lit from the top-left (${(lit / nl).toFixed(0)} over ${(shade / ns).toFixed(0)})`);
  }
  const has = (cell, rampSet) => { const keys = new Set(rampSet.map((c) => c.join())); let n = 0; for (let y = cell[1]; y < cell[1] + cell[3]; y++) for (let x = cell[0]; x < cell[0] + cell[2]; x++) { const i = (y * S + x) * 4; if (keys.has(`${albedo.colors[i]},${albedo.colors[i + 1]},${albedo.colors[i + 2]}`)) n++; } return n; };
  assert.ok(has(SD_HALL_ATLAS.emblem[4], SD_RAMP.pale) > 100, 'the crown of bone in bone');
  assert.ok(has(SD_HALL_ATLAS.emblem[0], SD_RAMP.pale) === 0 && has(SD_HALL_ATLAS.emblem[0], SD_RAMP.brass) > 300, 'the lion in brass');
  for (let k = 0; k < 6; k++) assert.ok(has(SD_HALL_ATLAS.banner[k], SD_BANNER_RAMPS[k]) > 600, `banner ${k} in its kingdom's cloth`);
  // the gem
  const glowOf = (n) => { const e = hallGemArt(n).emission; let s = 0; for (let i = 0; i < 256; i++) s += e.colors[i * 4 + 1]; return s; };
  for (let n = 1; n <= 6; n++) assert.ok(glowOf(n) > glowOf(n - 1), `the gem brighter at ${n}`);
  assert.ok(glowOf(0) > 0, 'never out');
  assert.equal(offPalette(hallGemArt(3).albedo, paletteOf(SD_GEM_RAMP)), 0);
  // the band: the Mantella and gold, nothing between
  const band = hallBandArt().albedo, cols = new Set();
  for (let i = 0; i < band.width * band.height; i++) cols.add(`${band.colors[i * 4]},${band.colors[i * 4 + 1]},${band.colors[i * 4 + 2]}`);
  assert.deepEqual([...cols].sort(), [SD_GLOW_COLORS.brass.join(), SD_GLOW_COLORS.mantella.join()].sort());
  // the bridge: plate j's numeral the hour 12 - j, the Hour's own glyphs
  const br = hallBridgeArt().albedo, dark = (x, y) => br.colors[(y * 64 + x) * 4 + 1] < SD_GLOW_COLORS.mantella[1] * 0.5;
  for (let j = 0; j < 12; j++) {
    const s = SD_HOUR_NUMERALS[(12 - j) % 12], w = [...s].reduce((n, ch) => n + SD_GLYPHS[ch].w, 0) + s.length - 1, ox = Math.floor((64 - w * 2) / 2);
    let cx = 0;
    for (const ch of s) { const g = SD_GLYPHS[ch]; for (let gx = 0; gx < g.w; gx++) for (let gy = 0; gy < 7; gy++) assert.equal(dark(ox + (cx + gx) * 2, j * 16 + 1 + (6 - gy) * 2), ((g.rows[gy] >> (g.w - 1 - gx)) & 1) === 1, `plate ${j} (${s}) cell ${cx + gx},${gy}`); cx += g.w + 1; }
  }
  // every record the hall paints, once: 5-20
  assert.deepEqual(hallArt().map(([rec]) => rec), [...Array(16).keys()].map((k) => k + 5));
  assert.equal(SD_PIPS.length, 6);
});

test('SD-LOOK S10 THE DIAL\'S FLOOR AND THE HALL\'S PARTS: twelve numerals raised as tall as a knee at their hours (XII toward +z, the bridge), each spelt as the sky spells it; a bezel round the inner ring; the lit plates inside their outlines; the fray\'s tabs half a step off the hours\' inlay; the band from the hub along +z; nothing that turns casts a shadow - only the standing hall (mutants: XII turned to the walk; a numeral misspelt; the hands casting)', () => {
  const quads = dialFloorQuads(), brass = quads.filter(([rec]) => rec === SD_REALM_BRASS_RECORD).flatMap(([, P]) => P).map((p) => dungeonToRealm(...p));
  for (let h = 0; h < 12; h++) {
    const b = (h / 12) * Math.PI * 2, pts = brass.filter((p) => { const rr = Math.hypot(p[0] - SD_ORRERY.x, p[2] - SD_ORRERY.z), bb = Math.atan2(p[0] - SD_ORRERY.x, p[2] - SD_ORRERY.z); return Math.abs(rr - SD_NUMERALS.r) < SD_NUMERALS.h && Math.abs(Math.atan2(Math.sin(bb - b), Math.cos(bb - b))) < 0.06; });
    assert.ok(pts.length >= 8 * numeralStrokes(SD_HOUR_NUMERALS[h]).length, `hour ${h} (${SD_HOUR_NUMERALS[h]}) at its bearing`);
    assert.ok(Math.max(...pts.map((p) => p[1])) <= SD_NUMERALS.up + 1e-9 && Math.max(...pts.map((p) => p[1])) > SD_NUMERALS.up - 1e-9, 'raised, a hand\'s breadth');
  }
  assert.deepEqual(numeralStrokes('I').length, 1);
  assert.deepEqual(['XII', 'IV', 'VIII'].map((s) => numeralStrokes(s).length), [4, 3, 5], 'spelt stroke by stroke');
  assert.equal(SD_HOUR_NUMERALS[0], 'XII');
  const xii = numeralStrokes('XII'), mx = (xii[0][0] + xii[0][2]) / 2;
  assert.ok(mx < 0, 'the X on the left of the I\'s, as one at the hub looking out reads it');
  assert.ok(brass.some((p) => Math.abs(Math.hypot(p[0] - SD_ORRERY.x, p[2] - SD_ORRERY.z) - SD_INNER_BEZEL.r1) < 1e-4), 'the inner ring\'s bezel');
  // the lit plates inside the segments' outlines
  for (const p of vertsOf(buildLitModel(6)).map((q) => dungeonToRealm(...q))) { const rr = Math.hypot(p[0] - SD_ORRERY.x, p[2] - SD_ORRERY.z); assert.ok(rr >= SD_LIT_RING.r0 + SD_LIT_RING.inset - 1e-4 && rr <= SD_LIT_RING.r1 - SD_LIT_RING.inset + 1e-4); }
  // the tabs
  assert.ok(Math.abs(frayTabBearing(0) - Math.PI / 48) < 1e-12 && Math.abs(frayTabBearing(0, 36) - Math.PI / 36) < 1e-12, 'half a step in');
  assert.ok(SD_FRAY_TAB.h > 0.3 && SD_FRAY_TAB.len <= SD_FRAY_RING.r1 - SD_FRAY_RING.r0 + 1e-9);
  // the band along +z from the hub
  for (const p of vertsOf(buildBandModel()).map((q) => dungeonToRealm(...q))) assert.ok(Math.abs(p[0] - SD_ORRERY.x) <= SD_BAND.halfW + 1e-4 && p[2] >= SD_ORRERY.z + SD_BAND.r0 - 1e-4 && p[2] <= SD_ORRERY.z + SD_BAND.r1 + 1e-4);
  const bm = bandMatrix(0.5), z0 = realmToDungeon(0, 0, SD_ORRERY.z + SD_BAND.r0)[2];
  assert.ok(Math.abs(xf(bm, [0, 0, z0])[2] - z0) < 1e-4, 'run out from the hub');
  // the bridge's plates: twelve, the bridge record's cells
  assert.equal(trisOf(buildBridgeModel()).length, SD_BRIDGE_PLATES.n * 10);
  assert.equal(trisOf(buildBridgePlateModel(3)).length, 10);
  // nothing that turns casts: every draw but the standing hall carries noShadow
  const r = rig();
  r.hall.frame(0.016, null, { ...word(1, [...orreryOf(1).start]), f: 3 });
  const casting = r.draws.filter((d) => !d.noShadow);
  assert.equal(casting.length, 1, 'the standing hall alone');
  assert.equal(casting[0].gpu.m.subMeshes.some((s) => s.textureRecord === SD_HALL_ATLAS_RECORD), true);
  const { hands, gears, rings, bezels } = r.hall.parts;
  assert.ok([...hands, ...gears, ...rings, ...bezels].every((d) => d.noShadow === true));
  assert.ok(buildHallModel().subMeshes.length <= 6, `the standing hall in ${buildHallModel().subMeshes.length} records (it was sixteen draws and more)`);
});

test('SD-LOOK S10 THE LAB: the Orrery\'s knobs stand the hall at any word from its own text - a stone\'s hour, a turn heard, a refusal, the snap, the Concord at a moment - and the law\'s solids as wire; the hall\'s halos and gem light in its frame', () => {
  const L = read('src/tools/abyssLab.js');
  for (const k of ['?hours=', '?turn=', '?refuse=', '?snap', '?concord=', '?cs=', '?law']) assert.ok(L.includes(`//   ${k}`) || L.includes(`?${k.slice(1)}`), `the header names ${k}`);
  assert.match(L, /const hall = createSdHall\(\{ renderer, s: LAB_SLOT, now: \(\) => hallMs, clock: \(\) => clock, onTurn: \(\) => true \}\);/);
  assert.match(L, /hall\.press\(sdStoneKey\(i, 1\)\);/);
  assert.match(L, /\.\.\.hall\.halos\(\)/);
  assert.match(L, /\.\.\.hall\.lights\(\)/);
  assert.ok(SD_HAND_RATE > 0 && SD_STONE_SETTLE_MS === 700);
});
