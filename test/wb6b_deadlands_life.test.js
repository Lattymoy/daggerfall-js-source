// WB6b (2026-09-25, Mac: "the arena needs to be an oblivion masterpiece ... Whole thing needs to feel alive"): THE
// DEADLANDS' LIFE, DRIVEN. The land out in the fire (the islands: seeded, round the court, clear of the great tower's
// sightline, inside the far plane); the floor's shards (off the court, clear of its spires over the whole period, bobbing
// and turning whole over it, never mirrored); the air's life (the embers from past the court's edge, the ash from over
// it, the pass's blend and depth over a fake GL); the strike's light on the court; the air's sound (the thunder of every
// strike the sky draws, late by its distance; the beds; the driver over a fake engine); and the seams by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  deadlandsIslands, buildDeadlandsLand, deadlandsShards, buildShardModel, shardMatrix,
  ISLAND_COUNT, ISLAND_NEAR, ISLAND_FAR, TOWER_WINDOW, SHARD_COUNT, SHARD_RING, SHARD_RISE, SHARD_WINDOW,
} from '../src/world/deadlandsLand.js';
import {
  DeadlandsRenderer, lifeVertices, deadlandsWind, deadlandsFlash, flashOfSlot, courtLighting, deadClock,
  DEAD_CLOCK_PERIOD, DEAD_SEA_Y, SEA_EMBERS, BRAZIER_EMBERS, ASH_FLAKES, LIFE_BRAZIERS_MAX, EMBER_RING, ASH_TOP, WIND_TURNS,
  FLASH_SLOT_S, FLASH_SLOTS, FLASH_S, FLASH_DIST, FLASH_LIGHT, COURT_KEY_LIGHT, COURT_TRILIGHT, SIGIL_TOWER, DEAD_LIFE_VS, SEA_FADE,
} from '../src/render/deadlands.js';
import {
  deadlandsAirEvents, airSourceAt, airWindGain, createDeadlandsAir, AIR_WIND, AIR_SEA, AIR_BRAZIER, AIR_BACKLOG_S,
  ROAR_SLOT_S, PLOP_SLOT_S, THUNDER_CRACK_NEAR_M, CLIP_ROAR,
} from '../src/scenes/deadlandsAir.js';
import { SPEED_OF_SOUND, THUNDER_SOURCE_M } from '../src/systems/distantStorms.js';
import { courtToDungeon, courtBraziers, LAVA_Y, ARRIVE_Z, RIM_OUT, SPIRES, GATE_BLOCK_SIDE } from '../src/world/gateArena.js';
import { GATE_ARCHIVE } from '../src/world/gateModel.js';
import { COURT_ARCHIVE } from '../src/world/gateArena.js';
import { COURT_R } from '../src/net/gateBrain.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const C = courtToDungeon(0, 0, 0);
const wrap = (a) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
const azOf = (x, z) => Math.atan2(x, -z);
/** A model's vertices through a column-major matrix (or none), in the court's frame. */
function* courtVerts(model, m = null) {
  const P = model.positions;
  for (let v = 0; v < P.length; v += 3) {
    const [x, y, z] = m ? [m[0] * P[v] + m[4] * P[v + 1] + m[8] * P[v + 2] + m[12], m[1] * P[v] + m[5] * P[v + 1] + m[9] * P[v + 2] + m[13], m[2] * P[v] + m[6] * P[v + 1] + m[10] * P[v + 2] + m[14]] : [P[v], P[v + 1], P[v + 2]];
    yield [x - C[0], y - C[1], z - C[2]];
  }
}
/** The court's rim spires as world/gateArena.js buildCourtModel stands them: axis and the square base's corner reach. */
function courtSpires() {
  const out = [];
  for (let k = 0; k < SPIRES; k++) {
    const a = ((k + 0.5) / SPIRES) * Math.PI * 2;
    if (!(Math.abs(Math.atan2(Math.cos(a), Math.sin(a))) > 0.35)) continue;
    const r = RIM_OUT + 1.5 + (k % 3) * 0.8;
    out.push({ b: [Math.cos(a) * r, -14, Math.sin(a) * r], t: [Math.cos(a) * (r + 3.5), 11 + (k % 4) * 2.5, Math.sin(a) * (r + 3.5)], w: 1.6 * Math.SQRT2 });
  }
  return out;
}

test('WB6b the islands: seeded and pure, round the court from ISLAND_NEAR to ISLAND_FAR, none in the great tower\'s window, rising out of the fire and standing over the floor - every vertex inside the host\'s 500 m far plane from anywhere on the court, and none crossing the arrival\'s sightline to the tower (mutants: an island in the window; the land past the far plane)', () => {
  const a = deadlandsIslands(), b = deadlandsIslands();
  assert.deepEqual(a, b, 'the same land on every screen');
  assert.equal(a.length, ISLAND_COUNT);
  for (const isl of a) {
    const d = Math.hypot(isl.x, isl.z);
    assert.ok(d >= ISLAND_NEAR - 1e-9 && d <= ISLAND_FAR + 1e-9, `in the ring: ${d}`);
    assert.ok(Math.abs(wrap(azOf(isl.x, isl.z) - SIGIL_TOWER.az)) >= TOWER_WINDOW, 'out of the tower\'s window');
    assert.ok(isl.spires.length >= 3);
  }
  assert.ok(Math.max(...a.flatMap((i) => i.spires.map((s) => s.tip[1]))) > 20, 'the tallest spire stands well over the floor');
  const land = buildDeadlandsLand();
  assert.deepEqual(land.subMeshes.map((s) => [s.textureArchive, s.textureRecord]), [[GATE_ARCHIVE, 0]], 'all of it the gate\'s own basalt');
  assert.equal(land.indices.length, land.positions.length / 3);
  const eye = [0, 1.7, ARRIVE_Z];
  let far = 0, lowest = Infinity, nearTower = Infinity;
  for (const [x, y, z] of courtVerts(land)) {
    far = Math.max(far, Math.hypot(x, z));
    lowest = Math.min(lowest, y);
    const az = Math.atan2(x - eye[0], -(z - eye[2])), el = Math.atan2(y - eye[1], Math.hypot(x - eye[0], z - eye[2]));
    if (el <= SIGIL_TOWER.top + 0.05) nearTower = Math.min(nearTower, Math.abs(wrap(az - SIGIL_TOWER.az)));
  }
  assert.ok(far + COURT_R < 480, `inside the far plane from the court's far edge: ${far.toFixed(1)}`);
  assert.ok(far < SEA_FADE[0], `standing on the sea before its rim fades into the horizon: ${far.toFixed(1)}`);
  assert.ok(lowest < LAVA_Y, 'rising out of the sea, not floating on it');
  assert.ok(nearTower > SIGIL_TOWER.w * 3, `the arrival sees the tower past the land: ${nearTower.toFixed(3)} rad`);
});

test('WB6b the floor\'s shards: off the court past its rim, off the floor, clear of the tower\'s window and of the bridge, never touching the court\'s spires over the whole period; bobbing and turning whole over it (the matrix a period later the same), a rotation and a scale never mirrored; the flagstones on top, the gate\'s stone under (mutants: a shard in the tower\'s window; a turn off the whole; the matrix mirrored)', () => {
  const s = deadlandsShards();
  assert.deepEqual(s, deadlandsShards(), 'seeded, pure');
  assert.equal(s.length, SHARD_COUNT);
  assert.ok(SHARD_RING[0] > RIM_OUT + 5, 'past the rim');
  for (const sh of s) {
    const d = Math.hypot(sh.x, sh.z), az = azOf(sh.x, sh.z);
    assert.ok(d >= SHARD_RING[0] && d <= SHARD_RING[1] && sh.y >= SHARD_RISE[0] && sh.y <= SHARD_RISE[1]);
    assert.ok(Math.abs(wrap(az - SIGIL_TOWER.az)) >= SHARD_WINDOW, 'out of the tower\'s window');
    assert.ok(Math.abs(wrap(az - Math.PI)) >= 0.45, 'not over the bridge the players came by');
    assert.ok(Number.isInteger(sh.bobTurns) && Number.isInteger(sh.spinTurns) && sh.spinTurns !== 0, 'whole over the period');
    for (const t of [0, 17.3, 333.3]) {
      const m = shardMatrix(sh, t), n = shardMatrix(sh, t + DEAD_CLOCK_PERIOD);
      for (let i = 0; i < 16; i++) assert.ok(Math.abs(m[i] - n[i]) < 1e-6, 'the same a period later');
      const det = m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
      assert.ok(Math.abs(det - sh.size ** 3) < 1e-6 * sh.size ** 3, `a rotation scaled by its size, never mirrored: ${det}`);
      const at = courtToDungeon(sh.x, sh.y, sh.z);
      assert.ok(Math.abs(m[12] - at[0]) < 1e-4 && Math.abs(m[14] - at[2]) < 1e-4 && Math.abs(m[13] - at[1]) <= sh.bob + 1e-4, 'at its place, bobbing (a float32 matrix)');
    }
  }
  const model = buildShardModel();
  assert.deepEqual(model.subMeshes.map((m) => m.textureArchive).sort(), [GATE_ARCHIVE, COURT_ARCHIVE].sort());
  const top = model.subMeshes.find((m) => m.textureArchive === COURT_ARCHIVE);
  for (let i = top.startIndex; i < top.startIndex + top.primitiveCount * 3; i++) assert.ok(model.normals[i * 3 + 1] > 0.9, 'the flagstones face up');
  // never touching a rim spire (a square spike from its base to its tip), over the whole period
  const spires = courtSpires();
  let gap = Infinity;
  for (const sh of s) {
    for (let t = 0; t < DEAD_CLOCK_PERIOD; t += 2) {
      for (const [x, y, z] of courtVerts(model, shardMatrix(sh, t))) {
        for (const sp of spires) {
          const ab = sp.t.map((q, k) => q - sp.b[k]), ap = [x - sp.b[0], y - sp.b[1], z - sp.b[2]];
          const u = Math.max(0, Math.min(1, (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
          gap = Math.min(gap, Math.hypot(ap[0] - ab[0] * u, ap[1] - ab[1] * u, ap[2] - ab[2] * u) - sp.w * (1 - u));
        }
        assert.ok(Math.hypot(x, z) > COURT_R + 2 || y > 4, 'never into the court\'s floor');
      }
    }
  }
  assert.ok(gap > 1.5, `clear of every spire: ${gap.toFixed(2)} m`);
});

test('WB6b the air\'s life: embers off the sea from past the court\'s edge (never up through its floor), a few off each brazier, ash from over it all down to the sea - every life a whole number of lives a period, the drift whole over it (mutants: the embers from under the floor; a life off the whole)', () => {
  const v = lifeVertices();
  assert.equal(v.length / 4, SEA_EMBERS + BRAZIER_EMBERS * LIFE_BRAZIERS_MAX + ASH_FLAKES, 'one vertex a mote');
  assert.deepEqual(v, lifeVertices(), 'seeded, pure');
  const kinds = [0, 0, 0];
  for (let i = 0; i < v.length; i += 4) { kinds[v[i]]++; for (let k = 1; k < 4; k++) assert.ok(v[i + k] >= 0 && v[i + k] < 1); }
  assert.deepEqual(kinds, [SEA_EMBERS, BRAZIER_EMBERS * LIFE_BRAZIERS_MAX, ASH_FLAKES], 'the embers first, then the ash - one draw each');
  assert.ok(EMBER_RING[0] > RIM_OUT, 'the sea\'s embers rise from past the court\'s edge');
  assert.equal(DEAD_SEA_Y, LAVA_Y, 'the sea the embers rise from is the court\'s');
  assert.ok(ASH_TOP > 20, 'the ash starts high over the floor');
  assert.equal((DEAD_LIFE_VS.match(/float life = PERIOD \/ floor\(/g) || []).length, 3, 'every life a whole number a period, all three kinds');
  assert.match(DEAD_LIFE_VS, /float age = mod\(uTime \+ b \* life, life\), u = age \/ life;/);
  assert.ok(Number.isInteger(WIND_TURNS));
  const w0 = deadlandsWind(12.5), w1 = deadlandsWind(12.5 + DEAD_CLOCK_PERIOD);
  assert.ok(Math.abs(w0[0] - w1[0]) < 1e-9 && Math.abs(w0[1] - w1[1]) < 1e-9, 'the drift the same a period later');
  assert.match(DEAD_LIFE_VS, /int bi = int\(floor\(a \* \d+\.0\)\);\n\s+float live = bi < uBrazierCount \? 1\.0 : 0\.0;/, 'a brazier the court has not got lights nothing');
});

/** A GL that records every call. */
function fakeGl() {
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, BLEND: 5, DEPTH_TEST: 6, CULL_FACE: 7, LEQUAL: 8, LESS: 9, POINTS: 10, ONE: 11, ONE_MINUS_SRC_ALPHA: 12, drawingBufferHeight: 720 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('WB6b the life\'s pass: depth-tested and never written, the ash laid over first (premultiplied), the embers added after, the renderer\'s mask back and blending off after; the braziers handed in the court\'s frame, at most LIFE_BRAZIERS_MAX; the world image\'s own height sizes the motes; no centre, nothing drawn (mutants: the life written into depth; the embers laid over; the blend left on)', () => {
  const { gl, calls } = fakeGl();
  const p = new DeadlandsRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  const beds = courtBraziers().map(([, q]) => q);
  assert.equal(p.drawLife(I, I, C, 42, { mode: 2, density: 0.009, range: [0, 1], color: [0.32, 0.05, 0.02], camPos: [0, 2, 0] }, 0.8, [...beds, [1, 2, 3], [4, 5, 6]], 360), true);
  assert.deepEqual(p.lifeDrawn, ['ash', 'embers']);
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  assert.deepEqual(draws.map((c) => [c[1], c[2], c[3]]), [[gl.POINTS, SEA_EMBERS + BRAZIER_EMBERS * LIFE_BRAZIERS_MAX, ASH_FLAKES], [gl.POINTS, 0, SEA_EMBERS + BRAZIER_EMBERS * LIFE_BRAZIERS_MAX]], 'the ash, then the embers');
  const lastBefore = (i, name) => { for (let k = i; k >= 0; k--) if (calls[k][0] === name) return calls[k]; return null; };
  const iAsh = calls.indexOf(draws[0]), iEmb = calls.indexOf(draws[1]);
  assert.deepEqual(lastBefore(iAsh, 'blendFunc'), ['blendFunc', gl.ONE, gl.ONE_MINUS_SRC_ALPHA], 'the ash laid over');
  assert.deepEqual(lastBefore(iEmb, 'blendFunc'), ['blendFunc', gl.ONE, gl.ONE], 'the embers added');
  assert.deepEqual(lastBefore(iAsh, 'depthMask'), ['depthMask', false], 'never written');
  assert.ok(calls.slice(0, iAsh).some((c) => c[0] === 'enable' && c[1] === gl.DEPTH_TEST), 'depth-tested');
  assert.ok(!calls.some((c) => c[0] === 'disable' && c[1] === gl.DEPTH_TEST), 'no depth-blind draw');
  const after = calls.slice(iEmb);
  assert.deepEqual(after.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [true], 'the mask back');
  assert.ok(after.some((c) => c[0] === 'disable' && c[1] === gl.BLEND), 'blending off');
  const count = calls.find((c) => c[0] === 'uniform1i' && c[1] === 'uBrazierCount');
  assert.equal(count[2], LIFE_BRAZIERS_MAX, 'at most LIFE_BRAZIERS_MAX beds');
  const bedsU = calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uBraziers');
  assert.ok([...bedsU[2].slice(0, 3)].every((c, i) => Math.abs(c - beds[0][i]) < 1e-5), 'in the court\'s frame, as handed');
  const px = calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uPxPerM');
  assert.equal(px[2], 180, 'the world image\'s height over the lens');
  const t = calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uTime');
  assert.equal(t[2], deadClock(42));
  calls.length = 0;
  assert.equal(p.drawLife(I, I, null, 1), false);
  assert.ok(!calls.some((c) => c[0] === 'drawArrays'), 'no centre, nothing drawn');
});

test('WB6b the strike\'s light: the slots whole over the period; the flash is its slot\'s strike (the one answer the thunder reads); the court flares with it - the trilight\'s sky lifted, the key stronger and swung toward the strike, all the vortex\'s again in the dark; out of a strike exactly WB6a\'s light (mutants: the slots off the whole; the key never swinging; the flash dropped)', () => {
  assert.ok(Number.isInteger(FLASH_SLOTS) && FLASH_SLOTS * FLASH_SLOT_S === DEAD_CLOCK_PERIOD, 'no stub slot at the wrap');
  let checked = 0;
  for (let n = 0; n < FLASH_SLOTS; n++) {
    const f = flashOfSlot(n);
    assert.deepEqual(flashOfSlot(n + FLASH_SLOTS), f, 'a period on, the same');
    if (!f) continue;
    assert.ok(f.at >= n * FLASH_SLOT_S && f.at + FLASH_S <= (n + 1) * FLASH_SLOT_S + 1e-9, 'inside its slot');
    assert.ok(f.dist >= FLASH_DIST[0] && f.dist <= FLASH_DIST[1]);
    const lit = deadlandsFlash(f.at + 0.01);
    assert.ok(lit && lit.slot === n && lit.az === f.az && lit.elev === f.elev, 'the sky draws the slot\'s strike');
    assert.equal(deadlandsFlash(f.at - 0.01), null, 'and not before');
    checked++;
  }
  assert.ok(checked > FLASH_SLOTS * 0.3);
  const dark = courtLighting(null);
  assert.deepEqual(dark, courtLighting(), 'no strike: WB6a\'s light');
  assert.deepEqual(dark.tri.sky, [...COURT_TRILIGHT.sky]);
  assert.deepEqual(dark.key.dir, [...COURT_KEY_LIGHT.dir]);
  const f = { strength: 1, az: -2, elev: 0.5 };
  const lit = courtLighting(f);
  const to = [Math.sin(f.az) * Math.cos(f.elev), Math.sin(f.elev), -Math.cos(f.az) * Math.cos(f.elev)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  assert.ok(dot(lit.key.dir, to) > dot(dark.key.dir, to) + 0.3, 'the key swung toward the strike');
  assert.ok(Math.abs(Math.hypot(...lit.key.dir) - 1) < 1e-9, 'a unit vector still');
  assert.ok(Math.abs(lit.key.scale - (COURT_KEY_LIGHT.scale + FLASH_LIGHT.key)) < 1e-12, 'stronger by the strike');
  for (let i = 0; i < 3; i++) assert.ok(lit.tri.sky[i] > dark.tri.sky[i] && lit.tri.equator[i] > dark.tri.equator[i], 'the sky and the equator lifted');
  assert.deepEqual(lit.tri.ground, dark.tri.ground, 'the fire\'s light from under unchanged');
  const half = courtLighting({ ...f, strength: 0.5 });
  assert.ok(half.key.scale < lit.key.scale && half.tri.sky[0] < lit.tri.sky[0] && dot(half.key.dir, to) < dot(lit.key.dir, to), 'by the strike\'s strength');
  assert.deepEqual(courtLighting({ strength: NaN }), dark, 'a broken strike lights nothing');
});

test('WB6b the thunder: every strike the sky draws is heard once, late by its distance at the speed of sound, from its own quarter - the roll far, the thunder near, louder the nearer; the roars and the sea\'s plops on slots whole over the period; the events the same however the time is cut (mutants: the thunder on the flash; a strike unheard; a frame\'s events heard twice)', () => {
  const P = DEAD_CLOCK_PERIOD, T0 = 1790000000;
  const all = deadlandsAirEvents(T0, T0 + P);
  let cut = [];
  for (let t = T0; t < T0 + P; t += 1 / 60) cut = cut.concat(deadlandsAirEvents(t, Math.min(T0 + P, t + 1 / 60)));
  assert.deepEqual(cut.map((e) => e.t), all.map((e) => e.t), 'frame by frame, the same events as all at once');
  for (const e of all.slice(0, 12)) assert.equal(deadlandsAirEvents(T0, e.t).length + deadlandsAirEvents(e.t, T0 + P).length, all.length, 'an event on a frame\'s edge heard once, by the frame it ends');
  const thunder = all.filter((e) => e.kind === 'thunder');
  // over one period starting at a period's start, each strike is heard once (the last few land past its end)
  const base = Math.ceil(T0 / P) * P;
  const heard = deadlandsAirEvents(base - 30, base + P + 30).filter((e) => e.kind === 'thunder');
  for (let n = 0; n < FLASH_SLOTS; n++) {
    const f = flashOfSlot(n);
    if (!f) continue;
    const due = base + f.at + f.dist / SPEED_OF_SOUND;
    const hit = heard.filter((e) => Math.abs(e.t - due) < 1e-6);
    assert.equal(hit.length, 1, `slot ${n}'s strike heard once, ${(f.dist / SPEED_OF_SOUND).toFixed(2)} s after its flash`);
    assert.equal(hit[0].az, f.az, 'from the strike\'s quarter');
    assert.equal(hit[0].clip, f.dist < THUNDER_CRACK_NEAR_M ? 349 : 350, 'the thunder near, the roll far');
  }
  for (let i = 1; i < thunder.length; i++) assert.ok(thunder[i].t >= thunder[i - 1].t, 'in time order');
  const byDist = [...heard].sort((a, b) => b.volume - a.volume);
  assert.ok(byDist[0].volume > byDist[byDist.length - 1].volume, 'the nearer the louder');
  assert.ok(Number.isInteger(P / ROAR_SLOT_S) && Number.isInteger(P / PLOP_SLOT_S), 'the roars\' and the plops\' slots whole');
  const roars = all.filter((e) => e.kind === 'roar'), plops = all.filter((e) => e.kind === 'plop');
  assert.ok(roars.length >= 5 && roars.length <= P / ROAR_SLOT_S, `a beast now and then: ${roars.length}`);
  assert.ok(roars.every((e) => e.clip === CLIP_ROAR && e.pitch < 0.8), 'low - something huge, far off');
  assert.ok(plops.length > 30 && plops.every((e) => e.lift < 0), 'the sea below');
  assert.deepEqual(deadlandsAirEvents(T0 + 5, T0 + 5), [], 'an empty span, nothing');
  assert.deepEqual(deadlandsAirEvents(NaN, T0), []);
  // the stand-in: THUNDER_SOURCE_M out in its quarter, `lift` over the ear
  const s = airSourceAt([10, 2, -5], Math.PI / 2, 6);
  assert.deepEqual(s.map((c) => Math.round(c * 1e9) / 1e9), [10 + THUNDER_SOURCE_M, 8, -5], 'a quarter turn is +x');
  assert.ok(Math.abs(airSourceAt([0, 0, 0], 0, 0)[2] + THUNDER_SOURCE_M) < 1e-9, 'azimuth 0 toward the boss (-z)');
});

test('WB6b the air\'s driver: the beds set every frame (the wind breathing on the clock, the sea\'s roar, a loop at each brazier), the events between two frames played once from their stand-ins with the ear\'s offset held (`far`), a gap past AIR_BACKLOG_S playing nothing; stop silences every loop it set and nothing when it set none; a later boot\'s air silences the old one\'s as it is made (mutants: stop leaving a bed looping; the backlog played; an event unheld; the old air outliving its host)', () => {
  const log = [];
  const engine = {
    setLoop: (...a) => log.push(['setLoop', ...a]),
    setLoop3d: (...a) => log.push(['setLoop3d', ...a]),
    play3d: (...a) => log.push(['play3d', ...a]),
  };
  const air = createDeadlandsAir(engine);
  air.stop();
  assert.equal(log.length, 0, 'never on, nothing to stop');
  const beds = courtBraziers().map(([, p]) => courtToDungeon(p[0], 1.2, p[2]));
  const ear = [...C];
  const T0 = 1790000000;
  air.frame(T0, ear, beds);
  assert.ok(air.on);
  const wind = log.find((c) => c[0] === 'setLoop' && c[1] === AIR_WIND.loop);
  assert.equal(wind[2], AIR_WIND.clip);
  assert.ok(Math.abs(wind[3].volume - airWindGain(T0)) < 1e-12 && wind[3].pitch === AIR_WIND.pitch);
  assert.ok(log.some((c) => c[0] === 'setLoop' && c[1] === AIR_SEA.loop && c[2] === AIR_SEA.clip));
  const fires = log.filter((c) => c[0] === 'setLoop3d');
  assert.equal(fires.length, beds.length, 'a fire at each brazier');
  assert.deepEqual(fires[0][3], beds[0]);
  assert.equal(fires[0][4].distanceModel, 'linear', 'a torch\'s short reach');
  assert.ok(!log.some((c) => c[0] === 'play3d'), 'the first frame plays no events - it has no span yet');
  // the breathing: whole over the period, between (1 - depth) and the full gain
  let lo = Infinity, hi = 0;
  for (let t = 0; t < DEAD_CLOCK_PERIOD; t += 0.5) { const g = airWindGain(t); lo = Math.min(lo, g); hi = Math.max(hi, g); assert.ok(Math.abs(g - airWindGain(t + DEAD_CLOCK_PERIOD)) < 1e-9); }
  assert.ok(Math.abs(hi - AIR_WIND.volume) < 1e-3 && Math.abs(lo - AIR_WIND.volume * (1 - AIR_WIND.depth)) < 1e-3);
  // frame by frame through ten seconds: every event of the span played once, from its quarter, held
  let t = T0;
  log.length = 0;
  for (let i = 0; i < 600; i++) { t += 1 / 60; air.frame(t, ear, beds); }
  const want = deadlandsAirEvents(T0, t);
  const played = log.filter((c) => c[0] === 'play3d');
  assert.equal(played.length, want.length, `every event once: ${want.length}`);
  played.forEach((c, i) => {
    assert.equal(c[1], want[i].clip);
    assert.deepEqual(c[2], airSourceAt(ear, want[i].az, want[i].lift));
    assert.equal(c[3], want[i].volume);
    assert.deepEqual(c[4], { refDistance: THUNDER_SOURCE_M, pitch: want[i].pitch, far: true }, 'its offset from the ear held while it sounds');
  });
  // a tab put away: the gap plays nothing of what it passed
  log.length = 0;
  air.frame(t + AIR_BACKLOG_S + 60, ear, beds);
  assert.ok(!log.some((c) => c[0] === 'play3d'), 'no backlog');
  // fewer braziers: the missing one's loop stopped
  log.length = 0;
  air.frame(t + AIR_BACKLOG_S + 60.02, ear, beds.slice(0, 2));
  assert.deepEqual(log.filter((c) => c[0] === 'setLoop3d' && c[2] == null).map((c) => c[1]), [2, 3, 4].map((i) => AIR_BRAZIER.loop + i));
  // stop: every loop it set, silenced
  log.length = 0;
  air.stop();
  assert.ok(!air.on);
  assert.deepEqual(log.filter((c) => c[0] === 'setLoop').map((c) => [c[1], c[2]]), [[AIR_WIND.loop, null], [AIR_SEA.loop, null]]);
  assert.deepEqual(log.filter((c) => c[0] === 'setLoop3d').map((c) => [c[1], c[2]]), [[AIR_BRAZIER.loop + 0, null], [AIR_BRAZIER.loop + 1, null]]);
  // a later boot's air silences the old one's loops as it is made - the old host's loop died without a stop
  log.length = 0;
  air.frame(T0 + 1000, ear, beds);
  const next = createDeadlandsAir(engine);
  assert.ok(!air.on && !next.on, 'the old air silenced by the new one\'s making');
  assert.deepEqual(log.filter((c) => c[0] === 'setLoop' && c[2] == null).map((c) => c[1]), [AIR_WIND.loop, AIR_SEA.loop]);
  // a sound is never the fight
  const bad = createDeadlandsAir({ setLoop() { throw new Error('no audio'); }, setLoop3d() {}, play3d() {} });
  assert.doesNotThrow(() => bad.frame(T0, ear, beds));
});

test('WB6b the seams, by source: the world host keeps the Deadlands\' clock on the relay\'s and hands it to the sky, the life, the court\'s flash and the shards; the air sounds while the court stands and stops the frame it does not - on the main frame, online or not; the life drawn after the telegraph, one seam marked; the court stands the land beside it and moves its shards before the frame\'s draws; the dungeon\'s own ambience is silent in the court (mutants: each seam removed)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const deadlandsSeconds = \(\) => \(performance\.timeOrigin \+ performance\.now\(\) \+ _sharedOffsetMs\) \/ 1000;/, 'the relay\'s clock, never stepping back');
  assert.match(w, /const deadlandsAirFrame = \(\) => \{ if \(modes\?\.gateArenaDay\?\.\(\) != null\) deadlandsAir\.frame\(deadlandsSeconds\(\), cam\.pos, courtFireBeds\); else deadlandsAir\.stop\(\); \};/);
  // ticked on the main frame after the online block, online or not (going offline is one of the court's ways out, and
  // the online frame does not run then), and stopped where the loop itself dies
  assert.match(w, /\n    if \(onlineOn && playerSpawned\) \{ if \(!online\) onlineStart\(\); onlineFrame\(now, dt\); \} else \{[^\n]*\n    deadlandsAirFrame\(\);/, 'on the main frame, after the court\'s ways out');
  assert.ok(!/const gateFrame = \(\) => \{[\s\S]{0,1200}deadlandsAir\.frame/.test(w), 'not on the online frame alone');
  assert.match(w, /const courtFireBeds = courtBraziers\(\)\.map\(\(\[, p\]\) => courtToDungeon\(p\[0\], 1\.2, p\[2\]\)\);/);
  assert.match(w, /const lived = deadlandsPass\(\)\?\.drawLife\(proj, view, courtToDungeon\(0, 0, 0\), deadlandsSeconds\(\), fog, glow, courtBraziers\(\)\.map\(\(\[, p\]\) => p\), renderer\.worldViewportPx\?\.\[3\]\);\n\s+if \(told \|\| lived\) renderer\.markForeignPass\(\);/);
  assert.match(w, /\n    deadlandsSeconds: \(\) => deadlandsSeconds\(\),/);
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /if \(_courtMesh\) ctx\.dynamicDraws\.push\(\{ gpu: _courtMesh, object: \{ matrix: identity\(\) \} \}\);\n\s+standDeadlands\(ctx\);/, 'the land after the court, whose art it is cut from');
  assert.match(wm, /if \(_shardMesh\) for \(const s of deadlandsShards\(\)\) ctx\.dynamicDraws\.push\(\{ gpu: _shardMesh, object: \{ matrix: shardMatrix\(s, host\.deadlandsSeconds\?\.\(\) \?\? 0\) \}, shard: s \}\);/);
  assert.match(wm, /if \(_landMesh\) ctx\.dynamicDraws\.push\(\{ gpu: _landMesh, object: \{ matrix: identity\(\) \} \}\);/);
  const shards = wm.indexOf('\n      if (isGateArena(dungeonLoc)) for (const d of dungeonCtx.dynamicDraws) if (d.shard) shardMatrix(d.shard, _deadS, d.object.matrix);');
  const clock = wm.indexOf('\n      const _deadS = isGateArena(dungeonLoc) ? (host.deadlandsSeconds?.() ?? performance.now() / 1000) : 0;');
  const begin = wm.indexOf('renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);');
  assert.ok(clock > 0 && clock < shards && shards < begin, 'the shards moved before the frame\'s draws, which the shadows record');
  assert.match(wm, /const _cl = courtLighting\(deadlandsFlash\(_deadS\)\);/);
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /\n      if \(!isGateArena\(dfLocation\)\) sceneAmbience\.update\(dt, \{/, 'no drip, no door, no bird in the Deadlands');
  assert.ok(GATE_BLOCK_SIDE > 0);
});
