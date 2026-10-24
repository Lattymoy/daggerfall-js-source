// COATS3D (2026-10-11): THE 3D HORSE (bible/06-Systems/Horse-Coats.md "The 3D horse") - the bake of the owner's Courser
// (tools/bakeHorse.mjs) against its committed FBX, its frame, flanks, skin and gaits; the runtime's stream, gait and pose
// (world/horseModel.js); the texel map and the 3D dye against the sprites' dye (systems/horse/horseCoats.js); the GL half
// (world/horseRig.js) on a recording renderer - its looks dyed on the frame budget and let go; the body astride
// (player/seatPose.js saddleRigInput) solved on retail's biped; the view's saddle (player/mwView.js - RIDE-POV lifted
// astride, held elsewhere); and the hosts, the peers, the pool and the road wiring it. tools/horse3dProbe.mjs draws it
// through the real renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { bakeHorse, GAIT_STACKS, HORSE_FPS } from '../../../tools/bakeHorse.mjs';
import {
  HORSE_GAITS, HORSE_GAIT_FROM, GAIT_HOLD, GAIT_RATES, GAIT_FADE, gaitFor, gaitRate, horseGait, stepHorseGait, gaitShare, gaitLocals,
  horsePaletteShape, horsePoseScratch, writeHorsePalette, horseSkinStream, horseHide, horseTexelMap, startTexelMap, TEXEL_GUTTER, TEXEL_MAP_STEPS, rgbaMips,
} from '../../../src/world/horseModel.js';
import { createHorseRig, horseRigFor, HORSE3D_LOOKS_KEPT, DYE_ROWS, HORSE_SEAT, HORSE_SEAT_BONE, LOOK_ASK_STALE, outOfView } from '../../../src/world/horseRig.js';
import { createRoadTeams } from '../../../src/world/road/roadTeams.js';
import { createPeerRiders } from '../../../src/net/peer/peerRiders.js';
import { createEotbBody, HORSE_PRELOAD_A_FRAME } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { horseLookCode, recolorHorse, recolorHorseTexels, dyeHorseTexelRows, texelPlanes, PLANE_SHARPNESS, LEG_BANDS, WHITE_FLOOR_3D, isCoatPixel } from '../../../src/systems/horse/horseCoats.js';
import { skinStreamFloats, SKIN_STATIC_FLOATS } from '../../../src/formats/morrowind/mwGpuSkin.js';
import { saddleRigInput, saddleRequestFor, seatedCamera, STIRRUP_SIDE, STIRRUP_DROP, STIRRUP_AHEAD, REIN_AHEAD, REIN_UP, REIN_SIDE, SADDLE_LEAN_GALLOP, SEAT_PELVIS_HEIGHT } from '../../../src/player/seatPose.js';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { applyClimbRig, climbBones } from '../../../src/combat/climbRig.js';
import { MW_UNITS_PER_METER } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { spriteBoxUnion } from '../../../src/combat/fpArm.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const bytes = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url));
const BAKE = JSON.parse(rd('src/assets/horse/courser.json'));
const BODY = (() => { const p = PNG.sync.read(bytes('src/assets/horse/body.png')); return { width: p.width, height: p.height, colors: new Uint8Array(p.data) }; })();
const MAP = horseTexelMap(BAKE, BODY.width, BODY.height);
const code = (coat, pattern = 0, legs = 0, seed = 0) => horseLookCode({ coat, pattern, legs, seed });
const r3 = (v) => Math.round(v * 1000) / 1000;

test('COATS3D the bake: the committed bake is the committed FBX\'s, byte for byte - one rig, two meshes, 33 bones, four gaits', () => {
  const fbx = bytes('src/assets/horse/source/courser.fbx');
  const { report, ...asset } = bakeHorse(fbx);
  assert.equal(JSON.stringify(asset), rd('src/assets/horse/courser.json'), 'node tools/bakeHorse.mjs makes exactly what is committed');
  assert.equal(BAKE.bake, 'COATS3D');
  assert.deepEqual(BAKE.frame.up + BAKE.frame.forward + BAKE.frame.units, '+z+ymetres', 'Morrowind\'s basis, in metres');
  assert.equal(BAKE.bones.length, 33);
  assert.equal(BAKE.bones[0].name, 'Root'); assert.equal(BAKE.bones[0].parent, -1);
  BAKE.bones.forEach((b, i) => assert.ok(b.parent < i, `${b.name}: parent first`));
  assert.deepEqual(BAKE.meshes.map((m) => [m.part, m.texture, m.alpha]), [['hair', 'hair', true], ['body', 'body', false]]);
  assert.ok(report.bindAgree < 1e-4, 'the clusters\' two binds agree');
  assert.equal(report.weights.body.overFour, 0); assert.equal(report.weights.body.unweighted, 0);
  assert.ok(report.weights.body.renormalised > 0, 'the body\'s unnormalised weights were divided out, as Blender does');
  for (const m of BAKE.meshes) for (let v = 0; v < m.weights.length / 4; v++) {
    const s = m.weights[v * 4] + m.weights[v * 4 + 1] + m.weights[v * 4 + 2] + m.weights[v * 4 + 3];
    assert.ok(Math.abs(s - 1) < 3e-3, `${m.part} vertex ${v}: weights sum to one (${s})`);
  }
  assert.deepEqual(Object.keys(BAKE.gaits), [...HORSE_GAITS]);
  assert.deepEqual(Object.keys(GAIT_STACKS), [...HORSE_GAITS]);
  for (const [g, { fps }] of Object.entries(GAIT_STACKS)) {
    const G = BAKE.gaits[g];
    assert.equal(G.fps, fps); assert.equal(G.frames, Math.round(G.duration * fps) + 1);
    assert.equal(G.q.length, G.frames * 33 * 4); assert.equal(G.t.length, G.frames * G.moves.length * 3); assert.equal(G.rest.length, 33 * 3);
  }
  assert.equal(HORSE_FPS, 30); assert.equal(BAKE.gaits.idle.fps, 15, 'the idle\'s eight slow seconds at half the rate');
  assert.deepEqual(['idle', 'walk', 'trot', 'gallop'].map((g) => BAKE.gaits[g].speed), [0, 0.668, 1.932, 10.3088], 'each gait\'s ground a second: the twins\' Root travel, the gallop\'s planted hooves');
});

test('COATS3D each flank its own texels: the mirrored islands\' left triangles read the painting\'s own left half - seamless, and the bay unchanged', () => {
  const { report } = bakeHorse(bytes('src/assets/horse/source/courser.fbx'));
  assert.deepEqual(report.flanks.axes.map(r3), [0.419, 0.62], 'the barrel\'s and the head\'s axes, at their midline edge');
  assert.ok(report.flanks.twins > 200);
  const body = BAKE.meshes.find((m) => m.part === 'body');
  const P = body.positions, UV = body.uvs, I = body.indices, A = report.flanks.axes[0];
  let left = 0, mirrored = 0, right = 0, kept = 0;
  for (let t = 0; t < I.length; t += 3) {   // the barrel's triangles: off its middle, between the legs and the withers
    const c = [0, 1, 2].map((k) => (P[I[t] * 3 + k] + P[I[t + 1] * 3 + k] + P[I[t + 2] * 3 + k]) / 3);
    if (!(c[1] > -0.4 && c[1] < 0.4 && c[2] > 1.0 && c[2] < 1.5 && Math.abs(c[0]) > 0.05)) continue;
    const us = [0, 1, 2].map((k) => UV[I[t + k] * 2]);
    if (c[0] < 0) { left++; if (us.every((u) => u <= A + 1e-4)) mirrored++; } else { right++; if (us.every((u) => u >= A - 1e-4)) kept++; }
  }
  assert.ok(right > 50 && kept === right, `every right barrel triangle on the painting's right half (${kept}/${right})`);
  assert.ok(left > 50 && mirrored === left, `and every left one on its left half (${mirrored}/${left})`);
  // the painting mirrors itself about the axis (why the bay draws as it did): a texel and its reflection a few levels apart
  const T = BODY.colors, W = BODY.width;
  let d = 0, n = 0;
  for (let y = Math.floor((1 - 0.98) * W); y < Math.floor((1 - 0.35) * W); y++) for (let k = 2; k < 60; k++) {
    const a = (y * W + Math.round(0.4175 * W * 2 - (107 + k) - 1)) * 4, b = (y * W + 107 + k) * 4;
    if (!T[b + 3]) continue;
    d += Math.abs(T[a] - T[b]) + Math.abs(T[a + 1] - T[b + 1]) + Math.abs(T[a + 2] - T[b + 2]); n += 3;
  }
  assert.ok(d / n < 12, `the barrel's painting is its own mirror (${(d / n).toFixed(1)} levels)`);
});

test('COATS3D the stream: the character pass\'s GPU-skin corner - one pair, the post the identity, the hide first and the cards alpha-cut after it; the picture\'s v turned over', () => {
  const s = horseSkinStream(BAKE);
  assert.equal(s.floats, skinStreamFloats(1)); assert.equal(s.floats, SKIN_STATIC_FLOATS + 9); assert.equal(s.pairs, 1);
  assert.deepEqual(s.ranges.map((r) => [r.part, r.alpha]), [['body', false], ['hair', true]]);
  const body = BAKE.meshes.find((m) => m.part === 'body'), hair = BAKE.meshes.find((m) => m.part === 'hair');
  assert.deepEqual(s.ranges.map((r) => r.count), [body.indices.length, hair.indices.length]);
  assert.equal(s.stream.length, (body.indices.length + hair.indices.length) * s.floats);
  const v = body.indices[0], o = 0;
  assert.deepEqual([...s.stream.slice(o, o + 3)].map(r3), body.positions.slice(v * 3, v * 3 + 3).map(r3));
  assert.deepEqual([...s.stream.slice(o + 3, o + 6)], [1, 1, 1], 'white: the picture is the colour');
  assert.equal(r3(s.stream[o + 10]), r3(1 - body.uvs[v * 2 + 1]), 'v up (FBX) to the pass\'s rows top first');
  assert.deepEqual([...s.stream.slice(o + 11, o + 14)], [0, 0, 0], 'no emission');
  assert.deepEqual([...s.stream.slice(o + 14, o + 18)], body.joints.slice(v * 4, v * 4 + 4).map((j) => j + 1), 'bone b is palette entry 1 + b');
  assert.equal(s.stream[o + s.floats - 1], 0, 'the post: entry 0, the identity');
  const shape = horsePaletteShape(BAKE);
  assert.deepEqual(shape, { entries: 34, width: 102, height: 1 });
});

test('COATS3D the gait: idle, walk, trot, gallop by the ground speed, held past an edge; the rate the stride\'s, clamped; a new gait at the old one\'s phase, faded in', () => {
  assert.deepEqual([...HORSE_GAITS], ['idle', 'walk', 'trot', 'gallop']);
  assert.deepEqual({ ...HORSE_GAIT_FROM }, { idle: 0, walk: 0.2, trot: 1.3, gallop: 5 });
  assert.equal(GAIT_HOLD, 0.15); assert.equal(GAIT_FADE, 0.25);
  assert.deepEqual([0, 0.1, 0.5, 2, 4, 6, 10.8, 16, NaN, -3].map((v) => gaitFor(v)), ['idle', 'idle', 'walk', 'trot', 'trot', 'gallop', 'gallop', 'gallop', 'idle', 'idle']);
  assert.equal(gaitFor(5.2, 'trot'), 'trot', 'a trot is held past the gallop\'s start');
  assert.equal(gaitFor(5.9, 'trot'), 'gallop');
  assert.equal(gaitFor(4.6, 'gallop'), 'gallop', 'and a gallop below it');
  assert.equal(gaitFor(4.2, 'gallop'), 'trot');
  assert.equal(r3(gaitRate(BAKE, 'gallop', 10.3088)), 1, 'Daggerfall\'s ride is a gallop at its own rate');
  assert.equal(gaitRate(BAKE, 'gallop', 2), GAIT_RATES.gallop[0]); assert.equal(gaitRate(BAKE, 'gallop', 40), GAIT_RATES.gallop[1]);
  assert.equal(gaitRate(BAKE, 'idle', 3), 1);
  const g = horseGait();
  stepHorseGait(g, BAKE, 1.0, 0.1);
  assert.deepEqual([g.gait, g.from], ['walk', 'idle']);
  assert.ok(g.fade > 0 && g.fade < 1); assert.ok(gaitShare(g, 'walk') > 0 && gaitShare(g, 'idle') > 0);
  for (let i = 0; i < 5; i++) stepHorseGait(g, BAKE, 1.0, 0.1);
  assert.deepEqual([g.gait, g.from, g.fade], ['walk', null, 1], 'faded in whole');
  const at = g.clock.walk / BAKE.gaits.walk.duration;
  stepHorseGait(g, BAKE, 2.5, 0);
  assert.equal(g.gait, 'trot');
  assert.equal(r3(g.clock.trot / BAKE.gaits.trot.duration), r3(at), 'the trot comes in at the walk\'s phase');
  stepHorseGait(g, BAKE, 2.5, 99);
  assert.ok(g.clock.trot < BAKE.gaits.trot.duration, 'a long frame is a quarter second at most, wrapped');
});

test('COATS3D the pose: the palette posed by the gait\'s bones - entry 0 the identity, the idle\'s first frame the skin\'s bind within a centimetre, and every gait moves it', () => {
  const shape = horsePaletteShape(BAKE);
  const pal = new Float32Array(shape.width * shape.height * 4);
  const sc = horsePoseScratch(BAKE);
  const g = horseGait();
  writeHorsePalette(BAKE, g, pal, sc);
  assert.deepEqual([...pal.slice(0, 12)], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const body = BAKE.meshes.find((m) => m.part === 'body');
  const skinned = (v) => {
    const out = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const e = 1 + body.joints[v * 4 + k], w = body.weights[v * 4 + k];
      for (let r = 0; r < 3; r++) out[r] += w * (pal[e * 12 + r * 4] * body.positions[v * 3] + pal[e * 12 + r * 4 + 1] * body.positions[v * 3 + 1] + pal[e * 12 + r * 4 + 2] * body.positions[v * 3 + 2] + pal[e * 12 + r * 4 + 3]);
    }
    return out;
  };
  let worst = 0;
  for (let v = 0; v < body.positions.length / 3; v += 7) { const p = skinned(v); worst = Math.max(worst, Math.hypot(p[0] - body.positions[v * 3], p[1] - body.positions[v * 3 + 1], p[2] - body.positions[v * 3 + 2])); }
  assert.ok(worst < 0.04, `the idle's first frame stands where the skin was bound - its bones within 8 mm, its farthest vertex a few cm (${worst.toFixed(4)} m)`);
  const rest = pal.slice();
  for (const gait of ['walk', 'trot', 'gallop']) {
    const h = horseGait(); h.gait = gait; h.clock[gait] = BAKE.gaits[gait].duration * 0.3;
    writeHorsePalette(BAKE, h, pal, sc);
    let moved = 0; for (let i = 12; i < pal.length; i++) moved = Math.max(moved, Math.abs(pal[i] - rest[i]));
    assert.ok(moved > 0.05, `${gait} moves the bones (${moved.toFixed(3)})`);
  }
  // a fade blends: halfway between two gaits, a bone stands between them
  const t = new Float32Array(33 * 3), q = new Float32Array(33 * 4), t2 = new Float32Array(33 * 3), q2 = new Float32Array(33 * 4);
  gaitLocals(BAKE, 'walk', 0.2, t, q); gaitLocals(BAKE, 'trot', 0.2, t2, q2);
  assert.ok(q.some((v, i) => Math.abs(v - q2[i]) > 0.01));
});

test('COATS3D the texel map: every texel the body draws placed on the horse - the horn below the crown kept, the islands\' edges two texels deep, each texel\'s faces weighted to one', () => {
  const hide = horseHide(BAKE);
  assert.equal(r3(hide.crown), 0.088, 'halfway between the coffin joint (3.5 cm) and the fetlock (13.5-14.5 cm), the mean of four');
  assert.equal(r3(hide.length), 2.319); assert.equal(r3(hide.front), 1.546); assert.equal(r3(hide.top), 1.979);
  assert.equal(TEXEL_GUTTER, 2);
  assert.equal(TEXEL_MAP_STEPS, 10);
  const job = startTexelMap(BAKE, BODY.width, BODY.height);
  let steps = 0;
  while (!job.step()) steps++;
  assert.equal(steps, TEXEL_MAP_STEPS - 1);
  assert.deepEqual([job.map.hide, job.map.planes, job.map.up], [MAP.hide, MAP.planes, MAP.up], 'a step at a time, the same map');
  const n = BODY.width * BODY.height;
  let drawn = 0, kept = 0;
  for (let i = 0; i < n; i++) {
    const w = MAP.planes[i * 9 + 2] + MAP.planes[i * 9 + 5] + MAP.planes[i * 9 + 8];
    if (w === 0) continue;
    drawn++;
    assert.ok(Math.abs(w - 1) < 1e-5, 'a texel\'s faces weigh one between them');
    if (!MAP.hide[i]) { kept++; assert.ok(MAP.up[i] < 0, 'only the horn is kept'); }
  }
  assert.ok(drawn > 40000 && drawn < n, `the islands and their gutters (${drawn} of ${n})`);
  assert.ok(kept > 300, `the hooves' horn (${kept} texels)`);
  // the frame: the flank as the side view lays it, one unit the hide's length; the two flanks apart on the pattern
  const right = texelPlanes([0.3, 0.5, 1.2], [1, 0, 0], hide), left = texelPlanes([-0.3, 0.5, 1.2], [-1, 0, 0], hide);
  assert.equal(PLANE_SHARPNESS, 4);
  assert.deepEqual([r3(right[0]), r3(right[1]), r3(right[2])], [r3((hide.front - 0.5) / hide.length), r3((hide.top - 1.2) / hide.length), 1]);
  assert.ok(Math.abs(left[0] - right[0]) > 10, 'a left flank is not its right one\'s place on the pattern');
  const between = texelPlanes([0.2, 0, 1.4], [Math.SQRT1_2, 0, Math.SQRT1_2], hide);
  assert.deepEqual([r3(between[2]), r3(between[5]), r3(between[8])], [0.5, 0, 0.5], 'facing between two, both, by |n|^4');
});

test('COATS3D THE ONE DYE: a texel of the 3D horse takes exactly the colour a sprite\'s pixel of the same colour takes - every coat, every shade; the bay as drawn no pass; the horn and the unwarm kept', () => {
  const at = (img, i) => [...img.colors.slice(i * 4, i * 4 + 4)];
  const probe = [];
  for (let i = 0; i < BODY.width * BODY.height && probe.length < 40; i += 997) {
    const o = i * 4;
    if (MAP.hide[i] && isCoatPixel(BODY.colors[o], BODY.colors[o + 1], BODY.colors[o + 2], false)) probe.push(i);
  }
  assert.ok(probe.length >= 30);
  for (let coat = 0; coat < 7; coat++) for (const seed of [0, 5, 40000]) {
    const look = code(coat, 0, 0, seed);
    if (!look) { assert.equal(recolorHorseTexels(BODY, look, MAP), BODY, 'the bay as drawn is no pass at all'); continue; }
    const tex = recolorHorseTexels(BODY, look, MAP);
    for (const i of probe) {
      const one = { width: 1, height: 1, colors: Uint8Array.from(at(BODY, i)) };
      assert.deepEqual(at(tex, i), at(recolorHorse(one, look, { tack: false }), 0), `coat ${coat} seed ${seed}: texel ${i}`);
    }
  }
  const grey = recolorHorseTexels(BODY, code(3, 0, 2, 9), MAP);
  for (let i = 0; i < BODY.width * BODY.height; i++) if (!MAP.hide[i]) assert.deepEqual(at(grey, i), at(BODY, i), 'the horn and the gutters past the map keep the art');
  // the rows apart are the whole: a renderer may dye a look a few rows a frame
  const out = new Uint8Array(BODY.colors);
  for (let r = 0; r < BODY.height; r += 37) dyeHorseTexelRows(BODY.colors, out, BODY.width, code(1, 1, 1, 77), MAP, r, Math.min(BODY.height, r + 37));
  assert.deepEqual(out, recolorHorseTexels(BODY, code(1, 1, 1, 77), MAP).colors);
});

test('COATS3D the markings on the 3D horse: a pinto\'s two flanks their own, the legs\' white from the crown by the sprites\' share, every pattern its own per seed', () => {
  const hide = horseHide(BAKE);
  const whiteAt = (img, i) => { const o = i * 4; const [r, g, b] = [img.colors[o], img.colors[o + 1], img.colors[o + 2]]; return Math.min(r, g, b) > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 40; };
  // where each flank's texels are: off the map's side faces
  const flank = (sgn) => { const out = []; for (let i = 0; i < BODY.width * BODY.height; i++) if (MAP.hide[i] && MAP.planes[i * 9 + 2] > 0.9 && MAP.up[i] > 0.45 && (sgn > 0 ? MAP.planes[i * 9] < 10 : MAP.planes[i * 9] > 30)) out.push(i); return out; };
  const R = flank(1), L = flank(-1);
  assert.ok(R.length > 2000 && L.length > 2000);
  const share = (img, set) => set.filter((i) => whiteAt(img, i)).length / set.length;
  let differ = 0;
  for (const seed of [3, 11, 321, 4242]) {
    const p = recolorHorseTexels(BODY, code(1, 1, 0, seed), MAP);
    if (Math.abs(share(p, R) - share(p, L)) > 0.05) differ++;
  }
  assert.ok(differ >= 2, `a pinto is no mirror horse: its flanks' white differs on most seeds (${differ}/4)`);
  // the legs: socks to a tenth of the hide's height over the crown, stockings a fifth, ragged by up to a fifth either way
  assert.deepEqual([...LEG_BANDS], [0, 0.1, 0.2]);
  const band = (legs) => { const img = recolorHorseTexels(BODY, code(1, 0, legs, 5), MAP); let lowW = 0, low = 0, hiW = 0, hi = 0; for (let i = 0; i < BODY.width * BODY.height; i++) { if (!MAP.hide[i] || !isCoatPixel(BODY.colors[i * 4], BODY.colors[i * 4 + 1], BODY.colors[i * 4 + 2], false)) continue; const u = MAP.up[i]; if (u > 0 && u < LEG_BANDS[legs] * 0.75) { low++; if (whiteAt(img, i)) lowW++; } if (u > LEG_BANDS[legs] * 1.25 && u < 0.4) { hi++; if (whiteAt(img, i)) hiW++; } } return [lowW / low, hi ? hiW / hi : 0]; };
  const [sockIn, sockOut] = band(1), [stockIn] = band(2);
  assert.ok(sockIn > 0.95 && sockOut < 0.02, `socks: white under the band, none past its ragged top (${sockIn.toFixed(2)}, ${sockOut.toFixed(2)})`);
  assert.ok(stockIn > 0.95, 'stockings too');
  assert.equal(WHITE_FLOOR_3D, 0.4, 'a sock is white on the bay\'s dark-painted points (its light floored - the world shades the 3D horse)');
  assert.ok(hide.height * LEG_BANDS[2] < 0.52 - hide.crown, 'a stocking stops under the knee (the cannon\'s joint, 0.49-0.52 m)');
  // every pattern is its own per seed, and its own from the solid
  for (const p of [1, 2, 3, 4]) {
    const a = recolorHorseTexels(BODY, code(2, p, 0, 31), MAP).colors, b = recolorHorseTexels(BODY, code(2, p, 0, 32), MAP).colors, s = recolorHorseTexels(BODY, code(2, 0, 0, 31), MAP).colors;
    assert.notDeepEqual(a, b, `pattern ${p}: another seed, another horse`);
    assert.notDeepEqual(a, s, `pattern ${p}: marked`);
  }
});

/** A recording renderer: the GL half's doors, as the hosts' renderer answers them. */
function recordingRenderer() {
  const r = { made: { meshes: 0, palettes: 0, textures: 0 }, released: { palettes: 0, textures: 0 }, uploads: 0, sprites: [], overlays: 0, queued: [] };
  Object.assign(r, {
    createSkinnedCharacterMesh: (stream, o) => { r.made.meshes++; return { vao: {}, vbo: {}, count: stream.length / o.floats, floats: o.floats, skin: r.createSkinPalette(o) }; },
    createSkinPalette: (o) => { r.made.palettes++; return { tex: { id: r.made.palettes }, ...o }; },
    releaseCharacterSkin: (m) => { if (m?.skin?.tex) { r.released.palettes++; m.skin.tex = null; } },
    createCharacterTexture: (mips) => { r.made.textures++; return { mips: mips.length, id: r.made.textures }; },
    releaseCharacterTexture: () => { r.released.textures++; },
    updateSkinPalette: () => { r.uploads++; },
    renderCharacterSprite: (mesh, model, proj, view, pw, ph, o) => { r.sprites.push({ mesh, pw, ph, also: o?.also ?? null }); return {}; },
    drawCharacterSpriteQuad: () => {},
    drawScreenOverlayQuad: () => { r.overlays++; },
    queueCharacterSprite: (it) => r.queued.push(it),
    characterSpriteBatchOpen: false,
    retroImageSpan: null,
  });
  return r;
}
const RIG_DEPS = {
  fetchJson: async () => JSON.parse(rd('src/assets/horse/courser.json')),
  fetchBytes: async (u) => new Uint8Array(readFileSync(new URL(u))),
  decode: async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
};

test('COATS3D the GL half: one stream, a palette a horse; a look dyed DYE_ROWS a frame and uploaded once whole, the bay\'s worn meanwhile; past HORSE3D_LOOKS_KEPT the longest undrawn let go', async () => {
  const r = recordingRenderer();
  const rig = createHorseRig({ renderer: r, ...RIG_DEPS });
  assert.equal(rig.ready(), false); assert.equal(rig.horse(), null, 'no horse before the rig is up');
  await rig.load();
  assert.equal(rig.failure(), null); assert.equal(rig.ready(), true);
  assert.deepEqual([r.made.meshes, r.made.textures, r.released.palettes], [1, 2, 1], 'the stream once, the bay\'s and the cards\' pictures; the shared mesh poses nothing');
  const a = rig.horse(1), b = rig.horse(2);
  assert.equal(a.mesh.vao, b.mesh.vao, 'one stream'); assert.notEqual(a.mesh.skin.tex, b.mesh.skin.tex, 'a palette each');
  assert.deepEqual(a.mesh.ranges.map((x) => [x.part, x.alphaCut]), [['body', 0], ['hair', 0.5]]);
  const pinto = code(1, 1, 1, 321);
  rig.step(a, { feet: [0, 0, 0], yaw: 0, speed: 0, dt: 0.016, look: pinto });
  const bay = rig.lookTex(0);
  assert.equal(a.mesh.ranges[0].tex, bay, 'the bay\'s worn until the look is up');
  assert.equal(r.uploads, 1);
  assert.equal(DYE_ROWS, 32);
  const frames = BODY.height / DYE_ROWS;
  for (let f = 0; f < TEXEL_MAP_STEPS; f++) { rig.tick(); assert.equal(rig.dyeing(), null, 'the texel map first, a slice a frame'); }
  for (let f = 0; f < frames - 1; f++) { rig.tick(); assert.equal(rig.dyeing(), pinto); }
  rig.tick();
  assert.equal(rig.dyeing(), null); assert.ok(rig.kept().includes(pinto), `up in ${frames} frames`);
  rig.step(a, { feet: [0, 0, 0], yaw: 0, look: pinto });
  assert.notEqual(a.mesh.ranges[0].tex, bay, 'and worn');
  // the kept looks: the bay always, and HORSE3D_LOOKS_KEPT more
  assert.equal(HORSE3D_LOOKS_KEPT, 12);
  for (let s = 1; s <= HORSE3D_LOOKS_KEPT + 3; s++) { rig.lookTex(code(2, 0, 0, s)); for (let f = 0; f < frames; f++) rig.tick(); }
  assert.equal(rig.kept().length, HORSE3D_LOOKS_KEPT + 1); assert.ok(rig.kept().includes(0));
  assert.ok(r.released.textures >= 3, 'the longest undrawn let go');
  rig.release(a);
  assert.equal(a.mesh.skin.tex, null, 'a horse let go gives its palette back');
  assert.equal(horseRigFor(r, RIG_DEPS), horseRigFor(r), 'one rig a renderer');
});

test('COATS3D the seat and the draws: the seat rides the Spine\'s stride over the rider\'s feet; alone, a sprite at the arm\'s dial; first person, the world\'s camera laid over the screen', async () => {
  const r = recordingRenderer();
  const rig = createHorseRig({ renderer: r, ...RIG_DEPS });
  await rig.load();
  assert.deepEqual([...HORSE_SEAT], [0, 0.1, 1.68]); assert.equal(HORSE_SEAT_BONE, 'Spine');
  const h = rig.horse(1);
  rig.step(h, { feet: [10, 2, 30], yaw: 0, speed: 0, dt: 0 });
  const seat = rig.seat(h);
  assert.ok(Math.abs(seat[0] - 10) < 0.01 && Math.abs(seat[2] - 30.1) < 0.02 && Math.abs(seat[1] - 3.68) < 0.02, `the seat at rest: 0.1 m forward, 1.68 m up (${seat.map(r3)})`);
  rig.step(h, { feet: [10, 2, 30], yaw: Math.PI / 2, speed: 0, dt: 0 });
  assert.ok(Math.abs(rig.seat(h)[0] - 10.1) < 0.02, 'turned with the heading (yaw PI/2 faces +x)');
  const ys = [];
  for (let i = 0; i < 16; i++) { rig.step(h, { feet: [0, 0, 0], yaw: 0, speed: 10.3, dt: 1 / 30 }); ys.push(rig.seat(h)[1]); }
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.05, 'a gallop lifts and drops the seat');
  const bx = rig.box(h);
  assert.ok(bx.halfH > 1 && bx.halfW > 1.2 && bx.anchor[1] > 0.9);
  assert.equal(rig.draw(h, { clientWidth: 900, clientHeight: 600 }, { proj: new Float32Array(16).fill(0).map((_, i) => (i % 5 ? 0 : 1)), view: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), eye: [0, 1.5, -6] }), true);
  assert.equal(r.sprites.length, 1, 'alone: one picture through the sprite pass');
  assert.equal(rig.drawFirstPerson(h, { clientWidth: 900, clientHeight: 600 }, { proj: new Float32Array(16), view: new Float32Array(16) }), true);
  assert.deepEqual([r.sprites.at(-1).pw, r.sprites.at(-1).ph, r.overlays], [300, 200, 1], 'first person: the screen at the arm\'s dial, laid over it');
  const pic = rig.picture(h, [0, 0, 0], 0, 3);
  assert.equal(h.scale, 3); assert.ok(pic.box.halfH > 3, 'grown about its feet under the travel view');
});

test('COATS3D THE BODY ASTRIDE: the saddle\'s request - hips on the seat, the stirrups the horse\'s width at the rider\'s leg, the reins over the withers - solved on retail\'s biped to the millimetre', () => {
  assert.deepEqual([STIRRUP_SIDE, STIRRUP_DROP, STIRRUP_AHEAD, REIN_AHEAD, REIN_UP, REIN_SIDE, SADDLE_LEAN_GALLOP], [0.32, 0.8, 0.08, 0.36, 0.18, 0.12, 0.28]);
  const saddle = { feet: [0, 0, 0], seat: [0, 1.68, 0.1], yaw: 0, lean: 1 };
  const s = saddleRigInput(saddle.feet, saddle);
  assert.deepEqual(s.req.offset.map(r3), [0, r3(1.68 - SEAT_PELVIS_HEIGHT), 0.1], 'the body moved up onto the seat');
  assert.deepEqual([s.req.feet.L.at, s.req.feet.R.at].map((p) => p.map(r3)), [[-0.32, 0.88, 0.18], [0.32, 0.88, 0.18]]);
  assert.deepEqual([s.req.hands.L.at, s.req.hands.R.at].map((p) => p.map(r3)), [[-0.12, 1.86, 0.46], [0.12, 1.86, 0.46]]);
  assert.equal(r3(s.req.lean.pitch), 0.28, 'leaning into the gallop');
  assert.equal(saddleRigInput([0, 0, 0], { ...saddle, lean: 0 }).req.lean.pitch, 0, 'upright at a stand');
  const tall = saddleRigInput([0, 0, 0], saddle, { height: 1.1, weight: 0.9 }).req;
  assert.equal(r3(tall.feet.L.at[0]), -0.32, 'the stirrups are the horse\'s width');
  assert.equal(r3(tall.feet.L.at[1]), r3(1.68 - 0.88), 'their drop the rider\'s leg');
  assert.equal(r3(tall.hands.R.at[0]), r3(0.12 * 0.9), 'the reins in the rider\'s build');
  assert.equal(saddleRequestFor(null, { unitsPerMetre: 70 }), null);
  // solved on retail's biped (Weapon Sheathing's xbase_anim_sh.nif, as CARDS2b's seat is)
  const sk = buildSkeleton(parseNif(new Uint8Array(bytes('vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif'))));
  const b = climbBones(sk), U = MW_UNITS_PER_METER;
  const pose = poseSkeleton(sk, null, null, 0);
  const out = applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, saddleRequestFor(saddle, { unitsPerMetre: U }));
  const m = skeletonSpaceMatrices(sk, pose, GRAPH_ROOT);
  const at = (ref) => { const t = m.get(ref).t; return [t[0] / U, t[2] / U, t[1] / U]; };   // the rig's x right, y forward, z up - the world's x, z, y at yaw 0
  assert.ok(out.reach.L < 1e-3 && out.reach.R < 1e-3, 'the hands on the reins');
  for (const s2 of ['L', 'R']) {
    const f = at(b[s2].foot), want = s.req.feet[s2].at;
    assert.ok(Math.hypot(f[0] - want[0], f[1] - want[1], f[2] - want[2]) < 0.01, `${s2}: the foot in its stirrup`);
    const k = at(b[s2].calf);
    assert.ok(Math.abs(k[0]) > 0.28 && k[2] > 0.25, `${s2}: the knee forward and round the barrel (${k.map(r3)})`);
  }
  const hip = at(b.root);
  assert.ok(Math.abs(hip[1] - 1.68) < 0.03, `the hips on the seat (${r3(hip[1])})`);
  assert.ok(at(b.head)[1] > 2.1, 'sitting up');
  // and the body plays no stride under it
  const cam = seatedCamera({ saddle, move: { forward: 1, speed: 10, running: true, riding: true } });
  assert.deepEqual([cam.move.forward, cam.move.speed, cam.move.riding, cam.move.standing], [0, 0, false, true]);
});

test('COATS3D one picture, rider and horse: the union of the two boxes holds both, whichever holds which', () => {
  const a = { center: [0, 1, 0], halfW: 0.5, halfH: 1 }, b = { center: [2, 1, 0], halfW: 1.5, halfH: 1.2 };
  const u = spriteBoxUnion(a, b);
  for (const x of [a, b]) {
    assert.ok(Math.hypot(x.center[0] - u.center[0], x.center[2] - u.center[2]) + x.halfW <= u.halfW + 1e-9);
    assert.ok(x.center[1] - x.halfH >= u.center[1] - u.halfH - 1e-9 && x.center[1] + x.halfH <= u.center[1] + u.halfH + 1e-9);
  }
  assert.deepEqual(spriteBoxUnion({ center: [0, 0, 0], halfW: 3, halfH: 1 }, { center: [1, 0, 0], halfW: 0.5, halfH: 0.5 }), { center: [0, 0, 0], halfW: 3, halfH: 1 });
});

test('COATS3D by source: the view keeps the saddle and lifts RIDE-POV astride; the hosts hand it the horse and the body the saddle; the riding sprite stands down; the peers, the pool and the road ride it; the pass takes the horse in the rider\'s picture', () => {
  const v = rd('src/player/mwView.js');
  assert.match(v, /saddled = !!state\.riding && stepOwnHorse\(state\.horse, feet, yaw, state\.dt \?\? 0\);\n\s*mounted = !!state\.riding && !saddled;/, 'RIDE-POV holds the head only off a 3D horse');
  assert.match(v, /horseRig\?\.tick\(\);\n\s*if \(!state\.riding\) dropOwnHorse\(\);\n\s*\/\/ EOTB4: the other lane/, 'AUDIT A2/A11: the dye every frame, on foot as mounted, before either lane; my horse let go off its back');
  assert.match(v, /dropOwnHorse\(\); saddled = false;   \/\/ the sprite lane's rider is its own picture/, 'and on the sprite lane');
  assert.match(v, /ownSink = fpEye && feet \? Math\.max\(0, RIDE_EYE_HEIGHT - \(fpEye\[1\] - feet\[1\]\) - SINK_SLACK\) : 0;/, 'AUDIT A8: the horse under the eye - sunk with a swimming rider, rising under a mount');
  assert.match(v, /feet\[1\] - ownSink \* grow,/);
  assert.match(v, /if \(!horse \|\| !horseRig\?\.ready\(\) \|\| !feet \|\| !fpArm\.canThirdPerson\(\)\) \{ dropOwnHorse\(\); return false; \}/, 'no horse, no rig or no Morrowind body: RIDE-POV as it stood');
  assert.match(v, /export const mwViewSaddle = \(\) => \(saddled \? ownSaddle : null\);/);
  assert.match(v, /export function mwViewHorseRig\(\) \{\n\s*return horseRig\?\.ready\(\) && !eotbLane\(\) && fpArm\.canThirdPerson\(\) \? horseRig : null;/, 'the world\'s horses 3D on the Morrowind lane alone');
  assert.match(v, /return fpArm\.drawThird\(canvas, \{ [^\n]*, horse \}\);/);
  assert.match(v, /if \(saddled && ownSaddle\) feet = \[feet\[0\], feet\[1\] \+ Math\.max\(0, ownSaddle\.seat\[1\] - feet\[1\] - SEAT_PELVIS_HEIGHT \* heightScale\), feet\[2\]\];\n\s*const eye = mwCamera\.eye\(\{ fpEye, feet,/, 'the third-person camera about the rider\'s head');
  for (const h of ['world', 'exterior']) {
    const s = rd(`src/scenes/${h}.js`);
    assert.match(s, /horse: player\.transportMode === TRANSPORT_MODES\.Horse \? \{ look: riddenHorseLook\(playerEntity\.items \?\? \[\]\), slow: player\.slowRide \} : null,/, `${h}: the horse, never the cart, in its look (PIN MOVED, HORSE-WALK: and the motor's slow ride, which holds it under the gallop)`);
    assert.match(s, /saddle: mwViewSaddle\(\),/, `${h}: the body's saddle in its camera`);
    assert.match(s, /mwViewAttachHorse\(renderer\);/, `${h}: the rig attached`);
    assert.match(s, /hcc\.draw3d\(canvas, \{ eye[^\n]*proj, view/, `${h}: the pool's 3D horses in the body pass`);
  }
  assert.match(rd('src/scenes/world.js'), /livingRoads\.drawTeams3d\(canvas, /, 'and the road\'s teams');
  assert.match(rd('src/player/mountRig.js'), /if \(isRiding\(player\.transportMode\) && !ridePaused && !mwViewHides\(\)\.horse && mwViewDrawSaddle\([^\n]*\)\) return r;\n\s*if \(art && isRiding/, 'the 3D horse in the riding sprite\'s place, which stands down');
  const fp = rd('src/combat/fpArm.js');
  assert.match(fp, /if \(cam && cam\.saddle\) \{ climbLast = null; return thirdSaddle\(cam\); \}/);
  assert.match(fp, /drawBodyPicture\(renderer, canvas, thirdMesh, model, \{ \.\.\.u, anchor: horse\.box\.anchor, hitFlash, conceal, up, fx, also: \[\{ mesh: horse\.mesh, model: horse\.model \}\], glowLook: padLooks \}/);   // PIN MOVED (WEAPON-GLOW1, AUDIT MW-3): and the held weapon's glow, whose outline the rider's picture is padded for   // PIN MOVED (TWO-HANDS x WEAPON-GLOW1): the pad's looks - the held weapon's and a pair's left blade's   // PIN MOVED (BODY-CROP x MW-DETAIL, 2026-10-22): through drawBodyPicture
  const r = rd('src/render/renderer.js');
  assert.match(r, /this\.drawCharacter\(mesh, modelMatrix\);\n\s*if \(also\) for \(const o of also\) this\.drawCharacter\(o\.mesh, o\.model\);/, 'the lone pass');
  assert.match(r, /this\.drawCharacter\(it\.mesh, it\.model\);\n\s*if \(it\.also\) for \(const o of it\.also\) this\.drawCharacter\(o\.mesh, o\.model\);/, 'and the batch\'s tiles');
  assert.match(rd('src/render/characterSprite.js'), /queueCharacterSprite\(\{ mesh, model: rigMat, also,/);
  const pb = rd('src/net/peer/peerBodies.js');
  assert.match(pb, /b\.cam\.saddle = this\._saddle\(b, peer\.shown, f, dt\);/);
  assert.match(pb, /if \(!rig\?\.ready\(\) \|\| shown\.rd !== POSE_RIDE\.Horse \|\| peerIsWolf\(shown\) \|\| shown\.wb\) \{ this\._unhorse\(b\); return null; \}/);
  assert.match(pb, /look: shown\.rc \| 0/, 'in the look the pose names');
  assert.match(pb, /this\._unhorse\(b\);   \/\/ COATS3D: the horse is the peer's, never the spare body's/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /yields: peerRidesIn3d, conceal: veilOf/);
  assert.match(w, /const peerRidesIn3d = \(d\) => !!peerBodies\?\.enabled\(\) && horseRigFor\(renderer\)\.ready\(\) && d\.shown\?\.rd === POSE_RIDE\.Horse && !d\.shown\?\.wb && !peerBodies\.failureOf\(d\.look, d\.shown, d\.glyphs\);/);
  assert.match(rd('src/net/peer/peerRiders.js'), /if \(riding && !beast && yields\(peer\)\) \{ deferred\.push\(peer\); continue; \}/, 'PIN MOVED (AUDIT A3): held for the settle, never dropped');
  assert.match(w, /hcc\.drawVeiled3d\(\);   \/\/ AUDIT COATS3D A5/, 'AUDIT A5: a concealed owner\'s horses after the opaque world');
  assert.match(rd('src/scenes/exterior.js'), /hcc\.drawVeiled3d\(\);   \/\/ AUDIT COATS3D A5/);
  const pool = rd('src/scenes/horseCartPool.js');
  assert.match(pool, /if \(rig\?\.ready\(\)\) \{ pose3dTeam\(rig, owner, team, conceal, _dt3d\); dropTeamBatches\(owner, 0\); return; \}/, 'the pool\'s team 3D, no billboard');
  assert.match(pool, /rig\.step\(e\.horse, \{ feet: h\.position, yaw, speed: e\.speed, dt, look: lookOfOwner\(owner\), pose: false \}\);/, 'in its owner\'s look');   // PIN MOVED (HORSE-VIEW): its pose in the view, on its cadence (test/systems/horse/fb1021_horses.test.js)
  assert.match(rd('src/world/wagonModels.js'), /horses3d: \(\) => mwViewHorseRig\(\),/, 'both hosts, through the one construction seam');
  assert.match(rd('src/world/road/roadTeams.js'), /rig\.step\(s\.h3, \{ feet: h\.feet, yaw: h\.yaw, speed: h\.moving \? h\.speed : 0, dt, look: s\.look, pose: false \}\);/, 'the road\'s strangers in their looks');   // PIN MOVED (HORSE-VIEW II): its pose in the view, on its cadence (test/systems/horse/fb1021b_strangers.test.js)
});

test('COATS3D the mips: each level the 2x2 mean, its colour by its alpha - a card\'s cut edge does not darken', () => {
  const rgba = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0]);
  const m = rgbaMips(2, 2, rgba);
  assert.deepEqual(m.map((l) => [l.width, l.height]), [[2, 2], [1, 1]]);
  assert.deepEqual([...m[1].rgba], [255, 0, 0, 128], 'red at half cover, not a dark red');
  assert.equal(rgbaMips(256, 256, new Uint8Array(256 * 256 * 4)).length, 9);
});

test('COATS3D AUDIT the look cache: a look drawn this frame or the last is never let go - past the cap with every look on screen the cap waits; a look nobody asks for again leaves the queue undyed', async () => {
  const r = recordingRenderer();
  const rig = createHorseRig({ renderer: r, ...RIG_DEPS });
  await rig.load();
  const frames = BODY.height / DYE_ROWS;
  const looks = Array.from({ length: HORSE3D_LOOKS_KEPT + 2 }, (_, i) => code(3, 0, 0, i + 1));
  const horses = looks.map((_, i) => rig.horse(i + 1));
  // the host's order: every horse steps (its look asked, its texture worn), then the view's tick
  const frame = () => { horses.forEach((h, i) => rig.step(h, { feet: [0, 0, 0], yaw: 0, look: looks[i] })); rig.tick(); };
  for (let f = 0; f < 10 + looks.length * (frames + 1) + 4; f++) frame();
  assert.equal(rig.kept().length, looks.length + 1, `all ${looks.length} looks on screen kept past the cap (and the bay)`);
  assert.equal(r.released.textures, 0, 'none let go while drawn - no horse wears a deleted picture');
  const made = r.made.textures;
  for (let f = 0; f < 60; f++) frame();
  assert.equal(r.made.textures, made, 'and no thrash: nothing dyed again');
  // the crowd leaves: the looks undrawn are let go down to the cap
  horses.length = 1;
  for (let f = 0; f < 4; f++) frame();
  assert.equal(rig.kept().length, HORSE3D_LOOKS_KEPT + 1, 'the cap back once the looks are off screen');
  // a look asked once and never again (its horse gone) is dropped from the queue undyed
  const r2 = recordingRenderer();
  const rig2 = createHorseRig({ renderer: r2, ...RIG_DEPS });
  await rig2.load();
  assert.equal(LOOK_ASK_STALE, 30);
  // four looks drawn every frame ahead of one asked once: its turn comes past LOOK_ASK_STALE
  const here = [1, 2, 3, 4].map((s) => code(1, 3, 0, s)), gone = code(5, 1, 0, 9);
  const ask = () => { for (const c of here) rig2.lookTex(c); };
  ask(); rig2.lookTex(gone);
  for (let f = 0; f < 10 + 6 * frames; f++) { ask(); rig2.tick(); }
  assert.ok(here.every((c) => rig2.kept().includes(c)), 'the looks still asked for dyed');
  assert.equal(rig2.kept().includes(gone), false, 'the one nobody asked for again never');
  assert.equal(rig2.dyeing(), null);
});

test('COATS3D AUDIT the view test: a horse wholly behind the eye or past a side of the lens is not drawn; one in view is, and an ortho lens has no sides', async () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const persp = (fovy, aspect) => { const f = 1 / Math.tan(fovy / 2); return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, -1.002, -1, 0, 0, -0.2, 0]; };
  const P = persp(Math.PI / 3, 1.5);
  assert.equal(outOfView([0, 0, -10], 1.5, I, P), false, 'ahead');
  assert.equal(outOfView([0, 0, 1], 1.5, I, P), false, 'at the eye\'s plane, its reach over it: drawn');
  assert.equal(outOfView([0, 0, 3], 1.5, I, P), true, 'behind');
  assert.equal(outOfView([40, 0, -10], 1.5, I, P), true, 'far past the right side');
  assert.equal(outOfView([-9, 0, -10], 1.5, I, P), false, 'its reach over the left edge: drawn');
  assert.equal(outOfView([0, 30, -10], 1.5, I, P), true, 'over the top');
  const O = [0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, -0.1, 0, 0, 0, -1, 1];
  assert.equal(outOfView([400, 0, -10], 1.5, I, O), false, 'an ortho lens: behind alone');
  const r = recordingRenderer();
  const rig = createHorseRig({ renderer: r, ...RIG_DEPS });
  await rig.load();
  const h = rig.horse(1);
  rig.step(h, { feet: [0, 0, 20], yaw: 0, dt: 0 });
  const canvas = { clientWidth: 900, clientHeight: 600 };
  assert.equal(rig.draw(h, canvas, { proj: new Float32Array(P), view: new Float32Array(I), eye: [0, 0, 0] }), false, 'behind the eye: no picture');
  rig.step(h, { feet: [0, 0, -20], yaw: 0, dt: 0 });
  assert.equal(rig.draw(h, canvas, { proj: new Float32Array(P), view: new Float32Array(I), eye: [0, 0, 0] }), true, 'ahead: drawn');
  assert.equal(r.sprites.length, 1);
});

test('COATS3D AUDIT the road\'s 3D horses give their palettes back through the rig that made them - the gate down under a beast\'s stand-in, the rig alive', async () => {
  const r = recordingRenderer();
  const rig = createHorseRig({ renderer: r, ...RIG_DEPS });
  await rig.load();
  let gate = true;
  const teams = createRoadTeams({ renderer: null, presentation: () => null, horses3d: () => (gate ? rig : null) });
  const horse = { key: 't1:h0', feet: [0, 0, 0], yaw: 0, moving: false, speed: 0 };
  teams.sync([horse], [], { dt: 1 / 60 });
  const made = r.made.palettes, back = r.released.palettes;
  gate = false;
  teams.sync([horse], [], { dt: 1 / 60 });
  assert.equal(r.released.palettes, back + 1, 'the horse\'s palette back while the gate answers null');
  gate = true;
  teams.sync([horse], [], { dt: 1 / 60 });
  gate = false;
  teams.sync([], [], { dt: 1 / 60 });
  assert.equal(r.made.palettes - made, 1); assert.equal(r.released.palettes, back + 2, 'and a horse gone with the gate down');
});

test('COATS3D AUDIT the peers: a rider yielded to the 3D horse whose body did not stand (too far, the bodies full, still building) is drawn as the sprite rider; the frame its body stands, the sprite goes', () => {
  const riders = createPeerRiders({ renderer: {}, urlFor: () => null, decode: async () => null, art: null });
  const pose = { x: 0, y: 0, z: 0, rd: 1, wb: 0, yaw: 0 };
  const peers = [{ id: 'far', shown: pose }, { id: 'near', shown: pose }];
  const toScene = (p) => [p.x, p.y, p.z];
  riders.sync(peers, toScene, { yields: () => true });
  assert.equal(riders.riders.has('far') || riders.riders.has('near'), false, 'held for the settle');
  riders.settle(() => false, (id) => id === 'near');
  assert.equal(riders.riders.has('far'), true, 'no body of theirs stood: the sprite rider, this frame');
  assert.equal(riders.riders.has('near'), false, 'their body stands astride: no sprite');
  riders.sync(peers, toScene, { yields: () => true });
  riders.settle(() => false, () => true);
  assert.equal(riders.riders.has('far'), false, 'the frame its body first stands, the sprite is let go');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const afoot = seen\.filter\(\(d\) => \(peerRidesIn3d\(d\) \|\| !peerRiders\.isRiding\(d\.id\)\) && !d\.shown\?\.wb/, 'the bodies take the rider whether or not the sprite stood in last frame - else its body would never build');
});

test('COATS3D AUDIT the sprite lane\'s rider: a look chosen fetches its mounted sprites HORSE_PRELOAD_A_FRAME a frame, never all in one task', async () => {
  let asked = 0;
  const b = createEotbBody({ count: () => 3035, urlFor: (k) => { asked++; return `/art/${k}.png`; }, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
  b.attach({ uploadTexture() {}, createBillboardBatch(archive, rec, size) { return { archive, rec, size, origin: [0, 0, 0] }; }, destroyBillboardBatch() {}, drawBillboards() {} }, () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.tick(1 / 60, {});
  assert.equal(HORSE_PRELOAD_A_FRAME, 3);
  asked = 0;
  b.tick(1 / 60, { horseLook: code(2, 2, 1, 40) });
  assert.equal(asked, HORSE_PRELOAD_A_FRAME, 'a frame\'s share, not the 136');
  let frames = 1;
  for (; frames < 100; frames++) { const was = asked; b.tick(1 / 60, { horseLook: code(2, 2, 1, 40) }); if (asked === was) break; }
  assert.ok(asked >= 120 && frames > 30, `the mounted tables fetched over ${frames} frames (${asked} sprites)`);
});

test('COATS3D AUDIT the dye: a hue jittered under nought wraps to the reds, never a channel to 255', () => {
  // a plain byte array, as the 3D horse's dye writes (horseRig.js's job.out) - a clamped one hid it
  const hide = () => ({ width: 4, height: 4, colors: new Uint8Array(Array.from({ length: 16 }, () => [120, 2, 0, 255]).flat()) });
  let dyed = 0;
  for (let seed = 1; seed < 64; seed++) {
    const out = recolorHorse(hide(), { coat: 0, pattern: 0, legs: 0, seed }, { legs: false });
    const px = out.colors;
    if (px[0] !== 120 || px[1] !== 2) dyed++;
    assert.ok(px[2] < 40 && px[0] > px[2], `seed ${seed}: a bay stays red (${[...px].slice(0, 3)})`);
  }
  assert.ok(dyed > 30, `the seeds' shades dyed (${dyed})`);
});
