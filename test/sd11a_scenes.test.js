// SD11a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's AUDIT SD II): THE ARC'S
// SECOND AUDIT, ITS SCENES AND ITS RENDERING - each fix as it stands. The Orrery's hall as the eye sees it (its hands
// clockwise, the third hour at three o'clock, the forward handle on the right, every sign and plaque unmirrored, through
// the game's own camera); its stones and plaques solid, a handle turned from the stone's face alone; every glow of the
// Hour its own light; the walk laid from island to island over neither; the sign clear of the dial; the kerbs, the lips
// and the walk's underside turned out; the aurorae whole round; no blood on a surface that moves; the Hour's sets making
// nothing a frame; the hall and the arena posed before the world pass, and a hidden draw no draw; no pow of a negative;
// the lamps under the Hour's lights; the clock-face round on the sky and no shard ever over it; the hall's word forgotten
// out of the realm; the Warp's breath seen; and the void's cast-back to the span the body last stood in (AUDIT SD II L4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { glslFunctions } from './glsl.mjs';
import { lookAt, perspective, mirrorProjectionX, multiply, identity, transformPoint } from '../src/world/mat4.js';
import { SD_REALM_ORIGIN, SD_THRESHOLD, SD_WALK, SD_ORRERY, SD_ARENA, SD_STONE_POS, realmToDungeon, dungeonToRealm, inOrreryHall, SD_FRAY_LASH } from '../src/net/sdBrain.js';
import {
  buildRealmModel, realmColliderTris, realmLights, realmLampFeet, realmLampTris, realmLighting, realmLightsNear, realmLightsWith, SD_LIGHTS_CAP, walkNearZ, walkFarZ,
  SD_REALM_FLOOR_RECORD, SD_REALM_BRASS_RECORD, SD_REALM_ROOT_RECORD, SD_REALM_DIAL_RECORD, SD_ISLAND_SIDES, SD_RIM_W, SD_RIM_H,
  SD_KERB_W, SD_KERB_H, SD_LAMP_H, SD_LAMP_HEAD, SD_LAMP_POST_W,
} from '../src/world/sdRealm.js';
import { withCourtLights } from '../src/world/gateArena.js';
import {
  stoneFrame, stonePoint, plaqueFrame, handleBox, handMatrix, beforeStone, buildHallModel, buildHandModel, hallSolidTris,
  SD_STONE_SIZE, SD_DIAL, SD_EMBLEM, SD_HAND, SD_PLAQUE,
} from '../src/world/sdHall.js';
import { SD_HALL_FACE_RECORD, SD_HALL_EMBLEM_RECORD, SD_HALL_PLAQUE_RECORD, SD_HALL_GLOW_RECORD } from '../src/world/sdHallArt.js';
import { createSdHall, ensureSdHallArt, sdStoneKey, SD_HALL_TEXT } from '../src/scenes/sdHall.js';
import { createSdSteps, ensureSdStepsArt, sdStepKey, SD_CHECKS_KEY } from '../src/scenes/sdSteps.js';
import { createSdRemnant, ensureSdRemnantArt } from '../src/scenes/sdRemnant.js';
import { SD_RIG_PARTS } from '../src/scenes/sdRemnantRig.js';   // SD17 (PIN MOVED): the bodies' parts
import { SD_HEARTS } from '../src/net/sdRemnant.js';
import { createSdEnd, SD_RIFT_KEY } from '../src/scenes/sdEnd.js';
import { SD_FIGHT_EMPTY } from '../src/net/sdFightLink.js';
import { sdAnyInFlight, sdBlowsInFlight } from '../src/scenes/sdRemnantBlows.js';
import { SD_STEPS_COURSE, SD_CHECKPOINTS, SD_COURSE_END, SD_GUST_EVERY, SD_GUST_WARN, SD_GUST_FOR, gustAt, breathSeen, spanAt } from '../src/world/sdSteps.js';
import { SD_BREATH, stepTris } from '../src/world/sdStepsModel.js';
import { SD_SKY_FS, SD_SKY_SHARDS, SD_SHARD_TOP, SD_CLOCK_FACE, SD_CLOCK_RING_W, SD_CLOCK_TOP, SD_SKY_PERIOD, CLOCK_BASIS, sdSkyBasisInto } from '../src/render/sdSky.js';
import { skyBasis, DEAD_NOISE_GLSL } from '../src/render/deadlands.js';
import { AURA_FS } from '../src/render/auraRing.js';
import { SHADOW_POINT_NEAR } from '../src/render/shadowPass.js';
import { createBloodMarks, onMover } from '../src/combat/bloodMarks.js';
import { Collider } from '../src/player/collider.js';
import { GRAVITY, runSpeed } from '../src/player/motor.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => a.length === b.length && [...a].every((v, i) => Math.abs(v - b[i]) < e);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const TAU = Math.PI * 2;
/** A realm second of the anchored clock's size, on a whole Beat cycle and a whole pair of gusts. */
const T0 = 1_800_000_000 - (1_800_000_000 % 36);
const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
/** A fake renderer: meshes made and freed, uploads recorded with their options. */
const fakeRenderer = () => {
  const r = { made: [], emission: [], albedo: [] };
  r.createMesh = (m) => { const g = { m }; r.made.push(g); return g; };
  r.destroyMesh = () => {};
  r.uploadTexture = (a, rec) => r.albedo.push([a, rec]);
  r.uploadEmissionTexture = (a, rec, c32, opts) => r.emission.push([a, rec, opts ?? null]);
  return r;
};
/** A mesh's triangles: `[[p0, p1, p2], [uv0, uv1, uv2], record]` each, positions in the dungeon's frame. */
function trisOf(model, keep = () => true) {
  const out = [];
  for (const sm of model.subMeshes) {
    for (let k = sm.startIndex; k < sm.startIndex + sm.primitiveCount * 3; k += 3) {
      const P = [0, 1, 2].map((j) => [model.positions[(k + j) * 3], model.positions[(k + j) * 3 + 1], model.positions[(k + j) * 3 + 2]]);
      const U = [0, 1, 2].map((j) => [model.uvs[(k + j) * 2], model.uvs[(k + j) * 2 + 1]]);
      if (keep(sm.textureRecord, P)) out.push([P, U, sm.textureRecord]);
    }
  }
  return out;
}
/** THE GAME'S OWN CAMERA (scenes/worldModes.js, the modal arms' frame): an eye at `eye` looking along `yaw` - its look
 *  (sin yaw, 0, cos yaw), lookAt to eye + look, and world/mat4.js's ONE mirror on its lens. A point to the screen's NDC
 *  (x right, y up), and its right as the game's own camRight (cos yaw, 0, -sin yaw). */
function gameCamera(eye, yaw) {
  const look = [Math.sin(yaw), 0, Math.cos(yaw)];
  const vp = multiply(mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.05, 500)), lookAt(eye, [eye[0] + look[0], eye[1] + look[1], eye[2] + look[2]], [0, 1, 0]));
  const S = (p) => { const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]; return [(vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w, (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w]; };
  return { S, camRight: [Math.cos(yaw), 0, -Math.sin(yaw)] };
}
/** A triangle as the screen holds it: its signed area (NDC, y up - the renderer's frontFace(CW) draws it when NEGATIVE)
 *  and how its texture runs across it (du/dx > 0: u left to right; dv/dy > 0: v bottom to top). */
function onScreen(S, [P, U]) {
  const [a, b, c] = P.map(S);
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  const dudx = ((U[1][0] - U[0][0]) * (c[1] - a[1]) - (U[2][0] - U[0][0]) * (b[1] - a[1])) / det;
  const dvdy = ((b[0] - a[0]) * (U[2][1] - U[0][1]) - (c[0] - a[0]) * (U[1][1] - U[0][1])) / det;
  return { area: det, dudx, dvdy };
}

// ── L2 F1: the hall as the eye sees it ─────────────────────────────────

test('AUDIT SD II L2 F1: THE ORRERY\'S HALL AS THE EYE SEES IT, through the game\'s own camera (mat4\'s lookAt and its one mirror): a stone\'s right is the screen\'s right; its hand stands at twelve straight up, its third hour at three o\'clock, and turns clockwise; the forward handle - "Turn it forward" - on the right; its dial, its sign, every plaque read unmirrored, u left to right and v up, and every one of them - and the hand at every hour, the notch over its twelfth, the fronts of its cap and handles - turned toward the eye (mutants: the right the left; the hand\'s turn a mirror; a sign wound away; a plaque mirrored; the notch wound away)', () => {
  assert.match(read('src/render/renderer.js'), /gl\.frontFace\(gl\.CW\);/, 'the renderer draws a face wound clockwise on the screen');
  const hall = buildHallModel(), hand = buildHandModel();
  const handTris = trisOf(hand);
  const r = fakeRenderer(), set = createSdHall({ renderer: r, s: 1 });
  set.stand({ dynamicDraws: [], collider: null });
  for (let i = 0; i < SD_STONE_POS.length; i++) {
    const { n, R } = stoneFrame(i);
    const dial = realmToDungeon(...stonePoint(i, 0, SD_DIAL.y, 0));
    const eye = [dial[0] + n[0] * 2.5, dial[1], dial[2] + n[2] * 2.5];
    const { S, camRight } = gameCamera(eye, Math.atan2(-n[0], -n[2]));
    assert.ok(near(camRight, R), `stone ${i}: R is the camera's own right`);
    const c = S(dial);
    assert.ok(S([dial[0] + R[0], dial[1], dial[2] + R[2]])[0] > c[0] + 0.1, 'and the screen\'s right');
    const tip = (h) => S(transformPoint(handMatrix(i, h), 0, SD_HAND.len, 0));
    const [t12, t3, t6, t9] = [0, 3, 6, 9].map(tip);
    assert.ok(t12[1] > c[1] + 0.05 && Math.abs(t12[0] - c[0]) < 1e-6, 'twelve straight up');
    assert.ok(t3[0] > c[0] + 0.05 && Math.abs(t3[1] - c[1]) < 1e-6, 'three at three o\'clock - to the right');
    assert.ok(t6[1] < c[1] - 0.05 && t9[0] < c[0] - 0.05, 'six down, nine left');
    let turned = 0;
    for (let h = 0; h < 12; h += 0.5) {
      const a = tip(h), b = tip(h + 0.5);
      const d = Math.atan2(b[1] - c[1], b[0] - c[0]) - Math.atan2(a[1] - c[1], a[0] - c[0]);
      turned += Math.atan2(Math.sin(d), Math.cos(d));
    }
    assert.ok(Math.abs(turned + TAU) < 1e-6, `clockwise on the screen, a whole turn (${turned.toFixed(4)})`);
    for (const h of [0, 3, 7.5, 10.25]) {
      const M = handMatrix(i, h);
      for (const [P, U] of handTris) assert.ok(onScreen(S, [P.map((p) => transformPoint(M, ...p)), U]).area < 0, `the hand at ${h}: toward the eye, drawn`);
    }
    // the handles: the forward on the right, and the ray's key that names it says so
    const mid = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    assert.ok(S(mid(handleBox(i, 1)))[0] > c[0] + 0.1 && S(mid(handleBox(i, -1)))[0] < c[0] - 0.1, 'forward on the right, back on the left');
    const fwd = set.targets().find((t) => t.key === sdStoneKey(i, 1));
    assert.deepEqual(fwd.aabb, handleBox(i, 1));
    assert.equal(set.hoverName(fwd.key).subs[1], SD_HALL_TEXT.forward);
    // every face standing before the stone's face, across the eye's look - the dial, the notch, the sign, the cap's and
    // the handles' fronts - looks toward the eye and is drawn
    const foot = realmToDungeon(...stoneFrame(i).at), ahead = (p) => (p[0] - foot[0]) * n[0] + (p[2] - foot[2]) * n[2];
    const before = trisOf(hall, (record, P) => P.every((p) => Math.hypot(p[0] - dial[0], p[2] - dial[2]) < SD_STONE_SIZE.w && ahead(p) > SD_STONE_SIZE.d / 2 + 0.004)).filter(([P]) => { const nn = cross(sub(P[1], P[0]), sub(P[2], P[0])), l = Math.hypot(...nn); return l > 1e-9 && Math.abs(dot(nn, n)) / l > 0.9; });
    assert.ok(before.length >= 11, `stone ${i}: its faces before it (${before.length})`);
    for (const t of before) assert.ok(dot(cross(sub(t[0][1], t[0][0]), sub(t[0][2], t[0][0])), n) > 0 && onScreen(S, t).area < 0, `stone ${i}: a face of record ${t[2]} toward the eye, drawn`);
    // its dial and its sign: toward the eye, their pictures unmirrored
    const mine = (rec) => (record, P) => record === rec && P.every((p) => Math.hypot(p[0] - dial[0], p[2] - dial[2]) < SD_STONE_SIZE.w);
    for (const rec of [SD_HALL_FACE_RECORD, SD_HALL_EMBLEM_RECORD + i]) {
      const tris = trisOf(hall, mine(rec));
      assert.ok(tris.length >= 2, `record ${rec} on stone ${i}`);
      for (const t of tris) {
        const o = onScreen(S, t);
        assert.ok(o.area < 0, `record ${rec}: toward the eye, drawn`);
        assert.ok(o.dudx > 0 && o.dvdy > 0, `record ${rec}: its picture read left to right and upright (du/dx ${o.dudx.toFixed(3)}, dv/dy ${o.dvdy.toFixed(3)})`);
      }
    }
  }
  for (let k = 0; k < SD_PLAQUE.bearings.length; k++) {
    const { at, n } = plaqueFrame(k);
    const face = realmToDungeon(at[0] + n[0] * 0.09, SD_PLAQUE.post + SD_PLAQUE.h / 2, at[2] + n[2] * 0.09);
    const { S } = gameCamera([face[0] + n[0] * 2.5, face[1], face[2] + n[2] * 2.5], Math.atan2(-n[0], -n[2]));
    const tris = trisOf(hall, (record) => record === SD_HALL_PLAQUE_RECORD + k);
    assert.equal(tris.length, 2);
    for (const t of tris) { const o = onScreen(S, t); assert.ok(o.area < 0 && o.dudx > 0 && o.dvdy > 0, `plaque ${k}: toward the eye, unmirrored`); }
  }
});

// ── L2 F2: the stones stand ─────────────────────────────────────────────

test('AUDIT SD II L2 F2: THE STONES AND THE PLAQUES STAND - the hall stands each stone\'s slab, cap and handles and each plaque\'s post and tablet on the collider, from the corners its draw is made of: a body walked at a stone stops at its face (or its back), a chest-high ray meets the slab, a body walked at a plaque stops; and a handle turns its stone from before its face alone - behind it, though the handle\'s box can still be won past the slab\'s edge, it says so and sends nothing (mutants: the solids left off; the press from behind)', () => {
  const col = new Collider(() => -Infinity);
  const tris = realmColliderTris(), idx = new Uint32Array(tris.length / 3);
  for (let k = 0; k < idx.length; k++) idx[k] = k;
  col.addMesh('sd:realm', tris, idx, identity());
  const sent = [], said = [];
  const set = createSdHall({ renderer: fakeRenderer(), s: 1, now: () => 10_000, onTurn: (i, a) => { sent.push([i, a]); return true; }, say: (t) => said.push(t) });
  set.stand({ dynamicDraws: [], collider: col });
  const walk = (from, dir, metres) => { const feet = [...from]; for (let k = 0; k < metres * 10; k++) col.move(feet, dir[0] * 0.1, 0, dir[2] * 0.1); return Math.hypot(feet[0] - from[0], feet[2] - from[2]); };
  const { d } = SD_STONE_SIZE;
  for (let i = 0; i < SD_STONE_POS.length; i++) {
    const { at, n } = stoneFrame(i);
    const front = realmToDungeon(at[0] + n[0] * 2, 0, at[2] + n[2] * 2), back = realmToDungeon(at[0] - n[0] * 2, 0, at[2] - n[2] * 2);
    const went = walk(front, [-n[0], 0, -n[2]], 4);
    assert.ok(went < 2 - d / 2 && went > 2 - d / 2 - 0.6, `stone ${i}: stopped at its face (${went.toFixed(2)} m of 4)`);
    assert.ok(walk(back, n, 4) < 2 - d / 2, 'and at its back');
    const ray = col.raycast(realmToDungeon(at[0] + n[0] * 2, 1.2, at[2] + n[2] * 2), [-n[0], 0, -n[2]], 4);
    assert.ok(Math.abs(ray - (2 - d / 2)) < 1e-3, `a chest-high ray meets its face (${ray})`);
  }
  for (let k = 0; k < SD_PLAQUE.bearings.length; k++) {
    const { at, n } = plaqueFrame(k);
    assert.ok(walk(realmToDungeon(at[0] + n[0] * 2.5, 0, at[2] + n[2] * 2.5), [-n[0], 0, -n[2]], 4) < 2.5, `plaque ${k}: a body stops at it`);
  }
  assert.equal(hallSolidTris().length / 9, SD_STONE_POS.length * 4 * 5 * 2 + SD_PLAQUE.bearings.length * 6 * 2, 'a stone\'s four boxes (its slab, its cap, its handles) and a plaque\'s post and tablet, two triangles a face');
  // the press: before its face, never behind it
  const i = 2, { at, n, R } = stoneFrame(i);
  const behind = [at[0] - n[0] * 1.2 + R[0] * 1.4, 0, at[2] - n[2] * 1.2 + R[2] * 1.4];
  assert.ok(Math.hypot(behind[0] - at[0], behind[2] - at[2]) < 3, 'within the realm\'s reach');
  assert.equal(beforeStone(i, behind[0], behind[2]), false);
  set.frame(0.016, realmToDungeon(...behind), null);
  assert.equal(set.press(sdStoneKey(i, 1)), true);
  assert.deepEqual([sent, said], [[], [SD_HALL_TEXT.front]], 'from behind it: said, never sent');
  const before = [at[0] + n[0] * 1.2, 0, at[2] + n[2] * 1.2];
  assert.equal(beforeStone(i, before[0], before[2]), true);
  set.frame(0.016, realmToDungeon(...before), null);
  set.press(sdStoneKey(i, 1));
  assert.deepEqual(sent, [[i, 1]], 'before its face: sent');
  assert.equal(beforeStone(i, at[0] + n[0] * (d / 2 - 0.01), at[2] + n[2] * (d / 2 - 0.01)), false, 'inside its own face is not before it');
});

// ── L2 F3: the Hour's own light ─────────────────────────────────────────

test('AUDIT SD II L2 F3: THE HOUR\'S GLOWS ARE THEIR OWN LIGHT - every emission the arc\'s art uploads (the realm\'s, the hall\'s, the Steps\', the Echoes\') goes up `white`, as the Rift\'s does: an emission without it is a window mask, and the dungeon arm tints every window by DFU\'s day colour - every glow in the Hour burned at (0.175, 0.302, 0.349) of itself (mutants: each upload a window\'s)', () => {
  for (const [what, upload] of [['the hall', ensureSdHallArt], ['the Steps', ensureSdStepsArt], ['the Echoes', ensureSdRemnantArt]]) {
    const r = fakeRenderer();
    upload(r);
    assert.ok(r.emission.length >= 2 && r.emission.length === r.albedo.length, `${what}: a light for every picture`);
    for (const [, rec, opts] of r.emission) assert.equal(opts?.white, true, `${what}: record ${rec} its own light`);
  }
  assert.match(read('src/scenes/worldModes.js'), /for \(const \[rec, art\] of realmArt\(\)\) \{ renderer\.uploadTexture\?\.\(SD_REALM_ARCHIVE, rec, art\.albedo\); renderer\.uploadEmissionTexture\?\.\(SD_REALM_ARCHIVE, rec, art\.emission, \{ white: true \}\); \}/, 'the realm\'s own five');
  // the renderer's own law, which the four now take: a white emission wears no window's colour
  const R = read('src/render/renderer.js');
  assert.match(R, /if \(opts\.white\) this\.emissionWhite\.add\(key\);/);
  assert.match(R, /const emisColor = sm\._evEmisWhite \? EMISSION_WHITE : this\._windowEmission;/);
});

// ── L2 F4: the walk meets the islands ──────────────────────────────────

test('AUDIT SD II L2 F4: THE WALK RUNS FROM ISLAND TO ISLAND AND OVER NEITHER - its floor laid from the Threshold\'s edge to the Orrery\'s, each end following the island\'s own edge: every point of the walk\'s band under exactly one floor (it ran z 7-25 over the dial\'s own floor at the hall\'s mouth, in its plane - a 4 x 0.65 m patch that fought); the collider\'s walk unchanged (mutants: the walk to z 25; an end straight across)', () => {
  const m = buildRealmModel();
  const floors = trisOf(m, (rec, P) => (rec === SD_REALM_FLOOR_RECORD || rec === SD_REALM_DIAL_RECORD) && P.every((p) => Math.abs(p[1]) < 1e-6)).map(([P]) => P.map((p) => dungeonToRealm(...p)));
  const nearBand = floors.filter((P) => P.some((p) => Math.abs(p[0]) < 3 && p[2] > 5 && p[2] < 27) || P.some((p) => p[0] === 0 && (p[2] === 0 || p[2] === SD_ORRERY.z)));
  const s = (p, a, b) => (p[0] - b[0]) * (a[2] - b[2]) - (a[0] - b[0]) * (p[2] - b[2]);
  const inTri = (p, [a, b, c]) => { const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
  let samples = 0;
  for (let x = -SD_WALK.halfW + 0.0137; x < SD_WALK.halfW; x += 0.0731) {
    for (let z = SD_WALK.z0 + 0.0119; z < SD_WALK.z1; z += 0.0517) {
      const under = nearBand.filter((P) => inTri([x, 0, z], P)).length;
      assert.equal(under, 1, `(${x.toFixed(3)}, ${z.toFixed(3)}) under ${under} floors`);
      samples++;
    }
  }
  assert.ok(samples > 15000);
  // its ends are the islands' own edges, which bend where their corners stand
  for (const x of [-2, -1.5, 0, 0.7, 2]) {
    assert.ok(walkNearZ(x) > SD_WALK.z0 && walkNearZ(x) <= SD_THRESHOLD.z + SD_THRESHOLD.r + 1e-9, `the near end at ${x} on the Threshold's edge`);
    assert.ok(walkFarZ(x) >= SD_ORRERY.z - SD_ORRERY.r - 1e-9 && walkFarZ(x) < SD_WALK.z1, `the far end at ${x} on the Orrery's edge`);
  }
  assert.ok(Math.abs(walkFarZ(0) - (SD_ORRERY.z - SD_ORRERY.r)) < 1e-9 && walkFarZ(2) > walkFarZ(0) + 0.1, 'the hall\'s edge bends from its corner at the walk\'s middle');
  // the collider's walk is the band as it was: a body is held up from z 7 to 25
  const t = realmColliderTris(), col = new Collider(() => -Infinity), idx = new Uint32Array(t.length / 3);
  for (let k = 0; k < idx.length; k++) idx[k] = k;
  col.addMesh('sd:realm', t, idx, identity());
  for (const z of [7.2, 16, 24.6]) assert.ok(Math.abs(col.raycast(realmToDungeon(1.9, 1, z), [0, -1, 0], 3) - 1) < 1e-6, `the collider's floor at z ${z}`);
});

// ── L2 F5: the sign clear of the dial ──────────────────────────────────

test('AUDIT SD II L2 F5: EACH STONE\'S SIGN CLEAR OF ITS DIAL - the two a hair before the face stood over each other at its twelfth hour (y 1.92-2.05) and fought; the sign now between the dial\'s top and the cap (mutants: the sign back over the dial)', () => {
  const hall = buildHallModel();
  assert.ok(SD_EMBLEM.y - SD_EMBLEM.half > SD_DIAL.y + SD_DIAL.r && SD_EMBLEM.y + SD_EMBLEM.half <= SD_STONE_SIZE.h, 'by the numbers');
  for (let i = 0; i < SD_STONE_POS.length; i++) {
    const at = realmToDungeon(SD_STONE_POS[i].x, 0, SD_STONE_POS[i].z);
    const ys = (rec) => trisOf(hall, (r, P) => r === rec && P.every((p) => Math.hypot(p[0] - at[0], p[2] - at[2]) < SD_STONE_SIZE.w)).flatMap(([P]) => P.map((p) => p[1]));
    const dial = ys(SD_HALL_FACE_RECORD), sign = ys(SD_HALL_EMBLEM_RECORD + i);
    assert.ok(Math.max(...dial) < Math.min(...sign), `stone ${i}: the drawn dial (to ${Math.max(...dial).toFixed(3)}) under the drawn sign (from ${Math.min(...sign).toFixed(3)})`);
    assert.ok(Math.max(...sign) <= SD_STONE_SIZE.h + 1e-6, 'under the cap');
  }
});

// ── L2 F6: the kerbs, the lips, the underside ───────────────────────────

test('AUDIT SD II L2 F6: EVERY FACE TURNED OUT - both kerbs\' tops face up (the left faced down and was culled), each kerb a box of brass with its sides and ends; the walk\'s underside faces down (it faced up); every island\'s lip has its inner side, facing its floor (mutants: the left kerb wound down; the underside up; no lip inside)', () => {
  const m = buildRealmModel();
  const tris = trisOf(m).map(([P, , rec]) => ({ rec, P: P.map((p) => dungeonToRealm(...p)), n: cross(sub(P[1], P[0]), sub(P[2], P[0])) }));
  const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  for (const sd of [-1, 1]) {
    const xi = sd * (SD_WALK.halfW - SD_KERB_W), xo = sd * SD_WALK.halfW;
    const top = tris.filter((t) => t.rec === SD_REALM_BRASS_RECORD && t.P.every((p) => Math.abs(p[1] - SD_KERB_H) < 1e-6 && Math.abs(Math.abs(p[0]) - SD_WALK.halfW + SD_KERB_W / 2) <= SD_KERB_W / 2 + 1e-6 && Math.sign(p[0]) === sd && p[2] > 5 && p[2] < 27));
    assert.equal(top.length, 2, `kerb ${sd}: its top`);
    for (const t of top) assert.ok(unit(t.n)[1] > 0.99, `kerb ${sd}: its top faces up`);
    for (const [x, out] of [[xi, -sd], [xo, sd]]) {
      const side = tris.filter((t) => t.rec === SD_REALM_BRASS_RECORD && t.P.every((p) => Math.abs(p[0] - x) < 1e-6 && p[1] >= -1e-6 && p[1] <= SD_KERB_H + 1e-6 && p[2] > 5 && p[2] < 27));
      assert.equal(side.length, 2, `kerb ${sd}: its side at ${x}`);
      for (const t of side) assert.ok(unit(t.n)[0] * out > 0.99, `kerb ${sd}: its side at ${x} faces out`);
    }
    const ends = tris.filter((t) => t.rec === SD_REALM_BRASS_RECORD && t.P.every((p) => Math.abs(p[0]) >= SD_WALK.halfW - SD_KERB_W - 1e-6 && Math.abs(p[0]) <= SD_WALK.halfW + 1e-6 && Math.sign(p[0]) === sd && p[1] <= SD_KERB_H + 1e-6) && t.P.some((p) => p[1] > 0.1) && t.P.some((p) => p[1] < 1e-6) && Math.abs(unit(t.n)[2]) > 0.9);
    assert.equal(ends.length, 4, `kerb ${sd}: its two ends`);
    for (const t of ends) assert.ok(unit(t.n)[2] * (t.P[0][2] < 16 ? -1 : 1) > 0.9, 'each end facing its island');
  }
  const under = tris.filter((t) => t.rec === SD_REALM_ROOT_RECORD && t.P.every((p) => Math.abs(p[1] + 0.8) < 1e-6));
  assert.equal(under.length, 2, 'the walk\'s underside');
  for (const t of under) assert.ok(unit(t.n)[1] < -0.99, 'facing down');
  for (const { x: cx, z: cz, r } of [SD_THRESHOLD, SD_ORRERY, SD_ARENA]) {
    const ri = r - SD_RIM_W;
    const inner = tris.filter((t) => t.rec === SD_REALM_BRASS_RECORD && t.P.every((p) => Math.abs(Math.hypot(p[0] - cx, p[2] - cz) - ri) < 1e-3 && p[1] >= -1e-6 && p[1] <= SD_RIM_H + 1e-6) && t.P.some((p) => p[1] > SD_RIM_H / 2) && t.P.some((p) => p[1] < SD_RIM_H / 2));
    assert.equal(inner.length, SD_ISLAND_SIDES * 2, `the lip of the island at z ${cz}: its inner side all round`);
    for (const t of inner) { const c = t.P.reduce((a, p) => [a[0] + p[0] / 3, 0, a[2] + p[2] / 3], [0, 0, 0]); assert.ok(dot(unit(t.n), [cx - c[0], 0, cz - c[2]]) > 0, 'facing its floor'); }
  }
});

// ── L2 F7, F12, F15: the Hour's sky ─────────────────────────────────────

/** The sky's own functions, run (test/glsl.mjs) - every pow answered NaN for a negative base, as D3D's does (GLSL ES
 *  leaves it undefined). */
const skyRun = (t = 100) => glslFunctions(SD_SKY_FS.replace(/\bpow\(/g, 'spow(').replace('precision highp float;\n', 'precision highp float;\nfloat spow(float x, float y) { return x < 0.0 ? 0.0 / 0.0 : pow(x, y); }\n'), { uTime: t, uHaze: [0.2, 0.15, 0.07], uGain: 1, vRay: [0, 0.5, 1] });

test('AUDIT SD II L2 F7: THE AURORAE WHOLE ROUND - their curtain\'s noise read round a circle, as the Deadlands\' ridges are: either side of the azimuth\'s leap from PI to -PI (toward -z) the curtain is one, at every height of the band and every drift - it read the raw azimuth and was cut there by a hard seam (mutants: the raw azimuth)', () => {
  const f = skyRun();
  assert.match(SD_SKY_FS, /float curtain = auroraCurtain\(az, e, drift\);/, 'the sky\'s curtain is this one');
  assert.ok(SD_SKY_FS.includes(DEAD_NOISE_GLSL), 'on the Deadlands\' noise');
  let worst = 0, lo = Infinity, hi = -Infinity;
  for (const e of [0.35, 0.5, 0.7, 0.9, 1.1]) {
    for (const drift of [0, 1.3, 2.6, 4.4]) {
      worst = Math.max(worst, Math.abs(f.auroraCurtain(Math.PI - 1e-7, e, drift) - f.auroraCurtain(-Math.PI + 1e-7, e, drift)));
      for (let a = -Math.PI; a < Math.PI; a += 0.1) { const c = f.auroraCurtain(a, e, drift); lo = Math.min(lo, c); hi = Math.max(hi, c); }
    }
  }
  assert.ok(worst < 1e-4, `no seam (${worst})`);
  assert.ok(hi - lo > 1.5, 'and a curtain that moves round the sky');
});

test('AUDIT SD II L2 F12: NO POW OF A NEGATIVE in the arc\'s shaders - Wayrest\'s arches squared (pow(2.0 * cell - 1.0, 2.0) was negative over half of every span: undefined in GLSL ES, NaN on D3D), and the Turning Hour\'s gleam on a base kept off the negative (a cos a hair under -1): the sky\'s skylines run with D3D\'s pow are numbers everywhere (mutants: the arch a pow; the gleam unguarded)', () => {
  assert.doesNotMatch(SD_SKY_FS, /\bpow\(/, 'the sky takes no pow at all');
  const f = skyRun();
  for (let u = -1; u <= 1; u += 0.01) for (let v = -0.05; v < 1; v += 0.05) for (const k of [0, 1, 2]) assert.ok(Number.isFinite(f[`skyline${k}`](u, v)), `skyline${k}(${u.toFixed(2)}, ${v.toFixed(2)})`);
  const turning = AURA_FS.slice(AURA_FS.indexOf('vec3 turningGround('), AURA_FS.indexOf('vec3 turningWall('));
  const bases = [...turning.matchAll(/\bpow\(/g)].map((m) => turning.slice(m.index + 4, m.index + 8));
  assert.ok(bases.length >= 1 && bases.every((b) => b === 'max('), `every pow of the Turning Hour's ground on a base kept off the negative (${bases})`);
});

test('AUDIT SD II L2 F15: THE CLOCK-FACE ROUND ON THE SKY, AND NO SHARD EVER OVER IT - its frame read on the sphere (laid out in raw azimuth and elevation it stood 7% narrower than tall), its twelfth up and its third to the arena\'s right; and over the whole of the sky\'s period, every shard - turning a whole sky a period - hangs clear of the face\'s every drawn point (Daggerfall\'s spires crossed its ring\'s top arc twenty seconds in every twelve minutes) (mutants: the face in raw azimuth; the shards hung low)', () => {
  const f = skyRun();
  const B = CLOCK_BASIS, R = SD_CLOCK_FACE.r;
  const along = (th, ang) => { const a = [0, 1, 2].map((j) => Math.cos(th) * B.up[j] + Math.sin(th) * B.right[j]); return [0, 1, 2].map((j) => B.centre[j] * Math.cos(ang) + a[j] * Math.sin(ang)); };
  for (let k = 0; k < 24; k++) { const p = f.clockFaceAt(along((k / 24) * TAU, R)); assert.ok(Math.abs(Math.hypot(p[0], p[1]) - 1) < 1e-4, `round: ${k}/24 of the way round, ${Math.hypot(p[0], p[1]).toFixed(5)}`); }
  const twelve = f.clockFaceAt(along(0, R)), three = f.clockFaceAt(along(Math.PI / 2, R));
  assert.ok(near(twelve, [0, 1], 1e-4) && near(three, [1, 0], 1e-4), 'the twelfth up, the third to the right');
  assert.ok(near(B.right, [Math.cos(SD_CLOCK_FACE.az), 0, -Math.sin(SD_CLOCK_FACE.az)]) && B.up[1] > 0.9, 'its right the growing azimuth (the screen\'s right toward +z), its up toward the zenith');
  assert.match(SD_SKY_FS, /vec2 p = clockFaceAt\(d\);/, 'the face drawn in it');
  // the shards over the whole period: their every drawn point (the shader's box: |du| < 1, -0.05 < dv < 1) against the
  // face's every drawn point (the ring's outer edge, 1 + SD_CLOCK_RING_W radii) - in the face's own frame, the shader's
  const faceR = (az, e) => { const d = [Math.cos(e) * Math.sin(az), Math.sin(e), Math.cos(e) * Math.cos(az)]; return Math.acos(Math.max(-1, Math.min(1, dot(d, B.centre)))) / R; };
  assert.ok(Math.abs(faceR(...[0.2, 0.5]) - Math.hypot(...f.clockFaceAt([Math.cos(0.5) * Math.sin(0.2), Math.sin(0.5), Math.cos(0.5) * Math.cos(0.2)]))) < 1e-4, 'the shader\'s own frame');
  let nearest = Infinity;
  for (let t = 0; t < SD_SKY_PERIOD; t += 0.5) {
    for (const s of SD_SKY_SHARDS) {
      const c = s.az + (s.turns * TAU * t) / SD_SKY_PERIOD;
      for (let du = -1; du <= 1; du += 0.1) for (let dv = -0.05; dv < 1; dv += 0.05) nearest = Math.min(nearest, faceR(c + du * s.halfW, SD_SHARD_TOP - dv * s.depth));
    }
  }
  assert.ok(nearest > 1 + SD_CLOCK_RING_W, `no shard's point ever on the face (the nearest at ${nearest.toFixed(3)} radii)`);
  assert.ok(SD_SHARD_TOP - Math.max(...SD_SKY_SHARDS.map((s) => s.depth)) > SD_CLOCK_TOP && SD_SHARD_TOP + 0.05 * Math.max(...SD_SKY_SHARDS.map((s) => s.depth)) < Math.PI / 2, 'every shard between the face\'s top and the zenith');
});

// ── L2 F8: no mark on what moves ────────────────────────────────────────

test('AUDIT SD II L2 F8: NO BLOOD ON A SURFACE THAT MOVES - a drip over a mover\'s bucket (the collider carries its transform: the Shattered Hour\'s steps, a deck) lays nothing, where the same drip over a still floor lays its drops; nor a corpse\'s pool, nor a print; a drop thrown at a mover\'s side stains nothing - a mark is laid in the world\'s frame and was left hanging in the void as the step moved on (mutants: the floor\'s mark on a mover; the wall\'s; the pool\'s; the print\'s)', () => {
  const col = new Collider(() => -Infinity);
  const place = [10, 0, 10];
  const { positions, indices } = stepTris('drift');
  col.addMesh('sd:step:0', positions, indices, identity(), () => place);
  col.addMesh('still', [-4, 0, -4, 4, 0, -4, 4, 0, 4, -4, 0, 4], [0, 1, 2, 0, 2, 3], identity());
  assert.ok(onMover(col, col.surfaceHit([10, 1, 10], [0, -1, 0], 2)), 'the step moves');
  assert.ok(!onMover(col, col.surfaceHit([0, 1, 0], [0, -1, 0], 2)), 'the floor is still');
  assert.ok(!onMover(col, { dist: 1, key: null }) && !onMover({}, { dist: 1, key: 'x' }), 'the ground, and a collider that cannot tell');
  const rig = () => {
    const renderer = { createDecalBatch: (capacity) => ({ capacity }), writeDecalSlot: () => true, drawDecals: () => {}, createBillboardBatch: () => ({}), moveBillboardBatch: () => true, destroyBillboardBatch: () => {} };
    const marks = createBloodMarks({ renderer, collider: () => col, settings: { enabled: () => true, capacity: () => 64, density: () => 1, overkill: () => false }, texture: () => 'blood', rng: () => 0.5 });
    marks.useArt(380, 1, 6);
    return marks;
  };
  const still = rig();
  assert.ok(still.drip(0, [0, 0, 0], 3) && still.count() === 3, 'a drip on the still floor: its drops');
  assert.ok(still.spreadPool(0, [1, 0, 1]), 'and a corpse\'s pool');
  const moving = rig();
  assert.equal(moving.drip(0, [10, 0, 10], 3), null);
  assert.equal(moving.spreadPool(0, [10, 0, 10]), null);
  assert.equal(moving.count(), 0, 'on the step: nothing');
  // a print: the walker carries blood off a wet mark on the floor, and lays none on the step
  const walker = {};
  const floor = rig();
  floor.drip(0, [0, 0, 0], 3);
  floor.step(walker, floor._pool().decals()[0].pos, [1, 0, 0]);
  assert.ok(floor.tracked(walker) > 0, 'blood on the boots');
  const before = floor.count();
  assert.equal(floor.step(walker, [10, 0, 10], [1, 0, 0]), null);
  assert.equal(floor.count(), before, 'no print on the step');
  assert.ok(floor.step(walker, [2, 0, 2], [1, 0, 0]), 'and one on the floor beyond it');
  // a drop thrown sideways at the step's side: it meets the mover, and stains nothing
  const wall = rig();
  place[1] = 1.4;   // the step's top over the drops, its side across their way
  wall.place(0, [10, 1, 7], { damage: 40, maxHealth: 40, throw: [0, 4] });
  assert.equal(wall.count(), 0, 'the step took every drop that met it - and kept none');
  place[1] = 0;
  const thrown = rig();
  col.addMesh('still-wall', [9, 0, 8.8, 11, 0, 8.8, 11, 3, 8.8, 9, 3, 8.8], [0, 1, 2, 0, 2, 3], identity());
  place[0] = 40;   // the step away; a still wall where its side stood
  thrown.place(0, [10, 1, 7], { damage: 40, maxHealth: 40, throw: [0, 4] });
  assert.ok(thrown._pool().decals().some((d) => d.normal[2] < -0.9), 'a still wall in the same place takes its stain');
});

// ── L2 F9: a frame makes nothing ────────────────────────────────────────

test('AUDIT SD II L2 F9: THE HOUR\'S FRAME MAKES NOTHING - measured in a child with a 64 MB young space (the least of six windows, so a compile is never counted), every hot path of the arc\'s own code a frame: the hall (its frame with the realm\'s word, its targets twice, as the hover pick asks), the Steps\' ride (every step posed, a Crumble step underfoot, the breath, the void asked), the Remnant\'s frame with no fight, the End\'s frame and its lists, the arm\'s Hour lines (realmLighting, realmLightsWith), the sky\'s basis, the blows\' frame with no fight - none past 2 bytes a frame, against a control of three numbers into a fresh list a frame, which must show (they made 0.5 to 18 KB a frame) (mutants: each scratch given up for a fresh one)', () => {
  const url = (p) => JSON.stringify(pathToFileURL(join(ROOT, p)).href);
  const script = `
    const { createSdHall } = await import(${url('src/scenes/sdHall.js')});
    const { createSdSteps } = await import(${url('src/scenes/sdSteps.js')});
    const { createSdRemnant } = await import(${url('src/scenes/sdRemnant.js')});
    const { createSdEnd } = await import(${url('src/scenes/sdEnd.js')});
    const { createSdRemnantBlows } = await import(${url('src/scenes/sdRemnantBlows.js')});
    const { realmLighting, realmLightsWith } = await import(${url('src/world/sdRealm.js')});
    const { SD_STEPS_COURSE } = await import(${url('src/world/sdSteps.js')});
    const { sdSkyBasisInto } = await import(${url('src/render/sdSky.js')});
    const { realmToDungeon } = await import(${url('src/net/sdBrain.js')});
    const { SD_FIGHT_EMPTY } = await import(${url('src/net/sdFightLink.js')});
    const { Collider } = await import(${url('src/player/collider.js')});
    const renderer = { createMesh: () => ({}), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} };
    // the realm's clock as the host hands it: numbers already made (a call's own argument makes none of its own)
    const clock = Array.from({ length: 4096 }, (_, k) => ${T0} + k / 60); clock.push('tagged');
    let k = 0;
    const tick = () => clock[(k = (k + 1) & 4095)];
    const bytes = (fn) => {
      for (let f = 0; f < 20000; f++) fn();
      let least = Infinity;
      for (let w = 0; w < 6; w++) {
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 5000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
      }
      return least;
    };
    const feet = realmToDungeon(0, 0, 42), out = {}, sink = [];
    out.control = bytes(() => { sink[0] = [feet[0] + 0.5, feet[1] + 0.5, feet[2] + 0.5]; });
    const hall = createSdHall({ renderer, s: 1, now: () => 10000 });
    hall.stand({ dynamicDraws: [], collider: null });
    const word = { k: 'pz', s: 1, st: [3, 11, 5, 0, 7, 9], f: 4, lit: 2, ok: false };
    out.hall = bytes(() => { hall.frame(1 / 60, feet, word); hall.targets(); hall.targets(); });
    const steps = createSdSteps({ renderer });
    steps.stand({ dynamicDraws: [], collider: new Collider(() => -Infinity) });
    const c = SD_STEPS_COURSE.find((s) => s.kind === 'crumble');
    const body = { pos: realmToDungeon(0, c.y, c.z), grounded: true, groundKey: 'sd:step:' + c.i, jumping: false, height: 1.8, collider: { move() {} }, carryBy() {} };
    out.steps = bytes(() => steps.ride(tick(), 1 / 60, body, true));
    const rem = createSdRemnant({ renderer });
    rem.stand({ dynamicDraws: [] });
    out.remnant = bytes(() => rem.frame(1 / 60, feet));
    let ms = 0;
    const end = createSdEnd({ renderer, now: () => (ms += 16) });
    end.stand({ rift: { at: realmToDungeon(0, 0, -5), size: 5 }, retAt: realmToDungeon(0, 0, 230) });
    out.end = bytes(() => { end.frame(feet); end.targets(); end.batches(); });
    const lit = { data: Object.assign(new Float32Array(8), { carried: new Uint8Array(2) }), colors: new Float32Array(6) }, none = Object.freeze([]);
    out.hourLines = bytes(() => { realmLighting(); realmLightsWith(lit, none, feet); });
    const view = new Float32Array(16).fill(0.25), proj = new Float32Array(16).fill(0.5);
    const basis = { right: new Float32Array(3), up: new Float32Array(3), fwd: new Float32Array(3), lens: new Float32Array(4) };
    out.skyBasis = bytes(() => sdSkyBasisInto(view, proj, basis));
    const me = { health: 50, maxHealth: 100 };
    const blows = createSdRemnantBlows({ link: { state: () => SD_FIGHT_EMPTY, now: tick }, feet: () => feet, player: () => me });
    out.blows = bytes(() => blows.frame());
    console.log(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const m = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.ok(m.control >= 40, `the control made ${m.control.toFixed(2)} bytes a frame - the measure is blind`);
  for (const [path, b] of Object.entries(m)) if (path !== 'control') assert.ok(b < 2, `${path}: ${b.toFixed(2)} bytes a frame (the control ${m.control.toFixed(2)})`);
});

test('AUDIT SD II L2 F9: THE SAME LIGHTS AND THE SAME SKY, made in place - realmLightsWith is world/gateArena.js withCourtLights\' composition (the arm\'s own lights, then the spoils\', then the lamps nearest the eye: their places, ranges, colours and carried mask) whatever the counts, its arrays grown when a frame wants more and one set of views a count; the hall\'s and the End\'s lists one each; sdSkyBasisInto is render/deadlands.js skyBasis\'s reading, and the sky\'s pass reads it into its own; the blows\' driver idle exactly when no blow is in flight (mutants: the views made each frame; an Echo\'s blow or the Hour\'s never in flight)', () => {
  const litOf = (n) => {
    /** @type {Float32Array & { carried?: Uint8Array }} */
    const data = Float32Array.from({ length: n * 4 }, (_, i) => i * 0.5 + 1);
    data.carried = Uint8Array.from({ length: n }, (_, i) => i % 2);
    return { data, colors: Float32Array.from({ length: n * 3 }, (_, i) => i / 10) };
  };
  const spoil = (k) => ({ x: k, y: 2, z: -k, range: 5 + k, color: [0.1 * k, 0.2, 0.3] });
  for (const [n, e, eye] of [[0, 0, realmToDungeon(0, 0, 0)], [2, 0, realmToDungeon(0, 0, 220)], [3, 2, realmToDungeon(0, 0, 0)], [8, 30, realmToDungeon(0, 0, 42)], [1, 1, null], [2, 0, realmToDungeon(5, 0, 100)]]) {
    const lit = litOf(n), extra = Array.from({ length: e }, (_, k) => spoil(k)), rest = [...extra, ...realmLightsNear(eye)];
    // AUDIT SD III (V9, PIN MOVED): past the cap the spoils' and the lamps sorted in by how far the eye stands outside
    // each one's reach (stable) - at or under it, the court's own order
    const outside = (l) => { const dx = l.x - eye[0], dy = l.y - eye[1], dz = l.z - eye[2]; return Math.max(0, Math.sqrt(dx * dx + dy * dy + dz * dz) - l.range); };
    const order = eye && n + rest.length > SD_LIGHTS_CAP ? rest.map((l, i) => [outside(l), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, i]) => rest[i]) : rest;
    const want = withCourtLights(lit, order);
    const got = realmLightsWith(lit, extra, eye);
    assert.deepEqual([[...got.data], [...got.colors], [...got.carried]], [[...want.data], [...want.colors], [...want.carried]], `${n} of the arm's, ${e} spoils'`);
    assert.equal(got.data.carried, got.carried, 'the mask on the data, where the renderer lifts it');
  }
  assert.equal(realmLightsWith(litOf(2), [], realmToDungeon(0, 0, 0)), realmLightsWith(litOf(2), [], realmToDungeon(0, 0, 220)), 'one set of views a count');
  const hall = createSdHall({ renderer: fakeRenderer(), s: 1 });
  hall.stand({ dynamicDraws: [], collider: null });
  assert.ok(hall.targets() === hall.targets() && Object.isFrozen(hall.targets()) && hall.targets().length === SD_STONE_POS.length * 2 + SD_PLAQUE.bearings.length, 'the hall\'s boxes made at its stand');
  const end = createSdEnd({});
  end.stand({ rift: { at: [0, 0, 0], size: 5 }, retAt: [4, 0, 0] });
  assert.ok(end.targets() === end.targets() && end.targets().length === 2, 'the End\'s made as either stands');
  end.returnOut();
  assert.deepEqual(end.targets().map((t) => t.key), [SD_RIFT_KEY], 'and again as one goes');
  for (let k = 0; k < 4; k++) {
    const view = Float32Array.from({ length: 16 }, (_, i) => Math.sin(i * 1.7 + k)), proj = Float32Array.from({ length: 16 }, (_, i) => Math.cos(i * 0.9 + k));
    const into = { right: new Float32Array(3), up: new Float32Array(3), fwd: new Float32Array(3), lens: new Float32Array(4) };
    const want = skyBasis(view, proj), got = sdSkyBasisInto(view, proj, into);
    assert.equal(got, into);
    for (const key of ['right', 'up', 'fwd', 'lens']) assert.ok(near(got[key], Float32Array.from(want[key])), key);
  }
  assert.match(read('src/render/sdSky.js'), /const gl = this\.gl, U = this\.u, b = sdSkyBasisInto\(view, proj, this\._b\);/, 'the pass\'s frame reads it into its own');
  // the blows' driver idles only when sdBlowsInFlight would hand it nothing
  const atk = { i: 1, a: 1, at: 0 }, rem = { x: 0, z: 8, yw: 0, mv: null, atk: null }, ec = (a0, a1, h = 50) => [{ h, atk: a0 }, { h, atk: a1 }];
  for (const s of [SD_FIGHT_EMPTY, { ...SD_FIGHT_EMPTY, fi: 1 }, { ...SD_FIGHT_EMPTY, fi: 1, rem: { ...rem, atk } }, { ...SD_FIGHT_EMPTY, fi: 1, clk: atk },
    { ...SD_FIGHT_EMPTY, fi: 1, ec: ec(null, atk) }, { ...SD_FIGHT_EMPTY, fi: 1, ec: ec(atk, null, 0) }, { ...SD_FIGHT_EMPTY, fi: 1, ec: ec(null, null) },
    { ...SD_FIGHT_EMPTY, fi: 1, clk: atk, fell: { at: 1 } }, { ...SD_FIGHT_EMPTY, fi: 1, clk: atk, lost: 5 }, { ...SD_FIGHT_EMPTY, rem: { ...rem, atk } }, null]) {
    assert.equal(sdAnyInFlight(s), sdBlowsInFlight(s).length > 0, JSON.stringify(s));
  }
});

// ── L2 F10, F11: posed before the world pass; a hidden draw no draw ─────

test('AUDIT SD II L2 F10, F11: THE HOUR POSED BEFORE THE WORLD PASS, AND A HIDDEN DRAW NO DRAW - the mode machine\'s dungeon arm poses the hall and the arena (the dungeon host\'s sdPose) before the frame begins and before its draws, with no window up, as the Steps are ridden before the motor (in drawFoes, after the world pass, they were drawn a frame late); its draw loop skips a draw that says it is hidden, and so its shadow\'s record (drawMesh makes it); and the sets say so - a gone step, a body not shown, an Echo out of the Break, the hall\'s bridge before the Concord, the breath between gusts (mutants: posed after the draws; a hidden step drawn)', () => {
  const W = read('src/scenes/worldModes.js');
  const arm = W.slice(W.indexOf("if (mode === 'dungeon') {"), W.indexOf('// Whole-pipeline swap: interior draws'));
  const pose = arm.indexOf('if (isSdRealm(dungeonLoc) && !dungeonCtx.uiOverlayActive) dungeonCtx.sdPose?.(dt, player.pos);');
  const draws = arm.indexOf('for (const d of dungeonCtx.dynamicDraws) if (!d.hidden) renderer.drawMesh(d.gpu, d.object.matrix, dungeonCtx.texRemap);');
  assert.ok(pose > 0 && pose < arm.indexOf('renderer.beginFrame(') && pose < draws, 'posed before the frame and its draws');
  assert.ok(draws < arm.indexOf('dungeonCtx.drawFoes('), 'the draws before drawFoes');
  assert.match(read('src/render/renderer.js'), /if \(!wire && !noShadow && this\._casting\) this\._shadows\.recordMesh\(/, 'a drawMesh is what records a shadow');
  const D = read('src/scenes/dungeonContext.js');
  assert.deepEqual([D.match(/\bsdHallFrame\(dt, playerFeet\);/g)?.length, D.match(/\bsdRemnantFrame\(dt, playerFeet\);/g)?.length], [1, 1], 'framed in one place');
  assert.match(D, /sdPose\(dt, playerFeet\) \{\n\s+if \(sdHall\) sdHallFrame\(dt, playerFeet\);\n\s+if \(sdRemnant\) sdRemnantFrame\(dt, playerFeet\);\n\s+\},/);
  // the sets
  const steps = createSdSteps({ renderer: fakeRenderer() }), list = [];
  steps.stand({ dynamicDraws: list, collider: null });
  let hid = 0, shown = 0;
  for (let t = T0; t < T0 + 2 * SD_GUST_EVERY; t += 1 / 16) {
    steps.ride(t, 1 / 16, null, true);
    for (const d of list) {
      assert.equal(!!d.hidden, d.object.matrix.every((v) => v === 0), `the Steps at ${(t - T0).toFixed(3)}: a draw hidden exactly when it stands nowhere`);
      if (d.hidden) hid++; else shown++;
    }
  }
  assert.ok(hid > 0 && shown > 0, 'the Beat\'s gone steps and the breath between gusts hidden, the rest shown');
  const rem = createSdRemnant({ renderer: fakeRenderer() }), rl = [];
  rem.stand({ dynamicDraws: rl });
  rem.frame(1 / 60, realmToDungeon(0, 0, 42));
  // SD17 (PIN MOVED): the Remnant's own turned parts (after the Hearts) stand with it
  const H = 3 + SD_HEARTS[1], up = rl.map((d, i) => i === 0 || (i >= H && i < H + SD_RIG_PARTS.length));
  assert.deepEqual(rl.map((d) => !d.hidden), up, 'no fight: the Remnant stands, its Echoes, hearts and gears hidden');
  for (const [i, d] of rl.entries()) if (!up[i]) assert.ok(d.object.matrix.every((v) => v === 0));
  // a body shown, hidden and shown again where it stood: hidden says so, and it is drawn again (a still body keeps its
  // matrix - L2 F9 - but never a hidden one's nought)
  let S = { ...SD_FIGHT_EMPTY, fi: 1 };
  const L = { state: () => S, now: () => 5000, inDue: () => false, sentIn() {} };
  const fought = createSdRemnant({ renderer: fakeRenderer(), link: () => L }), fl = [];
  fought.stand({ dynamicDraws: fl });
  fought.frame(1 / 60, null);
  const standing = Float32Array.from(fl[0].object.matrix);
  assert.ok(fl[0].hidden === false && standing.some((v) => v !== 0), 'the Remnant in its fight');
  S = { ...S, ph: 2 };
  fought.frame(1 / 60, null);
  assert.ok(fl[0].hidden === true && fl[0].object.matrix.every((v) => v === 0), 'outside time: hidden, and says so');
  S = { ...S, ph: 1 };
  fought.frame(1 / 60, null);
  assert.deepEqual([fl[0].hidden, [...fl[0].object.matrix]], [false, [...standing]], 'back where it stood: drawn again');
});

// ── L2 F14: a lamp under every light ────────────────────────────────────

test('AUDIT SD II L2 F14: A LAMP UNDER EVERY LIGHT - each of the Hour\'s twenty lights hangs in a lamp the realm\'s mesh stands at its foot (they were pools of light from nowhere, 2.4 m over the rims): a brass post from the floor to under the light, a head of the hands\' brass glow round the light, inside its shadow\'s near plane on every side (it never shadows the light it holds), a brass cap; and the posts on the collider - a body walked at one stops at it, a chest-high ray meets it (mutants: no post; the head over its near plane; the posts off the collider)', () => {
  const m = buildRealmModel(), feet = realmLampFeet(), lights = realmLights();
  assert.equal(feet.length, 20);
  const tris = trisOf(m).map(([P, , rec]) => ({ rec, P: P.map((p) => dungeonToRealm(...p)) }));
  const e = 1e-4;   // the mesh's own float32s, some 250 m out
  const about = (f, w, y0, y1) => (t) => t.P.every((p) => Math.abs(p[0] - f[0]) <= w + e && Math.abs(p[2] - f[2]) <= w + e && p[1] >= y0 - e && p[1] <= y1 + e);
  for (let i = 0; i < feet.length; i++) {
    const f = feet[i], l = dungeonToRealm(lights[i].x, lights[i].y, lights[i].z);
    assert.ok(near(l, [f[0], SD_LAMP_H, f[2]], 1e-9), `light ${i} over its lamp's foot`);
    const post = tris.filter((t) => t.rec === SD_REALM_BRASS_RECORD && about(f, SD_LAMP_POST_W, 0, SD_LAMP_H - SD_LAMP_HEAD)(t));
    assert.equal(post.length, 10, `lamp ${i}: its post, four sides and a top`);
    assert.ok(post.some((t) => t.P.some((p) => Math.abs(p[1]) < e)) && post.some((t) => t.P.some((p) => Math.abs(p[1] - (SD_LAMP_H - SD_LAMP_HEAD)) < e)), 'from the floor to its head');
    const head = tris.filter((t) => t.rec === SD_HALL_GLOW_RECORD.brass && about(f, SD_LAMP_HEAD, SD_LAMP_H - SD_LAMP_HEAD, SD_LAMP_H + SD_LAMP_HEAD)(t));
    assert.equal(head.length, 10, `lamp ${i}: its head alight round its light`);
    assert.ok(tris.some((t) => t.rec === SD_REALM_BRASS_RECORD && about(f, SD_LAMP_HEAD, SD_LAMP_H + SD_LAMP_HEAD, SD_LAMP_H + SD_LAMP_HEAD + 0.05)(t) && t.P.every((p) => p[1] > SD_LAMP_H + SD_LAMP_HEAD + 1e-3)), 'its cap');
  }
  assert.ok(SD_LAMP_HEAD < SHADOW_POINT_NEAR, 'the head inside its light\'s near plane, every way: a cube face\'s near plane lies SHADOW_POINT_NEAR along its axis');
  const col = new Collider(() => -Infinity), t = realmColliderTris(), idx = new Uint32Array(t.length / 3);
  for (let k = 0; k < idx.length; k++) idx[k] = k;
  col.addMesh('sd:realm', t, idx, identity());
  for (const f of feet) {
    for (const way of [[1, 0, 0], [0, 0, -1]]) {   // at a face of its square, square on - 1.3 m asked, its face 1.45 m off
      const from = realmToDungeon(f[0] - way[0] * 1.5, 0, f[2] - way[2] * 1.5), at = [...from];
      for (let k = 0; k < 13; k++) col.move(at, way[0] * 0.1, 0, way[2] * 0.1);
      const went = (at[0] - from[0]) * way[0] + (at[2] - from[2]) * way[2];
      assert.ok(went < 1.5 - SD_LAMP_POST_W - 0.3 && went > 1.5 - SD_LAMP_POST_W - 0.6, `walked at the lamp at (${f[0].toFixed(1)}, ${f[2].toFixed(1)}): stopped at its post (${went.toFixed(2)} m of 1.3)`);
      const ray = col.raycast(realmToDungeon(f[0] - way[0] * 1.5, 1.2, f[2] - way[2] * 1.5), way, 3);
      assert.ok(Math.abs(ray - (1.5 - SD_LAMP_POST_W)) < 1e-3, `a chest-high ray meets it (${ray})`);
    }
  }
  assert.deepEqual([...realmLampTris()].length, feet.length * 5 * 2 * 9, 'the posts\' sides and tops, two triangles a face');
});

// ── L2 F17: the hall's word forgotten ───────────────────────────────────

test('AUDIT SD II L2 F17: THE HALL\'S WORD FORGOTTEN OUT OF THE REALM, run from the world host\'s own text - the realm\'s last word on the Orrery is the hall\'s while I stand in its slot\'s Hour; out of the realm the fight\'s frame forgets it, so back in the same slot\'s Hour the hall waits for the realm\'s own word (it turned its stones from the stale one, and chimed and said a Concord reached meanwhile again), and no Concord widens the edge from the last visit (mutants: the word kept)', () => {
  const w = read('src/scenes/world.js');
  const grab = (head, end) => { const i = w.indexOf(head); assert.ok(i > 0, head); return w.slice(i + 1, w.indexOf(end, i + 1) + end.length); };
  const text = [grab('\n  function sdHallHeard(w) {', '\n  }\n'), grab('\n  const sdFightFrame = () => {', '\n  };\n'), grab('\n  const sdHallWord = () =>', '\n'), grab('\n  const sdConcordHere = () =>', '\n')].join('');
  let slot = 3;
  const env = {
    modes: { sdRealmSlot: () => slot }, sdFightLink: { leave() {}, state: () => ({}), now: () => 0 }, _sdReceipts: new Map(), sdReceiptsLeft() {},
    sdSpoilsBurst: { leave() {}, frame() {} }, sdBlows: { leave() {}, frame() {} }, player: { pos: [0, 0, 0] }, playerEntity: { health: 10, maxHealth: 10 },
    sdDungeonToRealm: () => [0, 0, 1e9], sdBarNear: () => false, remnantBarModel: () => null, drawGateBossBar() {}, gamePaused: () => false, townTalk: { hudHidden: false },
    inOrreryHall, SD_FRAY_LASH, hurtPlayer() {}, flashPlayerDamage() {}, setMidScreenText() {}, SD_HALL_TEXT,
    // SD14a, SD15 (PIN MOVED): the voice and the arena read in the fight's frame
    sdRemVoice: { leave() {}, frame() {} }, cam: { yaw: 0 }, SD_ARENA: { x: 0, z: 0 }, sdPerilAt: () => null, sdGroundModel: () => null,
    sdBeats: { frame: () => null, leave() {} }, titleCardModel: () => null, drawGateGround() {}, drawSdTitleCard() {},
    sdMarksCardModel: () => null, sdMarksOf: () => null, drawGateMarksCard() {}, performance: { now: () => 0 },   // SD18b (PIN MOVED): the Hour's marks card
  };
  const h = new Function(...Object.keys(env), `let _sdHall = null, _sdFightHeld = false, _sdBarUp = false, _sdGroundUp = false, _sdCardUp = false, _sdMarksSince = null, _sdMarksUp = false, _sdPassesWarm = true;\n${text}\nreturn { sdHallHeard, sdFightFrame, sdHallWord, sdConcordHere };`)(...Object.values(env));   // AUDIT SD III (V13, PIN MOVED): the passes already warm
  const word = { k: 'pz', s: 3, st: [1, 2, 3, 4, 5, 6], f: 0, lit: 6, ok: true };
  h.sdHallHeard(word);
  h.sdFightFrame();
  assert.equal(h.sdHallWord(), word, 'in its Hour: the hall\'s');
  assert.equal(h.sdConcordHere(), true);
  slot = null;
  h.sdFightFrame();
  slot = 3;
  assert.equal(h.sdHallWord(), null, 'back in the same slot\'s Hour: forgotten, until the realm says it again');
  assert.equal(h.sdConcordHere(), false, 'and no Concord held over');
  h.sdHallHeard(word);
  assert.equal(h.sdHallWord(), word, 'the realm\'s own word, heard');
  // the hall's set hears a first word as where the stones ARE - no turn, no chime, no line (SD6c)
  const said = [], hall = createSdHall({ renderer: fakeRenderer(), s: 3, say: (x) => said.push(x) });
  hall.stand({ dynamicDraws: [], collider: null });
  hall.frame(0.016, null, h.sdHallWord());
  assert.deepEqual([hall.shown, hall.concord, said], [word.st, true, []]);
});

// ── L2 F18: the Warp's breath seen ──────────────────────────────────────

test('AUDIT SD II L2 F18: THE WARP\'S BREATH SEEN - from the instant its wind rises (the second before a gust, when it is heard) through the gust, brass streaks blow across the Crumble the way that gust pushes: the law (breathSeen) shows the coming gust\'s way through its warning and its own through it, carried on as it blows, nothing between; the Steps\' draw of it stands over the Crumble, turned the breath\'s way and moving that way while it shows, hidden between (it was heard alone: a player with the sound off met each gust unwarned) (mutants: shown the wrong way; shown between gusts; standing still)', () => {
  let seen = 0, quiet = 0, lastK = -1;
  const ways = new Set();
  for (let t = T0; t < T0 + 2 * SD_GUST_EVERY; t += 1 / 64) {
    const b = breathSeen(t), g = gustAt(t);
    if (g.push) assert.equal(b.dir, Math.sign(g.push), `through the gust, its way (${t - T0})`);
    else if (g.warn) assert.equal(b.dir, Math.sign(gustAt(t + SD_GUST_WARN).push), `through its warning, the coming gust's way (${t - T0})`);
    else assert.deepEqual(b, { dir: 0, k: 0 }, `nothing between (${t - T0})`);
    if (b.dir) { seen++; ways.add(b.dir); assert.ok(b.k >= 0 && b.k < 1 && (lastK < 0 || b.k > lastK), 'carried on'); lastK = b.k; } else { quiet++; lastK = -1; }
  }
  assert.ok(Math.abs(seen / (seen + quiet) - (SD_GUST_WARN + SD_GUST_FOR) / SD_GUST_EVERY) < 0.01 && ways.size === 2, 'two seconds in six, both ways in a pair');
  const steps = createSdSteps({ renderer: fakeRenderer() }), list = [];
  steps.stand({ dynamicDraws: list, collider: null });
  const breath = list.find((d) => d.gpu.m.subMeshes.length === 1 && d.gpu.m.subMeshes[0].textureRecord === SD_HALL_GLOW_RECORD.brass && d.gpu.m.subMeshes[0].primitiveCount === 8 * SD_BREATH.n);
  assert.ok(breath, 'the breath\'s streaks drawn with the Steps');
  const C = SD_CHECKPOINTS[2], P = breath.gpu.m.positions;
  for (let k = 0; k < P.length; k += 3) assert.ok(P[k + 2] >= C.z + C.r - 1e-4 && P[k + 2] <= SD_COURSE_END + 1e-4 && Math.abs(P[k]) <= SD_BREATH.halfX + SD_BREATH.len, 'over the Crumble, in the realm\'s frame');
  let lastX = null;
  for (let t = T0; t < T0 + 2 * SD_GUST_EVERY; t += 1 / 64) {
    steps.ride(t, 1 / 64, null, true);
    const b = breathSeen(t), M = breath.object.matrix;
    if (!b.dir) { assert.ok(breath.hidden === true && M.every((v) => v === 0), 'hidden between'); lastX = null; continue; }
    assert.equal(breath.hidden, false);
    assert.deepEqual([M[0], M[5], M[10], M[13], M[14]], [b.dir, 1, 1, SD_REALM_ORIGIN[1], Math.fround(SD_REALM_ORIGIN[2])], 'turned its way, at the realm');
    assert.ok(Math.abs(M[12] - SD_REALM_ORIGIN[0]) <= SD_BREATH.sweep / 2 + 1e-3);
    if (lastX != null) assert.ok((M[12] - lastX) * b.dir > 0, 'moving the way it blows');
    lastX = M[12];
  }
});

// ── L4 F1: the span I last stood in ─────────────────────────────────────

test('AUDIT SD II L4 F1: THE VOID CASTS BACK TO THE SPAN THE BODY LAST STOOD IN - run off the first Drift step backward at a run (the motor\'s liftoff momentum and its gravity, no air control), the body passes under A and crosses the void\'s floor short of A\'s near edge, before every span: cast back to A (it was answered with nothing - a fall for ever); run off Drift step 6 forward, past step 7, it crosses the void\'s floor over the Beat\'s span: cast back to A, the span it stood in (it was cast on to B, the rest of the Drift skipped); the checkpoint it stood on its own (mutants: the span the fall crosses; a checkpoint never its own span; a fall before the first span unasked - SD7b\'s record)', () => {
  const [A, B] = SD_CHECKPOINTS;
  const run = (from, way, x = 0) => {
    const r = createSdSteps({});
    r.stand({ dynamicDraws: [], collider: null });
    const s = SD_STEPS_COURSE[from], v = runSpeed(50, 30), dt = 1 / 60;
    let t = T0 + 0.25, z = s.z + (way * s.d) / 2, y = s.y, vy = 0;
    const body = { pos: realmToDungeon(x, y, z), grounded: true, groundKey: sdStepKey(s.i), height: 1.8, collider: null, carryBy() {} };
    assert.equal(r.ride(t, dt, body, true), null, 'stood on it');
    body.grounded = false; body.groundKey = null;
    for (let k = 0; k < 10 * 60; k++) {
      t += dt; vy -= GRAVITY * dt; y += vy * dt; z += way * v * dt;
      body.pos = realmToDungeon(x, y, z);
      const back = r.ride(t, dt, body, true);
      if (back) return { back, z, y };
    }
    return { back: null, z, y };
  };
  const off0 = run(0, -1);
  assert.ok(spanAt(off0.z) === -1 && off0.z < A.z - A.r, `the fall crossed the void's floor before every span (z ${off0.z.toFixed(2)})`);
  assert.deepEqual(off0.back, realmToDungeon(A.x, A.y, A.z), 'back to A');
  const off6 = run(6, 1);
  assert.equal(SD_STEPS_COURSE[6].span, 0);
  assert.ok(spanAt(off6.z) === 1 && off6.z > B.z - B.r, `the fall crossed the void's floor over the Beat's span (z ${off6.z.toFixed(2)})`);
  assert.deepEqual(off6.back, realmToDungeon(A.x, A.y, A.z), 'back to A, never on to B');
  assert.equal(spanAt(B.z - B.r) === 1 && spanAt(B.z - B.r - 1e-9), 0, 'a span runs from its checkpoint\'s NEAR edge (spanAt\'s comment said the far)');
  // a checkpoint stood on is its own span's: a Drift step, then B's island, then a fall off B's near side, back over the
  // Drift's span - cast back to B
  const r = createSdSteps({});
  r.stand({ dynamicDraws: [], collider: null });
  const s6 = SD_STEPS_COURSE[6];
  r.ride(T0, 1 / 60, { pos: realmToDungeon(0, s6.y, s6.z), grounded: true, groundKey: sdStepKey(6), height: 1.8 }, true);
  r.ride(T0, 1 / 60, { pos: realmToDungeon(0, B.y, B.z), grounded: true, groundKey: SD_CHECKS_KEY, height: 1.8 }, true);
  assert.deepEqual(r.ride(T0, 1 / 60, { pos: realmToDungeon(0, -31, B.z - B.r - 4), grounded: false, groundKey: null, height: 1.8 }, true), realmToDungeon(B.x, B.y, B.z), 'back to B');
});
