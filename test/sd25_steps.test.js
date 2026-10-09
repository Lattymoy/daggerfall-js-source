// SD25 S9 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 8): THE UNMOORED
// STEPS, every step showing what it will do next - a draw atlas a kind (world/sdStepsArt.js), the Beat's clock-plate
// frames, its falter and its dissolve, the Drift's pendulums, the risers' racks, the Crumble's crack stages and its chunks
// that rewind (world/sdStepsModel.js, scenes/sdSteps.js), the waystones and the vane, the ghosts' pass
// (render/sdStepsPass.js - its shader run through test/glsl.mjs), and the cast-back's gold rewind (scenes/sdFx.js). The
// law (world/sdSteps.js) is run from its own code: no picture is larger than it, none moves it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from './glsl.mjs';
import { realmToDungeon, SD_REALM_ORIGIN } from '../src/net/sdBrain.js';
import { SD_REALM_ARCHIVE } from '../src/world/sdRealm.js';
import { SD_HALL_ATLAS_RECORD, SD_HALL_ATLAS } from '../src/world/sdHallArt.js';
import { SD_ENDINGS } from '../src/net/sdMarks.js';
import { SD_RAMP } from '../src/world/sdLook.js';
import { offPalette, paletteOf } from '../src/world/sdPixelKit.js';
import {
  SD_STEPS_COURSE, SD_CHECKPOINTS, SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_BEAT_BLINK, SD_CRUMBLE_DELAY, SD_CRUMBLE_BACK, SD_CRUMBLE_FALL_G,
  SD_GUST_EVERY, SD_GUST_WARN, SD_STEP_THICK, SD_VOID_Y, stepAt, beatStands, gustAt,
} from '../src/world/sdSteps.js';
import {
  stepsArt, beatArt, crumbleArt, driftArt, riserArt, partsArt, beatHandAngle, beatTickLit, hourAngle, crackDistance, SD_STEPS_RECORD, SD_STEPS_ATLAS,
  SD_RISER_ATLAS, SD_STEPS_PALETTE, SD_BEAT_DIAL, SD_BEAT_EMBER_FRAME, SD_STEP_BEVEL, SD_CRACK_STAGES, SD_CRUMBLE_CRACKS, SD_STEPS_GLOW,
} from '../src/world/sdStepsArt.js';
import {
  SD_STEP_KINDS, SD_PENDULUM, SD_BEAT_DISSOLVE, SD_RACK, SD_VANE, SD_WAYSTONES, stepBox, stepTris, buildStepModel, buildBeatDissolve, buildPendulum,
  pendulumAngle, buildCrumbleChunks, buildVaneModel, vaneYawAt, stepEdges, buildWaystoneModel, SD_WAYSTONE,
} from '../src/world/sdStepsModel.js';
import { createSdSteps, sdStepKey, SD_STEPS_SOUNDS, SD_BEAT_FRAME_S, SD_BEAT_IN_S, SD_CHUNK, SD_CRUMBLE_SEEN, SD_BEAT_BLINK_HZ } from '../src/scenes/sdSteps.js';
import { SD_GHOST, SD_GHOST_STEPS, SD_STEPS_PASS_VS, SD_STEPS_PASS_FS, sdGhostVertices } from '../src/render/sdStepsPass.js';
import { createSdFx, sdCastBackSeen, SD_FX_REWIND, SD_FX_COLOR, SD_REWIND_SEEN } from '../src/scenes/sdFx.js';
import { FX_BURST_MS, FX_LIGHT_MS } from '../src/render/gateFx.js';
import { TELEGRAPH_THROB_MAX_HZ } from '../src/render/gateTelegraph.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A realm second on a whole Beat cycle and a whole pair of gusts (sd7b's). */
const T0 = 1_800_000_000 - (1_800_000_000 % 36);
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const key = (rec) => `${SD_REALM_ARCHIVE}_${rec}`;
/** The set over a fake renderer and ear. */
function rig({ ending = null } = {}) {
  const draws = [], sounds = [];
  const renderer = { createMesh: (m) => ({ m }), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} };
  const audio = { playOneShot: (rec, vol, pitch) => sounds.push({ rec, vol, pitch }), play3d: (rec, at, vol, o) => sounds.push({ rec, at, vol, pitch: o?.pitch }) };
  const steps = createSdSteps({ renderer, audio, ending });
  steps.stand({ dynamicDraws: draws, collider: { addMesh() {} } });
  return { draws, sounds, steps };
}
/** A mesh's lowest point (y). */
const minY = (m) => { let y = Infinity; for (let k = 1; k < m.positions.length; k += 3) y = Math.min(y, m.positions[k]); return y; };
const recOf = (remap, base) => (remap ? Number([...remap.values()][0].split('_')[1]) : base);
/** A texel's light (r + g + b) of an image at (x, y). */
const lightAt = (img, x, y) => { const i = (y * img.width + x) * 4; return img.colors[i] + img.colors[i + 1] + img.colors[i + 2]; };
/** A Beat top's texel holding (m, the plate's own: +x right, +z far) - world/sdStepsArt.js's own mapping, the chamfer round it. */
const beatTexel = (mx, mz) => {
  const [x0, y0, w, h] = SD_STEPS_ATLAS.top, tw = 3 - 2 * SD_STEP_BEVEL, td = 2.6 - 2 * SD_STEP_BEVEL;
  return [x0 + Math.floor((mx / tw + 0.5) * w), y0 + Math.floor((mz / td + 0.5) * h)];
};

test('S9 A DRAW ATLAS A KIND: one record a kind, every texel in the Hour\'s ramps; each kind its own picture at a glance; metal and stone with no light of their own - the gold line under every rim (L2) the only light a Drift deck or a riser has, a riser\'s lip the brightest; the Crumble\'s light in its cracks alone (mutants: a picture off its palette; the Drift\'s deck alight; the riser\'s lip no brighter)', () => {
  const pal = paletteOf(SD_RAMP.basalt, SD_RAMP.brass, SD_RAMP.verdigris, SD_RAMP.void, SD_RAMP.bronze);
  assert.deepEqual(SD_STEPS_PALETTE, pal);
  for (const [rec, a] of stepsArt()) assert.equal(offPalette(a.albedo, pal), 0, `record ${rec} in its ramps`);
  // the kinds told apart: each top's mean colour its own
  const mean = (img, [x0, y0, w, h]) => { const s = [0, 0, 0]; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * img.width + x) * 4; s[0] += img.colors[i]; s[1] += img.colors[i + 1]; s[2] += img.colors[i + 2]; } return s.map((v) => v / (w * h)); };
  const tops = [driftArt(), riserArt(), beatArt(0), crumbleArt(0)].map((a) => mean(a.albedo, SD_STEPS_ATLAS.top));
  for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) assert.ok(Math.hypot(...tops[i].map((v, k) => v - tops[j][k])) > 8, `kinds ${i} and ${j} told apart`);
  // light only where it means something
  const litIn = (img, [x0, y0, w, h]) => { let n = 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (lightAt(img, x, y)) n++; return n; };
  for (const [name, a, A] of [['drift', driftArt(), SD_STEPS_ATLAS], ['riser', riserArt(), SD_RISER_ATLAS]]) {
    for (const cell of ['top', 'side', 'bevel', 'under']) assert.equal(litIn(a.emission, A[cell]), 0, `${name}'s ${cell}: no light of its own`);
    assert.equal(litIn(a.emission, A.line), A.line[2] * A.line[3], `${name}: its rim's gold line alight`);
  }
  const lip = lightAt(riserArt().emission, SD_RISER_ATLAS.line[0], SD_RISER_ATLAS.line[1]), line = lightAt(driftArt().emission, SD_STEPS_ATLAS.line[0], SD_STEPS_ATLAS.line[1]);
  assert.ok(lip > line && lip <= 255 * 3 * 0.66, `the riser's lip the brightest gold (${lip} over ${line}), under the signals`);
  assert.ok(SD_STEPS_GLOW.lip > SD_STEPS_GLOW.line && SD_STEPS_GLOW.line <= 0.5, 'the rim on the ambient rung');
  // the Crumble: lit where its cracks run, dark elsewhere on its top
  const c = crumbleArt(1), [x0, y0, w, h] = SD_STEPS_ATLAS.top, tw = 2.6 - 2 * SD_STEP_BEVEL;
  for (let y = y0; y < y0 + h; y += 3) for (let x = x0; x < x0 + w; x += 3) {
    const [main, branch] = crackDistance(((x + 0.5 - x0) / w - 0.5) * tw, ((y + 0.5 - y0) / h - 0.5) * tw);
    if (Math.min(main, branch * 2.2) > SD_CRACK_STAGES[1].lip + 0.01) assert.equal(lightAt(c.emission, x, y), 0, `stone dark away from its cracks (${x}, ${y})`);
  }
  // the parts: the waystone's rune lit in the one record, dark in the other
  assert.ok(litIn(partsArt(true).emission, [48, 0, 16, 32]) > 20 && litIn(partsArt(false).emission, [48, 0, 16, 32]) === 0);
});

test('S9 THE BEAT\'S CLOCK-PLATE: frame k\'s one hand at (12 - k) twelfths of a turn clockwise from XII as the eye sees it - running BACK to XII across the solid 2.4 s; the ticks still ahead of it lit (11 - k of them); frames 10 and 11 in the ember sector, their light ember; the falter frame frame 11 with its light near out (mutants: the hand running forward; the ember a frame early; the falter unfaltered)', () => {
  assert.equal(SD_BEAT_EMBER_FRAME, 10);
  assert.equal(SD_BEAT_FRAME_S * 12, SD_BEAT_SOLID);
  assert.ok(near(SD_BEAT_FRAME_S, 0.2, 1e-12), 'a frame a fifth of a second: motion, never a flash');
  assert.ok(near(hourAngle(1, 0), Math.PI / 2) && near(hourAngle(0, -1), Math.PI) && near(hourAngle(-1, 0), Math.PI * 1.5), 'III at +x - the camera\'s one mirror puts it on the right, facing +z');
  for (let k = 0; k < 12; k++) {
    const a = beatHandAngle(k), art = beatArt(k), E = art.emission;
    assert.ok(near(a, ((12 - k) / 12) * Math.PI * 2), `frame ${k}: its hand`);
    if (k > 0) assert.ok(a < beatHandAngle(k - 1), 'back toward XII');
    // its hand alight two thirds out along it, nothing at the opposite side
    const r = SD_BEAT_DIAL.hand * 0.4, [hx, hy] = beatTexel(Math.sin(a) * r, Math.cos(a) * r), [ox, oy] = beatTexel(-Math.sin(a) * r, -Math.cos(a) * r);
    assert.ok(lightAt(E, hx, hy) > 200, `frame ${k}: its hand lit`);
    assert.equal(lightAt(E, ox, oy), 0, `frame ${k}: none behind it`);
    let lit = 0;
    for (let h = 1; h < 12; h++) {
      const ta = (h / 12) * Math.PI * 2, rr = (SD_BEAT_DIAL.tick0 + SD_BEAT_DIAL.tick1) / 2, [tx, ty] = beatTexel(Math.sin(ta) * rr, Math.cos(ta) * rr);
      const on = lightAt(E, tx, ty) > 150;
      if (h !== 12 - k) assert.equal(on, beatTickLit(k, h), `frame ${k}: hour ${h}'s tick`);
      if (on && h !== 12 - k) lit++;
    }
    assert.equal(lit, Math.max(0, 11 - k), `frame ${k}: the time it holds, lit`);
    const i = (hy * E.width + hx) * 4, ember = E.colors[i] > 2 * E.colors[i + 1];
    assert.equal(ember, k >= SD_BEAT_EMBER_FRAME, `frame ${k}: ${ember ? 'ember' : 'gold'}`);
  }
  const f = beatArt(11, true).emission, full = beatArt(11).emission;
  let a = 0, b = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { a += lightAt(f, x, y); b += lightAt(full, x, y); }
  assert.ok(a > 0 && a < b * 0.2, `the falter: its light near out (${a} of ${b})`);
});

test('S9 THE BEAT ON THE PAGE: its frame its time in its solid (the draw\'s remap); its light faltering once in its warning at SD_BEAT_BLINK_HZ (under the flash ceiling) while it dissolves out a stage a tenth of a second - its draw\'s mesh a dither of its own cells - and in over its first SD_BEAT_IN_S; gone, hidden and its ghost alight where it will return, the ghost\'s hand running back to the return and brightening over its last 0.3 s; the collider the law\'s alone (mutants: no dissolve; the ghost on a solid plate; the ghost\'s hand forward; the ghost never brightening)', () => {
  const r = rig(), s = SD_STEPS_COURSE.find((x) => x.kind === 'beat'), solidMesh = r.draws.find((d) => d.gpu?.m?.subMeshes?.[0]?.textureRecord === SD_STEPS_RECORD.beat[0] && d.gpu.m.indices.length === 108).gpu;
  const g = SD_GHOST_STEPS.indexOf(s);
  assert.ok(SD_BEAT_BLINK_HZ <= TELEGRAPH_THROB_MAX_HZ);
  let lastKeep = 17, falters = 0, wasFalter = false;
  for (let k = 0; k < 360; k++) {
    const u = (k + 0.5) / 100, t = T0 + s.beat + u;
    r.steps.ride(t, 0.01, null);
    const st = r.steps.steps[s.i], solid = beatStands(s, t);
    assert.equal(st.solid, solid, 'the law\'s own');
    assert.deepEqual([st.T[0], st.T[2]], [realmToDungeon(...stepAt(s, t))[0], realmToDungeon(...stepAt(s, t))[2]]);
    const gs = r.steps.ghosts.state;
    if (!solid) {
      assert.ok(st.matrix.every((v) => v === 0), 'gone: hidden');
      const left = SD_BEAT_CYCLE - u;
      assert.equal(gs[g * 4], 1, 'its ghost alight');
      assert.ok(near(gs[g * 4 + 1], left / (SD_BEAT_CYCLE - SD_BEAT_SOLID), 1e-5), 'its hand back toward XII as the return comes');
      assert.ok(near(gs[g * 4 + 2], left >= SD_GHOST.rise ? SD_GHOST.base : SD_GHOST.base + (SD_GHOST.peak - SD_GHOST.base) * ((x) => x * x * (3 - 2 * x))((SD_GHOST.rise - left) / SD_GHOST.rise), 1e-5), 'brightening over its last moments');
      const gp = r.steps.ghosts.step;
      assert.ok(near(gp[g * 4], st.T[0], 1e-3) && near(gp[g * 4 + 1], realmToDungeon(s.x, s.y, s.z)[1], 1e-3) && near(gp[g * 4 + 2], st.T[2], 1e-3), 'where the law will stand it');
      continue;
    }
    assert.equal(gs[g * 4], 0, 'no ghost while it stands');
    assert.ok(st.matrix.some((v) => v !== 0), 'seen while it holds');
    const warned = u - (SD_BEAT_SOLID - SD_BEAT_BLINK), rec = recOf(st.remap, SD_STEPS_RECORD.beat[0]);
    const falter = rec === SD_STEPS_RECORD.falter;
    if (falter && !wasFalter) falters++;
    wasFalter = falter;
    if (!falter) assert.equal(rec, SD_STEPS_RECORD.beat[Math.min(11, Math.floor(u / SD_BEAT_FRAME_S))], `at ${u.toFixed(2)}: its frame`);
    assert.equal(falter, warned >= 0 && Math.floor(warned * 2 * SD_BEAT_BLINK_HZ) % 2 === 1, `at ${u.toFixed(2)}: the falter`);
    if (warned >= 0) {
      assert.notEqual(st.gpu, solidMesh, `at ${u.toFixed(2)}: dissolving out`);
      const n = st.gpu.m.indices.length;
      assert.ok(n <= lastKeep, 'fewer cells as it goes');
      lastKeep = n;
    } else if (u < SD_BEAT_IN_S) assert.notEqual(st.gpu, solidMesh, `at ${u.toFixed(2)}: dithering in`);
    else assert.equal(st.gpu, solidMesh, `at ${u.toFixed(2)}: whole`);
    if (warned < 0) lastKeep = Infinity;
  }
  assert.equal(falters, 1, 'one falter a warning');
  // THE FLASH PROBE (the spec's lab check, in numbers): a plate's light - its record's whole emission, times the share of
  // its cells kept, or its ghost's - sampled at 60 Hz for 4 s turns from rising to falling at most three times a second
  const light = new Map(stepsArt().map(([rec, a]) => { let n = 0; for (let k = 0; k < a.emission.colors.length; k += 4) n += a.emission.colors[k] + a.emission.colors[k + 1] + a.emission.colors[k + 2]; return [rec, n]; }));
  const fullCells = buildBeatDissolve(16).indices.length;
  let prev = null, dir = 0, turns = 0;
  for (let k = 0; k < 240; k++) {
    const t = T0 + 7 + k / 60;
    r.steps.ride(t, 1 / 60, null);
    const st = r.steps.steps[s.i], gs = r.steps.ghosts.state;
    const v = st.solid ? (light.get(recOf(st.remap, SD_STEPS_RECORD.beat[0])) / light.get(SD_STEPS_RECORD.beat[0])) * (st.gpu === solidMesh ? 1 : st.gpu.m.indices.length / fullCells) : gs[g * 4] * gs[g * 4 + 2] * 0.1;
    if (prev != null && Math.abs(v - prev) > 1e-9) { const d = Math.sign(v - prev); if (dir && d !== dir) turns++; dir = d; }
    prev = v;
  }
  assert.ok(turns / 4 <= TELEGRAPH_THROB_MAX_HZ, `${turns} turns in 4 s`);
});

test('S9 THE DISSOLVE IS AN ORDERED DITHER OF THE PLATE\'S OWN CELLS: each stage keeps its share of every 16 (about three texels a cell), each a stage\'s cells among the next fuller stage\'s - a screen-door, never a shuffle - all inside the plate\'s box (mutants: the dither\'s order turned; a stage keeping all)', () => {
  const box = stepBox('beat'), cellsOf = (m) => {
    const out = new Set(), P = m.positions;
    for (let k = 0; k < m.indices.length; k += 6) {
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < 6; j++) { const v = m.indices[k + j]; cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; }
      out.add([cx, cy, cz].map((q) => Math.round((q / 6) * 1000)).join());
    }
    return out;
  };
  const stages = SD_BEAT_DISSOLVE.keep.map((k) => buildBeatDissolve(k)), full = cellsOf(buildBeatDissolve(16));
  assert.deepEqual([...SD_BEAT_DISSOLVE.keep], [12, 8, 4, 2]);
  assert.ok(SD_BEAT_DISSOLVE.cell > 0.1 && SD_BEAT_DISSOLVE.cell < 0.2, 'about three texels');
  let prev = full;
  for (const [i, m] of stages.entries()) {
    const c = cellsOf(m), share = c.size / full.size;
    assert.ok(Math.abs(share - SD_BEAT_DISSOLVE.keep[i] / 16) < 0.08, `stage ${i}: ${share.toFixed(3)} kept`);
    for (const q of c) assert.ok(prev.has(q), `stage ${i}: its cells among the fuller stage's`);
    prev = c;
    const P = m.positions;
    for (let k = 0; k < P.length; k += 3) assert.ok(Math.abs(P[k]) <= box.w / 2 + 1e-6 && P[k + 1] <= 1e-6 && P[k + 1] >= -box.h - 1e-6 && Math.abs(P[k + 2]) <= box.d / 2 + 1e-6, 'inside its box');
  }
});

test('S9 THE DRIFT\'S PENDULUMS: each step hangs from its own - a gear SD_PENDULUM.len over its rest, turned by asin(dx / len), dx the law\'s own swing at that second, so its rods lean with it (+x up through the camera\'s mirror, the deck carried the same way); its rods\' feet bracketed to the deck\'s sides at every swing the law has, and none of it over the deck where a body stands (AUDIT SD V L3); nothing that turns casts (mutants: the lean the wrong way; the pivot riding the deck; a pendulum casting; the rods over the deck)', () => {
  const r = rig(), P = buildPendulum(), drifts = SD_STEPS_COURSE.filter((s) => s.kind === 'drift');
  const pends = r.draws.filter((d) => d.gpu?.m?.positions?.length === P.positions.length && d.gpu.m.subMeshes[0].textureRecord === SD_STEPS_RECORD.parts && minY(d.gpu.m) < -SD_PENDULUM.len);
  assert.equal(pends.length, drifts.length, 'one a Drift step');
  assert.ok(pends.every((d) => d.noShadow === true), 'they turn: no shadow');
  const feet = [];
  for (let k = 0; k < P.positions.length; k += 3) if (P.positions[k + 1] < -SD_PENDULUM.len + 0.01) feet.push([P.positions[k], P.positions[k + 1], P.positions[k + 2]]);
  assert.ok(feet.length >= 8, 'its rods reach the deck');
  for (const t of [T0 + 0.37, T0 + 1.37, T0 + 2.9, T0 + 11.1]) {
    r.steps.ride(t, 1 / 60, null);
    for (const [j, s] of drifts.entries()) {
      const M = pends[j].object.matrix, at = stepAt(s, t), dx = at[0] - s.x, a = pendulumAngle(dx);
      assert.ok(near(a, Math.asin(dx / SD_PENDULUM.len)), 'asin(dx / len)');
      assert.ok(near(M[0], Math.cos(a), 1e-6) && near(M[1], Math.sin(a), 1e-6) && near(M[4], -Math.sin(a), 1e-6), `step ${s.i} at ${t - T0}: leaning with its swing`);
      const pivot = realmToDungeon(s.x, s.y + SD_PENDULUM.len, s.z);
      assert.ok(near(M[12], pivot[0], 1e-3) && near(M[13], pivot[1], 1e-3) && near(M[14], pivot[2], 1e-3), 'its gear over its rest');
      const deck = realmToDungeon(...at), box = stepBox('drift');
      for (const f of feet) {
        const w = [M[0] * f[0] + M[4] * f[1] + M[8] * f[2] + M[12], M[1] * f[0] + M[5] * f[1] + M[9] * f[2] + M[13], M[2] * f[0] + M[6] * f[1] + M[10] * f[2] + M[14]];
        // PIN MOVED (AUDIT SD V L3): the rods hang beside the deck on brackets - every foot at the deck's own height, under
        // its top, at its middle along z; the brackets reach into its side
        assert.ok(Math.abs(w[0] - deck[0]) <= SD_PENDULUM.foot + 0.1 && w[1] <= deck[1] && w[1] >= deck[1] - box.h && Math.abs(w[2] - deck[2]) <= box.d / 2, `step ${s.i}: a rod's foot at its deck's side`);
      }
    }
  }
  // the widest swing, sideways in full: the feet still in the deck (the law's 2 m either way)
  for (const dx of [2, -2]) {
    const a = pendulumAngle(dx), c = Math.cos(a), sn = Math.sin(a);
    for (const f of feet) { const x = c * f[0] - sn * f[1], y = sn * f[0] + c * f[1] + SD_PENDULUM.len; assert.ok(Math.abs(x - dx) <= SD_PENDULUM.foot + 0.1 && y <= 0 && y >= -SD_STEP_THICK, `full swing ${dx}: foot (${x.toFixed(2)}, ${y.toFixed(2)})`); }   // PIN MOVED (AUDIT SD V L3)
    // AUDIT SD V (L3): nothing of it over the deck where a body stands - no vertex from its top up a body's height within
    // the deck's half-width and a capsule's reach of its middle (the rods stood 0.3 m in from its edges, through anyone there)
    for (let k = 0; k < P.positions.length; k += 3) {
      const px = P.positions[k], py = P.positions[k + 1], x = c * px - sn * py, y = sn * px + c * py + SD_PENDULUM.len;
      if (y > 0 && y < 2.2) assert.ok(Math.abs(x - dx) >= 1.5 + 0.35, `full swing ${dx}: a rod over the deck at (${(x - dx).toFixed(2)}, ${y.toFixed(2)})`);
    }
  }
});

test('S9 NOTHING LARGER THAN THE LAW: every step\'s mesh inside its collider\'s box (a riser\'s rack inside it, its face set back for it), the colliders the law\'s twelve triangles; every step and part that moves casts nothing; a riser\'s eleven teeth up its run-up face, its lip at its top (mutants: the rack proud of the box; a step casting)', () => {
  for (const kind of SD_STEP_KINDS) {
    const m = buildStepModel(kind), box = stepBox(kind), P = m.positions;
    for (let k = 0; k < P.length; k += 3) assert.ok(Math.abs(P[k]) <= box.w / 2 + 1e-6 && P[k + 1] <= 1e-6 && P[k + 1] >= -box.h - 1e-6 && Math.abs(P[k + 2]) <= box.d / 2 + 1e-6, `${kind}: inside its box`);
    assert.equal(stepTris(kind).indices.length, 36, `${kind}: the law's collider`);
    assert.equal(m.subMeshes.length, 1, `${kind}: one draw`);
  }
  const riser = buildStepModel('riser'), box = stepBox('riser'), P = riser.positions;
  let proud = 0, faceMin = Infinity;
  for (let k = 0; k < P.length; k += 3) {
    if (P[k + 2] < -box.d / 2 + SD_RACK.out - 1e-6) { proud++; assert.ok(Math.abs(P[k]) <= SD_RACK.w / 2 + 1e-6 && P[k + 1] < -0.2 && P[k + 1] > -2.3, 'a tooth on the face it is run up'); }
    else if (Math.abs(P[k]) > SD_RACK.w / 2 + 0.1) faceMin = Math.min(faceMin, P[k + 2]);
  }
  assert.ok(proud >= SD_RACK.n * 4, 'its teeth stand proud of its face');
  assert.ok(near(faceMin, -box.d / 2 + SD_RACK.out, 1e-6), 'its face set back by as much');
  const r = rig();
  for (const d of r.draws) if (d.gpu?.m?.subMeshes?.[0]?.textureRecord !== undefined && d.object.matrix !== undefined && d !== r.draws[0]) assert.equal(d.noShadow, true, 'nothing that moves casts');
});

test('S9 THE CRUMBLE, MINE: at rest its dim cracks; under my foot they flare in three stages across the shake while grit pours; fallen, its draw hidden and four chunks falling in its stead at the law\'s own gravity, out of sight past SD_CRUMBLE_SEEN, its ghost counting the return; in the last SD_CHUNK.rewind they fly back up the same way and are home exactly as the law brings it back - a click, a shudder (mutants: the stages never advancing; the rewind skipped; the chunks home early; no grit)', () => {
  const r = rig(), i = SD_STEPS_COURSE.findIndex((s) => s.kind === 'crumble'), s = SD_STEPS_COURSE[i], rest = realmToDungeon(s.x, s.y, s.z), t0 = T0 + 1.25;
  const g = SD_GHOST_STEPS.indexOf(s), chunks = buildCrumbleChunks();
  const grit = r.draws.find((d) => d.gpu?.m?.subMeshes?.[0]?.textureRecord === SD_STEPS_RECORD.parts && minY(d.gpu.m) < -2 && minY(d.gpu.m) > -5);
  r.steps.ride(t0 - 0.1, 1 / 60, null);
  assert.equal(r.steps.steps[i].remap, null, 'at rest: its rest record');
  assert.ok(grit.hidden, 'no grit at rest');
  r.steps.touch(i, t0);
  const stages = [];
  for (let k = 0; k < 7; k++) { r.steps.ride(t0 + (k + 0.5) / 10, 1 / 60, null); const st = r.steps.steps[i]; assert.ok(st.solid); stages.push(recOf(st.remap, -1)); }
  assert.deepEqual(stages, [1, 1, 2, 2, 2, 3, 3].map((n) => SD_STEPS_RECORD.crumble[n]), 'three stages across the shake, a third of it each');
  r.steps.ride(t0 + 0.3, 1 / 60, null);
  const gritOf = r.draws.filter((d) => d.gpu === grit.gpu && !d.hidden);
  assert.equal(gritOf.length, 1, 'grit pouring from the one I stand on');
  // fallen: the chunks fall at the law's gravity, drifting out
  const at = (f) => { r.steps.ride(t0 + SD_CRUMBLE_DELAY + f, 1 / 60, null); return r.steps.steps[i]; };
  for (const f of [0.05, 0.5, 1.2]) {
    const st = at(f);
    assert.equal(st.solid, false);
    assert.ok(st.matrix.every((v) => v === 0), 'its draw gone');
    for (const [j, m] of st.chunks.entries()) {
      const C = chunks[j];
      assert.ok(near(m[13], rest[1] + C.at[1] - 0.5 * SD_CRUMBLE_FALL_G * f * f * (1 + 0.06 * (j - 1.5)), 1e-3), `chunk ${j} falling at ${f}`);
      assert.ok(Math.hypot(m[12] - rest[0], m[14] - rest[2]) > Math.hypot(C.at[0], C.at[2]), 'drifting out');
    }
    const gs = r.steps.ghosts.state;
    assert.equal(gs[g * 4], 1, 'its ghost alight');
    assert.ok(near(gs[g * 4 + 1], (SD_CRUMBLE_BACK - f) / SD_CRUMBLE_BACK, 1e-5), 'its hand counting the return');
  }
  assert.ok(at(3.5).chunks.every((m) => m.every((v) => v === 0)), 'out of sight past SD_CRUMBLE_SEEN');
  assert.ok(0.5 * SD_CRUMBLE_FALL_G * 3.5 * 3.5 > SD_CRUMBLE_SEEN);
  // the rewind: up out of the void, eased out - lowest first, home at the return
  let last = -Infinity;
  for (const f of [SD_CRUMBLE_BACK - SD_CHUNK.rewind + 0.01, SD_CRUMBLE_BACK - 0.4, SD_CRUMBLE_BACK - 0.2, SD_CRUMBLE_BACK - 0.01]) {
    const m = at(f).chunks[0];
    assert.ok(m[13] > last, `rising at ${f}`);
    last = m[13];
  }
  assert.ok(near(last, rest[1] + chunks[0].at[1], 0.01), 'home as the law brings it back');
  assert.ok(at(SD_CRUMBLE_BACK - SD_CHUNK.rewind - 0.2).chunks.every((m) => m.every((v) => v === 0)), 'not before its rewind');
  r.sounds.length = 0;
  const back = at(SD_CRUMBLE_BACK + 0.01);
  assert.equal(back.solid, true, 'whole: the law\'s');
  assert.ok(back.chunks.every((m) => m.every((v) => v === 0)), 'its chunks gone into it');
  assert.deepEqual(r.sounds.map((x) => [x.rec, x.pitch > 2]), [[SD_STEPS_SOUNDS.clack, true]], 'they click home');
  let off = 0;   // a real shudder, past float32's own rounding of the place
  for (const d of [0.01, 0.05, 0.1, 0.15]) { const m = at(SD_CRUMBLE_BACK + d).matrix; off = Math.max(off, Math.hypot(m[12] - rest[0], m[14] - rest[2])); }
  assert.ok(off > SD_CHUNK.settle * 0.3 && off <= SD_CHUNK.settle * Math.SQRT2, `a shudder (${off.toFixed(4)})`);
  assert.ok(Math.hypot(at(SD_CRUMBLE_BACK + SD_CHUNK.shudder + 0.05).matrix[12] - rest[0], 0) < 1e-4, 'and still');
  // the chunks tile its top, each inside its box
  const box = stepBox('crumble');
  let area = 0;
  for (const C of chunks) {
    for (let k = 0; k < C.poly.length; k++) { const p = C.poly[k], q = C.poly[(k + 1) % C.poly.length]; area += p[0] * q[1] - q[0] * p[1]; }
    const P = C.model.positions;
    for (let k = 0; k < P.length; k += 3) { const x = P[k] + C.at[0], y = P[k + 1] + C.at[1], z = P[k + 2] + C.at[2]; assert.ok(Math.abs(x) <= box.w / 2 + 1e-6 && y <= 1e-6 && y >= -box.h - 1e-6 && Math.abs(z) <= box.d / 2 + 1e-6, 'a chunk in its box'); }
  }
  assert.ok(near(-area / 2, box.w * box.d, 1e-6), 'the four tile its top (wound clockwise, faces up)');
  // the phone's tier: two halves either side of the crack across it, and the pendulums' gears without teeth
  const halves = buildCrumbleChunks(2);
  let half = 0;
  for (const C of halves) for (let k = 0; k < C.poly.length; k++) { const p = C.poly[k], q = C.poly[(k + 1) % C.poly.length]; half += p[0] * q[1] - q[0] * p[1]; }
  assert.ok(halves.length === 2 && near(-half / 2, box.w * box.d, 1e-6), 'two halves tile its top');
  const draws = [], lite = createSdSteps({ renderer: { createMesh: (m) => ({ m }), destroyMesh() {}, uploadTexture() {} }, lite: true });
  lite.stand({ dynamicDraws: draws, collider: null });
  lite.touch(i, t0);
  lite.ride(t0 + SD_CRUMBLE_DELAY + 0.3, 1 / 60, null);
  assert.equal(lite.steps[i].chunks.length, 2, 'two chunks fall');
  assert.ok(draws.some((d) => d.gpu?.m?.indices?.length === buildPendulum({ teeth: false }).indices.length) && buildPendulum({ teeth: false }).indices.length < buildPendulum().indices.length, 'its gears toothless');
  assert.ok([SD_CRUMBLE_CRACKS.across, SD_CRUMBLE_CRACKS.along].every((p) => p.includes(SD_CRUMBLE_CRACKS.at)), 'split along the art\'s own two cracks');
});

test('S9 THE WAYSTONES AND THE VANE: the waystone of the span I last stood in lit gold - one at a time, A when I stood in none; the vane on C swinging to point the coming gust\'s push SD_GUST_WARN before it (the law\'s own gustAt), held through it, back after, its fin the Hollow\'s Ending\'s sign; its clack with the wind, once a gust (mutants: the vane pointing against the push; two waystones lit; the fin plain)', () => {
  const r = rig({ ending: 'sentinel' }), stones = r.draws.filter((d) => d.gpu?.m?.indices?.length === 66 && d.gpu.m.subMeshes[0].textureRecord === SD_STEPS_RECORD.parts);
  assert.equal(stones.length, 3);
  assert.equal(SD_WAYSTONES.length, SD_CHECKPOINTS.length);
  for (const [k, w] of SD_WAYSTONES.entries()) { const c = SD_CHECKPOINTS[k]; assert.ok(Math.hypot(w[0] - c.x, w[2] - c.z) < c.r - 0.4 && w[1] === c.y, `waystone ${k} on its checkpoint`); }
  const litOf = () => stones.map((d) => (d.texRemap ? 0 : 1));
  r.steps.ride(T0, 1 / 60, null);
  assert.deepEqual(litOf(), [1, 0, 0], 'none stood in: A');
  for (const [span, want] of [[1, [0, 1, 0]], [2, [0, 0, 1]], [0, [1, 0, 0]]]) {
    r.steps.standOn(span); r.steps.ride(T0 + 1, 1 / 60, null);
    assert.deepEqual(litOf(), want, `span ${span}`);
  }
  assert.deepEqual([...stones[1].texRemap.values()], [key(SD_STEPS_RECORD.partsDark)]);
  // its rune drawn upright: up its shaft the picture's rows climb (row 0 its foot - the hand points up)
  const ws = buildWaystoneModel(), y0 = SD_WAYSTONE.baseH, y1 = SD_WAYSTONE.baseH + SD_WAYSTONE.h;
  let climbs = 0;
  for (let k = 0; k < ws.positions.length / 3; k += 3) {
    const tri = [0, 1, 2].map((j) => ({ y: ws.positions[(k + j) * 3 + 1], v: ws.uvs[(k + j) * 2 + 1] }));
    if (!tri.every((q) => q.y >= y0 - 1e-6 && q.y <= y1 + 1e-6) || tri.every((q) => near(q.y, tri[0].y))) continue;
    const lo = tri.reduce((a, q) => (q.y < a.y ? q : a)), hi = tri.reduce((a, q) => (q.y > a.y ? q : a));
    assert.ok(hi.v > lo.v, 'the rune\'s rows climb its shaft');
    climbs++;
  }
  assert.ok(climbs >= 8, 'every face of its shaft');
  // the vane
  for (let n = 0; n < 4; n++) {
    const gust = T0 + n * SD_GUST_EVERY, push = Math.sign(gustAt(gust + 0.1).push);
    assert.ok(near(vaneYawAt(gust - SD_GUST_WARN - 0.5), 0, 1e-9), 'at rest down the course');
    assert.ok(near(vaneYawAt(gust - SD_GUST_WARN + SD_VANE.swing + 0.01), push * Math.PI / 2, 1e-9), `gust ${n}: pointing its push a second before`);
    assert.ok(near(vaneYawAt(gust + 0.9), push * Math.PI / 2, 1e-9), 'held through it');
    assert.ok(Math.abs(vaneYawAt(gust + 1 + SD_VANE.back * 0.5)) < Math.PI / 2 && Math.abs(vaneYawAt(gust + 1 + SD_VANE.back * 0.5)) > 0, 'swinging back');
    // its matrix: the arrow (+z of its own frame) pointing the push's way in the world
    const vane = r.draws.find((d) => d.gpu?.m?.subMeshes?.some((q) => q.textureRecord === SD_HALL_ATLAS_RECORD));   // its fin the hall atlas's (S10)
    r.steps.ride(gust - 0.1, 1 / 60, null);
    const M = vane.object.matrix;
    assert.ok(near(M[8], push, 1e-6) && near(M[10], 0, 1e-6), `gust ${n}: its arrow toward ${push > 0 ? '+x' : '-x'}`);
    const at = realmToDungeon(...SD_VANE.at);
    assert.ok(near(M[12], at[0], 1e-3) && near(M[14], at[2], 1e-3));
  }
  // its fin the Ending's sign: the hall atlas's emblem cell (S10 - the hall's emblems one atlas now), its uv inside that cell
  const vm = buildVaneModel('sentinel'), sm = vm.subMeshes.find((q) => q.textureRecord === SD_HALL_ATLAS_RECORD), Ec = SD_HALL_ATLAS.emblem[SD_ENDINGS.findIndex((E) => E.id === 'sentinel')], S = SD_HALL_ATLAS.size;
  assert.ok(sm, 'its fin the Ending\'s sign');
  for (let k = sm.startIndex; k < sm.startIndex + sm.primitiveCount * 3; k++) {
    const u = vm.uvs[vm.indices[k] * 2] * S, v = vm.uvs[vm.indices[k] * 2 + 1] * S;
    assert.ok(u >= Ec[0] && u <= Ec[0] + Ec[2] && v >= Ec[1] && v <= Ec[1] + Ec[3], 'inside its emblem\'s cell');
  }
  assert.ok(!buildVaneModel(null).subMeshes.some((q) => q.textureRecord === SD_HALL_ATLAS_RECORD), 'none: plain brass');
  const C = SD_CHECKPOINTS[2];
  assert.ok(Math.hypot(SD_VANE.at[0] - C.x, SD_VANE.at[2] - C.z) < C.r && SD_VANE.at[1] === C.y, 'on C');
  // its clack, once a gust, with the wind
  const crumble = SD_STEPS_COURSE.find((s) => s.kind === 'crumble'), body = { pos: realmToDungeon(0, crumble.y + 3, crumble.z), grounded: false, groundKey: null, height: 1.8 };
  r.sounds.length = 0;
  for (let k = 0; k < 2 * 60; k++) r.steps.ride(T0 + 4.5 + k / 60, 1 / 60, body);
  assert.deepEqual(r.sounds.filter((x) => x.rec === SD_STEPS_SOUNDS.clack && x.pitch > 2).length, 1, 'its clack once');
  assert.deepEqual(r.sounds.filter((x) => x.rec === SD_STEPS_SOUNDS.wind).length, 1, 'with the wind');
});

test('S9 THE GHOSTS\' PASS: one buffer of every ghostable step\'s twelve edges and its hand, the law\'s own boxes; its shader stands each segment as a quad SD_GHOST.px wide on the screen (never GL_LINES), its hand clockwise from XII by its share, a ghost with no light outside every clip; its light posterized through the ordered dither, fogged (mutants: the line half as wide; the hand running the other way; a ghost unlit still drawn)', () => {
  assert.deepEqual(SD_GHOST_STEPS.map((s) => s.kind), SD_STEPS_COURSE.filter((s) => s.kind === 'beat' || s.kind === 'crumble').map((s) => s.kind));
  const v = sdGhostVertices(), F = 10, N = SD_GHOST_STEPS.length;
  assert.equal(v.length, N * 13 * 6 * F);
  for (let g = 0; g < N; g++) {
    const edges = stepEdges(SD_GHOST_STEPS[g].kind);
    for (let e = 0; e < 12; e++) { const o = ((g * 13 + e) * 6) * F; assert.deepEqual([...v.subarray(o, o + 6)].map((q) => Math.fround(q)), [...edges[e][0], ...edges[e][1]].map((q) => Math.fround(q)), `ghost ${g} edge ${e}: the law's box`); }
    assert.equal(v[((g * 13 + 12) * 6) * F + 9], 1, 'then its hand');
  }
  assert.ok(!/gl\.LINES|drawElements\(gl\.LINE/.test(read('src/render/sdStepsPass.js')), 'never GL_LINES');
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const step = Array.from({ length: N }, () => [0, 0, 0, 0]), state = Array.from({ length: N }, () => [0, 0, 0, 0]);
  step[0] = [0, 0, 0.5, 0]; state[0] = [1, 0.25, 1, 0];
  const f = glslFunctions(SD_STEPS_PASS_VS, { uVP: I, uStep: step, uState: state, uViewport: [200, 100], uWidth: SD_GHOST.px, aA: [-0.5, 0, 0], aB: [0.5, 0, 0], aM: [0, 1, 0, 0] });
  const pos = (aA, aB, aM) => { f.globals.aA = aA; f.globals.aB = aB; f.globals.aM = aM; f.main(); return f.globals.gl_Position.slice(); };
  // a horizontal edge: its quad's corners a pixel above and below its line, capped a pixel past its ends
  const pxX = 2 / 200, pxY = 2 / 100;
  assert.deepEqual(pos([-0.5, 0, 0], [0.5, 0, 0], [0, 1, 0, 0]).map((q) => +q.toFixed(6)), [-0.5 - pxX * SD_GHOST.px / 2, pxY * SD_GHOST.px / 2, 0.5, 1].map((q) => +q.toFixed(6)));
  assert.deepEqual(pos([-0.5, 0, 0], [0.5, 0, 0], [0, -1, 1, 0]).map((q) => +q.toFixed(6)), [0.5 + pxX * SD_GHOST.px / 2, -pxY * SD_GHOST.px / 2, 0.5, 1].map((q) => +q.toFixed(6)));
  // the hand, the eye looking down (world z up the screen, x across): a quarter turn toward +x (III), a half toward -z (VI)
  f.globals.uVP = [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
  const tip = pos([0, 0, 0], [0, 0, 0], [0, 0, 1, 1]);
  assert.ok(near(tip[0], SD_GHOST.hand + pxX * SD_GHOST.px / 2, 1e-6) && near(tip[1], 0.5, 1e-6), `its hand at III (${tip})`);
  state[0] = [1, 0.5, 1, 0]; f.globals.uState = state;
  const six = pos([0, 0, 0], [0, 0, 0], [0, 0, 1, 1]);
  assert.ok(near(six[0], 0, 1e-6) && near(six[1], 0.5 - SD_GHOST.hand - pxY * SD_GHOST.px / 2, 1e-6), `at VI, toward -z (${six})`);
  f.globals.uVP = I;
  state[0] = [0, 0.5, 1, 0]; f.globals.uState = state;
  assert.deepEqual(pos([-0.5, 0, 0], [0.5, 0, 0], [0, 1, 0, 0]), [2, 2, 2, 1], 'unlit: outside every clip');
  // its light: one of its posterized steps, fogged
  const fs = glslFunctions(SD_STEPS_PASS_FS, { vK: 0.6, vWorld: [0, 0, 0], uColor: [...SD_GHOST.color], uSteps: 8, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], gl_FragCoord: [3, 5, 0, 1] });
  fs.main();
  const o = fs.globals.o, l = Math.max(o[0], o[1], o[2]);
  assert.ok(near((l * 8) % 1, 0, 1e-6) || near((l * 8) % 1, 1, 1e-6), `a posterized step (${l})`);
  assert.ok(near(o[1] / o[0], SD_GHOST.color[1] / SD_GHOST.color[0], 1e-6), 'its gold kept');
  assert.ok(SD_GHOST.peak * Math.max(...SD_GHOST.color) >= 0.5 && SD_GHOST.base * Math.max(...SD_GHOST.color) <= 0.5, 'at the ambient rung, reaching the signals\' at the return');
});

test('S9 THE REWIND: my feet fallen to the void\'s floor one frame and on a checkpoint\'s landing the next is a cast-back - a gold burst of its own kind there, its sparks run BACKWARDS (gathering onto me from its stone and from under its rim), its light swelling to its end; a walk onto a checkpoint, a slow frame, a fall still falling are none (mutants: the burst run forward; the slow frame taken; any landing taken)', () => {
  const [, B] = SD_CHECKPOINTS;
  assert.equal(sdCastBackSeen(SD_VOID_Y - 0.4, B.x, B.y, B.z), 1);
  assert.equal(sdCastBackSeen(SD_VOID_Y + SD_REWIND_SEEN.fell + 0.5, B.x, B.y, B.z), -1, 'from above the void: a walk');
  assert.equal(sdCastBackSeen(SD_VOID_Y - 0.4, B.x + 1, B.y, B.z), -1, 'off the landing');
  assert.equal(sdCastBackSeen(SD_VOID_Y - 0.4, 0, SD_VOID_Y - 2, B.z), -1, 'still falling');
  assert.equal(sdCastBackSeen(NaN, B.x, B.y, B.z), -1);
  let now = 5_000_000, feet = realmToDungeon(0, SD_VOID_Y - 0.5, B.z - 10);
  const fx = createSdFx({ link: { state: () => null, now: () => now }, feet: () => feet });
  fx.frame();
  assert.equal(fx.bursts(now).length, 0);
  now += 16; feet = realmToDungeon(B.x, B.y, B.z);
  fx.frame();
  const b = fx.bursts(now + 100);
  assert.equal(b.length, 1);
  assert.equal(b[0].kind, SD_FX_REWIND);
  assert.equal(b[0].color, SD_FX_COLOR.gold);
  assert.ok(near(b[0].at[1], feet[1] + SD_REWIND_SEEN.chest) && b[0].floor === feet[1], 'gathering over my feet, resting on its stone');
  const isle = realmToDungeon(B.x, B.y, B.z);
  assert.deepEqual([...b[0].edge], [isle[0], isle[2], B.r], 'and falling past its rim');
  assert.ok(near(b[0].t, FX_BURST_MS / 1000 - 0.1, 1e-9), 'run backwards');
  assert.ok(fx.bursts(now + FX_BURST_MS - 10)[0].t < 0.02, 'gathered at its end');
  const glow = (t) => { const l = fx.lights(t); assert.equal(l.length, 1); return l[0].color[0]; };   // a kept list: read at once
  const l0 = glow(now + 50), l1 = glow(now + FX_LIGHT_MS - 50);
  assert.ok(l1 > l0 && near(l1, SD_FX_COLOR.gold[0] * SD_FX_REWIND.light[0] * (FX_LIGHT_MS - 50) / FX_LIGHT_MS, 1e-9), `its light swelling (${l0.toFixed(3)} to ${l1.toFixed(3)})`);
  // a slow frame: no cast-back seen across it; a walk onto B: none
  const fx2 = createSdFx({ link: { state: () => null, now: () => now }, feet: () => feet });
  feet = realmToDungeon(0, SD_VOID_Y - 0.5, B.z - 10); fx2.frame();
  now += SD_REWIND_SEEN.gap + 10; feet = realmToDungeon(B.x, B.y, B.z); fx2.frame();
  assert.equal(fx2.bursts(now + 10).length, 0, 'not across a slow frame');
  const fx3 = createSdFx({ link: { state: () => null, now: () => now }, feet: () => feet });
  feet = realmToDungeon(B.x, B.y + 0.3, B.z - 1); fx3.frame(); now += 16; feet = realmToDungeon(B.x, B.y, B.z); fx3.frame();
  assert.equal(fx3.bursts(now + 10).length, 0, 'a walk is no cast-back');
});

test('S9 the hosts by source: the dungeon host hands the Steps the Hollow\'s Ending and the ghosts\' door; the world host draws the ghosts in the Hour\'s reads, fight or none; the lab stands the Steps\' knobs and draws their pass', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const sdSteps = _sdRealm \? createSdSteps\(\{ ending: sdMarksOf\(dfLocation\.sdRealm\)\[0\], renderer, audio \}\) : null;/);
  assert.match(D, /sdStepsDraw: sdSteps \? \(proj, view, fog\) => sdSteps\.drawPass\(proj, view, fog\) : undefined,/);
  const W = read('src/scenes/world.js');
  assert.match(W, /function drawSdArenaReads\(proj, view, fog\) \{\n\s+const ghosts = !!modes\?\.dungeonCtx\?\.sdStepsDraw\?\.\(proj, view, fog\);[^\n]*\n\s+if \(!sdFightLink \|\| _sdReadsBroken \|\| modes\?\.sdRealmSlot\?\.\(\) == null\) return ghosts;/);
  assert.match(W, /return drew \|\| ghosts;\n {2}\}/);
  const L = read('src/tools/abyssLab.js');
  assert.match(L, /if \(steps\.drawPass\(proj, view, courtFogNow\(\)\)\) renderer\.markForeignPass\(\);/);
  assert.match(L, /if \(params\.has\('crumble'\)\) for \(const i of CRUMBLES\) steps\.touch\(i, clock - Number\(params\.get\('crumble'\)\)\);/);
  assert.equal(sdStepKey(3), 'sd:step:3');
});
